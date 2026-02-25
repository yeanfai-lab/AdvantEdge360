from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict

class ProposalVersion(BaseModel):
    version_id: str
    title: str
    description: str
    amount: Optional[float] = None
    requirement: Optional[str] = None
    scope_area: Optional[str] = None
    final_proposal: Optional[str] = None
    saved_by: str
    saved_at: datetime

class Proposal(BaseModel):
    model_config = ConfigDict(extra="ignore")
    proposal_id: str
    title: str
    client_name: str
    description: str
    status: str = "draft"  # draft, pending_approval, approved, sent_to_client, signed, converted, rejected
    amount: Optional[float] = None
    category: Optional[str] = None  # Individual-Residential, Housing, Commercial, Institutional, Hospitality
    requirement: Optional[str] = None
    scope_area: Optional[str] = None
    final_proposal: Optional[str] = None
    assigned_to: Optional[str] = None
    versions: List[ProposalVersion] = []
    current_version: int = 1
    approvals: List[dict] = []  # {user_id, action, timestamp, notes}
    documents: List[dict] = []  # {doc_id, name, url, type, uploaded_at}
    created_by: str
    created_at: datetime
    updated_at: Optional[datetime] = None

class ProposalCreate(BaseModel):
    title: str
    client_name: str
    description: str
    amount: Optional[float] = None
    category: Optional[str] = None
    requirement: Optional[str] = None
    scope_area: Optional[str] = None

class ProposalUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[float] = None
    category: Optional[str] = None
    requirement: Optional[str] = None
    scope_area: Optional[str] = None
    final_proposal: Optional[str] = None
    assigned_to: Optional[str] = None
