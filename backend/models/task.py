from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

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
