from fastapi import FastAPI, APIRouter, HTTPException, Cookie, Response, Header, UploadFile, File
from fastapi.responses import StreamingResponse
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
    status: str = "active"
    client_name: Optional[str] = None
    budget: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
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
    description: str
    version: int = 1
    status: str = "draft"
    amount: Optional[float] = None
    created_by: str
    approved_by: Optional[List[str]] = []
    project_id: Optional[str] = None
    created_at: datetime

class ProposalCreate(BaseModel):
    title: str
    client_name: str
    description: str
    amount: Optional[float] = None

class Task(BaseModel):
    model_config = ConfigDict(extra="ignore")
    task_id: str
    project_id: str
    title: str
    description: Optional[str] = None
    status: str = "todo"
    priority: str = "medium"
    assigned_to: Optional[str] = None
    due_date: Optional[str] = None
    parent_task_id: Optional[str] = None
    subtasks: List[str] = []
    time_logs: List[dict] = []
    created_by: str
    created_at: datetime

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
    user_id: str
    duration_minutes: int
    description: Optional[str] = None
    date: str
    billable: bool = True
    created_at: datetime

class TimeLogCreate(BaseModel):
    task_id: str
    duration_minutes: int
    description: Optional[str] = None
    date: str
    billable: bool = True

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
async def update_project(project_id: str, updates: dict, user: User = Cookie(None)):
    if not user:
        user = await get_user_from_token()
    
    await db.projects.update_one({"project_id": project_id}, {"$set": updates})
    return {"message": "Project updated"}

# ========== PROPOSAL ROUTES ==========

@api_router.post("/proposals", response_model=Proposal)
async def create_proposal(payload: ProposalCreate, user: User = Cookie(None)):
    if not user:
        user = await get_user_from_token()
    
    proposal_id = f"prop_{uuid.uuid4().hex[:12]}"
    proposal_doc = {
        "proposal_id": proposal_id,
        "title": payload.title,
        "client_name": payload.client_name,
        "description": payload.description,
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
async def get_proposals(user: User = Cookie(None)):
    if not user:
        user = await get_user_from_token()
    
    proposals = await db.proposals.find({}, {"_id": 0}).to_list(1000)
    for prop in proposals:
        if isinstance(prop['created_at'], str):
            prop['created_at'] = datetime.fromisoformat(prop['created_at'])
    return proposals

@api_router.post("/proposals/{proposal_id}/approve")
async def approve_proposal(proposal_id: str, user: User = Cookie(None)):
    if not user:
        user = await get_user_from_token()
    
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

@api_router.post("/proposals/{proposal_id}/convert")
async def convert_to_project(proposal_id: str, user: User = Cookie(None)):
    if not user:
        user = await get_user_from_token()
    
    proposal = await db.proposals.find_one({"proposal_id": proposal_id}, {"_id": 0})
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    
    if proposal["status"] != "approved":
        raise HTTPException(status_code=400, detail="Proposal must be approved first")
    
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

# ========== TASK ROUTES ==========

@api_router.post("/tasks", response_model=Task)
async def create_task(payload: TaskCreate, user: User = Cookie(None)):
    if not user:
        user = await get_user_from_token()
    
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
async def get_tasks(project_id: Optional[str] = None, user: User = Cookie(None)):
    if not user:
        user = await get_user_from_token()
    
    query = {}
    if project_id:
        query["project_id"] = project_id
    
    tasks = await db.tasks.find(query, {"_id": 0}).to_list(1000)
    for task in tasks:
        if isinstance(task['created_at'], str):
            task['created_at'] = datetime.fromisoformat(task['created_at'])
    return tasks

@api_router.patch("/tasks/{task_id}")
async def update_task(task_id: str, updates: dict, user: User = Cookie(None)):
    if not user:
        user = await get_user_from_token()
    
    await db.tasks.update_one({"task_id": task_id}, {"$set": updates})
    return {"message": "Task updated"}

# ========== TIME TRACKING ROUTES ==========

@api_router.post("/time-logs", response_model=TimeLog)
async def create_time_log(payload: TimeLogCreate, user: User = Cookie(None)):
    if not user:
        user = await get_user_from_token()
    
    log_id = f"log_{uuid.uuid4().hex[:12]}"
    log_doc = {
        "log_id": log_id,
        "task_id": payload.task_id,
        "user_id": user.user_id,
        "duration_minutes": payload.duration_minutes,
        "description": payload.description,
        "date": payload.date,
        "billable": payload.billable,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.time_logs.insert_one(log_doc)
    log_doc['created_at'] = datetime.fromisoformat(log_doc['created_at'])
    return TimeLog(**log_doc)

@api_router.get("/time-logs", response_model=List[TimeLog])
async def get_time_logs(task_id: Optional[str] = None, user: User = Cookie(None)):
    if not user:
        user = await get_user_from_token()
    
    query = {}
    if task_id:
        query["task_id"] = task_id
    
    logs = await db.time_logs.find(query, {"_id": 0}).to_list(1000)
    for log in logs:
        if isinstance(log['created_at'], str):
            log['created_at'] = datetime.fromisoformat(log['created_at'])
    return logs

# ========== TEAM ROUTES ==========

@api_router.get("/team", response_model=List[User])
async def get_team_members(user: User = Cookie(None)):
    if not user:
        user = await get_user_from_token()
    
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    for u in users:
        if isinstance(u['created_at'], str):
            u['created_at'] = datetime.fromisoformat(u['created_at'])
    return users

@api_router.patch("/team/{user_id}")
async def update_team_member(user_id: str, updates: dict, user: User = Cookie(None)):
    if not user:
        user = await get_user_from_token()
    
    if user.role not in ["admin", "manager"]:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    await db.users.update_one({"user_id": user_id}, {"$set": updates})
    return {"message": "Team member updated"}

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
