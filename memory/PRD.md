# AdvantEdge360 - Product Requirements Document

## Overview
AdvantEdge360 is a comprehensive, full-stack business operations and project management suite built with React (frontend), FastAPI (backend), and MongoDB (database).

## Core Modules

### 1. Client Management
- Company/Contact hierarchy
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
- Budget, timeline, milestones tracking
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
  - One active timer per user at a time
  - Auto-logs time to task → project → client
  - Total tracked time displayed per task

### 5. Dashboard
- Statistics cards (clickable, navigate to respective pages)
- My Tasks section (user's assigned tasks)
- Team Kanban board (for managers - shows team members' tasks by status)
- Quick Actions (Create Project, Draft Proposal, Add Task)

### 6. Team Management
- Role-based access (Admin, Manager, Team Lead, Team Member, Finance)
- User profiles and skills

### 7. Time Tracking
- Task-level time logging
- Billable/non-billable hours
- Mobile-responsive
- Timer integration from project detail page

### 8. Finance
- Project budgets
- Invoices and expenses
- Revenue tracking

### 9. Reports & Analytics
- Project performance
- Team productivity
- Financial summaries
- CSV export (PDF planned)

## Technical Architecture

### Frontend
- React with React Router
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
- Collections: users, proposals, projects, tasks, time_logs, active_timers, companies, contact_persons

## Integrations (DEMO MODE)
- **Google Drive**: For proposal document attachments
- **Gmail**: For email notifications
- **Zoho Sign**: For electronic signatures
- **Google OAuth**: For user authentication (WORKING)

## What's Been Implemented

### December 2025 - V3 Enhancements
- [x] Proposal versioning system (auto-save, history, restore)
- [x] Tile/List view toggle for Proposals and Projects
- [x] Sortable columns in list views
- [x] Built-in time tracker (start/stop per task per user)
- [x] Sub-tasks system with nesting
- [x] Comment edit/delete functionality
- [x] Enhanced reviewer actions (Approve & Continue, Return to Owner)
- [x] Active timer banner display
- [x] Inline editing for proposal fields

### December 2025 - V4 Enhancements (Latest)
- [x] PDF export for reports (projects, tasks, time logs, team productivity, overview)
- [x] Custom React hooks (useProposals, useProjects, useTasks, useTimer)
- [x] Backend modular structure started (models, services, utils)
- [x] Export dropdown menus with CSV/PDF options
- [x] Proposal action dropdown with workflow actions (Send for Approval, Send to Client, Confirm, Convert)
- [x] Enhanced filtering on Tasks page (by priority, assignee, project)
- [x] Global timer ribbon sticky positioning for better UX
- [x] Full CRUD on Proposals - all fields inline editable (title, client, status, category, requirement, scope, description, amount)
- [x] Full CRUD on Projects - Edit dialog with all fields
- [x] Full CRUD on Tasks - Edit dialog with all fields (title, description, priority, status, assignee, reviewer, dates)
- [x] Task deletion with confirmation
- [x] Clean seed data: 1 company, 1 client, 1 proposal, 1 project, 2 tasks with 2 subtasks each

### December 2025 - V5 Enhancements (Phase 1, 3, 4)
**Phase 1: Task & Time Tracking**
- [x] Task creation with project/task nesting to auto-create subtasks
- [x] Time tracking with Project → Task → Subtask selection
- [x] Timer pause/resume functionality
- [x] Manual time entry with edit/delete capabilities
- [x] Weekly timesheet view

**Phase 3: Role-Based Access Control**
- [x] Admin: Full access to all features
- [x] Supervisor: Operational data only, no financial access
- [x] Manager: Project management with financial access
- [x] Team Member: Own tasks only
- [x] GET /api/roles endpoint for role permissions
- [x] GET /api/user/permissions endpoint
- [x] Team management CRUD with role editing
- [x] Role-based task filtering

**Phase 4: Finance Module**
- [x] Project Profitability view (income, pending, expenses, labor cost, profit)
- [x] Cash Flow 6-month projection
- [x] Labor Cost per project (billable hours × rate)
- [x] Expense CRUD (edit/delete)
- [x] Expense categories (Travel, Equipment, Office Supplies, Client Entertainment, Software, Utilities, Other)

### December 2025 - Initial Overhaul
- [x] Enhanced Proposal workflow with approval cycle
- [x] ProposalDetailPage with full CRUD and approval controls
- [x] Integrated Project/Task view (tasks within project detail)
- [x] Project completion percentage calculation
- [x] Dashboard My Tasks section
- [x] Dashboard Team Kanban for managers
- [x] Clickable navigation between pages

### Previous Implementation
- [x] All core module UI and backend routes
- [x] Google Social Login
- [x] Company/Contact hierarchy in clients
- [x] CSV export for reports
- [x] Mobile-responsive time tracking
- [x] Custom teal/dark grey theme

## Backlog (P1/P2)

### P1 - High Priority
- [ ] Activate Google Drive file picker UI
- [ ] Full proposal sending workflow
- [ ] Real Zoho Sign API integration (requires API keys)
- [ ] Real Gmail notifications (requires API keys)
- [ ] File attachments with cloud storage

### P2 - Medium Priority (Phase 2: Team Management) - COMPLETED
- [x] Onboarding forms for new hires (personal info, bank details, emergency contacts, education, work experience)
- [x] Leave applications CRUD + approval workflow (Casual, Sick, Earned/Annual, Unpaid, WFH)
- [x] Reimbursements CRUD + approval workflow (Travel, Equipment, Office Supplies, Client Entertainment, Other)
- [x] Performance reviews CRUD + approval workflow (draft → submitted → acknowledged)
- [x] Supervisor dashboard for team requests
- [ ] Native mobile app for time tracking

## API Endpoints

### Authentication
- POST /api/auth/session - Create session
- GET /api/auth/me - Get current user
- POST /api/auth/logout - Logout

### Proposals
- POST /api/proposals - Create proposal
- GET /api/proposals - List proposals
- GET /api/proposals/{id} - Get proposal detail
- PATCH /api/proposals/{id} - Update proposal (triggers versioning)
- GET /api/proposals/{id}/versions - Get version history
- POST /api/proposals/{id}/restore-version/{num} - Restore version
- POST /api/proposals/{id}/send-for-internal-approval
- POST /api/proposals/{id}/approve-internal
- POST /api/proposals/{id}/return-to-sender
- POST /api/proposals/{id}/manual-approval
- POST /api/proposals/{id}/reject
- POST /api/proposals/{id}/convert

### Projects
- POST /api/projects - Create project
- GET /api/projects - List projects
- GET /api/projects/{id} - Get project
- PATCH /api/projects/{id} - Update project
- GET /api/projects/{id}/stats - Get project stats

### Tasks
- POST /api/tasks - Create task (supports parent_task_id for subtasks)
- GET /api/tasks - List tasks
- GET /api/tasks/{id} - Get task with subtask details
- PATCH /api/tasks/{id} - Update task
- POST /api/tasks/{id}/add-comment
- PATCH /api/tasks/{id}/comments/{cid} - Edit comment
- DELETE /api/tasks/{id}/comments/{cid} - Delete comment
- POST /api/tasks/{id}/send-for-review
- POST /api/tasks/{id}/approve-review
- POST /api/tasks/{id}/return-to-owner
- POST /api/tasks/{id}/return-for-revision

### Timer
- POST /api/timer/start - Start timer for task
- POST /api/timer/stop - Stop timer and log time
- GET /api/timer/active - Get active timer
- DELETE /api/timer/cancel - Cancel timer without logging

### Dashboard
- GET /api/dashboard/my-tasks
- GET /api/dashboard/team-tasks
- GET /api/dashboard/pending-reviews
- GET /api/dashboard/pending-approvals

### Reports & Export (New in V4)
- GET /api/reports/overview
- GET /api/reports/project-performance
- GET /api/reports/team-productivity
- GET /api/reports/export/projects (CSV)
- GET /api/reports/export/projects/pdf (PDF)
- GET /api/reports/export/tasks (CSV)
- GET /api/reports/export/tasks/pdf (PDF)
- GET /api/reports/export/time-logs (CSV)
- GET /api/reports/export/time-logs/pdf (PDF)
- GET /api/reports/export/team-productivity (CSV)
- GET /api/reports/export/team-productivity/pdf (PDF)
- GET /api/reports/export/overview/pdf (PDF)

## File Structure
```
/app
├── backend/
│   ├── server.py          # Main FastAPI application
│   ├── requirements.txt
│   ├── models/            # Pydantic models (NEW)
│   ├── services/          # Business logic services (NEW)
│   │   └── pdf_service.py # PDF generation
│   ├── utils/             # Utility functions (NEW)
│   └── .env
├── frontend/
│   └── src/
│       ├── components/    # shadcn/ui components
│       ├── contexts/      # AuthContext
│       ├── hooks/         # Custom hooks (NEW)
│       │   ├── useProposals.js
│       │   ├── useProjects.js
│       │   ├── useTasks.js
│       │   └── useTimer.js
│       ├── layouts/       # AppLayout with sidebar
│       └── pages/
│           ├── DashboardPage.js
│           ├── ProposalsPage.js
│           ├── ProposalDetailPage.js
│           ├── ProjectsPage.js
│           ├── ProjectDetailPage.js
│           ├── TasksPage.js
│           ├── ReportsPage.js (Enhanced with PDF export)
│           ├── ClientsPage.js
│           ├── ClientDetailPage.js
│           └── ...
├── memory/
│   └── PRD.md
└── test_reports/
    ├── iteration_4.json
    └── iteration_5.json
```

## Testing
- Backend: pytest with API tests (100% pass rate)
- Frontend: Playwright automation
- All features verified working
- Latest test report: iteration_5.json
