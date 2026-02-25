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
  const [expandedMenus, setExpandedMenus] = useState(['Team']);
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const toggleMenu = (menuName) => {
    setExpandedMenus(prev => 
      prev.includes(menuName) 
        ? prev.filter(m => m !== menuName)
        : [...prev, menuName]
    );
  };

  const isChildActive = (item) => {
    if (!item.children) return false;
    return item.children.some(child => location.pathname === child.href);
  };

  const renderNavItem = (item, isMobile = false) => {
    const hasChildren = item.children && item.children.length > 0;
    const isExpanded = expandedMenus.includes(item.name);
    const isActive = item.href ? location.pathname === item.href : isChildActive(item);

    if (hasChildren) {
      return (
        <div key={item.name}>
          <button
            onClick={() => toggleMenu(item.name)}
            className={cn(
              'w-full flex items-center justify-between gap-3 px-4 py-3 rounded-md text-sm font-medium transition-colors',
              isActive
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
            data-testid={`nav-${item.name.toLowerCase().replace(' ', '-')}`}
          >
            <div className="flex items-center gap-3">
              <item.icon className="h-5 w-5" />
              {item.name}
            </div>
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
          {isExpanded && (
            <div className="ml-4 mt-1 space-y-1">
              {item.children.map((child) => {
                const childActive = location.pathname === child.href;
                return (
                  <button
                    key={child.name}
                    onClick={() => {
                      navigate(child.href);
                      if (isMobile) setSidebarOpen(false);
                    }}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2 rounded-md text-sm font-medium transition-colors',
                      childActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                    data-testid={`nav-${child.name.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {child.icon && <child.icon className="h-4 w-4" />}
                    {child.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <button
        key={item.name}
        onClick={() => {
          navigate(item.href);
          if (isMobile) setSidebarOpen(false);
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
            <div className="flex items-center justify-between p-4 border-b bg-white">
              <div className="flex flex-col items-center">
                <img src="/logo.png" alt="AdvantEdge Advisory" className="h-14 w-auto" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="flex-1 p-4 space-y-2">
              {navigation.map((item) => renderNavItem(item, true))}
            </nav>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-1 border-r bg-card">
          <div className="flex flex-col items-center justify-center py-5 px-4 border-b bg-white">
            <img src="/logo.png" alt="AdvantEdge Advisory" className="h-16 w-auto" />
          </div>
          <nav className="flex-1 p-4 space-y-2">
            {navigation.map((item) => renderNavItem(item, false))}
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
        <div className="sticky top-0 z-40 flex h-16 items-center gap-x-4 border-b bg-white px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </Button>
          <img src="/logo.png" alt="AdvantEdge Advisory" className="h-10 w-auto" />
        </div>

        <main className="p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
};
