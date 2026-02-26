from fastapi import FastAPI, APIRouter, HTTPException, Cookie, Response, Header, UploadFile, File, Query, Request
from fastapi.responses import StreamingResponse, RedirectResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import io
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
from reportlab.lib.pagesizes import letter, landscape
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from services.gmail_service import (
    send_email, get_invitation_email, get_leave_status_email, 
    get_reimbursement_status_email, GMAIL_ENABLED
)
from services.gdrive_service import (
    upload_file_to_drive, delete_file_from_drive, get_file_from_drive,
    list_files_in_folder, GDRIVE_ENABLED
)
from services.pdf_service import (
    create_projects_pdf,
    create_tasks_pdf,
    create_time_logs_pdf,
    create_team_productivity_pdf,
    create_overview_pdf
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ========== ROLE-BASED ACCESS CONTROL ==========

# Role hierarchy and permissions
ROLES = {
    "admin": {
        "level": 100,
        "can_view_financial": True,
        "can_manage_team": True,
        "can_invite_team": True,
        "can_edit_all": True,
        "can_delete_all": True,
        "description": "Full access to all features"
    },
    "manager": {
        "level": 70,
        "can_view_financial": True,
        "can_manage_team": True,
        "can_invite_team": True,
        "can_edit_all": True,
        "can_delete_all": False,
        "description": "Project management with financial access"
    },
    "team_lead": {
        "level": 50,
        "can_view_financial": False,
        "can_manage_team": True,
        "can_invite_team": False,
        "can_edit_all": False,
        "can_delete_all": False,
        "description": "Team coordination and management"
    },
    "team_member": {
        "level": 10,
        "can_view_financial": False,
        "can_manage_team": False,
        "can_invite_team": False,
        "can_edit_all": False,
        "can_delete_all": False,
        "description": "Own tasks only"
    }
}

def check_permission(user_role: str, required_permission: str) -> bool:
    """Check if user role has required permission"""
    role_config = ROLES.get(user_role, ROLES["team_member"])
    return role_config.get(required_permission, False)

def can_view_resource(user, resource_type: str, resource: dict) -> bool:
    """Check if user can view a specific resource"""
    role_config = ROLES.get(user.role, ROLES["team_member"])
    
    # Admin can view everything
    if user.role == "admin":
        return True
    
    # Supervisor can view operational data only
    if user.role == "supervisor":
        if resource_type in ["invoice", "expense", "financial_report"]:
            return False
        return True
    
    # Manager can view everything
    if user.role == "manager":
        return True
    
    # Team members can only view their own tasks or tasks they're involved in
    if user.role == "team_member":
        if resource_type == "task":
            return (resource.get("assigned_to") == user.user_id or 
                    resource.get("created_by") == user.user_id or
                    resource.get("reviewer_id") == user.user_id)
        if resource_type == "project":
            return user.user_id in resource.get("team_members", []) or resource.get("created_by") == user.user_id
        return True
    
    return True

def filter_resources_by_role(user, resources: list, resource_type: str) -> list:
    """Filter resources based on user role"""
    if user.role in ["admin", "manager"]:
        return resources
    
    if user.role == "supervisor":
        # Filter out financial data
        if resource_type in ["invoice", "expense"]:
            return []
        return resources
    
    # Team member: filter to own resources
    if user.role == "team_member":
        if resource_type == "task":
            return [r for r in resources if 
                    r.get("assigned_to") == user.user_id or 
                    r.get("created_by") == user.user_id or
                    r.get("reviewer_id") == user.user_id]
        if resource_type == "project":
            return [r for r in resources if 
                    user.user_id in r.get("team_members", []) or 
                    r.get("created_by") == user.user_id]
        return resources
    
    return resources

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
    project_id: Optional[str] = None  # Optional for internal tasks
    is_internal: bool = False  # True if task is internal (not billable to any project)
    title: str
    description: Optional[str] = None
    status: str = "not_started"  # not_started, assigned, in_progress, on_hold, under_review, completed
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
    project_id: Optional[str] = None  # Optional - can be None for internal tasks
    is_internal: bool = False  # True if task is internal (not billable)
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

# ========== PHASE 2: TEAM MANAGEMENT MODELS ==========

# Leave Application
class LeaveApplication(BaseModel):
    model_config = ConfigDict(extra="ignore")
    leave_id: str
    user_id: str
    user_name: str
    leave_type: str  # casual, sick, earned, unpaid, wfh
    start_date: str
    end_date: str
    days: int
    reason: str
    status: str = "pending"  # pending, approved, rejected
    approved_by: Optional[str] = None
    approver_comments: Optional[str] = None
    created_at: datetime

class LeaveCreate(BaseModel):
    leave_type: str
    start_date: str
    end_date: str
    reason: str

# Reimbursement
class Reimbursement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    reimbursement_id: str
    user_id: str
    user_name: str
    category: str  # travel, equipment, office_supplies, client_entertainment, other
    amount: float
    description: str
    receipt_url: Optional[str] = None
    date: str
    project_id: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected, paid
    approved_by: Optional[str] = None
    approver_comments: Optional[str] = None
    created_at: datetime

class ReimbursementCreate(BaseModel):
    category: str
    amount: float
    description: str
    date: str
    project_id: Optional[str] = None

# Performance Review
class PerformanceReview(BaseModel):
    model_config = ConfigDict(extra="ignore")
    review_id: str
    user_id: str
    user_name: str
    reviewer_id: str
    reviewer_name: str
    review_period: str  # e.g., "Q1 2025", "2025"
    overall_rating: int  # 1-5
    strengths: str
    areas_for_improvement: str
    goals: str
    comments: str
    status: str = "draft"  # draft, submitted, acknowledged
    created_at: datetime

class PerformanceReviewCreate(BaseModel):
    user_id: str
    review_period: str
    overall_rating: int
    strengths: str
    areas_for_improvement: str
    goals: str
    comments: str

# Onboarding Form
class OnboardingForm(BaseModel):
    model_config = ConfigDict(extra="ignore")
    form_id: str
    user_id: str
    status: str = "pending"  # pending, submitted, approved
    
    # Personal Info
    full_name: str
    date_of_birth: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    
    # Bank Details
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    
    # Education
    education: List[dict] = []  # [{degree, institution, year, grade}]
    
    # Work Experience
    work_experience: List[dict] = []  # [{company, role, duration, responsibilities}]
    
    # Documents
    documents: List[dict] = []  # [{doc_type, file_url, uploaded_at}]
    
    created_at: datetime
    submitted_at: Optional[datetime] = None

class OnboardingFormCreate(BaseModel):
    full_name: str
    date_of_birth: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    emergency_contact_name: Optional[str] = None
    emergency_contact_phone: Optional[str] = None
    emergency_contact_relation: Optional[str] = None
    bank_name: Optional[str] = None
    account_number: Optional[str] = None
    ifsc_code: Optional[str] = None
    education: List[dict] = []
    work_experience: List[dict] = []

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
        
        # Super Admin email from environment variable
        super_admin_email = os.environ.get("SUPER_ADMIN_EMAIL", "").lower().strip()
        is_super_admin = data["email"].lower().strip() == super_admin_email and super_admin_email != ""
        
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        existing_user = await db.users.find_one({"email": data["email"]}, {"_id": 0})
        
        if existing_user:
            user_id = existing_user["user_id"]
            update_data = {
                "name": data["name"],
                "picture": data.get("picture")
            }
            # If super admin, always ensure admin role
            if is_super_admin and existing_user.get("role") != "admin":
                update_data["role"] = "admin"
            
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": update_data}
            )
        else:
            # Check if there's a pending invitation for this email
            invitation = await db.team_invitations.find_one({
                "email": data["email"],
                "status": "pending"
            })
            
            # Determine role - super admin > invitation > first user > default
            user_count = await db.users.count_documents({})
            if is_super_admin:
                role = "admin"  # Super admin always gets admin
            elif invitation:
                role = invitation["role"]
                # Mark invitation as accepted
                await db.team_invitations.update_one(
                    {"invitation_id": invitation["invitation_id"]},
                    {"$set": {
                        "status": "accepted",
                        "accepted_at": datetime.now(timezone.utc).isoformat()
                    }}
                )
            elif user_count == 0:
                role = "admin"  # First user is admin
            else:
                role = "team_member"  # Default role for uninvited users
            
            user_doc = {
                "user_id": user_id,
                "email": data["email"],
                "name": data["name"],
                "picture": data.get("picture"),
                "role": role,
                "skills": [],
                "date_of_joining": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
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
    
    if proposal["status"] not in ["approved", "signed", "confirmed"]:
        raise HTTPException(status_code=400, detail="Proposal must be approved, confirmed, or signed first")
    
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
        "is_internal": payload.is_internal or (payload.project_id is None),  # Auto-set internal if no project
        "title": payload.title,
        "description": payload.description,
        "status": "not_started",
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
async def get_tasks(project_id: Optional[str] = None, include_internal: bool = False, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    query = {}
    if project_id:
        query["project_id"] = project_id
    elif include_internal:
        # Include both project and internal tasks
        pass
    
    tasks = await db.tasks.find(query, {"_id": 0}).to_list(1000)
    for task in tasks:
        if isinstance(task['created_at'], str):
            task['created_at'] = datetime.fromisoformat(task['created_at'])
    
    # Apply role-based filtering
    tasks = filter_resources_by_role(user, tasks, "task")
    
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

@api_router.delete("/tasks/{task_id}")
async def delete_task(task_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    task = await db.tasks.find_one({"task_id": task_id}, {"_id": 0})
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Delete all subtasks (cascading delete)
    if task.get("subtasks"):
        await db.tasks.delete_many({"task_id": {"$in": task["subtasks"]}})
    
    # Remove from parent task's subtasks array if this is a subtask
    if task.get("parent_task_id"):
        await db.tasks.update_one(
            {"task_id": task["parent_task_id"]},
            {"$pull": {"subtasks": task_id}}
        )
    
    # Delete time logs associated with this task
    await db.time_logs.delete_many({"task_id": task_id})
    
    # Cancel any active timer for this task
    await db.active_timers.delete_many({"task_id": task_id})
    
    # Delete the task
    await db.tasks.delete_one({"task_id": task_id})
    
    # Update project completion
    if task.get("project_id"):
        await update_project_completion(task["project_id"])
    
    return {"message": "Task deleted"}

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

@api_router.get("/dashboard/pending-reviews")
async def get_pending_reviews(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    # Get tasks where current user is the reviewer and status is under_review
    tasks = await db.tasks.find({
        "reviewer_id": user.user_id,
        "status": "under_review"
    }, {"_id": 0}).to_list(1000)
    
    for task in tasks:
        if isinstance(task.get('created_at'), str):
            task['created_at'] = datetime.fromisoformat(task['created_at'])
        # Get project info
        if task.get("project_id"):
            project = await db.projects.find_one({"project_id": task["project_id"]}, {"_id": 0})
            task["project_name"] = project.get("name") if project else None
    
    return tasks

@api_router.get("/dashboard/pending-approvals")
async def get_pending_approvals(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    # Get proposals where current user is the approver and status is pending_approval
    proposals = await db.proposals.find({
        "approver_id": user.user_id,
        "status": "pending_approval"
    }, {"_id": 0}).to_list(1000)
    
    for proposal in proposals:
        if isinstance(proposal.get('created_at'), str):
            proposal['created_at'] = datetime.fromisoformat(proposal['created_at'])
    
    return proposals

@api_router.get("/dashboard/team-tasks")
async def get_team_tasks(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "team_lead"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get all users
    team_members = await db.users.find({}, {"_id": 0}).to_list(1000)
    user_ids = [member["user_id"] for member in team_members]
    
    # Optimized: Batch query - fetch ALL relevant tasks in ONE query
    all_tasks = await db.tasks.find({
        "assigned_to": {"$in": user_ids},
        "status": {"$nin": ["not_started", "completed"]}
    }, {"_id": 0}).to_list(10000)
    
    # Group tasks by user_id in memory
    tasks_by_user = {}
    for task in all_tasks:
        if isinstance(task.get('created_at'), str):
            task['created_at'] = datetime.fromisoformat(task['created_at'])
        assigned_to = task.get("assigned_to")
        if assigned_to not in tasks_by_user:
            tasks_by_user[assigned_to] = []
        tasks_by_user[assigned_to].append(task)
    
    # Build response with pre-grouped tasks
    team_tasks = []
    for member in team_members:
        tasks = tasks_by_user.get(member["user_id"], [])
        if tasks:  # Only include members with tasks
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
    project_name = None
    client_name = None
    parent_task_title = None
    
    if project_id:
        project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
        if project:
            project_name = project.get("name")
            client_name = project.get("client_name")
    
    # Check if this is a subtask
    if task.get("parent_task_id"):
        parent_task = await db.tasks.find_one({"task_id": task["parent_task_id"]}, {"_id": 0})
        if parent_task:
            parent_task_title = parent_task.get("title")
    
    timer_id = f"timer_{uuid.uuid4().hex[:12]}"
    timer_doc = {
        "timer_id": timer_id,
        "user_id": user.user_id,
        "task_id": task_id,
        "task_title": task.get("title"),
        "parent_task_id": task.get("parent_task_id"),
        "parent_task_title": parent_task_title,
        "project_id": project_id,
        "project_name": project_name,
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
        "task_title": task.get("title"),
        "parent_task_title": parent_task_title,
        "project_name": project_name,
        "client_name": client_name
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
        "parent_task_id": timer.get("parent_task_id"),
        "parent_task_title": timer.get("parent_task_title"),
        "project_id": timer.get("project_id"),
        "project_name": timer.get("project_name"),
        "client_name": timer.get("client_name"),
        "start_time": timer["start_time"],
        "elapsed_minutes": elapsed_minutes,
        "description": timer.get("description"),
        "is_paused": timer.get("is_paused", False),
        "paused_time": timer.get("paused_time", 0)
    }

@api_router.delete("/timer/cancel")
async def cancel_timer(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    result = await db.active_timers.delete_one({"user_id": user.user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="No active timer found")
    
    return {"message": "Timer cancelled"}

@api_router.post("/timer/pause")
async def pause_timer(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    timer = await db.active_timers.find_one({"user_id": user.user_id}, {"_id": 0})
    if not timer:
        raise HTTPException(status_code=404, detail="No active timer found")
    
    if timer.get("is_paused"):
        raise HTTPException(status_code=400, detail="Timer is already paused")
    
    # Calculate time elapsed until pause
    start_time = datetime.fromisoformat(timer["start_time"])
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    elapsed = datetime.now(timezone.utc) - start_time
    elapsed_seconds = int(elapsed.total_seconds()) + timer.get("paused_time", 0)
    
    await db.active_timers.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "is_paused": True,
            "paused_at": datetime.now(timezone.utc).isoformat(),
            "paused_time": elapsed_seconds
        }}
    )
    
    return {"message": "Timer paused", "elapsed_seconds": elapsed_seconds}

@api_router.post("/timer/resume")
async def resume_timer(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    timer = await db.active_timers.find_one({"user_id": user.user_id}, {"_id": 0})
    if not timer:
        raise HTTPException(status_code=404, detail="No active timer found")
    
    if not timer.get("is_paused"):
        raise HTTPException(status_code=400, detail="Timer is not paused")
    
    # Reset start time to now, keep paused_time for total calculation
    await db.active_timers.update_one(
        {"user_id": user.user_id},
        {"$set": {
            "is_paused": False,
            "start_time": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    return {"message": "Timer resumed"}

@api_router.patch("/time-logs/{log_id}")
async def update_time_log(log_id: str, updates: dict, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    log = await db.time_logs.find_one({"log_id": log_id}, {"_id": 0})
    if not log:
        raise HTTPException(status_code=404, detail="Time log not found")
    
    # Only allow updating own logs or if admin/manager
    if log["user_id"] != user.user_id and user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Calculate duration difference for task total_tracked_time
    old_duration = log.get("duration_minutes", 0)
    new_duration = updates.get("duration_minutes", old_duration)
    duration_diff = new_duration - old_duration
    
    allowed_fields = ["duration_minutes", "description", "date", "billable"]
    filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    
    await db.time_logs.update_one({"log_id": log_id}, {"$set": filtered_updates})
    
    # Update task's total_tracked_time if duration changed
    if duration_diff != 0:
        await db.tasks.update_one(
            {"task_id": log["task_id"]},
            {"$inc": {"total_tracked_time": duration_diff}}
        )
    
    return {"message": "Time log updated"}

@api_router.delete("/time-logs/{log_id}")
async def delete_time_log(log_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    log = await db.time_logs.find_one({"log_id": log_id}, {"_id": 0})
    if not log:
        raise HTTPException(status_code=404, detail="Time log not found")
    
    # Only allow deleting own logs or if admin/manager
    if log["user_id"] != user.user_id and user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Update task's total_tracked_time
    await db.tasks.update_one(
        {"task_id": log["task_id"]},
        {"$inc": {"total_tracked_time": -log.get("duration_minutes", 0)}}
    )
    
    await db.time_logs.delete_one({"log_id": log_id})
    
    return {"message": "Time log deleted"}

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
    
    if user.role not in ["admin", "manager", "supervisor"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Supervisors can only update team members, not roles
    if user.role == "supervisor" and "role" in updates:
        raise HTTPException(status_code=403, detail="Supervisors cannot change roles")
    
    await db.users.update_one({"user_id": user_id}, {"$set": updates})
    return {"message": "Team member updated"}

@api_router.get("/roles")
async def get_available_roles(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    # Return roles list with descriptions
    roles_list = []
    for role_id, config in ROLES.items():
        roles_list.append({
            "id": role_id,
            "level": config["level"],
            "description": config["description"],
            "can_view_financial": config["can_view_financial"],
            "can_manage_team": config["can_manage_team"],
            "can_invite_team": config.get("can_invite_team", False)
        })
    
    return sorted(roles_list, key=lambda x: x["level"], reverse=True)

@api_router.get("/user/permissions")
async def get_user_permissions(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    role_config = ROLES.get(user.role, ROLES["team_member"])
    
    return {
        "role": user.role,
        "level": role_config["level"],
        "description": role_config["description"],
        "permissions": {
            "can_view_financial": role_config["can_view_financial"],
            "can_manage_team": role_config["can_manage_team"],
            "can_invite_team": role_config.get("can_invite_team", False),
            "can_edit_all": role_config["can_edit_all"],
            "can_delete_all": role_config["can_delete_all"]
        }
    }

@api_router.delete("/team/{user_id}")
async def delete_team_member(user_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete team members")
    
    if user_id == user.user_id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    
    result = await db.users.delete_one({"user_id": user_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Also delete their sessions
    await db.user_sessions.delete_many({"user_id": user_id})
    
    return {"message": "Team member deleted"}


# ========== TEAM INVITATION SYSTEM ==========

class TeamInvitation(BaseModel):
    model_config = ConfigDict(extra="ignore")
    invitation_id: str
    email: str
    name: str
    role: str = "team_member"
    invited_by: str
    invited_by_name: str
    status: str = "pending"  # pending, accepted, expired, cancelled
    token: str
    expires_at: datetime
    created_at: datetime
    accepted_at: Optional[datetime] = None

class InvitationCreate(BaseModel):
    email: str
    name: str
    role: str = "team_member"

@api_router.post("/team/invitations")
async def create_invitation(payload: InvitationCreate, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    """Send invitation to a new team member (Admin/Manager only)"""
    user = await get_user_from_token(session_token, authorization)
    
    # Check if user can invite
    role_config = ROLES.get(user.role, ROLES["team_member"])
    if not role_config.get("can_invite_team", False):
        raise HTTPException(status_code=403, detail="You don't have permission to invite team members")
    
    # Check if email already exists as user
    existing_user = await db.users.find_one({"email": payload.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="A user with this email already exists")
    
    # Check if there's already a pending invitation
    existing_invitation = await db.team_invitations.find_one({
        "email": payload.email,
        "status": "pending"
    })
    if existing_invitation:
        raise HTTPException(status_code=400, detail="An invitation is already pending for this email")
    
    # Validate role
    if payload.role not in ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    invitation_id = f"inv_{uuid.uuid4().hex[:12]}"
    token = uuid.uuid4().hex
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    invitation_doc = {
        "invitation_id": invitation_id,
        "email": payload.email,
        "name": payload.name,
        "role": payload.role,
        "invited_by": user.user_id,
        "invited_by_name": user.name,
        "status": "pending",
        "token": token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.team_invitations.insert_one(invitation_doc)
    
    # Get app URL for invitation link
    app_url = os.environ.get("APP_URL", "https://advantedge360.co.in")
    
    # Send email via Gmail service
    subject, body_text, body_html = get_invitation_email(
        invitee_name=payload.name,
        inviter_name=user.name,
        role=payload.role,
        app_url=app_url,
        token=token
    )
    
    email_result = await send_email(
        to=payload.email,
        subject=subject,
        body_text=body_text,
        body_html=body_html
    )
    
    # Store email notification record
    email_doc = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "type": "team_invitation",
        "recipient_email": payload.email,
        "recipient_name": payload.name,
        "subject": subject,
        "body": body_text,
        "status": "sent" if email_result.get("success") else "pending",
        "demo_mode": not GMAIL_ENABLED,
        "gmail_message_id": email_result.get("message_id"),
        "error": email_result.get("error"),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.email_notifications.insert_one(email_doc)
    
    return {
        "invitation_id": invitation_id,
        "email": payload.email,
        "name": payload.name,
        "role": payload.role,
        "token": token,
        "expires_at": expires_at.isoformat(),
        "email_sent": email_result.get("success", False),
        "demo_mode": not GMAIL_ENABLED,
        "message": "Invitation created and email sent" if email_result.get("success") else "Invitation created. Email stored (Gmail not configured)"
    }

@api_router.get("/team/invitations")
async def get_invitations(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    """Get all team invitations (Admin/Manager only)"""
    user = await get_user_from_token(session_token, authorization)
    
    role_config = ROLES.get(user.role, ROLES["team_member"])
    if not role_config.get("can_invite_team", False):
        raise HTTPException(status_code=403, detail="You don't have permission to view invitations")
    
    invitations = await db.team_invitations.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    # Check for expired invitations and update status
    now = datetime.now(timezone.utc)
    for inv in invitations:
        if inv["status"] == "pending":
            expires_at = datetime.fromisoformat(inv["expires_at"].replace("Z", "+00:00")) if isinstance(inv["expires_at"], str) else inv["expires_at"]
            if now > expires_at:
                await db.team_invitations.update_one(
                    {"invitation_id": inv["invitation_id"]},
                    {"$set": {"status": "expired"}}
                )
                inv["status"] = "expired"
    
    return invitations

@api_router.delete("/team/invitations/{invitation_id}")
async def cancel_invitation(invitation_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    """Cancel a pending invitation (Admin/Manager only)"""
    user = await get_user_from_token(session_token, authorization)
    
    role_config = ROLES.get(user.role, ROLES["team_member"])
    if not role_config.get("can_invite_team", False):
        raise HTTPException(status_code=403, detail="You don't have permission to cancel invitations")
    
    invitation = await db.team_invitations.find_one({"invitation_id": invitation_id})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    if invitation["status"] != "pending":
        raise HTTPException(status_code=400, detail="Can only cancel pending invitations")
    
    await db.team_invitations.update_one(
        {"invitation_id": invitation_id},
        {"$set": {"status": "cancelled"}}
    )
    
    return {"message": "Invitation cancelled"}

@api_router.post("/team/invitations/{invitation_id}/resend")
async def resend_invitation(invitation_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    """Resend an invitation email (Admin/Manager only)"""
    user = await get_user_from_token(session_token, authorization)
    
    role_config = ROLES.get(user.role, ROLES["team_member"])
    if not role_config.get("can_invite_team", False):
        raise HTTPException(status_code=403, detail="You don't have permission to resend invitations")
    
    invitation = await db.team_invitations.find_one({"invitation_id": invitation_id})
    if not invitation:
        raise HTTPException(status_code=404, detail="Invitation not found")
    
    # Generate new token and extend expiry
    new_token = uuid.uuid4().hex
    new_expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    await db.team_invitations.update_one(
        {"invitation_id": invitation_id},
        {"$set": {
            "token": new_token,
            "expires_at": new_expires_at.isoformat(),
            "status": "pending"
        }}
    )
    
    # Store new email notification
    email_doc = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "type": "team_invitation_resend",
        "recipient_email": invitation["email"],
        "recipient_name": invitation["name"],
        "subject": f"Reminder: You're invited to join AdvantEdge360",
        "body": f"Hi {invitation['name']},\n\nThis is a reminder that {user.name} has invited you to join AdvantEdge360.\n\nNew invitation token: {new_token}\n\nThis invitation expires in 7 days.\n\nBest regards,\nAdvantEdge360 Team",
        "status": "pending",
        "demo_mode": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.email_notifications.insert_one(email_doc)
    
    return {
        "message": "Invitation resent",
        "new_token": new_token,
        "expires_at": new_expires_at.isoformat(),
        "demo_mode": True
    }

@api_router.get("/team/invitations/verify/{token}")
async def verify_invitation(token: str):
    """Verify an invitation token (public endpoint for signup)"""
    invitation = await db.team_invitations.find_one({"token": token}, {"_id": 0})
    
    if not invitation:
        raise HTTPException(status_code=404, detail="Invalid invitation token")
    
    if invitation["status"] != "pending":
        raise HTTPException(status_code=400, detail=f"Invitation is {invitation['status']}")
    
    # Check expiry
    expires_at = datetime.fromisoformat(invitation["expires_at"].replace("Z", "+00:00")) if isinstance(invitation["expires_at"], str) else invitation["expires_at"]
    if datetime.now(timezone.utc) > expires_at:
        await db.team_invitations.update_one(
            {"invitation_id": invitation["invitation_id"]},
            {"$set": {"status": "expired"}}
        )
        raise HTTPException(status_code=400, detail="Invitation has expired")
    
    return {
        "valid": True,
        "email": invitation["email"],
        "name": invitation["name"],
        "role": invitation["role"],
        "invited_by_name": invitation["invited_by_name"]
    }


# ========== CLIENT MANAGEMENT MODELS & ROUTES ==========

class Company(BaseModel):
    model_config = ConfigDict(extra="ignore")
    company_id: str
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    business_address: Optional[str] = None
    phone: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    custom_fields: dict = {}
    status: str = "active"
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None

class CompanyCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    address: Optional[str] = None
    business_address: Optional[str] = None
    phone: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
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
    business_address: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    status: str = "active"
    custom_fields: dict = {}
    notes: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None

class ClientCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    company_id: Optional[str] = None
    address: Optional[str] = None
    business_address: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
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
        "business_address": payload.business_address,
        "phone": payload.phone,
        "gst_number": payload.gst_number,
        "pan_number": payload.pan_number,
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
        if company.get('created_at'):
            if isinstance(company['created_at'], str):
                company['created_at'] = datetime.fromisoformat(company['created_at'])
        else:
            company['created_at'] = datetime.now(timezone.utc)
    return companies

@api_router.get("/companies/{company_id}", response_model=Company)
async def get_company(company_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    if company.get('created_at'):
        if isinstance(company['created_at'], str):
            company['created_at'] = datetime.fromisoformat(company['created_at'])
    else:
        company['created_at'] = datetime.now(timezone.utc)
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

@api_router.get("/companies/{company_id}/overview")
async def get_company_overview(company_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    """Get comprehensive company overview with contacts, projects, proposals, tasks, and financials"""
    user = await get_user_from_token(session_token, authorization)
    
    company = await db.companies.find_one({"company_id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Company not found")
    
    # Get all contacts for this company
    contacts = await db.clients.find({"company_id": company_id}, {"_id": 0}).to_list(1000)
    
    # Get all projects where client_name matches company name or any contact name
    contact_names = [c["name"] for c in contacts]
    all_names = [company["name"]] + contact_names
    projects = await db.projects.find({"client_name": {"$in": all_names}}, {"_id": 0}).to_list(1000)
    
    # Get all proposals for company or contacts
    proposals = await db.proposals.find({"client_name": {"$in": all_names}}, {"_id": 0}).to_list(1000)
    
    # Get tasks for all projects
    project_ids = [p["project_id"] for p in projects]
    tasks = await db.tasks.find({"project_id": {"$in": project_ids}}, {"_id": 0}).to_list(1000) if project_ids else []
    
    # Get fee structure for all projects
    fee_items = await db.fee_structure.find({"project_id": {"$in": project_ids}}, {"_id": 0}).to_list(1000) if project_ids else []
    
    # Calculate financials (if user has access)
    total_revenue = 0
    pending_revenue = 0
    invoices = []
    if user.role in ["admin", "manager", "finance"]:
        # Total project value from fee structure
        total_project_value = sum(f.get("amount", 0) for f in fee_items)
        # Paid revenue from fee structure items with payment_status = 'paid'
        total_revenue = sum(f.get("amount", 0) for f in fee_items if f.get("payment_status") == "paid")
        pending_revenue = total_project_value - total_revenue
        # Also check invoices collection
        for contact in contacts:
            contact_invoices = await db.invoices.find({"client_id": contact.get("client_id")}, {"_id": 0}).to_list(100)
            invoices.extend(contact_invoices)
        total_revenue += sum(inv.get("amount", 0) for inv in invoices if inv.get("status") == "paid")
        pending_revenue += sum(inv.get("amount", 0) for inv in invoices if inv.get("status") == "pending")
    
    return {
        "company": company,
        "contacts": {
            "total": len(contacts),
            "list": contacts
        },
        "projects": {
            "total": len(projects),
            "active": len([p for p in projects if p.get("status") == "active"]),
            "list": projects
        },
        "proposals": {
            "total": len(proposals),
            "approved": len([p for p in proposals if p.get("status") == "approved"]),
            "converted": len([p for p in proposals if p.get("status") == "converted"]),
            "list": proposals
        },
        "tasks": {
            "total": len(tasks),
            "completed": len([t for t in tasks if t.get("status") == "completed"]),
            "in_progress": len([t for t in tasks if t.get("status") == "in_progress"]),
            "list": tasks[:20]  # Latest 20 tasks
        },
        "finance": {
            "total_revenue": total_revenue,
            "pending_revenue": pending_revenue,
            "total_project_value": sum(f.get("amount", 0) for f in fee_items),
            "fee_items_count": len(fee_items),
            "invoices": invoices[:20]
        } if user.role in ["admin", "manager", "finance"] else None
    }

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
        "business_address": payload.business_address,
        "gst_number": payload.gst_number,
        "pan_number": payload.pan_number,
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
        if client.get('created_at'):
            if isinstance(client['created_at'], str):
                client['created_at'] = datetime.fromisoformat(client['created_at'])
        else:
            client['created_at'] = datetime.now(timezone.utc)
    return clients

@api_router.get("/clients/{client_id}", response_model=Client)
async def get_client(client_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    client = await db.clients.find_one({"client_id": client_id}, {"_id": 0})
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")
    
    if client.get('created_at'):
        if isinstance(client['created_at'], str):
            client['created_at'] = datetime.fromisoformat(client['created_at'])
    else:
        client['created_at'] = datetime.now(timezone.utc)
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

# ========== PDF EXPORT FUNCTIONALITY ==========

@api_router.get("/reports/export/projects/pdf")
async def export_projects_pdf(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    pdf_buffer = create_projects_pdf(projects)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=projects_report.pdf"}
    )

@api_router.get("/reports/export/tasks/pdf")
async def export_tasks_pdf(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    tasks = await db.tasks.find({}, {"_id": 0}).to_list(10000)
    pdf_buffer = create_tasks_pdf(tasks)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=tasks_report.pdf"}
    )

@api_router.get("/reports/export/time-logs/pdf")
async def export_time_logs_pdf(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    logs = await db.time_logs.find({}, {"_id": 0}).to_list(10000)
    pdf_buffer = create_time_logs_pdf(logs)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=time_logs_report.pdf"}
    )

@api_router.get("/reports/export/team-productivity/pdf")
async def export_team_productivity_pdf(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    team_members = await db.users.find({}, {"_id": 0}).to_list(1000)
    team_data = []
    
    for member in team_members:
        tasks = await db.tasks.find({"assigned_to": member["user_id"]}, {"_id": 0}).to_list(1000)
        completed_tasks = [t for t in tasks if t.get("status") == "completed"]
        time_logs = await db.time_logs.find({"user_id": member["user_id"]}, {"_id": 0}).to_list(10000)
        total_hours = sum(log.get("duration_minutes", 0) for log in time_logs) / 60
        
        team_data.append({
            "name": member["name"],
            "role": member["role"],
            "total_tasks": len(tasks),
            "completed_tasks": len(completed_tasks),
            "total_hours": round(total_hours, 2)
        })
    
    pdf_buffer = create_team_productivity_pdf(team_data)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=team_productivity_report.pdf"}
    )

@api_router.get("/reports/export/overview/pdf")
async def export_overview_pdf(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    # Gather overview data
    projects_count = await db.projects.count_documents({})
    active_projects = await db.projects.count_documents({"status": "active"})
    tasks_count = await db.tasks.count_documents({})
    completed_tasks = await db.tasks.count_documents({"status": "completed"})
    team_count = await db.users.count_documents({})
    
    time_logs = await db.time_logs.find({}, {"_id": 0}).to_list(10000)
    total_hours = sum(log.get("duration_minutes", 0) for log in time_logs) / 60
    billable_hours = sum(log.get("duration_minutes", 0) for log in time_logs if log.get("billable")) / 60
    
    overview_data = {
        "projects": {"total": projects_count, "active": active_projects},
        "tasks": {
            "total": tasks_count,
            "completed": completed_tasks,
            "completion_rate": (completed_tasks / tasks_count * 100) if tasks_count > 0 else 0
        },
        "team": {"total": team_count},
        "time": {
            "total_hours": round(total_hours, 2),
            "billable_hours": round(billable_hours, 2),
            "non_billable_hours": round(total_hours - billable_hours, 2)
        }
    }
    
    # Add finance data for authorized users
    if user.role in ["admin", "manager", "finance"]:
        invoices = await db.invoices.find({}, {"_id": 0}).to_list(1000)
        expenses = await db.expenses.find({}, {"_id": 0}).to_list(1000)
        
        total_revenue = sum(inv.get("amount", 0) for inv in invoices if inv.get("status") == "paid")
        pending_revenue = sum(inv.get("amount", 0) for inv in invoices if inv.get("status") == "pending")
        total_expenses = sum(exp.get("amount", 0) for exp in expenses)
        
        overview_data["finance"] = {
            "total_revenue": total_revenue,
            "pending_revenue": pending_revenue,
            "total_expenses": total_expenses,
            "profit": total_revenue - total_expenses
        }
    
    pdf_buffer = create_overview_pdf(overview_data)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=overview_report.pdf"}
    )

# Custom Report PDF Export
@api_router.post("/reports/export-custom-pdf")
async def export_custom_report_pdf(payload: dict, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    report_name = payload.get('report_name', 'Custom Report')
    module = payload.get('module', 'Unknown')
    fields = payload.get('fields', [])
    data = payload.get('data', [])
    
    pdf_buffer = io.BytesIO()
    doc = SimpleDocTemplate(pdf_buffer, pagesize=landscape(letter))
    elements = []
    
    # Title
    styles = getSampleStyleSheet()
    title_style = ParagraphStyle('CustomTitle', parent=styles['Heading1'], fontSize=18, spaceAfter=20)
    elements.append(Paragraph(report_name, title_style))
    elements.append(Paragraph(f"Module: {module.replace('_', ' ').title()}", styles['Normal']))
    elements.append(Paragraph(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M')}", styles['Normal']))
    elements.append(Paragraph(f"Records: {len(data)}", styles['Normal']))
    elements.append(Spacer(1, 20))
    
    # Table
    if data and fields:
        # Create header labels
        field_labels = {
            'name': 'Name', 'email': 'Email', 'phone': 'Phone', 'company_name': 'Company',
            'status': 'Status', 'budget': 'Budget', 'client_name': 'Client', 'amount': 'Amount',
            'category': 'Category', 'date': 'Date', 'user_name': 'Employee', 'leave_type': 'Leave Type',
            'start_date': 'Start Date', 'end_date': 'End Date', 'days': 'Days', 'reason': 'Reason',
            'title': 'Title', 'project_name': 'Project', 'priority': 'Priority', 'assignee_name': 'Assignee',
            'duration_minutes': 'Duration', 'billable': 'Billable', 'stage': 'Stage', 'deliverable': 'Deliverable',
            'percentage': '%', 'deliverable_status': 'Deliverable Status', 'invoice_status': 'Invoice Status',
            'payment_status': 'Payment Status', 'industry': 'Industry', 'website': 'Website',
            'business_address': 'Address', 'gst_number': 'GST', 'pan_number': 'PAN', 'role': 'Role',
            'description': 'Description', 'position': 'Position', 'created_at': 'Created', 'completion_percentage': 'Completion %',
            'tentative_billing_date': 'Billing Date', 'date_of_joining': 'DOJ', 'project_id': 'Project ID'
        }
        
        headers = [field_labels.get(f, f) for f in fields]
        table_data = [headers]
        
        for row in data[:100]:  # Limit to 100 rows
            row_data = []
            for f in fields:
                value = row.get(f, '')
                if value is None:
                    value = ''
                elif isinstance(value, bool):
                    value = 'Yes' if value else 'No'
                elif f in ['amount', 'budget'] and isinstance(value, (int, float)):
                    value = f"INR {value:,.0f}"
                elif f == 'duration_minutes' and isinstance(value, (int, float)):
                    value = f"{value:.0f} min"
                row_data.append(str(value)[:30])  # Truncate long values
            table_data.append(row_data)
        
        # Create table with auto-sizing
        col_widths = [min(100, max(50, len(str(h)) * 8)) for h in headers]
        table = Table(table_data, colWidths=col_widths)
        table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.HexColor('#2d3748')),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
            ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('FONTSIZE', (0, 1), (-1, -1), 8),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
            ('TOPPADDING', (0, 1), (-1, -1), 5),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 5),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.gray),
            ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#f7fafc')])
        ]))
        elements.append(table)
    
    doc.build(elements)
    pdf_buffer.seek(0)
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={report_name.replace(' ', '_')}.pdf"}
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

# ========== FEE STRUCTURE MODELS ==========

class FeeStructureItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    item_id: str
    project_id: str
    stage: str
    deliverable: str
    percentage: float
    amount: float
    tentative_billing_date: Optional[str] = None
    deliverable_status: str = "not_started"  # not_started, in_progress, on_hold, completed
    invoice_status: str = "not_invoiced"  # not_invoiced, invoiced, paid
    payment_status: str = "pending"  # pending, received
    created_at: datetime
    updated_at: Optional[datetime] = None

class FeeStructureCreate(BaseModel):
    project_id: str
    stage: str
    deliverable: str
    percentage: float
    amount: float
    tentative_billing_date: Optional[str] = None
    deliverable_status: str = "not_started"
    invoice_status: str = "not_invoiced"
    payment_status: str = "pending"

# ========== TEAM SALARY MODELS ==========

class TeamSalary(BaseModel):
    model_config = ConfigDict(extra="ignore")
    salary_id: str
    user_id: str
    user_name: str
    monthly_salary: float
    hourly_rate: float
    daily_rate: float
    created_at: datetime
    updated_at: Optional[datetime] = None

class TeamSalaryCreate(BaseModel):
    user_id: str
    monthly_salary: float
    hourly_rate: float
    daily_rate: float

# ========== CASH FLOW EXPENSE MODELS ==========

class CashFlowExpense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    expense_id: str
    expense_head: str
    sub_head: Optional[str] = None
    month_year: str  # Format: "2025-01", "2025-02", etc.
    amount: float
    created_at: datetime
    updated_at: Optional[datetime] = None

class CashFlowExpenseCreate(BaseModel):
    expense_head: str
    sub_head: Optional[str] = None
    month_year: str
    amount: float

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

@api_router.patch("/expenses/{expense_id}")
async def update_expense(expense_id: str, updates: dict, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    expense = await db.expenses.find_one({"expense_id": expense_id}, {"_id": 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    allowed_fields = ["category", "amount", "description", "date", "project_id"]
    filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    
    await db.expenses.update_one({"expense_id": expense_id}, {"$set": filtered_updates})
    return {"message": "Expense updated"}

@api_router.delete("/expenses/{expense_id}")
async def delete_expense(expense_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.expenses.delete_one({"expense_id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Expense not found")
    
    return {"message": "Expense deleted"}

# ========== FEE STRUCTURE ROUTES ==========

@api_router.post("/fee-structure", response_model=FeeStructureItem)
async def create_fee_structure_item(payload: FeeStructureCreate, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    item_id = f"fee_{uuid.uuid4().hex[:12]}"
    item_doc = {
        "item_id": item_id,
        "project_id": payload.project_id,
        "stage": payload.stage,
        "deliverable": payload.deliverable,
        "percentage": payload.percentage,
        "amount": payload.amount,
        "tentative_billing_date": payload.tentative_billing_date,
        "deliverable_status": payload.deliverable_status,
        "invoice_status": payload.invoice_status,
        "payment_status": payload.payment_status,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": None
    }
    
    await db.fee_structure.insert_one(item_doc)
    item_doc['created_at'] = datetime.fromisoformat(item_doc['created_at'])
    return FeeStructureItem(**item_doc)

@api_router.get("/fee-structure", response_model=List[FeeStructureItem])
async def get_fee_structure(project_id: Optional[str] = None, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    query = {"project_id": project_id} if project_id else {}
    items = await db.fee_structure.find(query, {"_id": 0}).to_list(1000)
    for item in items:
        if isinstance(item.get('created_at'), str):
            item['created_at'] = datetime.fromisoformat(item['created_at'])
        if item.get('updated_at') and isinstance(item['updated_at'], str):
            item['updated_at'] = datetime.fromisoformat(item['updated_at'])
    return items

@api_router.patch("/fee-structure/{item_id}")
async def update_fee_structure_item(item_id: str, updates: dict, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    item = await db.fee_structure.find_one({"item_id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Fee structure item not found")
    
    allowed_fields = ["stage", "deliverable", "percentage", "amount", "tentative_billing_date", 
                      "deliverable_status", "invoice_status", "payment_status"]
    filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    filtered_updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.fee_structure.update_one({"item_id": item_id}, {"$set": filtered_updates})
    return {"message": "Fee structure item updated"}

@api_router.delete("/fee-structure/{item_id}")
async def delete_fee_structure_item(item_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.fee_structure.delete_one({"item_id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Fee structure item not found")
    
    return {"message": "Fee structure item deleted"}

# ========== TEAM SALARY ROUTES ==========

@api_router.post("/team-salaries", response_model=TeamSalary)
async def create_team_salary(payload: TeamSalaryCreate, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    # Get user name
    team_member = await db.users.find_one({"user_id": payload.user_id}, {"_id": 0})
    if not team_member:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check if salary entry already exists for this user
    existing = await db.team_salaries.find_one({"user_id": payload.user_id}, {"_id": 0})
    if existing:
        # Update instead of create
        await db.team_salaries.update_one(
            {"user_id": payload.user_id},
            {"$set": {
                "monthly_salary": payload.monthly_salary,
                "hourly_rate": payload.hourly_rate,
                "daily_rate": payload.daily_rate,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        updated = await db.team_salaries.find_one({"user_id": payload.user_id}, {"_id": 0})
        if isinstance(updated.get('created_at'), str):
            updated['created_at'] = datetime.fromisoformat(updated['created_at'])
        if updated.get('updated_at') and isinstance(updated['updated_at'], str):
            updated['updated_at'] = datetime.fromisoformat(updated['updated_at'])
        return TeamSalary(**updated)
    
    salary_id = f"sal_{uuid.uuid4().hex[:12]}"
    salary_doc = {
        "salary_id": salary_id,
        "user_id": payload.user_id,
        "user_name": team_member.get('name', 'Unknown'),
        "monthly_salary": payload.monthly_salary,
        "hourly_rate": payload.hourly_rate,
        "daily_rate": payload.daily_rate,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": None
    }
    
    await db.team_salaries.insert_one(salary_doc)
    salary_doc['created_at'] = datetime.fromisoformat(salary_doc['created_at'])
    return TeamSalary(**salary_doc)

@api_router.get("/team-salaries", response_model=List[TeamSalary])
async def get_team_salaries(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    salaries = await db.team_salaries.find({}, {"_id": 0}).to_list(1000)
    for salary in salaries:
        if isinstance(salary.get('created_at'), str):
            salary['created_at'] = datetime.fromisoformat(salary['created_at'])
        if salary.get('updated_at') and isinstance(salary['updated_at'], str):
            salary['updated_at'] = datetime.fromisoformat(salary['updated_at'])
    return salaries

@api_router.patch("/team-salaries/{salary_id}")
async def update_team_salary(salary_id: str, updates: dict, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    salary = await db.team_salaries.find_one({"salary_id": salary_id}, {"_id": 0})
    if not salary:
        raise HTTPException(status_code=404, detail="Salary record not found")
    
    allowed_fields = ["monthly_salary", "hourly_rate", "daily_rate"]
    filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    filtered_updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.team_salaries.update_one({"salary_id": salary_id}, {"$set": filtered_updates})
    return {"message": "Salary updated"}

@api_router.delete("/team-salaries/{salary_id}")
async def delete_team_salary(salary_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.team_salaries.delete_one({"salary_id": salary_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Salary record not found")
    
    return {"message": "Salary deleted"}

# ========== CASH FLOW EXPENSE ROUTES ==========

@api_router.post("/cashflow-expenses", response_model=CashFlowExpense)
async def create_cashflow_expense(payload: CashFlowExpenseCreate, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    expense_id = f"cfe_{uuid.uuid4().hex[:12]}"
    expense_doc = {
        "expense_id": expense_id,
        "expense_head": payload.expense_head,
        "sub_head": payload.sub_head,
        "month_year": payload.month_year,
        "amount": payload.amount,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": None
    }
    
    await db.cashflow_expenses.insert_one(expense_doc)
    expense_doc['created_at'] = datetime.fromisoformat(expense_doc['created_at'])
    return CashFlowExpense(**expense_doc)

@api_router.get("/cashflow-expenses", response_model=List[CashFlowExpense])
async def get_cashflow_expenses(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    expenses = await db.cashflow_expenses.find({}, {"_id": 0}).to_list(1000)
    for expense in expenses:
        if isinstance(expense.get('created_at'), str):
            expense['created_at'] = datetime.fromisoformat(expense['created_at'])
        if expense.get('updated_at') and isinstance(expense['updated_at'], str):
            expense['updated_at'] = datetime.fromisoformat(expense['updated_at'])
    return expenses

@api_router.patch("/cashflow-expenses/{expense_id}")
async def update_cashflow_expense(expense_id: str, updates: dict, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    expense = await db.cashflow_expenses.find_one({"expense_id": expense_id}, {"_id": 0})
    if not expense:
        raise HTTPException(status_code=404, detail="Cash flow expense not found")
    
    allowed_fields = ["expense_head", "sub_head", "month_year", "amount"]
    filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    filtered_updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.cashflow_expenses.update_one({"expense_id": expense_id}, {"$set": filtered_updates})
    return {"message": "Cash flow expense updated"}

@api_router.delete("/cashflow-expenses/{expense_id}")
async def delete_cashflow_expense(expense_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await db.cashflow_expenses.delete_one({"expense_id": expense_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Cash flow expense not found")
    
    return {"message": "Cash flow expense deleted"}

# ========== PUBLIC HOLIDAYS & LEAVE ACCRUAL MODELS ==========

class PublicHoliday(BaseModel):
    model_config = ConfigDict(extra="ignore")
    holiday_id: str
    name: str
    date: str  # YYYY-MM-DD
    year: int
    created_at: datetime
    created_by: str

class PublicHolidayCreate(BaseModel):
    name: str
    date: str
    year: int

class LeaveAccrualPolicy(BaseModel):
    model_config = ConfigDict(extra="ignore")
    policy_id: str
    leave_type: str  # casual, sick, earned, etc.
    accrual_per_month: float  # days earned per month
    max_carry_forward: float  # max days that can be carried to next year
    max_accumulation: float  # max balance allowed
    created_at: datetime
    updated_at: Optional[datetime] = None

class LeaveAccrualPolicyCreate(BaseModel):
    leave_type: str
    accrual_per_month: float
    max_carry_forward: float = 0
    max_accumulation: float = 30

class LeaveBalance(BaseModel):
    model_config = ConfigDict(extra="ignore")
    balance_id: str
    user_id: str
    user_name: str
    leave_type: str
    balance: float
    year: int
    created_at: datetime
    updated_at: Optional[datetime] = None

# ========== PUBLIC HOLIDAYS ROUTES ==========

@api_router.get("/public-holidays", response_model=List[PublicHoliday])
async def get_public_holidays(year: Optional[int] = None, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    query = {"year": year} if year else {}
    holidays = await db.public_holidays.find(query, {"_id": 0}).to_list(1000)
    for h in holidays:
        if isinstance(h.get('created_at'), str):
            h['created_at'] = datetime.fromisoformat(h['created_at'])
    return holidays

@api_router.post("/public-holidays", response_model=PublicHoliday)
async def create_public_holiday(payload: PublicHolidayCreate, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can manage public holidays")
    
    holiday_id = f"holiday_{uuid.uuid4().hex[:12]}"
    holiday_doc = {
        "holiday_id": holiday_id,
        "name": payload.name,
        "date": payload.date,
        "year": payload.year,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user.user_id
    }
    
    await db.public_holidays.insert_one(holiday_doc)
    holiday_doc['created_at'] = datetime.fromisoformat(holiday_doc['created_at'])
    return PublicHoliday(**holiday_doc)

@api_router.patch("/public-holidays/{holiday_id}")
async def update_public_holiday(holiday_id: str, updates: dict, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can manage public holidays")
    
    allowed_fields = ["name", "date", "year"]
    filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    
    await db.public_holidays.update_one({"holiday_id": holiday_id}, {"$set": filtered_updates})
    return {"message": "Public holiday updated"}

@api_router.delete("/public-holidays/{holiday_id}")
async def delete_public_holiday(holiday_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can manage public holidays")
    
    result = await db.public_holidays.delete_one({"holiday_id": holiday_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Public holiday not found")
    
    return {"message": "Public holiday deleted"}

# ========== LEAVE ACCRUAL POLICY ROUTES ==========

@api_router.get("/leave-accrual-policies", response_model=List[LeaveAccrualPolicy])
async def get_leave_accrual_policies(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    policies = await db.leave_accrual_policies.find({}, {"_id": 0}).to_list(100)
    for p in policies:
        if isinstance(p.get('created_at'), str):
            p['created_at'] = datetime.fromisoformat(p['created_at'])
        if p.get('updated_at') and isinstance(p['updated_at'], str):
            p['updated_at'] = datetime.fromisoformat(p['updated_at'])
    return policies

@api_router.post("/leave-accrual-policies", response_model=LeaveAccrualPolicy)
async def create_leave_accrual_policy(payload: LeaveAccrualPolicyCreate, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can manage leave policies")
    
    # Check if policy for this leave type already exists
    existing = await db.leave_accrual_policies.find_one({"leave_type": payload.leave_type}, {"_id": 0})
    if existing:
        # Update existing
        await db.leave_accrual_policies.update_one(
            {"leave_type": payload.leave_type},
            {"$set": {
                "accrual_per_month": payload.accrual_per_month,
                "max_carry_forward": payload.max_carry_forward,
                "max_accumulation": payload.max_accumulation,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        updated = await db.leave_accrual_policies.find_one({"leave_type": payload.leave_type}, {"_id": 0})
        if isinstance(updated.get('created_at'), str):
            updated['created_at'] = datetime.fromisoformat(updated['created_at'])
        if updated.get('updated_at') and isinstance(updated['updated_at'], str):
            updated['updated_at'] = datetime.fromisoformat(updated['updated_at'])
        return LeaveAccrualPolicy(**updated)
    
    policy_id = f"policy_{uuid.uuid4().hex[:12]}"
    policy_doc = {
        "policy_id": policy_id,
        "leave_type": payload.leave_type,
        "accrual_per_month": payload.accrual_per_month,
        "max_carry_forward": payload.max_carry_forward,
        "max_accumulation": payload.max_accumulation,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": None
    }
    
    await db.leave_accrual_policies.insert_one(policy_doc)
    policy_doc['created_at'] = datetime.fromisoformat(policy_doc['created_at'])
    return LeaveAccrualPolicy(**policy_doc)

@api_router.patch("/leave-accrual-policies/{policy_id}")
async def update_leave_accrual_policy(policy_id: str, updates: dict, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can manage leave policies")
    
    allowed_fields = ["accrual_per_month", "max_carry_forward", "max_accumulation"]
    filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    filtered_updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.leave_accrual_policies.update_one({"policy_id": policy_id}, {"$set": filtered_updates})
    return {"message": "Leave accrual policy updated"}

@api_router.delete("/leave-accrual-policies/{policy_id}")
async def delete_leave_accrual_policy(policy_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can manage leave policies")
    
    result = await db.leave_accrual_policies.delete_one({"policy_id": policy_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Leave accrual policy not found")
    
    return {"message": "Leave accrual policy deleted"}

# ========== LEAVE BALANCE ROUTES ==========

@api_router.get("/leave-balances")
async def get_leave_balances(user_id: Optional[str] = None, year: Optional[int] = None, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    current_year = year or datetime.now().year
    
    # Get all team members
    if user.role in ["admin", "manager", "supervisor"]:
        query = {}
        if user_id:
            query["user_id"] = user_id
    else:
        query = {"user_id": user.user_id}
    
    team_members = await db.users.find(query, {"_id": 0}).to_list(1000)
    policies = await db.leave_accrual_policies.find({}, {"_id": 0}).to_list(100)
    
    balances = []
    for member in team_members:
        member_id = member.get('user_id')
        member_name = member.get('name', 'Unknown')
        date_of_joining = member.get('date_of_joining')
        
        # Calculate months worked
        if date_of_joining:
            try:
                doj = datetime.fromisoformat(date_of_joining.replace('Z', '+00:00')) if isinstance(date_of_joining, str) else date_of_joining
                now = datetime.now(timezone.utc)
                # Calculate full months worked
                months_worked = (now.year - doj.year) * 12 + (now.month - doj.month)
                if now.day < doj.day:
                    months_worked -= 1
                months_worked = max(0, months_worked)
            except:
                months_worked = 12  # Default to 12 if DOJ not parseable
        else:
            months_worked = 12  # Default
        
        for policy in policies:
            leave_type = policy.get('leave_type')
            accrual_per_month = policy.get('accrual_per_month', 0)
            max_accumulation = policy.get('max_accumulation', 30)
            
            # Check existing balance record
            existing = await db.leave_balances.find_one({
                "user_id": member_id,
                "leave_type": leave_type,
                "year": current_year
            }, {"_id": 0})
            
            if existing:
                balance = existing.get('balance', 0)
            else:
                # Calculate accrued balance based on months worked
                accrued = months_worked * accrual_per_month
                balance = min(accrued, max_accumulation)
            
            # Get used leaves for this type
            leaves_query = {
                "user_id": member_id,
                "leave_type": leave_type,
                "status": {"$in": ["approved", "pending"]}
            }
            used_leaves = await db.leaves.find(leaves_query, {"_id": 0}).to_list(1000)
            
            total_used = 0
            for leave in used_leaves:
                if leave.get('days'):
                    total_used += leave['days']
            
            available_balance = balance - total_used
            
            balances.append({
                "user_id": member_id,
                "user_name": member_name,
                "leave_type": leave_type,
                "accrued_balance": balance,
                "used": total_used,
                "available": available_balance,
                "months_worked": months_worked,
                "year": current_year
            })
    
    return balances

@api_router.post("/leave-balances/adjust")
async def adjust_leave_balance(payload: dict, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can adjust leave balances")
    
    user_id = payload.get('user_id')
    leave_type = payload.get('leave_type')
    new_balance = payload.get('balance')
    year = payload.get('year', datetime.now().year)
    
    if not all([user_id, leave_type, new_balance is not None]):
        raise HTTPException(status_code=400, detail="Missing required fields")
    
    # Upsert balance
    await db.leave_balances.update_one(
        {"user_id": user_id, "leave_type": leave_type, "year": year},
        {"$set": {
            "balance": new_balance,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"message": "Leave balance adjusted"}

# ========== EMAIL NOTIFICATION SERVICE (DEMO MODE) ==========

async def send_email_notification(to_email: str, subject: str, body: str):
    """
    Demo mode email notification service.
    In production, this will use Gmail API with provided credentials.
    """
    # Log the email that would be sent (demo mode)
    print(f"[EMAIL DEMO] To: {to_email}, Subject: {subject}")
    print(f"[EMAIL DEMO] Body: {body[:100]}...")
    
    # Store notification in database for demo purposes
    notification_doc = {
        "notification_id": f"notif_{uuid.uuid4().hex[:12]}",
        "to_email": to_email,
        "subject": subject,
        "body": body,
        "status": "demo_sent",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.email_notifications.insert_one(notification_doc)
    return True

# ========== PHASE 2: TEAM MANAGEMENT ROUTES ==========

# --- Leave Applications ---

@api_router.post("/leaves", response_model=LeaveApplication)
async def create_leave_application(payload: LeaveCreate, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    # Calculate days
    start = datetime.strptime(payload.start_date, "%Y-%m-%d")
    end = datetime.strptime(payload.end_date, "%Y-%m-%d")
    days = (end - start).days + 1
    
    leave_id = str(uuid.uuid4())
    leave_doc = {
        "leave_id": leave_id,
        "user_id": user.user_id,
        "user_name": user.name,
        "leave_type": payload.leave_type,
        "start_date": payload.start_date,
        "end_date": payload.end_date,
        "days": days,
        "reason": payload.reason,
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    await db.leaves.insert_one(leave_doc)
    
    leave_doc["created_at"] = leave_doc["created_at"]
    return LeaveApplication(**leave_doc)

@api_router.get("/leaves")
async def get_leave_applications(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    # Team members see only their own, supervisors/managers see team's
    if user.role in ["admin", "manager", "supervisor"]:
        leaves = await db.leaves.find({}, {"_id": 0}).to_list(1000)
    else:
        leaves = await db.leaves.find({"user_id": user.user_id}, {"_id": 0}).to_list(100)
    
    for leave in leaves:
        if isinstance(leave['created_at'], str):
            leave['created_at'] = datetime.fromisoformat(leave['created_at'])
    
    return leaves

@api_router.patch("/leaves/{leave_id}/approve")
async def approve_leave(leave_id: str, comments: Optional[str] = None, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "supervisor"]:
        raise HTTPException(status_code=403, detail="Not authorized to approve leaves")
    
    leave = await db.leaves.find_one({"leave_id": leave_id}, {"_id": 0})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave application not found")
    
    await db.leaves.update_one(
        {"leave_id": leave_id},
        {"$set": {"status": "approved", "approved_by": user.user_id, "approver_comments": comments}}
    )
    
    # Send email notification (demo mode)
    applicant = await db.users.find_one({"user_id": leave["user_id"]}, {"_id": 0})
    if applicant and applicant.get("email"):
        await send_email_notification(
            to_email=applicant["email"],
            subject=f"Leave Application Approved - {leave['leave_type'].title()}",
            body=f"Your leave application from {leave['start_date']} to {leave['end_date']} has been approved by {user.name}." + (f"\n\nComments: {comments}" if comments else "")
        )
    
    return {"message": "Leave approved"}

@api_router.patch("/leaves/{leave_id}/reject")
async def reject_leave(leave_id: str, comments: Optional[str] = None, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "supervisor"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    leave = await db.leaves.find_one({"leave_id": leave_id}, {"_id": 0})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave application not found")
    
    await db.leaves.update_one(
        {"leave_id": leave_id},
        {"$set": {"status": "rejected", "approved_by": user.user_id, "approver_comments": comments}}
    )
    
    # Send email notification (demo mode)
    applicant = await db.users.find_one({"user_id": leave["user_id"]}, {"_id": 0})
    if applicant and applicant.get("email"):
        await send_email_notification(
            to_email=applicant["email"],
            subject=f"Leave Application Rejected - {leave['leave_type'].title()}",
            body=f"Your leave application from {leave['start_date']} to {leave['end_date']} has been rejected by {user.name}." + (f"\n\nReason: {comments}" if comments else "")
        )
    
    return {"message": "Leave rejected"}
    
    return {"message": "Leave rejected"}

@api_router.delete("/leaves/{leave_id}")
async def delete_leave(leave_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    leave = await db.leaves.find_one({"leave_id": leave_id}, {"_id": 0})
    if not leave:
        raise HTTPException(status_code=404, detail="Leave not found")
    
    # Only owner can delete pending, admins can delete any
    if leave["user_id"] != user.user_id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if leave["status"] != "pending" and user.role != "admin":
        raise HTTPException(status_code=400, detail="Cannot delete processed leave")
    
    await db.leaves.delete_one({"leave_id": leave_id})
    return {"message": "Leave deleted"}

# --- Reimbursements ---

# File upload directory
UPLOAD_DIR = Path("/app/backend/uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

@api_router.post("/upload/receipt")
async def upload_receipt(file: UploadFile = File(...), session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, and PDF files are allowed")
    
    # Validate file size (5MB max)
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be under 5MB")
    
    # Generate unique filename
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'bin'
    unique_filename = f"receipt_{uuid.uuid4().hex[:12]}.{file_ext}"
    
    # Try to upload to Google Drive first
    if GDRIVE_ENABLED:
        gdrive_result = await upload_file_to_drive(
            file_content=content,
            filename=unique_filename,
            mime_type=file.content_type,
            folder_type="receipts"
        )
        
        if gdrive_result.get('success'):
            return {
                "file_url": gdrive_result.get('view_link'),
                "download_url": gdrive_result.get('download_link'),
                "file_id": gdrive_result.get('file_id'),
                "filename": unique_filename,
                "storage": "google_drive"
            }
    
    # Fallback to local storage
    file_path = UPLOAD_DIR / unique_filename
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    file_url = f"/api/uploads/{unique_filename}"
    
    return {"file_url": file_url, "filename": unique_filename, "storage": "local"}

@api_router.get("/uploads/{filename}")
async def get_uploaded_file(filename: str):
    file_path = UPLOAD_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    # Determine content type
    if filename.endswith('.pdf'):
        content_type = 'application/pdf'
    elif filename.endswith('.png'):
        content_type = 'image/png'
    else:
        content_type = 'image/jpeg'
    
    async def file_iterator():
        async with aiofiles.open(file_path, 'rb') as f:
            while chunk := await f.read(8192):
                yield chunk
    
    return StreamingResponse(file_iterator(), media_type=content_type)

@api_router.post("/upload/document")
async def upload_document(
    file: UploadFile = File(...),
    folder_type: str = Query("documents", description="Folder type: proposals, documents, attachments"),
    subfolder: str = Query(None, description="Optional subfolder name (e.g., project name)"),
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Upload a document to Google Drive"""
    user = await get_user_from_token(session_token, authorization)
    
    # Validate file size (10MB max for documents)
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File size must be under 10MB")
    
    # Generate unique filename
    file_ext = file.filename.split('.')[-1] if '.' in file.filename else 'bin'
    original_name = file.filename.rsplit('.', 1)[0] if '.' in file.filename else file.filename
    unique_filename = f"{original_name}_{uuid.uuid4().hex[:8]}.{file_ext}"
    
    # Try to upload to Google Drive
    if GDRIVE_ENABLED:
        gdrive_result = await upload_file_to_drive(
            file_content=content,
            filename=unique_filename,
            mime_type=file.content_type or 'application/octet-stream',
            folder_type=folder_type,
            subfolder_name=subfolder
        )
        
        if gdrive_result.get('success'):
            return {
                "file_url": gdrive_result.get('view_link'),
                "download_url": gdrive_result.get('download_link'),
                "file_id": gdrive_result.get('file_id'),
                "filename": unique_filename,
                "original_filename": file.filename,
                "storage": "google_drive"
            }
        else:
            # If Drive upload failed, return error
            raise HTTPException(status_code=500, detail=f"Failed to upload to Google Drive: {gdrive_result.get('error')}")
    
    # Fallback to local storage if Drive not enabled
    file_path = UPLOAD_DIR / unique_filename
    async with aiofiles.open(file_path, 'wb') as f:
        await f.write(content)
    
    return {
        "file_url": f"/api/uploads/{unique_filename}",
        "filename": unique_filename,
        "original_filename": file.filename,
        "storage": "local"
    }

@api_router.get("/gdrive/files")
async def list_gdrive_files(
    folder_type: str = Query(None, description="Folder type: receipts, proposals, documents, attachments"),
    subfolder: str = Query(None, description="Optional subfolder name"),
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """List files in Google Drive folder"""
    user = await get_user_from_token(session_token, authorization)
    
    if not GDRIVE_ENABLED:
        return {"success": False, "demo_mode": True, "files": []}
    
    result = await list_files_in_folder(folder_type, subfolder)
    return result

@api_router.post("/reimbursements", response_model=Reimbursement)
async def create_reimbursement(payload: ReimbursementCreate, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    reimbursement_id = str(uuid.uuid4())
    reimbursement_doc = {
        "reimbursement_id": reimbursement_id,
        "user_id": user.user_id,
        "user_name": user.name,
        "category": payload.category,
        "amount": payload.amount,
        "description": payload.description,
        "date": payload.date,
        "project_id": payload.project_id,
        "receipt_url": None,
        "is_internal": payload.project_id is None,
        "status": "pending",
        "created_at": datetime.now(timezone.utc)
    }
    await db.reimbursements.insert_one(reimbursement_doc)
    
    return Reimbursement(**reimbursement_doc)

@api_router.patch("/reimbursements/{reimbursement_id}/upload-receipt")
async def update_reimbursement_receipt(reimbursement_id: str, receipt_url: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    reimbursement = await db.reimbursements.find_one({"reimbursement_id": reimbursement_id}, {"_id": 0})
    if not reimbursement:
        raise HTTPException(status_code=404, detail="Reimbursement not found")
    
    # Only owner or admin can update receipt
    if reimbursement["user_id"] != user.user_id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.reimbursements.update_one(
        {"reimbursement_id": reimbursement_id},
        {"$set": {"receipt_url": receipt_url}}
    )
    
    return {"message": "Receipt uploaded"}

@api_router.get("/reimbursements")
async def get_reimbursements(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role in ["admin", "manager", "supervisor", "finance"]:
        reimbursements = await db.reimbursements.find({}, {"_id": 0}).to_list(1000)
    else:
        reimbursements = await db.reimbursements.find({"user_id": user.user_id}, {"_id": 0}).to_list(100)
    
    for r in reimbursements:
        if isinstance(r['created_at'], str):
            r['created_at'] = datetime.fromisoformat(r['created_at'])
    
    return reimbursements

@api_router.patch("/reimbursements/{reimbursement_id}/approve")
async def approve_reimbursement(reimbursement_id: str, comments: Optional[str] = None, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "supervisor", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    reimbursement = await db.reimbursements.find_one({"reimbursement_id": reimbursement_id}, {"_id": 0})
    if not reimbursement:
        raise HTTPException(status_code=404, detail="Reimbursement not found")
    
    await db.reimbursements.update_one(
        {"reimbursement_id": reimbursement_id},
        {"$set": {"status": "approved", "approved_by": user.user_id, "approver_comments": comments}}
    )
    
    # Send email notification (demo mode)
    applicant = await db.users.find_one({"user_id": reimbursement["user_id"]}, {"_id": 0})
    if applicant and applicant.get("email"):
        await send_email_notification(
            to_email=applicant["email"],
            subject=f"Reimbursement Approved - INR {reimbursement['amount']}",
            body=f"Your reimbursement request for INR {reimbursement['amount']} ({reimbursement['category']}) has been approved by {user.name}." + (f"\n\nComments: {comments}" if comments else "")
        )
    
    return {"message": "Reimbursement approved"}

@api_router.patch("/reimbursements/{reimbursement_id}/reject")
async def reject_reimbursement(reimbursement_id: str, comments: Optional[str] = None, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "supervisor", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    reimbursement = await db.reimbursements.find_one({"reimbursement_id": reimbursement_id}, {"_id": 0})
    if not reimbursement:
        raise HTTPException(status_code=404, detail="Reimbursement not found")
    
    await db.reimbursements.update_one(
        {"reimbursement_id": reimbursement_id},
        {"$set": {"status": "rejected", "approved_by": user.user_id, "approver_comments": comments}}
    )
    
    # Send email notification (demo mode)
    applicant = await db.users.find_one({"user_id": reimbursement["user_id"]}, {"_id": 0})
    if applicant and applicant.get("email"):
        await send_email_notification(
            to_email=applicant["email"],
            subject=f"Reimbursement Rejected - INR {reimbursement['amount']}",
            body=f"Your reimbursement request for INR {reimbursement['amount']} ({reimbursement['category']}) has been rejected by {user.name}." + (f"\n\nReason: {comments}" if comments else "")
        )
    
    return {"message": "Reimbursement rejected"}

@api_router.patch("/reimbursements/{reimbursement_id}/mark-paid")
async def mark_reimbursement_paid(reimbursement_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "finance"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    reimbursement = await db.reimbursements.find_one({"reimbursement_id": reimbursement_id}, {"_id": 0})
    if not reimbursement:
        raise HTTPException(status_code=404, detail="Reimbursement not found")
    
    await db.reimbursements.update_one(
        {"reimbursement_id": reimbursement_id},
        {"$set": {"status": "paid"}}
    )
    
    # Send email notification (demo mode)
    applicant = await db.users.find_one({"user_id": reimbursement["user_id"]}, {"_id": 0})
    if applicant and applicant.get("email"):
        await send_email_notification(
            to_email=applicant["email"],
            subject=f"Reimbursement Paid - INR {reimbursement['amount']}",
            body=f"Your reimbursement request for INR {reimbursement['amount']} ({reimbursement['category']}) has been marked as paid."
        )
    
    return {"message": "Reimbursement marked as paid"}

@api_router.delete("/reimbursements/{reimbursement_id}")
async def delete_reimbursement(reimbursement_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    r = await db.reimbursements.find_one({"reimbursement_id": reimbursement_id}, {"_id": 0})
    if not r:
        raise HTTPException(status_code=404, detail="Reimbursement not found")
    
    if r["user_id"] != user.user_id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    if r["status"] != "pending" and user.role != "admin":
        raise HTTPException(status_code=400, detail="Cannot delete processed reimbursement")
    
    await db.reimbursements.delete_one({"reimbursement_id": reimbursement_id})
    return {"message": "Reimbursement deleted"}

# --- Performance Reviews ---

@api_router.post("/performance-reviews", response_model=PerformanceReview)
async def create_performance_review(payload: PerformanceReviewCreate, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "supervisor"]:
        raise HTTPException(status_code=403, detail="Not authorized to create reviews")
    
    # Get the user being reviewed
    reviewed_user = await db.users.find_one({"user_id": payload.user_id}, {"_id": 0})
    if not reviewed_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    review_id = str(uuid.uuid4())
    review_doc = {
        "review_id": review_id,
        "user_id": payload.user_id,
        "user_name": reviewed_user["name"],
        "reviewer_id": user.user_id,
        "reviewer_name": user.name,
        "review_period": payload.review_period,
        "overall_rating": payload.overall_rating,
        "strengths": payload.strengths,
        "areas_for_improvement": payload.areas_for_improvement,
        "goals": payload.goals,
        "comments": payload.comments,
        "status": "draft",
        "created_at": datetime.now(timezone.utc)
    }
    await db.performance_reviews.insert_one(review_doc)
    
    return PerformanceReview(**review_doc)

@api_router.get("/performance-reviews")
async def get_performance_reviews(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role in ["admin", "manager", "supervisor"]:
        reviews = await db.performance_reviews.find({}, {"_id": 0}).to_list(1000)
    else:
        # Team members see only their own reviews
        reviews = await db.performance_reviews.find({"user_id": user.user_id}, {"_id": 0}).to_list(100)
    
    for r in reviews:
        if isinstance(r['created_at'], str):
            r['created_at'] = datetime.fromisoformat(r['created_at'])
    
    return reviews

@api_router.patch("/performance-reviews/{review_id}")
async def update_performance_review(review_id: str, updates: dict, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    review = await db.performance_reviews.find_one({"review_id": review_id}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    # Only reviewer or admin can edit
    if review["reviewer_id"] != user.user_id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    allowed_fields = ["overall_rating", "strengths", "areas_for_improvement", "goals", "comments", "status"]
    filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    
    await db.performance_reviews.update_one({"review_id": review_id}, {"$set": filtered_updates})
    return {"message": "Review updated"}

@api_router.patch("/performance-reviews/{review_id}/submit")
async def submit_performance_review(review_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    review = await db.performance_reviews.find_one({"review_id": review_id}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    if review["reviewer_id"] != user.user_id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.performance_reviews.update_one(
        {"review_id": review_id},
        {"$set": {"status": "submitted"}}
    )
    
    return {"message": "Review submitted"}

@api_router.patch("/performance-reviews/{review_id}/acknowledge")
async def acknowledge_performance_review(review_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    review = await db.performance_reviews.find_one({"review_id": review_id}, {"_id": 0})
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    
    # Only the reviewed person can acknowledge
    if review["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Only the reviewed person can acknowledge")
    
    await db.performance_reviews.update_one(
        {"review_id": review_id},
        {"$set": {"status": "acknowledged"}}
    )
    
    return {"message": "Review acknowledged"}

@api_router.delete("/performance-reviews/{review_id}")
async def delete_performance_review(review_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admin can delete reviews")
    
    result = await db.performance_reviews.delete_one({"review_id": review_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Review not found")
    
    return {"message": "Review deleted"}

# --- Onboarding Forms ---

@api_router.post("/onboarding", response_model=OnboardingForm)
async def create_onboarding_form(payload: OnboardingFormCreate, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    # Check if form already exists
    existing = await db.onboarding_forms.find_one({"user_id": user.user_id}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Onboarding form already exists")
    
    form_id = str(uuid.uuid4())
    form_doc = {
        "form_id": form_id,
        "user_id": user.user_id,
        "status": "pending",
        "full_name": payload.full_name,
        "date_of_birth": payload.date_of_birth,
        "phone": payload.phone,
        "address": payload.address,
        "emergency_contact_name": payload.emergency_contact_name,
        "emergency_contact_phone": payload.emergency_contact_phone,
        "emergency_contact_relation": payload.emergency_contact_relation,
        "bank_name": payload.bank_name,
        "account_number": payload.account_number,
        "ifsc_code": payload.ifsc_code,
        "education": payload.education,
        "work_experience": payload.work_experience,
        "documents": [],
        "created_at": datetime.now(timezone.utc)
    }
    await db.onboarding_forms.insert_one(form_doc)
    
    return OnboardingForm(**form_doc)

@api_router.get("/onboarding")
async def get_onboarding_forms(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role in ["admin", "manager", "supervisor"]:
        forms = await db.onboarding_forms.find({}, {"_id": 0}).to_list(1000)
    else:
        forms = await db.onboarding_forms.find({"user_id": user.user_id}, {"_id": 0}).to_list(1)
    
    for form in forms:
        if isinstance(form['created_at'], str):
            form['created_at'] = datetime.fromisoformat(form['created_at'])
    
    return forms

@api_router.get("/onboarding/my")
async def get_my_onboarding_form(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    form = await db.onboarding_forms.find_one({"user_id": user.user_id}, {"_id": 0})
    if not form:
        return None
    
    if isinstance(form['created_at'], str):
        form['created_at'] = datetime.fromisoformat(form['created_at'])
    
    return form

@api_router.patch("/onboarding/{form_id}")
async def update_onboarding_form(form_id: str, updates: dict, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    form = await db.onboarding_forms.find_one({"form_id": form_id}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    if form["user_id"] != user.user_id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    allowed_fields = [
        "full_name", "date_of_birth", "phone", "address",
        "emergency_contact_name", "emergency_contact_phone", "emergency_contact_relation",
        "bank_name", "account_number", "ifsc_code",
        "education", "work_experience"
    ]
    filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    
    await db.onboarding_forms.update_one({"form_id": form_id}, {"$set": filtered_updates})
    return {"message": "Form updated"}

@api_router.patch("/onboarding/{form_id}/submit")
async def submit_onboarding_form(form_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    form = await db.onboarding_forms.find_one({"form_id": form_id}, {"_id": 0})
    if not form:
        raise HTTPException(status_code=404, detail="Form not found")
    
    if form["user_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.onboarding_forms.update_one(
        {"form_id": form_id},
        {"$set": {"status": "submitted", "submitted_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Form submitted"}

@api_router.patch("/onboarding/{form_id}/approve")
async def approve_onboarding_form(form_id: str, session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.onboarding_forms.update_one(
        {"form_id": form_id},
        {"$set": {"status": "approved"}}
    )
    
    return {"message": "Form approved"}

# --- Team Requests Summary ---

@api_router.get("/team-requests/pending")
async def get_pending_team_requests(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    if user.role not in ["admin", "manager", "supervisor"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    pending_leaves = await db.leaves.find({"status": "pending"}, {"_id": 0}).to_list(100)
    pending_reimbursements = await db.reimbursements.find({"status": "pending"}, {"_id": 0}).to_list(100)
    pending_onboarding = await db.onboarding_forms.find({"status": "submitted"}, {"_id": 0}).to_list(100)
    
    return {
        "leaves": pending_leaves,
        "reimbursements": pending_reimbursements,
        "onboarding": pending_onboarding,
        "total_pending": len(pending_leaves) + len(pending_reimbursements) + len(pending_onboarding)
    }

# ========== REPORTS & ANALYTICS ROUTES ==========

@api_router.get("/reports/overview")
async def get_overview_report(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    projects_count = await db.projects.count_documents({})
    active_projects = await db.projects.count_documents({"status": "active"})
    tasks_count = await db.tasks.count_documents({})
    completed_tasks = await db.tasks.count_documents({"status": "done"})
    team_count = await db.users.count_documents({})
    
    # Optimized: Use aggregation for time logs instead of fetching all records
    total_hours_agg = await db.time_logs.aggregate([
        {"$group": {"_id": None, "total_minutes": {"$sum": "$duration_minutes"}}}
    ]).to_list(1)
    total_hours = (total_hours_agg[0]["total_minutes"] / 60) if total_hours_agg and total_hours_agg[0].get("total_minutes") else 0
    
    billable_hours_agg = await db.time_logs.aggregate([
        {"$match": {"billable": True}},
        {"$group": {"_id": None, "billable_minutes": {"$sum": "$duration_minutes"}}}
    ]).to_list(1)
    billable_hours = (billable_hours_agg[0]["billable_minutes"] / 60) if billable_hours_agg and billable_hours_agg[0].get("billable_minutes") else 0
    
    finance_data = {}
    if user.role in ["admin", "manager"]:
        # Optimized: Use aggregation for invoices and expenses
        revenue_agg = await db.invoices.aggregate([
            {"$group": {
                "_id": "$status",
                "total": {"$sum": "$amount"}
            }}
        ]).to_list(10)
        revenue_map = {r["_id"]: r["total"] for r in revenue_agg}
        total_revenue = revenue_map.get("paid", 0)
        pending_revenue = revenue_map.get("pending", 0)
        
        expenses_agg = await db.expenses.aggregate([
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]).to_list(1)
        total_expenses = expenses_agg[0]["total"] if expenses_agg and expenses_agg[0].get("total") else 0
        
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
    
    # Optimized: Get all task counts per project in one query
    task_counts_agg = await db.tasks.aggregate([
        {"$group": {
            "_id": "$project_id",
            "total": {"$sum": 1},
            "completed": {"$sum": {"$cond": [{"$eq": ["$status", "done"]}, 1, 0]}}
        }}
    ]).to_list(1000)
    task_counts_map = {t["_id"]: {"total": t["total"], "completed": t["completed"]} for t in task_counts_agg}
    
    # Optimized: Get time logged per project in one query
    project_time_agg = await db.time_logs.aggregate([
        {"$group": {"_id": "$project_id", "total_minutes": {"$sum": "$duration_minutes"}}}
    ]).to_list(1000)
    project_time_map = {p["_id"]: p["total_minutes"] / 60 for p in project_time_agg}
    
    performance_data = []
    for project in projects:
        project_id = project["project_id"]
        task_data = task_counts_map.get(project_id, {"total": 0, "completed": 0})
        project_time = project_time_map.get(project_id, 0)
        
        performance_data.append({
            "project_id": project_id,
            "project_name": project["name"],
            "total_tasks": task_data["total"],
            "completed_tasks": task_data["completed"],
            "completion_rate": (task_data["completed"] / task_data["total"] * 100) if task_data["total"] else 0,
            "total_hours": round(project_time, 2),
            "budget": project.get("budget", 0),
            "status": project.get("status")
        })
    
    return performance_data

@api_router.get("/reports/team-productivity")
async def get_team_productivity(session_token: Optional[str] = Cookie(None), authorization: Optional[str] = Header(None)):
    user = await get_user_from_token(session_token, authorization)
    
    team_members = await db.users.find({}, {"_id": 0}).to_list(1000)
    
    # Optimized: Get all task counts per user in one query
    user_task_agg = await db.tasks.aggregate([
        {"$group": {
            "_id": "$assigned_to",
            "total": {"$sum": 1},
            "completed": {"$sum": {"$cond": [{"$eq": ["$status", "done"]}, 1, 0]}}
        }}
    ]).to_list(1000)
    user_task_map = {u["_id"]: {"total": u["total"], "completed": u["completed"]} for u in user_task_agg}
    
    # Optimized: Get time logged per user in one query
    user_time_agg = await db.time_logs.aggregate([
        {"$group": {"_id": "$user_id", "total_minutes": {"$sum": "$duration_minutes"}}}
    ]).to_list(1000)
    user_time_map = {u["_id"]: u["total_minutes"] / 60 for u in user_time_agg}
    
    productivity_data = []
    for member in team_members:
        user_id = member["user_id"]
        task_data = user_task_map.get(user_id, {"total": 0, "completed": 0})
        total_hours = user_time_map.get(user_id, 0)
        
        productivity_data.append({
            "user_id": user_id,
            "name": member["name"],
            "role": member["role"],
            "total_tasks": task_data["total"],
            "completed_tasks": task_data["completed"],
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
