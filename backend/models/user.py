from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "team_member"
    skills: List[str] = []
    assigned_projects: List[str] = []
    date_of_joining: Optional[str] = None
    created_at: datetime
