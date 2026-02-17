import React from 'react';
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from 'sonner';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { AuthCallback } from './pages/AuthCallback';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProposalsPage } from './pages/ProposalsPage';
import { TasksPage } from './pages/TasksPage';
import { TeamPage } from './pages/TeamPage';
import { TimeTrackingPage } from './pages/TimeTrackingPage';
import { ClientsPage } from './pages/ClientsPage';
import { FinancePage } from './pages/FinancePage';
import { ReportsPage } from './pages/ReportsPage';
import './App.css';

function AppRouter() {
  const location = useLocation();

  if (location.hash?.includes('session_id=')) {
    return <AuthCallback />;
  }

  return (
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
    </Routes>
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
