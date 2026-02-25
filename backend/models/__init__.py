from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime


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
    status: str = "ongoing"
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
    category: Optional[str] = None
    description: str
    version: int = 1
    version_history: List[dict] = []
    status: str = "draft"
    amount: Optional[float] = None
    created_by: str
    approved_by: Optional[List[str]] = []
    approver_id: Optional[str] = None
    approver_comments: Optional[str] = None
    approval_status: Optional[str] = None
    signature_type: Optional[str] = None
    manual_approval_date: Optional[str] = None
    project_id: Optional[str] = None
    drive_file_id: Optional[str] = None
    drive_file_name: Optional[str] = None
    drive_file_link: Optional[str] = None
    pdf_attachment: Optional[str] = None
    attachments: List[dict] = []
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
    status: str = "not_started"
    priority: str = "medium"
    assigned_to: Optional[str] = None
    reviewer_id: Optional[str] = None
    comments: List[dict] = []
    attachments: List[dict] = []
    review_notes: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    completion_percentage: float = 0.0
    is_overdue: bool = False
    due_date: Optional[str] = None
    parent_task_id: Optional[str] = None
    subtasks: List[str] = []
    time_logs: List[dict] = []
    total_tracked_time: int = 0
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
