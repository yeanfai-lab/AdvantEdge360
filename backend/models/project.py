from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    project_id: str
    name: str
    description: Optional[str] = None
    client_name: str
    status: str = "ongoing"  # ongoing, on_hold, completed
    budget: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    completion_percentage: float = 0.0
    proposal_id: Optional[str] = None
    team_members: List[str] = []
    milestones: List[dict] = []  # {milestone_id, title, due_date, status}
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime] = None

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None
    client_name: str
    budget: Optional[float] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    proposal_id: Optional[str] = None
