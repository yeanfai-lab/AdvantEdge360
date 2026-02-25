import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from 'sonner';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { GlobalTimerRibbon } from './components/GlobalTimerRibbon';
import { LoginPage } from './pages/LoginPage';
import { AuthCallback } from './pages/AuthCallback';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { ProposalsPage } from './pages/ProposalsPage';
import { ProposalDetailPage } from './pages/ProposalDetailPage';
import { TasksPage } from './pages/TasksPage';
import { TeamPage } from './pages/TeamPage';
import { TimeTrackingPage } from './pages/TimeTrackingPage';
import { ClientsPage } from './pages/ClientsPage';
import { ClientDetailPage } from './pages/ClientDetailPage';
import { FinancePage } from './pages/FinancePage';
import { ReportsPage } from './pages/ReportsPage';
import { LeaveReimbursementPage } from './pages/LeaveReimbursementPage';
import './App.css';

function TimerWrapper() {
  const { user } = useAuth();
  if (!user) return null;
  return <GlobalTimerRibbon />;
}

function AppRouter() {
  const location = useLocation();

  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
    <>
      <TimerWrapper />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route
          path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DashboardPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProjectsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects/:projectId"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProjectDetailPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/proposals"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProposalsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/proposals/:proposalId"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ProposalDetailPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <AppLayout>
              <TasksPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/team"
        element={
          <ProtectedRoute>
            <AppLayout>
              <TeamPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/time-tracking"
        element={
          <ProtectedRoute>
            <AppLayout>
              <TimeTrackingPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ClientsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients/:clientId"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ClientDetailPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/finance"
        element={
          <ProtectedRoute>
            <AppLayout>
              <FinancePage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ReportsPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leave-reimbursement"
        element={
          <ProtectedRoute>
            <AppLayout>
              <LeaveReimbursementPage defaultTab="leaves" />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reimbursements"
        element={
          <ProtectedRoute>
            <AppLayout>
              <LeaveReimbursementPage defaultTab="reimbursements" />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      </Routes>
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </AuthProvider>
  );
}

export default App;
