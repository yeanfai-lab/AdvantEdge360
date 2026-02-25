from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class TimeLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    log_id: str
    task_id: str
    project_id: Optional[str] = None
    user_id: str
    duration: int  # in minutes
    description: Optional[str] = None
    billable: bool = True
    start_time: datetime
    end_time: Optional[datetime] = None
    created_at: datetime

class TimeLogCreate(BaseModel):
    task_id: str
    duration: int
    description: Optional[str] = None
    billable: bool = True
    start_time: Optional[datetime] = None

class ActiveTimer(BaseModel):
    model_config = ConfigDict(extra="ignore")
    timer_id: str
    user_id: str
    task_id: str
    project_id: Optional[str] = None
    start_time: datetime
    paused_at: Optional[datetime] = None
    total_paused_duration: int = 0  # in seconds
    is_paused: bool = False
