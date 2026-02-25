from datetime import datetime, timezone
from typing import Optional
from fastapi import HTTPException, Cookie, Header
from pydantic import BaseModel, ConfigDict
from .config import db, ROLES

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "team_member"
    skills: list = []
    assigned_projects: list = []
    date_of_joining: Optional[str] = None
    created_at: datetime

async def get_user_from_token(session_token: Optional[str] = None, authorization: Optional[str] = None) -> User:
    """Authenticate user from session token or authorization header"""
    token = None
    
    if authorization and authorization.startswith("Bearer "):
        token = authorization.split(" ")[1]
    elif session_token:
        token = session_token
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user_doc = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user_doc:
        raise HTTPException(status_code=401, detail="User not found")
    
    if isinstance(user_doc.get('created_at'), str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    return User(**user_doc)

def check_permission(user_role: str, required_permission: str) -> bool:
    """Check if user role has required permission"""
    role_config = ROLES.get(user_role, ROLES["team_member"])
    return role_config.get(required_permission, False)

def can_view_resource(user: User, resource_type: str, resource: dict) -> bool:
    """Check if user can view a specific resource"""
    role_config = ROLES.get(user.role, ROLES["team_member"])
    
    # Admin can view everything
    if user.role == "admin":
        return True
    
    # Check assigned resources for non-admin
    if resource_type == "project":
        return resource.get("project_id") in user.assigned_projects or role_config["can_edit_all"]
    
    if resource_type == "task":
        return (resource.get("assigned_to") == user.user_id or 
                resource.get("created_by") == user.user_id or 
                role_config["can_edit_all"])
    
    return True

def filter_resources_by_role(user: User, resources: list, resource_type: str) -> list:
    """Filter resources based on user role and permissions"""
    role_config = ROLES.get(user.role, ROLES["team_member"])
    
    # Admin and those with edit_all see everything
    if user.role == "admin" or role_config["can_edit_all"]:
        return resources
    
    # Team members see only their assigned/created resources
    if resource_type == "task":
        return [r for r in resources if r.get("assigned_to") == user.user_id or r.get("created_by") == user.user_id]
    
    if resource_type == "project":
        return [r for r in resources if r.get("project_id") in user.assigned_projects]
    
    return resources
