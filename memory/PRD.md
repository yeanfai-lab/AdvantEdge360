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
- **Client Contact Dropdown**: Select from existing contacts or enter custom name
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
- **Team Tasks Overview**: 
  - Filter by Status/Team Member/Project
  - **Excludes Not Started and Completed tasks** - shows only active work
- Quick Actions matching page forms (with Internal task option)
- Pending Reviews and Proposal Approvals sections

### 6. Team Management
- **Roles** (Supervisor removed):
  - **Admin**: Full access, can invite team members
  - **Manager**: Project management with financial access, can invite team members
  - **Team Lead**: Team coordination and management (can manage team, cannot invite)
  - **Finance**: Financial data access only
  - **Team Member**: Own tasks only
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
- **Currency**: INR throughout the portal (all pages use Indian number formatting)
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

### February 2026 - V11 Updates

#### Phase 7: Role Permissions & UI Enhancements
- [x] Removed "Supervisor" role completely from the system
- [x] Added "Finance" role (can view financial data only)
- [x] Team Lead now has "can_manage_team" permission
- [x] Only Admin and Manager can invite team members (can_invite_team)
- [x] Role Permissions Overview shows new permission badges
- [x] Cleared all dummy data from database

#### Phase 6: Task & Client Enhancements
- [x] Added "Assigned" task status (between Not Started and In Progress)
- [x] Added "Internal" task option for non-billable tasks
- [x] Company Detail Page with tabs for Contacts, Projects, Proposals, Tasks, Finance
- [x] Clickable company tiles on Clients page
- [x] INR currency format across ALL pages (Proposals, Projects, Finance, Clients)
- [x] Client contact dropdown in proposal creation form
- [x] Dashboard Team Tasks excludes "Not Started" and "Completed" tasks

### December 2025 - V9-V10 Complete Feature Set
(Previous implementations preserved)

---

## API Endpoints

### New/Updated Endpoints (V11)
- `GET /api/roles` - Returns 5 roles (admin, manager, team_lead, finance, team_member) with can_invite_team permission
- `GET /api/user/permissions` - Returns can_invite_team in permissions object
- `GET /api/dashboard/team-tasks` - Now excludes not_started AND completed tasks

### V10 Endpoints
- `GET /api/companies/{company_id}/overview` - Company detail with contacts, projects, proposals, tasks, finance

---

## Code Architecture

### Backend Structure
```
/app/backend/
├── server.py           # Main API file (~4400 lines)
├── models/            # Extracted Pydantic models (NEW)
│   ├── user.py
│   ├── proposal.py
│   ├── project.py
│   ├── task.py
│   ├── client.py
│   ├── time_tracking.py
│   ├── team.py
│   └── finance.py
├── core/              # Core configuration (NEW)
│   ├── config.py      # DB connection, ROLES config
│   └── auth.py        # Authentication helpers
└── routes/            # Route modules (prepared for future migration)
```

### Frontend Structure
```
/app/frontend/src/
├── pages/
│   ├── DashboardPage.js
│   ├── ProposalsPage.js
│   ├── ProjectsPage.js
│   ├── TasksPage.js
│   ├── ClientsPage.js
│   ├── CompanyDetailPage.js
│   ├── TeamPage.js
│   ├── FinancePage.js
│   └── ReportsPage.js
└── components/
    └── layout/
        └── AppLayout.js
```

---

## Pending/Future Tasks

### P1 - High Priority
- [ ] Complete backend modular refactoring (migrate routes from server.py to /routes/)
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
users, user_sessions, proposals, projects, tasks, time_logs, active_timers, companies, clients, fee_structure, team_salaries, cashflow_expenses, leaves, reimbursements, public_holidays, leave_accrual_policies, leave_balances, email_notifications, invoices, expenses

### Role Configuration (V11)
| Role | Level | View Financial | Manage Team | Invite Team | Edit All | Delete All |
|------|-------|----------------|-------------|-------------|----------|------------|
| Admin | 100 | ✓ | ✓ | ✓ | ✓ | ✓ |
| Manager | 70 | ✓ | ✓ | ✓ | ✓ | ✗ |
| Team Lead | 50 | ✗ | ✓ | ✗ | ✗ | ✗ |
| Finance | 40 | ✓ | ✗ | ✗ | ✗ | ✗ |
| Team Member | 10 | ✗ | ✗ | ✗ | ✗ | ✗ |

### Mocked/Demo Features
- Email notifications: Stored in `email_notifications` collection but not sent
- Google Drive: UI present but not functional
- Zoho Sign: UI present but not functional
