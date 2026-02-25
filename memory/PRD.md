# AdvantEdge360 - Product Requirements Document

## Overview
AdvantEdge360 is a comprehensive, full-stack business operations and project management suite built with React (frontend), FastAPI (backend), and MongoDB (database).

## Core Modules

### 1. Client Management
- **Company/Contact hierarchy** with full CRUD for both
- **Company fields**: Name, Industry, Website, Phone, Business Address, GST Number, PAN Number
- **Contact fields**: Name, Email, Phone, Position, Company, Business Address, GST Number, PAN Number, Notes
- Custom fields support
- Status tracking
- Linked to projects, invoices, and reports

### 2. Proposal Management
- **Status Workflow**: Draft → Pending Approval → Approved → Sent to Client → Signed → Converted
- **Fields**: Title, Client, Category, Requirement, Scope/Area, Final Proposal, Amount
- **Categories**: Individual-Residential, Housing, Commercial, Institutional, Hospitality
- **Versioning System**: 
  - Auto-saves version on content changes
  - Version history panel with all revisions
  - Restore previous version functionality
- Internal approval workflow (Sender → Approver → Client)
- Inline editing for all fields
- Google Drive document attachment (DEMO MODE)
- Zoho Sign integration (DEMO MODE)
- Conversion to Project
- **View Toggle**: Tile view and List view with sortable columns

### 3. Project Management
- Integrated task management (tasks shown within project detail)
- Completion percentage calculated from task statuses
- Project stats (total, in progress, completed, overdue tasks)
- Budget (in ₹), timeline, milestones tracking
- **View Toggle**: Tile view and List view with sortable columns

### 4. Task Management
- **Statuses**: Not Started, In Progress, On Hold, Under Review, Completed
- **Priorities**: Low, Medium, High, Urgent
- **Sub-tasks**: Nested tasks under parent tasks with expand/collapse
- Assignment, reviewer, comments
- **Comments System**:
  - Add/Edit/Delete comments
  - System comments for review actions
  - Edit indicator for modified comments
- **Review Workflow**:
  - Send for Review
  - Approve & Continue (completes task)
  - Return to Owner (sends back with notes)
  - Reject (with revision notes)
- Start/End dates
- **Built-in Time Tracker**:
  - Start/Stop timer per task
  - Pause/Resume functionality
  - One active timer per user at a time
  - Auto-logs time to task → project → client
  - Total tracked time displayed per task
  - Editable/Deletable time entries

### 5. Dashboard
- Statistics cards (clickable, navigate to respective pages)
- **My Tasks section**: User's assigned tasks with Project Name & Client Name displayed
- **Pending Team Requests Panel** (for Admin/Manager/Supervisor):
  - Leave Applications count with link
  - Reimbursements count with link
- **Team Tasks Overview** (for managers):
  - Filter by Status / Team Member / Project
  - Excludes completed tasks
- **Quick Actions** (matching actual page forms):
  - Create Project (with client, budget ₹, dates)
  - Draft Proposal (with category, requirement)
  - Add Task (with project selector, priority)
- Pending Reviews section (tasks under review)
- Pending Proposal Approvals section

### 6. Team Management
- Role-based access (Admin, Manager, Supervisor, Team Lead, Team Member, Finance)
- User profiles and skills
- **Leave Applications** (separate page):
  - Types: Casual, Sick, Earned/Annual, Unpaid, Work from Home
  - Apply, Approve/Reject workflow
  - Pending count for managers
- **Reimbursements** (separate page):
  - Categories: Travel, Equipment, Office Supplies, Client Entertainment, Other
  - Status: Pending → Approved → Paid
  - Amount in ₹
  - Mark as Paid by Finance role

### 7. Time Tracking
- Task-level time logging
- Billable/non-billable hours
- Mobile-responsive
- Timer integration from project detail page
- Pause/Resume functionality
- Editable time entries

### 8. Finance Module (REDESIGNED)
- **Currency**: Indian Rupee (₹) throughout the portal
- **Fee Structure Tab**:
  - Project dropdown selector
  - CRUD table with fields:
    - Stage
    - Deliverable
    - Percentage of Total Value
    - Amount (₹)
    - Tentative Billing Date
    - Deliverable Status (Not Started / In Progress / On Hold / Completed)
    - Invoice Status (Not Invoiced / Invoiced / Paid)
    - Payment Status (Pending / Received)
- **Project Profitability Tab** (READ-ONLY):
  - Derived from Fee Structure + Labor Costs
  - Shows: Project Value, Received, Pending, Labor Cost, Billable Hours, Profit
- **Cash Flow Projection Tab**:
  - 6 months at a time with toggle (Months 1-6 / Months 7-12)
  - Income row: Derived from Fee Structure (tentative billing dates)
  - Expenses: Editable table with Expense Head, Sub-Head, Monthly Amounts
  - Auto-calculated totals
  - Net Cash Flow = Total Income - Total Expenses
- **Labor Costs Tab**:
  - Team Salary Table (editable):
    - Team Member
    - Monthly Salary (₹)
    - Hourly Rate (₹/hr)
    - Daily Rate (₹/day)
  - Labor Cost per Project:
    - Calculated as Hourly Rate × Billable Hours per team member
    - Breakdown by user per project

### 9. Reports & Analytics
- Project performance
- Team productivity
- Financial summaries
- CSV export
- PDF export (using reportlab)

## Technical Architecture

### Frontend
- React 18 with React Router
- Tailwind CSS + shadcn/ui components
- Custom theme: Teal/Dark Grey, PT Sans Narrow font
- Axios for API calls
- localStorage for view preferences

### Backend
- FastAPI (Python)
- Pydantic models
- JWT authentication with Google OAuth

### Database
- MongoDB (Motor async driver)
- **Collections**: users, proposals, projects, tasks, time_logs, active_timers, companies, clients, fee_structure, team_salaries, cashflow_expenses, leaves, reimbursements

## API Endpoints

### Finance Module
- `GET/POST /api/fee-structure` - Fee structure items
- `PATCH/DELETE /api/fee-structure/{item_id}` - Update/Delete fee item
- `GET/POST /api/team-salaries` - Team salary information
- `PATCH/DELETE /api/team-salaries/{salary_id}` - Update/Delete salary
- `GET/POST /api/cashflow-expenses` - Cash flow expenses
- `PATCH/DELETE /api/cashflow-expenses/{expense_id}` - Update/Delete expense

### Team Management
- `GET/POST /api/leaves` - Leave applications
- `PATCH /api/leaves/{id}/approve|reject` - Leave actions
- `GET/POST /api/reimbursements` - Reimbursement requests
- `PATCH /api/reimbursements/{id}/approve|reject|mark-paid` - Reimbursement actions

### Clients
- `GET/POST /api/companies` - Company CRUD
- `PATCH/DELETE /api/companies/{id}` - Update/Delete company
- `GET/POST /api/clients` - Contact CRUD
- `PATCH/DELETE /api/clients/{id}` - Update/Delete contact

---

## Implementation Status

### December 2025 - V8 Major Update (All 4 Phases Complete)

#### Phase D: Finance Module Overhaul
- [x] Changed currency from $ to ₹ (Indian Rupee) throughout
- [x] Removed Invoices & Expenses section
- [x] Fee Structure Tab with project-wise CRUD
- [x] Project Profitability (read-only, derived)
- [x] Cash Flow Projection with 6-month toggle
- [x] Editable expenses table with auto-totals
- [x] Labor Costs Tab with team salary table
- [x] Labor cost calculation (hourly rate × billable hours)

#### Phase C: Team Module Separation
- [x] Leave Applications as separate page
- [x] Reimbursements as separate page
- [x] Each page focused on its own content/actions

#### Phase B: Clients Enhancement
- [x] Full CRUD for Company (create, edit, delete)
- [x] New fields for Company: Business Address, GST Number, PAN Number
- [x] New fields for Contact: Business Address, GST Number, PAN Number
- [x] Edit dialogs for both Company and Contact

#### Phase A: Dashboard Enhancement
- [x] Updated Quick Actions to match actual page forms
- [x] Pending Team Requests panel for managers (leave/reimbursement counts)
- [x] My Tasks with Project Name & Client Name displayed
- [x] Team Tasks filter by Status / Team Member / Project
- [x] Removed Completed from team tasks view

---

## Pending/Future Tasks

### P1 - High Priority
- [ ] Email Notifications (Gmail/Resend integration - playbook ready)
- [ ] Google Calendar Integration (playbook ready)
- [ ] Backend monolith refactoring (server.py is 3700+ lines)

### P2 - Medium Priority
- [ ] Google Drive full integration (currently demo mode)
- [ ] Zoho Sign full integration (currently demo mode)
- [ ] Task drag-and-drop for hierarchy
- [ ] Task dependencies
- [ ] Activity logs per task

### P3 - Low Priority / Future
- [ ] Native mobile app (especially for time tracking)
- [ ] Frontend logic refactoring (extract into hooks)
- [ ] Advanced reporting/analytics
