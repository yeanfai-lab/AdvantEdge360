import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '../../lib/utils';
import {
  LayoutDashboard,
  FolderKanban,
  FileText,
  CheckSquare,
  Users,
  Clock,
  Building2,
  DollarSign,
  BarChart3,
  LogOut,
  Menu,
  X,
  Calendar,
  ChevronDown,
  ChevronRight,
  UserCheck,
  Receipt
} from 'lucide-react';
import { Button } from '../ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Clients', href: '/clients', icon: Building2 },
  { name: 'Proposals', href: '/proposals', icon: FileText },
  { name: 'Projects', href: '/projects', icon: FolderKanban },
  { name: 'Tasks', href: '/tasks', icon: CheckSquare },
  { name: 'Time Tracking', href: '/time-tracking', icon: Clock },
  { 
    name: 'Team', 
    icon: Users,
    children: [
      { name: 'Team Members', href: '/team', icon: UserCheck },
      { name: 'Leave Applications', href: '/leave-reimbursement', icon: Calendar },
      { name: 'Reimbursements', href: '/reimbursements', icon: Receipt }
    ]
  },
  { name: 'Finance', href: '/finance', icon: DollarSign },
  { name: 'Reports', href: '/reports', icon: BarChart3 },
];

export const AppLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      <div
        className={cn(
          'fixed inset-0 z-50 bg-background/80 backdrop-blur-sm transition-opacity lg:hidden',
          sidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={() => setSidebarOpen(false)}
      >
        <div
          className={cn(
            'fixed inset-y-0 left-0 w-64 bg-card border-r transform transition-transform',
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between p-6 border-b">
              <h2 className="text-xl font-heading font-bold">AdvantEdge360</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 p-4 space-y-2">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <button
                    key={item.name}
                    onClick={() => {
                      navigate(item.href);
                      setSidebarOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                    data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                  >
                    <item.icon className="h-5 w-5" />
                    {item.name}
                  </button>
                );
              })}
            </nav>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 border-r bg-card">
          <div className="flex items-center h-16 px-6 border-b">
            <h2 className="text-xl font-heading font-bold">AdvantEdge360</h2>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <button
                  key={item.name}
                  onClick={() => navigate(item.href)}
                  className={cn(
                    'w-full flex items-center gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors',
                    isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                  data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
                >
                  <item.icon className="h-5 w-5" />
                  {item.name}
                </button>
              );
            })}
          </nav>
          <div className="p-4 border-t">
            <div className="flex items-center gap-3 mb-4">
              <Avatar>
                <AvatarImage src={user?.picture} />
                <AvatarFallback>{user?.name?.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{user?.name}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full"
              onClick={handleLogout}
              data-testid="logout-button"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Logout
            </Button>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar for mobile */}
        <div className="sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b bg-card/80 backdrop-blur-md px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>
          <h2 className="text-lg font-heading font-bold">AdvantEdge360</h2>
        </div>

        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};
