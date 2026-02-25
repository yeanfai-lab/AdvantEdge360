from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

class Company(BaseModel):
    model_config = ConfigDict(extra="ignore")
    company_id: str
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    business_address: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None

class CompanyCreate(BaseModel):
    name: str
    industry: Optional[str] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    business_address: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None

class ContactPerson(BaseModel):
    model_config = ConfigDict(extra="ignore")
    client_id: str
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    business_address: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    notes: Optional[str] = None
    status: str = "active"
    created_by: Optional[str] = None
    created_at: Optional[datetime] = None

class ContactPersonCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    position: Optional[str] = None
    company_id: Optional[str] = None
    company_name: Optional[str] = None
    business_address: Optional[str] = None
    gst_number: Optional[str] = None
    pan_number: Optional[str] = None
    notes: Optional[str] = None
