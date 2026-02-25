from datetime import datetime
from typing import Optional, Dict
from pydantic import BaseModel, ConfigDict

class FeeStructureItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    item_id: str
    project_id: str
    stage: str
    deliverable: str
    percentage: float
    amount: float
    billing_date: Optional[str] = None
    completion_status: str = "pending"  # pending, in_progress, completed
    invoice_status: str = "not_raised"  # not_raised, raised, sent
    payment_status: str = "unpaid"  # unpaid, partial, paid
    created_by: str
    created_at: datetime

class FeeStructureCreate(BaseModel):
    project_id: str
    stage: str
    deliverable: str
    percentage: float
    amount: float
    billing_date: Optional[str] = None

class TeamSalary(BaseModel):
    model_config = ConfigDict(extra="ignore")
    salary_id: str
    user_id: str
    monthly_salary: float
    hourly_rate: Optional[float] = None
    daily_rate: Optional[float] = None
    effective_date: str
    created_by: str
    created_at: datetime

class CashFlowExpense(BaseModel):
    model_config = ConfigDict(extra="ignore")
    expense_id: str
    expense_head: str
    sub_head: Optional[str] = None
    monthly_amounts: Dict[str, float] = {}  # {"2024-01": 5000, "2024-02": 5000, ...}
    created_by: str
    created_at: datetime
