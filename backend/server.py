from fastapi import FastAPI, APIRouter, HTTPException, Cookie, Response, Header, UploadFile, File, Query
from fastapi.responses import StreamingResponse, RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, timedelta
import requests
import aiofiles
import tempfile
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import Flow
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request as GoogleRequest
import warnings
import base64
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ========== MODELS ==========

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "team_member"
    skills: List[str] = []
    created_at: datetime

class SessionCreate(BaseModel):
    session_id: str

class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    project_id: str
    name: str
    description: str
    status: str = "ongoing"  # ongoing, on_hold, completed
    client_name: Optional[str] = None
    budget: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    completion_percentage: float = 0.0
    milestones: List[dict] = []
    created_by: str
    team_members: List[str] = []
    created_at: datetime

class ProjectCreate(BaseModel):
    name: str
    description: str
    client_name: Optional[str] = None
    budget: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

class Proposal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    proposal_id: str
    title: str
    client_name: str
    requirement: Optional[str] = None
    scope_area: Optional[str] = None
    final_proposal: Optional[str] = None
    category: Optional[str] = None  # Individual-Residential, Housing, Commercial, Institutional, Hospitality
    description: str
    version: int = 1
    version_history: List[dict] = []  # Stores previous versions
    status: str = "draft"  # draft, pending_approval, approved, sent_to_client, signed, rejected, converted
    amount: Optional[float] = None
    created_by: str
    approved_by: Optional[List[str]] = []
    approver_id: Optional[str] = None
    approver_comments: Optional[str] = None
    approval_status: Optional[str] = None  # pending, approved, returned
    signature_type: Optional[str] = None  # zoho_sign, manual
    manual_approval_date: Optional[str] = None
    project_id: Optional[str] = None
    drive_file_id: Optional[str] = None
    drive_file_name: Optional[str] = None
    drive_file_link: Optional[str] = None
    pdf_attachment: Optional[str] = None
    attachments: List[dict] = []  # For file attachments
    created_at: datetime
    updated_at: Optional[datetime] = None

class ProposalCreate(BaseModel):
    title: str
    client_name: str
    requirement: Optional[str] = None
    scope_area: Optional[str] = None
    final_proposal: Optional[str] = None
    category: Optional[str] = None
    description: str
    amount: Optional[float] = None

class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    task_id: str
    project_id: str
    title: str
    description: Optional[str] = None
    status: str = "not_started"  # not_started, in_progress, on_hold, under_review, completed
    priority: str = "medium"
    assigned_to: Optional[str] = None
    reviewer_id: Optional[str] = None
    comments: List[dict] = []  # {comment_id, user_id, user_name, comment, timestamp, edited}
    attachments: List[dict] = []  # {attachment_id, filename, url, uploaded_by, uploaded_at}
    review_notes: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    completion_percentage: float = 0.0
    is_overdue: bool = False
    due_date: Optional[str] = None
    parent_task_id: Optional[str] = None
    subtasks: List[str] = []
    time_logs: List[dict] = []
    total_tracked_time: int = 0  # Total time in minutes
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime] = None

class TaskCreate(BaseModel):
    project_id: str
    title: str
    description: Optional[str] = None
    priority: str = "medium"
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    parent_task_id: Optional[str] = None

class TimeLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    log_id: str
    task_id: str
    project_id: Optional[str] = None
    client_name: Optional[str] = None
    user_id: str
    duration_minutes: int
    description: Optional[str] = None
    date: str
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    billable: bool = True
    created_at: datetime

class TimeLogCreate(BaseModel):
    task_id: str
    duration_minutes: int
    description: Optional[str] = None
    date: str
    billable: bool = True

class ActiveTimer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    timer_id: str
    user_id: str
    task_id: str
    project_id: Optional[str] = None
    client_name: Optional[str] = None
    start_time: datetime
    description: Optional[str] = None

# ========== HELPER FUNCTIONS ==========

async def get_user_from_token(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    token = session_token
    if not token and authorization:
        if authorization.startswith("Bearer "):
            token = authorization.replace("Bearer ", "")
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session_doc = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session_doc:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=404, detail="User not found")
    
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    return User(**user_doc)

# ========== AUTH ROUTES ==========

@api_router.post("/auth/session")
async def create_session(payload: SessionCreate, response: Response):
    try:
        headers = {"X-Session-ID": payload.session_id}
        resp = requests.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers=headers,
            timeout=10
        )
        resp.raise_for_status()
        data = resp.json()
        
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        existing_user = await db.users.find_one({"email": data["email"]}, {"_id": 0})
        
        if existing_user:
            user_id = existing_user["user_id"]
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {
                    "name": data["name"],
                    "picture": data.get("picture")
                }}
            )
        else:
            user_doc = {
                "user_id": user_id,
                "email": data["email"],
                "name": data["name"],
                "picture": data.get("picture"),
                "role": "admin",
                "skills": [],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(user_doc)
        
        session_token = data["session_token"]
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        await db.user_sessions.insert_one({
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7*24*60*60
        )
        
        user_response = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if isinstance(user_response['created_at'], str):
            user_response['created_at'] = datetime.fromisoformat(user_response['created_at'])
        
        return User(**user_response)
    
    except requests.exceptions.RequestException as e:
        logger.error(f"Emergent Auth error: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")

@api_router.get("/auth/me", response_model=User)
async def get_current_user(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    return user

@api_router.post("/auth/logout")
async def logout(response: Response, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    await db.user_sessions.delete_many({"user_id": user.user_id})
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out successfully"}

# ========== PROJECT ROUTES ==========

@api_router.post("/projects", response_model=Project)
async def create_project(payload: ProjectCreate, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    project_id = f"proj_{uuid.uuid4().hex[:12]}"
    project_doc = {
        "project_id": project_id,
        "name": payload.name,
        "description": payload.description,
        "status": "active",
        "client_name": payload.client_name,
        "budget": payload.budget,
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "milestones": [],
        "created_by": user.user_id,
        "team_members": [user.user_id],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.projects.insert_one(project_doc)
    project_doc['created_at'] = datetime.fromisoformat(project_doc['created_at'])
    return Project(**project_doc)

@api_router.get("/projects", response_model=List[Project])
async def get_projects(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    for proj in projects:
        if isinstance(proj['created_at'], str):
            proj['created_at'] = datetime.fromisoformat(proj['created_at'])
    return projects

@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    if isinstance(project['created_at'], str):
        project['created_at'] = datetime.fromisoformat(project['created_at'])
    return Project(**project)

@api_router.patch("/projects/{project_id}")
async def update_project(project_id: str, updates: dict, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.projects.update_one({"project_id": project_id}, {"$set": updates})
    return {"message": "Project updated"}

@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Delete all tasks associated with this project
    await db.tasks.delete_many({"project_id": project_id})
    
    # Delete all time logs associated with this project
    await db.time_logs.delete_many({"project_id": project_id})
    
    # Delete the project
    await db.projects.delete_one({"project_id": project_id})
    
    return {"message": "Project and associated tasks deleted"}

# ========== PROPOSAL ROUTES ==========

@api_router.post("/proposals", response_model=Proposal)
async def create_proposal(payload: ProposalCreate, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    proposal_id = f"prop_{uuid.uuid4().hex[:12]}"
    proposal_doc = {
        "proposal_id": proposal_id,
        "title": payload.title,
        "client_name": payload.client_name,
        "description": payload.description,
        "requirement": payload.requirement,
        "scope_area": payload.scope_area,
        "final_proposal": payload.final_proposal,
        "category": payload.category,
        "version": 1,
        "status": "draft",
        "amount": payload.amount,
        "created_by": user.user_id,
        "approved_by": [],
        "project_id": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.proposals.insert_one(proposal_doc)
    proposal_doc['created_at'] = datetime.fromisoformat(proposal_doc['created_at'])
    return Proposal(**proposal_doc)

@api_router.get("/proposals", response_model=List[Proposal])
async def get_proposals(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    proposals = await db.proposals.find({}, {"_id": 0}).to_list(1000)
    for prop in proposals:
        if isinstance(prop['created_at'], str):
            prop['created_at'] = datetime.fromisoformat(prop['created_at'])
    return proposals

@api_router.post("/proposals/{proposal_id}/approve")
async def approve_proposal(proposal_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    proposal = await db.proposals.find_one({"proposal_id": proposal_id}, {"_id": 0})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    approved_by = proposal.get("approved_by", [])
    if user.user_id not in approved_by:
        approved_by.append(user.user_id)
    
    await db.proposals.update_one(
        {"proposal_id": proposal_id},
        {"$set": {"approved_by": approved_by, "status": "approved"}}
    )
    
    return {"message": "Proposal approved"}

@api_router.post("/proposals/{proposal_id}/convert", response_model=Project)
async def convert_to_project(proposal_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    proposal = await db.proposals.find_one({"proposal_id": proposal_id}, {"_id": 0})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    if proposal["status"] not in ["approved", "signed"]:
        raise HTTPException(status_code=400, detail="Proposal must be approved or signed first")
    
    project_id = f"proj_{uuid.uuid4().hex[:12]}"
    project_doc = {
        "project_id": project_id,
        "name": proposal["title"],
        "description": proposal["description"],
        "status": "active",
        "client_name": proposal["client_name"],
        "budget": proposal.get("amount"),
        "start_date": None,
        "end_date": None,
        "completion_percentage": 0.0,
        "milestones": [],
        "created_by": user.user_id,
        "team_members": [user.user_id],
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.projects.insert_one(project_doc)
    await db.proposals.update_one(
        {"proposal_id": proposal_id},
        {"$set": {"project_id": project_id, "status": "converted"}}
    )
    
    project_doc['created_at'] = datetime.fromisoformat(project_doc['created_at'])
    return Project(**project_doc)

@api_router.patch("/proposals/{proposal_id}")
async def update_proposal(proposal_id: str, updates: dict, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    # Get current proposal to save version history
    current_proposal = await db.proposals.find_one({"proposal_id": proposal_id}, {"_id": 0})
    if not current_proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    # Check if content fields changed (for versioning)
    version_fields = ['title', 'description', 'requirement', 'scope_area', 'final_proposal', 'amount', 'category']
    content_changed = any(
        field in updates and updates[field] != current_proposal.get(field)
        for field in version_fields
    )
    
    if content_changed:
        # Save current state to version history
        version_snapshot = {
            "version": current_proposal.get("version", 1),
            "title": current_proposal.get("title"),
            "description": current_proposal.get("description"),
            "requirement": current_proposal.get("requirement"),
            "scope_area": current_proposal.get("scope_area"),
            "final_proposal": current_proposal.get("final_proposal"),
            "amount": current_proposal.get("amount"),
            "category": current_proposal.get("category"),
            "saved_at": datetime.now(timezone.utc).isoformat(),
            "saved_by": user.user_id
        }
        
        # Increment version number
        new_version = current_proposal.get("version", 1) + 1
        updates["version"] = new_version
        
        # Add to version history
        await db.proposals.update_one(
            {"proposal_id": proposal_id},
            {"$push": {"version_history": version_snapshot}}
        )
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.proposals.update_one({"proposal_id": proposal_id}, {"$set": updates})
    return {"message": "Proposal updated", "version": updates.get("version", current_proposal.get("version", 1))}

@api_router.get("/proposals/{proposal_id}/versions")
async def get_proposal_versions(proposal_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    proposal = await db.proposals.find_one({"proposal_id": proposal_id}, {"_id": 0})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    return {
        "current_version": proposal.get("version", 1),
        "version_history": proposal.get("version_history", [])
    }

@api_router.post("/proposals/{proposal_id}/restore-version/{version_number}")
async def restore_proposal_version(proposal_id: str, version_number: int, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    proposal = await db.proposals.find_one({"proposal_id": proposal_id}, {"_id": 0})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    version_history = proposal.get("version_history", [])
    target_version = next((v for v in version_history if v["version"] == version_number), None)
    
    if not target_version:
        raise HTTPException(status_code=404, detail="Version not found")
    
    # Save current state before restoring
    current_snapshot = {
        "version": proposal.get("version", 1),
        "title": proposal.get("title"),
        "description": proposal.get("description"),
        "requirement": proposal.get("requirement"),
        "scope_area": proposal.get("scope_area"),
        "final_proposal": proposal.get("final_proposal"),
        "amount": proposal.get("amount"),
        "category": proposal.get("category"),
        "saved_at": datetime.now(timezone.utc).isoformat(),
        "saved_by": user.user_id,
        "note": "Auto-saved before restore"
    }
    
    new_version = proposal.get("version", 1) + 1
    
    # Restore the target version content
    restore_data = {
        "title": target_version.get("title"),
        "description": target_version.get("description"),
        "requirement": target_version.get("requirement"),
        "scope_area": target_version.get("scope_area"),
        "final_proposal": target_version.get("final_proposal"),
        "amount": target_version.get("amount"),
        "category": target_version.get("category"),
        "version": new_version,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.proposals.update_one(
        {"proposal_id": proposal_id},
        {
            "$set": restore_data,
            "$push": {"version_history": current_snapshot}
        }
    )
    
    return {"message": f"Restored to version {version_number}", "new_version": new_version}

@api_router.get("/proposals/{proposal_id}", response_model=Proposal)
async def get_proposal_detail(proposal_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    proposal = await db.proposals.find_one({"proposal_id": proposal_id}, {"_id": 0})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    if isinstance(proposal['created_at'], str):
        proposal['created_at'] = datetime.fromisoformat(proposal['created_at'])
    return Proposal(**proposal)

@api_router.delete("/proposals/{proposal_id}")
async def delete_proposal(proposal_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    proposal = await db.proposals.find_one({"proposal_id": proposal_id}, {"_id": 0})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    await db.proposals.delete_one({"proposal_id": proposal_id})
    return {"message": "Proposal deleted"}

@api_router.post("/proposals/{proposal_id}/send-to-client")
async def send_proposal_to_client(proposal_id: str, client_email: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    proposal = await db.proposals.find_one({"proposal_id": proposal_id}, {"_id": 0})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    await db.proposals.update_one(
        {"proposal_id": proposal_id},
        {"$set": {
            "status": "sent_to_client",
            "client_email": client_email,
            "sent_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Send email to client (demo mode)
    await send_email_via_gmail(
        user.user_id,
        client_email,
        f"Proposal: {proposal['title']}",
        f"Dear {proposal['client_name']},\n\n"
        f"Please find attached our proposal: {proposal['title']}\n\n"
        f"Amount: ${proposal.get('amount', 0):,.2f}\n\n"
        f"Please review and let us know if you have any questions.\n\n"
        f"Best regards,\n{user.name}"
    )
    
    return {"message": "Proposal sent to client"}

@api_router.post("/proposals/{proposal_id}/confirm")
async def confirm_proposal(proposal_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    proposal = await db.proposals.find_one({"proposal_id": proposal_id}, {"_id": 0})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    await db.proposals.update_one(
        {"proposal_id": proposal_id},
        {"$set": {
            "status": "confirmed",
            "confirmed_at": datetime.now(timezone.utc).isoformat(),
            "confirmed_by": user.user_id
        }}
    )
    
    return {"message": "Proposal confirmed"}

@api_router.post("/proposals/{proposal_id}/send-for-internal-approval")
async def send_for_internal_approval(proposal_id: str, approver_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    await db.proposals.update_one(
        {"proposal_id": proposal_id},
        {"$set": {
            "status": "pending_approval",
            "approver_id": approver_id,
            "approval_status": "pending"
        }}
    )
    
    # Send notification to approver
    approver = await db.users.find_one({"user_id": approver_id}, {"_id": 0})
    if approver and approver.get("email"):
        proposal = await db.proposals.find_one({"proposal_id": proposal_id}, {"_id": 0})
        await send_email_via_gmail(
            user.user_id,
            approver["email"],
            f"Proposal Approval Request: {proposal['title']}",
            f"Hello {approver['name']},\n\nPlease review and approve the proposal: {proposal['title']}\n\n"
            f"Client: {proposal['client_name']}\n"
            f"Amount: ${proposal.get('amount', 0):,.2f}\n\n"
            f"Log in to the system to review and approve.\n\nBest regards,\n{user.name}"
        )
    
    return {"message": "Proposal sent for internal approval"}

@api_router.post("/proposals/{proposal_id}/approve-internal")
async def approve_internal(proposal_id: str, comments: Optional[str] = None, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    await db.proposals.update_one(
        {"proposal_id": proposal_id},
        {"$set": {
            "status": "approved",
            "approval_status": "approved",
            "approver_comments": comments
        }}
    )
    
    return {"message": "Proposal approved"}

@api_router.post("/proposals/{proposal_id}/return-to-sender")
async def return_to_sender(proposal_id: str, comments: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    await db.proposals.update_one(
        {"proposal_id": proposal_id},
        {"$set": {
            "status": "draft",
            "approval_status": "returned",
            "approver_comments": comments
        }}
    )
    
    return {"message": "Proposal returned to sender"}

@api_router.post("/proposals/{proposal_id}/manual-approval")
async def manual_approval(proposal_id: str, approval_date: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    await db.proposals.update_one(
        {"proposal_id": proposal_id},
        {"$set": {
            "status": "signed",
            "signature_type": "manual",
            "manual_approval_date": approval_date
        }}
    )
    
    return {"message": "Manual approval recorded"}

@api_router.post("/proposals/{proposal_id}/reject")
async def reject_proposal(proposal_id: str, reason: Optional[str] = None, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    await db.proposals.update_one(
        {"proposal_id": proposal_id},
        {"$set": {
            "status": "rejected",
            "approver_comments": reason
        }}
    )
    
    return {"message": "Proposal rejected"}

# ========== TASK ROUTES ==========

@api_router.post("/tasks", response_model=Task)
async def create_task(payload: TaskCreate, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    task_id = f"task_{uuid.uuid4().hex[:12]}"
    task_doc = {
        "task_id": task_id,
        "project_id": payload.project_id,
        "title": payload.title,
        "description": payload.description,
        "status": "todo",
        "priority": payload.priority,
        "assigned_to": payload.assigned_to,
        "due_date": payload.due_date,
        "parent_task_id": payload.parent_task_id,
        "subtasks": [],
        "time_logs": [],
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tasks.insert_one(task_doc)
    
    if payload.parent_task_id:
        await db.tasks.update_one(
            {"task_id": payload.parent_task_id},
            {"$push": {"subtasks": task_id}}
        )
    
    task_doc['created_at'] = datetime.fromisoformat(task_doc['created_at'])
    return Task(**task_doc)

@api_router.get("/tasks", response_model=List[Task])
async def get_tasks(project_id: Optional[str] = None, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    query = {}
    if project_id:
        query["project_id"] = project_id
    
    tasks = await db.tasks.find(query, {"_id": 0}).to_list(1000)
    for task in tasks:
        if isinstance(task['created_at'], str):
            task['created_at'] = datetime.fromisoformat(task['created_at'])
    return tasks

@api_router.patch("/tasks/{task_id}")
async def update_task(task_id: str, updates: dict, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.tasks.update_one({"task_id": task_id}, {"$set": updates})
    
    # Update project completion if status changed
    if "status" in updates:
        task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
        if task:
            await update_project_completion(task["project_id"])
            # Also update parent task if this is a subtask
            if task.get("parent_task_id"):
                await update_parent_task_completion(task["parent_task_id"])
    
    return {"message": "Task updated"}

@api_router.get("/tasks/{task_id}")
async def get_task_detail(task_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Get subtasks if any
    if task.get("subtasks"):
        subtask_docs = await db.tasks.find({"task_id": {"$in": task["subtasks"]}}, {"_id": 0}).to_list(100)
        task["subtask_details"] = subtask_docs
    
    if isinstance(task['created_at'], str):
        task['created_at'] = datetime.fromisoformat(task['created_at'])
    
    return task

async def update_parent_task_completion(parent_task_id: str):
    """Update parent task completion based on subtasks"""
    parent = await db.tasks.find_one({"task_id": parent_task_id}, {"_id": 0})
    if not parent or not parent.get("subtasks"):
        return
    
    subtasks = await db.tasks.find({"task_id": {"$in": parent["subtasks"]}}, {"_id": 0}).to_list(100)
    if not subtasks:
        return
    
    completed = len([t for t in subtasks if t.get("status") == "completed"])
    total = len(subtasks)
    completion_pct = (completed / total * 100) if total > 0 else 0
    
    await db.tasks.update_one(
        {"task_id": parent_task_id},
        {"$set": {"completion_percentage": round(completion_pct, 2)}}
    )

@api_router.post("/tasks/{task_id}/add-comment")
async def add_task_comment(task_id: str, comment: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    comment_id = f"cmt_{uuid.uuid4().hex[:12]}"
    comment_obj = {
        "comment_id": comment_id,
        "user_id": user.user_id,
        "user_name": user.name,
        "comment": comment,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "edited": False
    }
    
    await db.tasks.update_one(
        {"task_id": task_id},
        {"$push": {"comments": comment_obj}}
    )
    
    return {"message": "Comment added", "comment_id": comment_id}

@api_router.patch("/tasks/{task_id}/comments/{comment_id}")
async def edit_task_comment(task_id: str, comment_id: str, new_comment: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    comments = task.get("comments", [])
    updated = False
    for c in comments:
        if c.get("comment_id") == comment_id:
            if c.get("user_id") != user.user_id:
                raise HTTPException(status_code=403, detail="Can only edit your own comments")
            c["comment"] = new_comment
            c["edited"] = True
            c["edited_at"] = datetime.now(timezone.utc).isoformat()
            updated = True
            break
    
    if not updated:
        raise HTTPException(status_code=404, detail="Comment not found")
    
    await db.tasks.update_one({"task_id": task_id}, {"$set": {"comments": comments}})
    return {"message": "Comment updated"}

@api_router.delete("/tasks/{task_id}/comments/{comment_id}")
async def delete_task_comment(task_id: str, comment_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    comments = task.get("comments", [])
    original_len = len(comments)
    comments = [c for c in comments if not (c.get("comment_id") == comment_id and c.get("user_id") == user.user_id)]
    
    if len(comments) == original_len:
        raise HTTPException(status_code=404, detail="Comment not found or not authorized")
    
    await db.tasks.update_one({"task_id": task_id}, {"$set": {"comments": comments}})
    return {"message": "Comment deleted"}

@api_router.post("/tasks/{task_id}/return-to-owner")
async def return_task_to_owner(task_id: str, notes: Optional[str] = None, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = {
        "status": "in_progress",
        "review_notes": notes,
        "updated_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tasks.update_one({"task_id": task_id}, {"$set": update_data})
    
    # Add comment about return
    if notes:
        comment_obj = {
            "comment_id": f"cmt_{uuid.uuid4().hex[:12]}",
            "user_id": user.user_id,
            "user_name": user.name,
            "comment": f"[Returned for revision] {notes}",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "edited": False,
            "is_system": True
        }
        await db.tasks.update_one({"task_id": task_id}, {"$push": {"comments": comment_obj}})
    
    return {"message": "Task returned to owner"}

@api_router.post("/tasks/{task_id}/send-for-review")
async def send_for_review(task_id: str, reviewer_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": {
            "status": "under_review",
            "reviewer_id": reviewer_id
        }}
    )
    
    # Notify reviewer
    reviewer = await db.users.find_one({"user_id": reviewer_id}, {"_id": 0})
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if reviewer and reviewer.get("email") and task:
        await send_email_via_gmail(
            user.user_id,
            reviewer["email"],
            f"Task Review Request: {task['title']}",
            f"Hello {reviewer['name']},\n\nPlease review the task: {task['title']}\n\n"
            f"Project: {task.get('project_id', 'N/A')}\n\n"
            f"Log in to review and provide feedback.\n\nBest regards,\n{user.name}"
        )
    
    return {"message": "Task sent for review"}

@api_router.post("/tasks/{task_id}/approve-review")
async def approve_task_review(task_id: str, notes: Optional[str] = None, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": {
            "status": "completed",
            "review_notes": notes,
            "completion_percentage": 100.0
        }}
    )
    
    # Update project completion
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if task:
        await update_project_completion(task["project_id"])
    
    return {"message": "Task approved"}

@api_router.post("/tasks/{task_id}/return-for-revision")
async def return_for_revision(task_id: str, notes: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    await db.tasks.update_one(
        {"task_id": task_id},
        {"$set": {
            "status": "in_progress",
            "review_notes": notes
        }}
    )
    
    return {"message": "Task returned for revision"}

async def update_project_completion(project_id: str):
    """Calculate and update project completion percentage"""
    tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    
    if not tasks:
        return
    
    total_tasks = len(tasks)
    completed_tasks = len([t for t in tasks if t.get("status") == "completed"])
    in_progress_tasks = len([t for t in tasks if t.get("status") == "in_progress"])
    not_started_tasks = len([t for t in tasks if t.get("status") == "not_started"])
    
    completion_percentage = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
    
    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": {"completion_percentage": round(completion_percentage, 2)}}
    )

@api_router.get("/projects/{project_id}/stats")
async def get_project_stats(project_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    tasks = await db.tasks.find({"project_id": project_id}, {"_id": 0}).to_list(1000)
    
    total_tasks = len(tasks)
    completed = len([t for t in tasks if t.get("status") == "completed"])
    in_progress = len([t for t in tasks if t.get("status") == "in_progress"])
    under_review = len([t for t in tasks if t.get("status") == "under_review"])
    on_hold = len([t for t in tasks if t.get("status") == "on_hold"])
    not_started = len([t for t in tasks if t.get("status") == "not_started"])
    
    # Check for overdue tasks
    today = datetime.now(timezone.utc).date()
    overdue_tasks = []
    for task in tasks:
        if task.get("end_date") and task.get("status") not in ["completed"]:
            end_date = datetime.fromisoformat(task["end_date"]).date() if isinstance(task["end_date"], str) else task["end_date"]
            if end_date < today:
                overdue_tasks.append(task["task_id"])
                await db.tasks.update_one({"task_id": task["task_id"]}, {"$set": {"is_overdue": True}})
    
    completion_percentage = (completed / total_tasks * 100) if total_tasks > 0 else 0
    in_progress_percentage = (in_progress / total_tasks * 100) if total_tasks > 0 else 0
    not_started_percentage = (not_started / total_tasks * 100) if total_tasks > 0 else 0
    
    return {
        "total_tasks": total_tasks,
        "completed": completed,
        "in_progress": in_progress,
        "under_review": under_review,
        "on_hold": on_hold,
        "not_started": not_started,
        "overdue": len(overdue_tasks),
        "completion_percentage": round(completion_percentage, 2),
        "in_progress_percentage": round(in_progress_percentage, 2),
        "not_started_percentage": round(not_started_percentage, 2)
    }

@api_router.get("/dashboard/my-tasks")
async def get_my_tasks(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    tasks = await db.tasks.find({"assigned_to": user.user_id}, {"_id": 0}).to_list(1000)
    for task in tasks:
        if isinstance(task.get('created_at'), str):
            task['created_at'] = datetime.fromisoformat(task['created_at'])
    
    return tasks

@api_router.get("/dashboard/team-tasks")
async def get_team_tasks(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "team_lead"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get all users
    team_members = await db.users.find({}, {"_id": 0}).to_list(1000)
    
    team_tasks = []
    for member in team_members:
        tasks = await db.tasks.find({
            "assigned_to": member["user_id"],
            "status": {"$ne": "not_started"}
        }, {"_id": 0}).to_list(1000)
        
        for task in tasks:
            if isinstance(task.get('created_at'), str):
                task['created_at'] = datetime.fromisoformat(task['created_at'])
        
        team_tasks.append({
            "user": member,
            "tasks": tasks
        })
    
    return team_tasks

# ========== TIME TRACKING ROUTES ==========

@api_router.post("/time-logs", response_model=TimeLog)
async def create_time_log(payload: TimeLogCreate, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    # Get task details for project/client info
    task = await db.tasks.find_one({"task_id": payload.task_id}, {"_id": 0})
    project_id = task.get("project_id") if task else None
    client_name = None
    if project_id:
        project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
        client_name = project.get("client_name") if project else None
    
    log_id = f"log_{uuid.uuid4().hex[:12]}"
    log_doc = {
        "log_id": log_id,
        "task_id": payload.task_id,
        "project_id": project_id,
        "client_name": client_name,
        "user_id": user.user_id,
        "duration_minutes": payload.duration_minutes,
        "description": payload.description,
        "date": payload.date,
        "billable": payload.billable,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.time_logs.insert_one(log_doc)
    
    # Update task's total tracked time
    await db.tasks.update_one(
        {"task_id": payload.task_id},
        {"$inc": {"total_tracked_time": payload.duration_minutes}}
    )
    
    log_doc['created_at'] = datetime.fromisoformat(log_doc['created_at'])
    return TimeLog(**log_doc)

@api_router.get("/time-logs", response_model=List[TimeLog])
async def get_time_logs(task_id: Optional[str] = None, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    query = {}
    if task_id:
        query["task_id"] = task_id
    
    logs = await db.time_logs.find(query, {"_id": 0}).to_list(1000)
    for log in logs:
        if isinstance(log['created_at'], str):
            log['created_at'] = datetime.fromisoformat(log['created_at'])
    return logs

# ========== TIMER ROUTES (Start/Stop) ==========

@api_router.post("/timer/start")
async def start_timer(task_id: str, description: Optional[str] = None, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    # Check if user already has an active timer
    existing_timer = await db.active_timers.find_one({"user_id": user.user_id}, {"_id": 0})
    if existing_timer:
        raise HTTPException(status_code=400, detail="You already have an active timer. Stop it first.")
    
    # Get task details
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    project_id = task.get("project_id")
    client_name = None
    if project_id:
        project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
        client_name = project.get("client_name") if project else None
    
    timer_id = f"timer_{uuid.uuid4().hex[:12]}"
    timer_doc = {
        "timer_id": timer_id,
        "user_id": user.user_id,
        "task_id": task_id,
        "task_title": task.get("title"),
        "project_id": project_id,
        "client_name": client_name,
        "start_time": datetime.now(timezone.utc).isoformat(),
        "description": description
    }
    
    await db.active_timers.insert_one(timer_doc)
    
    return {
        "message": "Timer started",
        "timer_id": timer_id,
        "start_time": timer_doc["start_time"],
        "task_id": task_id,
        "task_title": task.get("title")
    }

@api_router.post("/timer/stop")
async def stop_timer(description: Optional[str] = None, billable: bool = True, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    # Get active timer
    timer = await db.active_timers.find_one({"user_id": user.user_id}, {"_id": 0})
    if not timer:
        raise HTTPException(status_code=404, detail="No active timer found")
    
    start_time = datetime.fromisoformat(timer["start_time"])
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    end_time = datetime.now(timezone.utc)
    duration = end_time - start_time
    duration_minutes = int(duration.total_seconds() / 60)
    
    # Create time log
    log_id = f"log_{uuid.uuid4().hex[:12]}"
    log_doc = {
        "log_id": log_id,
        "task_id": timer["task_id"],
        "project_id": timer.get("project_id"),
        "client_name": timer.get("client_name"),
        "user_id": user.user_id,
        "duration_minutes": duration_minutes,
        "description": description or timer.get("description", ""),
        "date": end_time.strftime("%Y-%m-%d"),
        "start_time": timer["start_time"],
        "end_time": end_time.isoformat(),
        "billable": billable,
        "created_at": end_time.isoformat()
    }
    
    await db.time_logs.insert_one(log_doc)
    
    # Update task's total tracked time
    await db.tasks.update_one(
        {"task_id": timer["task_id"]},
        {"$inc": {"total_tracked_time": duration_minutes}}
    )
    
    # Delete active timer
    await db.active_timers.delete_one({"user_id": user.user_id})
    
    return {
        "message": "Timer stopped",
        "duration_minutes": duration_minutes,
        "log_id": log_id,
        "task_id": timer["task_id"]
    }

@api_router.get("/timer/active")
async def get_active_timer(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    timer = await db.active_timers.find_one({"user_id": user.user_id}, {"_id": 0})
    if not timer:
        return {"active": False}
    
    start_time = datetime.fromisoformat(timer["start_time"])
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    elapsed = datetime.now(timezone.utc) - start_time
    elapsed_minutes = int(elapsed.total_seconds() / 60)
    
    return {
        "active": True,
        "timer_id": timer["timer_id"],
        "task_id": timer["task_id"],
        "task_title": timer.get("task_title"),
        "project_id": timer.get("project_id"),
        "client_name": timer.get("client_name"),
        "start_time": timer["start_time"],
        "elapsed_minutes": elapsed_minutes,
        "description": timer.get("description")
    }

@api_router.delete("/timer/cancel")
async def cancel_timer(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    result = await db.active_timers.delete_one({"user_id": user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No active timer found")
    
    return {"message": "Timer cancelled"}

# ========== TEAM ROUTES ==========

@api_router.get("/team", response_model=List[User])
async def get_team_members(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    for u in users:
        if isinstance(u['created_at'], str):
            u['created_at'] = datetime.fromisoformat(u['created_at'])
    return users

@api_router.patch("/team/{user_id}")
async def update_team_member(user_id: str, updates: dict, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.users.update_one({"user_id": user_id}, {"$set": updates})
    return {"message": "Team member updated"}


# ========== CLIENT MANAGEMENT MODELS & ROUTES ==========

class Company(BaseModel):
    model_config = ConfigDict(extra="ignore")
    company_id: str
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    custom_fields: dict = {}
    status: str = "active"
    created_by: str
    created_at: datetime

class CompanyCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    custom_fields: dict = {}

class Client(BaseModel):
    model_config = ConfigDict(extra="ignore")
    client_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    address: Optional[str] = None
    status: str = "active"
    custom_fields: dict = {}
    notes: Optional[str] = None
    created_by: str
    created_at: datetime

class ClientCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    company_id: Optional[str] = None
    address: Optional[str] = None
    custom_fields: dict = {}
    notes: Optional[str] = None

# ========== COMPANY ROUTES ==========

@api_router.post("/companies", response_model=Company)
async def create_company(payload: CompanyCreate, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    company_id = f"company_{uuid.uuid4().hex[:12]}"
    company_doc = {
        "company_id": company_id,
        "name": payload.name,
        "industry": payload.industry,
        "website": payload.website,
        "address": payload.address,
        "phone": payload.phone,
        "custom_fields": payload.custom_fields,
        "status": "active",
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.companies.insert_one(company_doc)
    company_doc['created_at'] = datetime.fromisoformat(company_doc['created_at'])
    return Company(**company_doc)

@api_router.get("/companies", response_model=List[Company])
async def get_companies(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    companies = await db.companies.find({}, {"_id": 0}).to_list(1000)
    for company in companies:
        if isinstance(company['created_at'], str):
            company['created_at'] = datetime.fromisoformat(company['created_at'])
    return companies

@api_router.get("/companies/{company_id}", response_model=Company)
async def get_company(company_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    if isinstance(company['created_at'], str):
        company['created_at'] = datetime.fromisoformat(company['created_at'])
    return Company(**company)

@api_router.patch("/companies/{company_id}")
async def update_company(company_id: str, updates: dict, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    await db.companies.update_one({"company_id": company_id}, {"$set": updates})
    return {"message": "Company updated"}

@api_router.delete("/companies/{company_id}")
async def delete_company(company_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    # Check if company has clients
    clients = await db.clients.count_documents({"company_id": company_id})
    if clients > 0:
        raise HTTPException(status_code=400, detail="Cannot delete company with existing contacts")
    
    await db.companies.delete_one({"company_id": company_id})
    return {"message": "Company deleted"}

# ========== CLIENT ROUTES ==========

@api_router.post("/clients", response_model=Client)
async def create_client(payload: ClientCreate, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    client_id = f"client_{uuid.uuid4().hex[:12]}"
    
    # Get company name if company_id provided
    company_name = None
    if payload.company_id:
        company = await db.companies.find_one({"company_id": payload.company_id}, {"_id": 0})
        if company:
            company_name = company["name"]
    
    client_doc = {
        "client_id": client_id,
        "name": payload.name,
        "email": payload.email,
        "phone": payload.phone,
        "position": payload.position,
        "company_id": payload.company_id,
        "company_name": company_name,
        "address": payload.address,
        "status": "active",
        "custom_fields": payload.custom_fields,
        "notes": payload.notes,
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.clients.insert_one(client_doc)
    client_doc['created_at'] = datetime.fromisoformat(client_doc['created_at'])
    return Client(**client_doc)

@api_router.get("/clients", response_model=List[Client])
async def get_clients(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    clients = await db.clients.find({}, {"_id": 0}).to_list(1000)
    for client in clients:
        if isinstance(client['created_at'], str):
            client['created_at'] = datetime.fromisoformat(client['created_at'])
    return clients

@api_router.get("/clients/{client_id}", response_model=Client)
async def get_client(client_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    client = await db.clients.find_one({"client_id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    if isinstance(client['created_at'], str):
        client['created_at'] = datetime.fromisoformat(client['created_at'])
    return Client(**client)

@api_router.patch("/clients/{client_id}")
async def update_client(client_id: str, updates: dict, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    await db.clients.update_one({"client_id": client_id}, {"$set": updates})
    return {"message": "Client updated"}

@api_router.delete("/clients/{client_id}")
async def delete_client(client_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    await db.clients.delete_one({"client_id": client_id})
    return {"message": "Client deleted"}

@api_router.get("/clients/by-company/{company_id}")
async def get_clients_by_company(company_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    clients = await db.clients.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    for client in clients:
        if isinstance(client['created_at'], str):
            client['created_at'] = datetime.fromisoformat(client['created_at'])
    return clients



# ========== CLIENT COMPREHENSIVE VIEW ==========

@api_router.get("/clients/{client_id}/overview")
async def get_client_overview(client_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    client = await db.clients.find_one({"client_id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    # Get all related data
    projects = await db.projects.find({"client_name": client["name"]}, {"_id": 0}).to_list(1000)
    proposals = await db.proposals.find({"client_name": client["name"]}, {"_id": 0}).to_list(1000)
    
    # Get invoices and expenses (if user has access)
    invoices = []
    total_revenue = 0
    pending_revenue = 0
    if user.role in ["admin", "manager", "finance"]:
        invoices = await db.invoices.find({"client_id": client_id}, {"_id": 0}).to_list(1000)
        total_revenue = sum(inv.get("amount", 0) for inv in invoices if inv.get("status") == "paid")
        pending_revenue = sum(inv.get("amount", 0) for inv in invoices if inv.get("status") == "pending")
    
    # Get email communications
    emails = await db.client_emails.find({"client_id": client_id}, {"_id": 0}).sort("date", -1).limit(50).to_list(1000)
    
    # Get tasks related to client projects
    project_ids = [p["project_id"] for p in projects]
    tasks = await db.tasks.find({"project_id": {"$in": project_ids}}, {"_id": 0}).to_list(1000) if project_ids else []
    
    return {
        "client": client,
        "projects": {
            "total": len(projects),
            "active": len([p for p in projects if p.get("status") == "active"]),
            "list": projects
        },
        "proposals": {
            "total": len(proposals),
            "approved": len([p for p in proposals if p.get("status") == "approved"]),
            "list": proposals
        },
        "finance": {
            "total_revenue": total_revenue,
            "pending_revenue": pending_revenue,
            "invoices": invoices
        } if user.role in ["admin", "manager", "finance"] else None,
        "tasks": {
            "total": len(tasks),
            "completed": len([t for t in tasks if t.get("status") == "done"]),
            "list": tasks[:10]  # Latest 10 tasks
        },
        "communications": {
            "total": len(emails),
            "recent": emails[:10]  # Latest 10 emails
        }
    }

# ========== GOOGLE DRIVE INTEGRATION ==========

@api_router.get("/drive/connect")
async def connect_drive(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    try:
        redirect_uri = os.environ.get("REACT_APP_BACKEND_URL", "") + "/api/drive/callback"
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
                    "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=['https://www.googleapis.com/auth/drive.readonly'],
            redirect_uri=redirect_uri
        )
        
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
            state=user.user_id
        )
        
        return {"authorization_url": authorization_url}
    
    except Exception as e:
        logger.error(f"Failed to initiate Drive OAuth: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to initiate Google Drive connection")

@api_router.get("/drive/callback")
async def drive_callback(code: str = Query(...), state: str = Query(...)):
    try:
        redirect_uri = os.environ.get("REACT_APP_BACKEND_URL", "") + "/api/drive/callback"
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
                    "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=None,
            redirect_uri=redirect_uri
        )
        
        flow.fetch_token(code=code)
        credentials = flow.credentials
        
        await db.drive_credentials.update_one(
            {"user_id": state},
            {"$set": {
                "user_id": state,
                "access_token": credentials.token,
                "refresh_token": credentials.refresh_token,
                "token_uri": credentials.token_uri,
                "client_id": credentials.client_id,
                "client_secret": credentials.client_secret,
                "scopes": credentials.scopes,
                "expiry": credentials.expiry.isoformat() if credentials.expiry else None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        frontend_url = os.getenv("REACT_APP_BACKEND_URL", "").replace("/api", "")
        return RedirectResponse(url=f"{frontend_url}/proposals?drive_connected=true")
    
    except Exception as e:
        logger.error(f"Drive callback failed: {str(e)}")
        raise HTTPException(status_code=400, detail="Google Drive connection failed")

async def get_drive_service(user_id: str):
    creds_doc = await db.drive_credentials.find_one({"user_id": user_id})
    if not creds_doc:
        return None
    
    creds = Credentials(
        token=creds_doc["access_token"],
        refresh_token=creds_doc.get("refresh_token"),
        token_uri=creds_doc["token_uri"],
        client_id=creds_doc["client_id"],
        client_secret=creds_doc["client_secret"],
        scopes=creds_doc["scopes"]
    )
    
    if creds.expired and creds.refresh_token:
        creds.refresh(GoogleRequest())
        await db.drive_credentials.update_one(
            {"user_id": user_id},
            {"$set": {
                "access_token": creds.token,
                "expiry": creds.expiry.isoformat() if creds.expiry else None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return build('drive', 'v3', credentials=creds)

@api_router.get("/drive/files")
async def list_drive_files(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    service = await get_drive_service(user.user_id)
    if not service:
        raise HTTPException(status_code=400, detail="Google Drive not connected")
    
    try:
        results = service.files().list(
            pageSize=50,
            fields="files(id, name, mimeType, webViewLink, modifiedTime, size)",
            q="mimeType='application/pdf' or mimeType='application/vnd.google-apps.document' or mimeType='application/vnd.openxmlformats-officedocument.wordprocessingml.document'"
        ).execute()
        
        return {"files": results.get('files', [])}
    
    except Exception as e:
        logger.error(f"Failed to list Drive files: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch Google Drive files")

# ========== GMAIL INTEGRATION ==========

@api_router.get("/gmail/connect")
async def connect_gmail(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    try:
        redirect_uri = os.environ.get("REACT_APP_BACKEND_URL", "") + "/api/gmail/callback"
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
                    "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=[
                "https://www.googleapis.com/auth/gmail.readonly",
                "openid",
                "https://www.googleapis.com/auth/userinfo.email",
                "https://www.googleapis.com/auth/userinfo.profile"
            ],
            redirect_uri=redirect_uri
        )
        
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
            state=user.user_id
        )
        
        return {"authorization_url": authorization_url}
    
    except Exception as e:
        logger.error(f"Failed to initiate Gmail OAuth: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to initiate Gmail connection")

@api_router.get("/gmail/callback")
async def gmail_callback(code: str = Query(...), state: str = Query(...)):
    try:
        redirect_uri = os.environ.get("REACT_APP_BACKEND_URL", "") + "/api/gmail/callback"
        
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": os.getenv("GOOGLE_CLIENT_ID", ""),
                    "client_secret": os.getenv("GOOGLE_CLIENT_SECRET", ""),
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [redirect_uri]
                }
            },
            scopes=None,
            redirect_uri=redirect_uri
        )
        
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            flow.fetch_token(code=code)
        
        credentials = flow.credentials
        
        await db.gmail_credentials.update_one(
            {"user_id": state},
            {"$set": {
                "user_id": state,
                "access_token": credentials.token,
                "refresh_token": credentials.refresh_token,
                "token_uri": credentials.token_uri,
                "client_id": credentials.client_id,
                "client_secret": credentials.client_secret,
                "scopes": credentials.scopes,
                "expiry": credentials.expiry.isoformat() if credentials.expiry else None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
        
        frontend_url = os.getenv("REACT_APP_BACKEND_URL", "").replace("/api", "")
        return RedirectResponse(url=f"{frontend_url}/clients?gmail_connected=true")
    
    except Exception as e:
        logger.error(f"Gmail callback failed: {str(e)}")
        raise HTTPException(status_code=400, detail="Gmail connection failed")

async def get_gmail_service(user_id: str):
    creds_doc = await db.gmail_credentials.find_one({"user_id": user_id})
    if not creds_doc:
        return None
    
    expiry_str = creds_doc.get("expiry")
    if expiry_str:
        expiry = datetime.fromisoformat(expiry_str)
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=timezone.utc)
    else:
        expiry = None
    
    creds = Credentials(
        token=creds_doc["access_token"],
        refresh_token=creds_doc.get("refresh_token"),
        token_uri=creds_doc["token_uri"],
        client_id=creds_doc["client_id"],
        client_secret=creds_doc["client_secret"],
        scopes=creds_doc["scopes"],
        expiry=expiry
    )
    
    if expiry and datetime.now(timezone.utc) >= expiry and creds.refresh_token:
        creds.refresh(GoogleRequest())
        await db.gmail_credentials.update_one(
            {"user_id": user_id},
            {"$set": {
                "access_token": creds.token,
                "expiry": creds.expiry.isoformat() if creds.expiry else None,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    
    return build('gmail', 'v1', credentials=creds)

@api_router.post("/gmail/sync/{client_id}")
async def sync_client_emails(client_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    client = await db.clients.find_one({"client_id": client_id}, {"_id": 0})
    if not client or not client.get("email"):
        raise HTTPException(status_code=404, detail="Client not found or no email")
    
    service = await get_gmail_service(user.user_id)
    if not service:
        raise HTTPException(status_code=400, detail="Gmail not connected")
    
    try:
        # Search for emails from/to client
        query = f"from:{client['email']} OR to:{client['email']}"
        results = service.users().messages().list(userId='me', q=query, maxResults=50).execute()
        messages = results.get('messages', [])
        
        synced_count = 0
        for msg in messages:
            msg_detail = service.users().messages().get(userId='me', id=msg['id'], format='full').execute()
            
            headers = {h['name']: h['value'] for h in msg_detail['payload'].get('headers', [])}
            
            email_data = {
                "client_id": client_id,
                "gmail_message_id": msg['id'],
                "subject": headers.get('Subject', 'No Subject'),
                "from": headers.get('From', ''),
                "to": headers.get('To', ''),
                "date": headers.get('Date', ''),
                "snippet": msg_detail.get('snippet', ''),
                "synced_at": datetime.now(timezone.utc).isoformat()
            }
            
            await db.client_emails.update_one(
                {"gmail_message_id": msg['id']},
                {"$set": email_data},
                upsert=True
            )
            synced_count += 1
        
        return {"message": f"Synced {synced_count} emails for {client['name']}"}
    
    except Exception as e:
        logger.error(f"Failed to sync emails: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to sync emails")

@api_router.get("/clients/{client_id}/emails")
async def get_client_emails(client_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    emails = await db.client_emails.find({"client_id": client_id}, {"_id": 0}).sort("date", -1).to_list(1000)
    return {"emails": emails}


# ========== ZOHO SIGN INTEGRATION (DEMO MODE) ==========

async def send_email_via_gmail(user_id: str, to: str, subject: str, body: str):
    """Send email using Gmail API"""
    service = await get_gmail_service(user_id)
    if not service:
        logger.warning(f"Gmail not connected for user {user_id}, skipping email")
        return False
    
    try:
        message = f"To: {to}\nSubject: {subject}\n\n{body}"
        encoded = base64.urlsafe_b64encode(message.encode()).decode()
        
        service.users().messages().send(
            userId='me',
            body={'raw': encoded}
        ).execute()
        
        logger.info(f"Email sent to {to}: {subject}")
        return True
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return False

@api_router.post("/proposals/{proposal_id}/send-for-signature")
async def send_proposal_for_signature(proposal_id: str, recipient_email: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    proposal = await db.proposals.find_one({"proposal_id": proposal_id}, {"_id": 0})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    # DEMO MODE: Simulate Zoho Sign integration
    zoho_enabled = os.getenv("ZOHO_CLIENT_ID") and os.getenv("ZOHO_CLIENT_SECRET")
    
    if zoho_enabled:
        # Real Zoho Sign implementation (placeholder for when credentials are added)
        logger.info(f"Zoho Sign: Sending proposal {proposal_id} to {recipient_email}")
        # TODO: Implement actual Zoho Sign API call
        zoho_request_id = f"zoho_demo_{uuid.uuid4().hex[:12]}"
    else:
        # Demo mode
        zoho_request_id = f"demo_{uuid.uuid4().hex[:12]}"
        logger.info(f"DEMO MODE: Proposal {proposal_id} sent for signature to {recipient_email}")
    
    # Update proposal with signature request info
    await db.proposals.update_one(
        {"proposal_id": proposal_id},
        {"$set": {
            "signature_request_id": zoho_request_id,
            "signature_status": "pending",
            "sent_to": recipient_email,
            "sent_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Send notification email via Gmail
    await send_email_via_gmail(
        user.user_id,
        recipient_email,
        f"Signature Request: {proposal['title']}",
        f"Hello,\n\nPlease review and sign the proposal: {proposal['title']}\n\n"
        f"{'[DEMO MODE - No actual signature required]' if not zoho_enabled else 'Click the link to sign the document.'}\n\n"
        f"Best regards,\n{user.name}"
    )
    
    return {
        "message": "Proposal sent for signature" + (" (Demo Mode)" if not zoho_enabled else ""),
        "request_id": zoho_request_id,
        "demo_mode": not zoho_enabled
    }

@api_router.get("/proposals/{proposal_id}/signature-status")
async def check_signature_status(proposal_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    proposal = await db.proposals.find_one({"proposal_id": proposal_id}, {"_id": 0})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    return {
        "status": proposal.get("signature_status", "not_sent"),
        "request_id": proposal.get("signature_request_id"),
        "sent_to": proposal.get("sent_to"),
        "sent_at": proposal.get("sent_at")
    }

# ========== EMAIL NOTIFICATIONS ==========

@api_router.post("/notifications/task-assignment")
async def notify_task_assignment(task_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task or not task.get("assigned_to"):
        return {"message": "No notification sent"}
    
    assignee = await db.users.find_one({"user_id": task["assigned_to"]}, {"_id": 0})
    if not assignee or not assignee.get("email"):
        return {"message": "Assignee has no email"}
    
    # Send email notification
    await send_email_via_gmail(
        user.user_id,
        assignee["email"],
        f"New Task Assignment: {task['title']}",
        f"Hello {assignee['name']},\n\n"
        f"You have been assigned a new task:\n\n"
        f"Task: {task['title']}\n"
        f"Priority: {task.get('priority', 'medium')}\n"
        f"Due Date: {task.get('due_date', 'Not set')}\n\n"
        f"Description: {task.get('description', 'No description')}\n\n"
        f"Please log in to the system to view details.\n\n"
        f"Best regards,\n{user.name}"
    )
    
    return {"message": "Task assignment notification sent"}

@api_router.post("/notifications/invoice-reminder")
async def send_invoice_reminder(invoice_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    invoice = await db.invoices.find_one({"invoice_id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    client = await db.clients.find_one({"client_id": invoice["client_id"]}, {"_id": 0})
    if not client or not client.get("email"):
        raise HTTPException(status_code=400, detail="Client has no email")
    
    # Send reminder email
    await send_email_via_gmail(
        user.user_id,
        client["email"],
        f"Invoice Reminder: #{invoice['invoice_id'][-6:]}",
        f"Hello {client['name']},\n\n"
        f"This is a friendly reminder about your pending invoice:\n\n"
        f"Invoice #: {invoice['invoice_id'][-6:]}\n"
        f"Amount: ${invoice['amount']:,.2f}\n"
        f"Due Date: {invoice.get('due_date', 'Not specified')}\n\n"
        f"Please process the payment at your earliest convenience.\n\n"
        f"If you have any questions, feel free to reach out.\n\n"
        f"Best regards,\n{user.name}"
    )
    
    return {"message": "Invoice reminder sent"}

# ========== CSV EXPORT FUNCTIONALITY ==========

@api_router.get("/reports/export/projects")
async def export_projects_csv(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    
    # Generate CSV
    csv_lines = ["Project ID,Name,Client,Status,Budget,Start Date,End Date,Created At"]
    for p in projects:
        csv_lines.append(
            f"{p['project_id']},{p['name']},{p.get('client_name', '')},"
            f"{p.get('status', '')},"
            f"{p.get('budget', 0)},{p.get('start_date', '')},"
            f"{p.get('end_date', '')},{p.get('created_at', '')}"
        )
    
    csv_content = "\n".join(csv_lines)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=projects_export.csv"}
    )

@api_router.get("/reports/export/tasks")
async def export_tasks_csv(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    tasks = await db.tasks.find({}, {"_id": 0}).to_list(10000)
    
    csv_lines = ["Task ID,Project ID,Title,Status,Priority,Assigned To,Due Date,Created At"]
    for t in tasks:
        csv_lines.append(
            f"{t['task_id']},{t.get('project_id', '')},"
            f"\"{t['title']}\",{t.get('status', '')},"
            f"{t.get('priority', '')},{t.get('assigned_to', '')},"
            f"{t.get('due_date', '')},{t.get('created_at', '')}"
        )
    
    csv_content = "\n".join(csv_lines)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=tasks_export.csv"}
    )

@api_router.get("/reports/export/time-logs")
async def export_time_logs_csv(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    logs = await db.time_logs.find({}, {"_id": 0}).to_list(10000)
    
    csv_lines = ["Log ID,Task ID,User ID,Duration (min),Date,Billable,Description,Created At"]
    for log in logs:
        csv_lines.append(
            f"{log['log_id']},{log.get('task_id', '')},"
            f"{log.get('user_id', '')},{log.get('duration_minutes', 0)},"
            f"{log.get('date', '')},{log.get('billable', True)},"
            f"\"{log.get('description', '')}\",{log.get('created_at', '')}"
        )
    
    csv_content = "\n".join(csv_lines)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=time_logs_export.csv"}
    )

@api_router.get("/reports/export/team-productivity")
async def export_team_productivity_csv(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    # Get team productivity data
    team_members = await db.users.find({}, {"_id": 0}).to_list(1000)
    
    csv_lines = ["User ID,Name,Role,Total Tasks,Completed Tasks,Total Hours"]
    
    for member in team_members:
        tasks = await db.tasks.find({"assigned_to": member["user_id"]}, {"_id": 0}).to_list(1000)
        completed_tasks = [t for t in tasks if t.get("status") == "done"]
        
        time_logs = await db.time_logs.find({"user_id": member["user_id"]}, {"_id": 0}).to_list(10000)
        total_hours = sum(log.get("duration_minutes", 0) for log in time_logs) / 60
        
        csv_lines.append(
            f"{member['user_id']},{member['name']},{member['role']},"
            f"{len(tasks)},{len(completed_tasks)},{total_hours:.2f}"
        )
    
    csv_content = "\n".join(csv_lines)
    
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=team_productivity_export.csv"}
    )

# ========== FINANCE MODELS & ROUTES ==========

class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    invoice_id: str
    client_id: str
    project_id: Optional[str] = None
    amount: float
    status: str = "pending"
    due_date: Optional[str] = None
    paid_date: Optional[str] = None
    items: List[dict] = []
    created_by: str
    created_at: datetime

class InvoiceCreate(BaseModel):
    client_id: str
    project_id: Optional[str] = None
    amount: float
    due_date: Optional[str] = None
    items: List[dict] = []

class Expense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    expense_id: str
    project_id: Optional[str] = None
    category: str
    amount: float
    description: Optional[str] = None
    date: str
    created_by: str
    created_at: datetime

class ExpenseCreate(BaseModel):
    project_id: Optional[str] = None
    category: str
    amount: float
    description: Optional[str] = None
    date: str

@api_router.post("/invoices", response_model=Invoice)
async def create_invoice(payload: InvoiceCreate, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized to create invoices")
    
    invoice_id = f"inv_{uuid.uuid4().hex[:12]}"
    invoice_doc = {
        "invoice_id": invoice_id,
        "client_id": payload.client_id,
        "project_id": payload.project_id,
        "amount": payload.amount,
        "status": "pending",
        "due_date": payload.due_date,
        "paid_date": None,
        "items": payload.items,
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.invoices.insert_one(invoice_doc)
    invoice_doc['created_at'] = datetime.fromisoformat(invoice_doc['created_at'])
    return Invoice(**invoice_doc)

@api_router.get("/invoices", response_model=List[Invoice])
async def get_invoices(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized to view invoices")
    
    invoices = await db.invoices.find({}, {"_id": 0}).to_list(1000)
    for invoice in invoices:
        if isinstance(invoice['created_at'], str):
            invoice['created_at'] = datetime.fromisoformat(invoice['created_at'])
    return invoices

@api_router.patch("/invoices/{invoice_id}")
async def update_invoice(invoice_id: str, updates: dict, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.invoices.update_one({"invoice_id": invoice_id}, {"$set": updates})
    return {"message": "Invoice updated"}

@api_router.post("/expenses", response_model=Expense)
async def create_expense(payload: ExpenseCreate, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized to create expenses")
    
    expense_id = f"exp_{uuid.uuid4().hex[:12]}"
    expense_doc = {
        "expense_id": expense_id,
        "project_id": payload.project_id,
        "category": payload.category,
        "amount": payload.amount,
        "description": payload.description,
        "date": payload.date,
        "created_by": user.user_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.expenses.insert_one(expense_doc)
    expense_doc['created_at'] = datetime.fromisoformat(expense_doc['created_at'])
    return Expense(**expense_doc)

@api_router.get("/expenses", response_model=List[Expense])
async def get_expenses(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized to view expenses")
    
    expenses = await db.expenses.find({}, {"_id": 0}).to_list(1000)
    for expense in expenses:
        if isinstance(expense['created_at'], str):
            expense['created_at'] = datetime.fromisoformat(expense['created_at'])
    return expenses

# ========== REPORTS & ANALYTICS ROUTES ==========

@api_router.get("/reports/overview")
async def get_overview_report(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    projects_count = await db.projects.count_documents({})
    active_projects = await db.projects.count_documents({"status": "active"})
    tasks_count = await db.tasks.count_documents({})
    completed_tasks = await db.tasks.count_documents({"status": "done"})
    team_count = await db.users.count_documents({})
    
    time_logs = await db.time_logs.find({}, {"_id": 0}).to_list(10000)
    total_hours = sum(log.get("duration_minutes", 0) for log in time_logs) / 60
    billable_hours = sum(log.get("duration_minutes", 0) for log in time_logs if log.get("billable")) / 60
    
    finance_data = {}
    if user.role in ["admin", "manager", "finance"]:
        invoices = await db.invoices.find({}, {"_id": 0}).to_list(1000)
        expenses = await db.expenses.find({}, {"_id": 0}).to_list(1000)
        
        total_revenue = sum(inv.get("amount", 0) for inv in invoices if inv.get("status") == "paid")
        pending_revenue = sum(inv.get("amount", 0) for inv in invoices if inv.get("status") == "pending")
        total_expenses = sum(exp.get("amount", 0) for exp in expenses)
        
        finance_data = {
            "total_revenue": total_revenue,
            "pending_revenue": pending_revenue,
            "total_expenses": total_expenses,
            "profit": total_revenue - total_expenses
        }
    
    return {
        "projects": {
            "total": projects_count,
            "active": active_projects
        },
        "tasks": {
            "total": tasks_count,
            "completed": completed_tasks,
            "completion_rate": (completed_tasks / tasks_count * 100) if tasks_count > 0 else 0
        },
        "team": {
            "total": team_count
        },
        "time": {
            "total_hours": round(total_hours, 2),
            "billable_hours": round(billable_hours, 2),
            "non_billable_hours": round(total_hours - billable_hours, 2)
        },
        "finance": finance_data
    }

@api_router.get("/reports/project-performance")
async def get_project_performance(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    performance_data = []
    
    for project in projects:
        tasks = await db.tasks.find({"project_id": project["project_id"]}, {"_id": 0}).to_list(1000)
        completed_tasks = [t for t in tasks if t.get("status") == "done"]
        
        time_logs = await db.time_logs.find({}, {"_id": 0}).to_list(10000)
        project_time = sum(
            log.get("duration_minutes", 0) 
            for log in time_logs 
            if log.get("task_id") in [t.get("task_id") for t in tasks]
        ) / 60
        
        performance_data.append({
            "project_id": project["project_id"],
            "project_name": project["name"],
            "total_tasks": len(tasks),
            "completed_tasks": len(completed_tasks),
            "completion_rate": (len(completed_tasks) / len(tasks) * 100) if tasks else 0,
            "total_hours": round(project_time, 2),
            "budget": project.get("budget", 0),
            "status": project.get("status")
        })
    
    return performance_data

@api_router.get("/reports/team-productivity")
async def get_team_productivity(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    team_members = await db.users.find({}, {"_id": 0}).to_list(1000)
    productivity_data = []
    
    for member in team_members:
        tasks = await db.tasks.find({"assigned_to": member["user_id"]}, {"_id": 0}).to_list(1000)
        completed_tasks = [t for t in tasks if t.get("status") == "done"]
        
        time_logs = await db.time_logs.find({"user_id": member["user_id"]}, {"_id": 0}).to_list(10000)
        total_hours = sum(log.get("duration_minutes", 0) for log in time_logs) / 60
        
        productivity_data.append({
            "user_id": member["user_id"],
            "name": member["name"],
            "role": member["role"],
            "total_tasks": len(tasks),
            "completed_tasks": len(completed_tasks),
            "total_hours": round(total_hours, 2)
        })
    
    return productivity_data

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
