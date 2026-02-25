# AdvantEdge360 - Product Requirements Document

## Overview
AdvantEdge360 is a comprehensive, full-stack business operations and project management suite built with React (frontend), FastAPI (backend), and MongoDB (database).

## Core Modules

### 1. Client Management
- **Company/Contact hierarchy** with full CRUD for both
- **Company fields**: Name, Industry, Website, Phone, Business Address, GST Number, PAN Number
- **Contact fields**: Name, Email, Phone, Position, Company, Business Address, GST Number, PAN Number, Notes
- **Company Detail View**: Clickable company tiles navigate to detailed view showing:
  - Associated contacts
  - Related projects
  - Proposals
  - Tasks
  - Financial summary (revenue, pending revenue, invoices)
- Custom fields support
- Status tracking

### 2. Proposal Management
- **Status Workflow**: Draft → Pending Approval → Approved → Sent to Client → Signed → Converted
- **Fields**: Title, Client, Category, Requirement, Scope/Area, Final Proposal, Amount
- **Categories**: Individual-Residential, Housing, Commercial, Institutional, Hospitality
- **Versioning System** with restore functionality
- Internal approval workflow
- Google Drive document attachment (DEMO MODE)
- Zoho Sign integration (DEMO MODE)

### 3. Project Management
- Integrated task management
- Completion percentage from tasks
- Budget (INR), timeline, milestones
- **View Toggle**: Tile and List views

### 4. Task Management
- **Statuses**: Not Started, **Assigned**, In Progress, On Hold, Under Review, Completed
- **Priorities**: Low, Medium, High, Urgent
- **Internal Tasks**: Non-billable tasks not linked to any project (for internal business operations)
- Sub-tasks with expand/collapse
- **Review Workflow**: Send for Review, Approve, Return, Reject
- Comments system
- **Built-in Time Tracker** with pause/resume

### 5. Dashboard
- Statistics cards (clickable)
- **My Tasks** with Project Name & Client Name
- **Pending Team Requests Panel** (Admin/Manager) for leaves/reimbursements
- **Team Tasks Overview** with filter by Status/Team Member/Project (no completed)
- Quick Actions matching page forms (with Internal task option)
- Pending Reviews and Proposal Approvals sections

### 6. Team Management
- Role-based access (Admin, Manager, Supervisor, Team Lead, Team Member, Finance)
- **Leave Applications** (separate page):
  - Types: Casual, Sick, Earned/Annual, Unpaid, Work from Home
  - **Calendar View** by month/year showing team leaves and public holidays
  - **Public Holidays CRUD** (Admin only)
  - **Leave Accrual Policies CRUD** - define accrual per month per leave type
  - **Leave Balances** - calculated from accrual based on date of joining
  - Negative balance allowed
  - **Email Notifications** on approval/rejection (DEMO MODE)
- **Reimbursements** (separate page):
  - Categories: Travel, Equipment, Office Supplies, Client Entertainment, Other
  - **Receipt Upload** (JPG, PNG, PDF - max 5MB)
  - **Project vs Internal** tagging
  - Project-tagged reimbursements show in Finance profitability/cash flow
  - **Email Notifications** on approval/rejection/paid (DEMO MODE)

### 7. Time Tracking
- Task-level time logging
- Billable/non-billable hours
- Pause/Resume functionality
- Editable time entries

### 8. Finance Module
- **Currency**: INR throughout the portal
- **Fee Structure Tab**:
  - Project dropdown selector
  - CRUD table: Stage, Deliverable, %, Amount, Billing Date, Statuses
  - **Bulk Actions**: Select multiple items, update Invoice/Payment/Deliverable status
  - **Bulk Add**: Add multiple deliverables at once (Stage | Deliverable | % | Date format)
- **Project Profitability Tab** (READ-ONLY):
  - Derived from Fee Structure + Labor Costs + Project Reimbursements
  - Shows: Project Value, Received, Pending, Labor Cost, Reimbursements, Billable Hours, Profit
- **Cash Flow Projection Tab**:
  - 6 months at a time with toggle (Months 1-6 / Months 7-12)
  - Income from Fee Structure (tentative billing dates)
  - Editable expenses table + auto-included reimbursements
  - Net Cash Flow = Income - Expenses
- **Labor Costs Tab**:
  - Team Salary Table: Monthly Salary, Hourly Rate, Daily Rate
  - Labor Cost per Project = Hourly Rate × Billable Hours

### 9. Reports & Analytics
- **Self-Service BI Report Builder**:
  - Select from 9 modules: Clients, Companies, Projects, Tasks, Time Logs, Team Members, Leave Applications, Reimbursements, Fee Structure
  - Drag-and-drop field selection
  - Reorderable columns
  - Filter by any field (equals, contains, >, <, >=, <=)
  - Sort by any column
  - **Export to CSV**
  - **Export to PDF**
- **Standard Reports**:
  - Overview metrics (Revenue, Projects, Hours, Team)
  - Project Performance bar chart
  - Team Productivity pie chart
  - CSV/PDF export

---

## Implementation Status

### February 2026 - V10 Feature Update

#### Phase 6: Task & Client Enhancements
- [x] Added "Assigned" task status (between Not Started and In Progress)
- [x] Added "Internal" task option for non-billable tasks
- [x] Company Detail Page with tabs for Contacts, Projects, Proposals, Tasks, Finance
- [x] Clickable company tiles on Clients page
- [x] Currency format verified as INR across all pages

### December 2025 - V9 Complete Feature Set

#### Phase 1: Currency & Email Notifications
- [x] Changed ₹ to INR across entire portal
- [x] Email notifications for leave approval/rejection (DEMO MODE)
- [x] Email notifications for reimbursement approval/rejection/paid (DEMO MODE)

#### Phase 2: Leave Enhancements
- [x] Public Holidays CRUD (Admin only)
- [x] Calendar View with team leaves and holidays marked
- [x] Leave Accrual Policies CRUD - define accrual per month per leave type
- [x] Leave Balances calculated from accrual based on DOJ
- [x] Negative balance allowed

#### Phase 3: Reimbursements Enhancement
- [x] Receipt file upload (JPG, PNG, PDF - max 5MB)
- [x] Project vs Internal tagging
- [x] Project-tagged reimbursements in Finance profitability
- [x] Reimbursements in Cash Flow projection

#### Phase 4: Finance Bulk Actions
- [x] Fee Structure bulk select with checkboxes
- [x] Bulk status update (Invoice, Payment, Deliverable status)
- [x] Bulk Add dialog for multiple deliverables

#### Phase 5: Self-Service BI Report Builder
- [x] Module selector (9 data sources)
- [x] Field selection with click-to-add
- [x] Drag-and-drop reordering
- [x] Report generation with data display
- [x] Filter by any field with operators
- [x] Sort by any column
- [x] Export to CSV
- [x] Export to PDF

---

## API Endpoints

### New Endpoints (V10)
- `GET /api/companies/{company_id}/overview` - Company detail with contacts, projects, proposals, tasks, finance

### V9 Endpoints
- `GET/POST/PATCH/DELETE /api/public-holidays` - Public holidays CRUD
- `GET/POST/PATCH/DELETE /api/leave-accrual-policies` - Leave accrual policies CRUD
- `GET /api/leave-balances` - Get calculated leave balances
- `POST /api/leave-balances/adjust` - Adjust leave balance (Admin)
- `POST /api/upload/receipt` - Upload receipt file
- `GET /api/uploads/{filename}` - Get uploaded file
- `PATCH /api/reimbursements/{id}/upload-receipt` - Attach receipt to reimbursement
- `POST /api/reports/export-custom-pdf` - Export custom report as PDF

---

## Pending/Future Tasks

### P1 - High Priority
- [ ] Backend monolith refactoring (server.py is 4400+ lines)
- [ ] Email Notifications - Implement real Gmail API (keys to be provided)

### P2 - Medium Priority
- [ ] Google Drive full integration (currently demo mode)
- [ ] Zoho Sign full integration (currently demo mode)
- [ ] Google Calendar integration (playbook ready)
- [ ] Task drag-and-drop for hierarchy
- [ ] Task dependencies

### P3 - Low Priority / Future
- [ ] Native mobile app (especially for time tracking)
- [ ] Frontend logic refactoring (extract into hooks)
- [ ] Activity logs per task

---

## Technical Notes

### Database Collections
users, proposals, projects, tasks, time_logs, active_timers, companies, clients, fee_structure, team_salaries, cashflow_expenses, leaves, reimbursements, public_holidays, leave_accrual_policies, leave_balances, email_notifications

### Data Models Updated (V10)
- **Task**: Added `is_internal` (bool) and made `project_id` optional
- **Task statuses**: Added "assigned" status

### Mocked/Demo Features
- Email notifications: Stored in `email_notifications` collection but not sent
- Google Drive: UI present but not functional
- Zoho Sign: UI present but not functional
