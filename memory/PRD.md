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
- Internal approval workflow (Sender → Approver → Client)
- Google Drive document attachment (DEMO MODE)
- Zoho Sign integration (DEMO MODE)
- Conversion to Project

### 3. Project Management
- Integrated task management (tasks shown within project detail)
- Completion percentage calculated from task statuses
- Project stats (total, in progress, completed, overdue tasks)
- Budget, timeline, milestones tracking

### 4. Task Management
- **Statuses**: Not Started, In Progress, On Hold, Under Review, Completed
- **Priorities**: Low, Medium, High, Urgent
- Assignment, reviewer, comments
- Review/approval workflow
- Start/End dates

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

### Backend
- FastAPI (Python)
- Pydantic models
- JWT authentication with Google OAuth

### Database
- MongoDB (Motor async driver)

## Integrations (DEMO MODE)
- **Google Drive**: For proposal document attachments
- **Gmail**: For email notifications
- **Zoho Sign**: For electronic signatures
- **Google OAuth**: For user authentication (WORKING)

## What's Been Implemented

### December 2025 - Major Overhaul
- [x] Enhanced Proposal workflow with approval cycle
- [x] ProposalDetailPage with full CRUD and approval controls
- [x] Integrated Project/Task view (tasks within project detail)
- [x] Project completion percentage calculation
- [x] Dashboard My Tasks section
- [x] Dashboard Team Kanban for managers
- [x] Clickable navigation between pages
- [x] Fixed proposal creation with new fields
- [x] Fixed TasksPage Select component crash

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

### P2 - Medium Priority
- [ ] PDF export for reports
- [ ] Backend refactoring (split server.py into modules)
- [ ] Custom hooks for frontend state management
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
- PATCH /api/proposals/{id} - Update proposal
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
- POST /api/tasks - Create task
- GET /api/tasks - List tasks
- PATCH /api/tasks/{id} - Update task
- POST /api/tasks/{id}/add-comment
- POST /api/tasks/{id}/send-for-review
- POST /api/tasks/{id}/approve-review
- POST /api/tasks/{id}/return-for-revision

### Dashboard
- GET /api/dashboard/my-tasks
- GET /api/dashboard/team-tasks

## File Structure
```
/app
├── backend/
│   ├── server.py          # Main FastAPI application
│   ├── requirements.txt
│   └── .env
├── frontend/
│   └── src/
│       ├── components/    # shadcn/ui components
│       ├── contexts/      # AuthContext
│       ├── layouts/       # AppLayout with sidebar
│       └── pages/
│           ├── DashboardPage.js
│           ├── ProposalsPage.js
│           ├── ProposalDetailPage.js
│           ├── ProjectsPage.js
│           ├── ProjectDetailPage.js
│           ├── TasksPage.js
│           ├── ClientsPage.js
│           ├── ClientDetailPage.js
│           └── ...
├── memory/
│   └── PRD.md
└── test_reports/
    └── iteration_2.json
```

## Testing
- Backend: pytest with API tests
- Frontend: Playwright automation
- All tests passing (100% success rate)
