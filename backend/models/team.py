from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class Leave(BaseModel):
    model_config = ConfigDict(extra="ignore")
    leave_id: str
    user_id: str
    leave_type: str  # casual, sick, earned, unpaid, wfh
    start_date: str
    end_date: str
    reason: str
    status: str = "pending"  # pending, approved, rejected
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime

class LeaveCreate(BaseModel):
    leave_type: str
    start_date: str
    end_date: str
    reason: str

class Reimbursement(BaseModel):
    model_config = ConfigDict(extra="ignore")
    reimbursement_id: str
    user_id: str
    amount: float
    category: str  # travel, equipment, office_supplies, client_entertainment, other
    description: str
    receipt_url: Optional[str] = None
    project_id: Optional[str] = None  # Optional - can be tagged to project or internal
    is_internal: bool = True  # True if not tagged to any project
    status: str = "pending"  # pending, approved, rejected, paid
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    created_at: datetime

class ReimbursementCreate(BaseModel):
    amount: float
    category: str
    description: str
    project_id: Optional[str] = None
    is_internal: bool = True

class PublicHoliday(BaseModel):
    model_config = ConfigDict(extra="ignore")
    holiday_id: str
    name: str
    date: str
    created_by: str
    created_at: datetime

class LeaveAccrualPolicy(BaseModel):
    model_config = ConfigDict(extra="ignore")
    policy_id: str
    leave_type: str
    accrual_rate: float  # days per month
    max_balance: float  # maximum accumulated days
    carry_forward: bool = True
    created_by: str
    created_at: datetime
