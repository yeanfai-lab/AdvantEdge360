import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/card';
import { FolderKanban, FileText, CheckSquare, Users, Clock, TrendingUp } from 'lucide-react';

export const DashboardPage = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    projects: 0,
    proposals: 0,
    tasks: 0,
    team: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [projects, proposals, tasks, team] = await Promise.all([
          axios.get(`${API_URL}/projects`, { withCredentials: true }),
          axios.get(`${API_URL}/proposals`, { withCredentials: true }),
          axios.get(`${API_URL}/tasks`, { withCredentials: true }),
          axios.get(`${API_URL}/team`, { withCredentials: true })
        ]);

        setStats({
          projects: projects.data.length,
          proposals: proposals.data.length,
          tasks: tasks.data.length,
          team: team.data.length
        });
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  const statCards = [
    { name: 'Active Projects', value: stats.projects, icon: FolderKanban, color: 'text-chart-1' },
    { name: 'Proposals', value: stats.proposals, icon: FileText, color: 'text-chart-2' },
    { name: 'Open Tasks', value: stats.tasks, icon: CheckSquare, color: 'text-chart-3' },
    { name: 'Team Members', value: stats.team, icon: Users, color: 'text-chart-4' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div data-testid="dashboard-page">
      <div className="mb-8">
        <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">
          Welcome back, {user?.name}
        </h1>
        <p className="text-base text-muted-foreground">
          Here's what's happening with your business today.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.name} className="p-6 hover:shadow-md transition-shadow" data-testid={`stat-card-${stat.name.toLowerCase().replace(' ', '-')}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground mb-1">{stat.name}</p>
                <p className="text-3xl font-bold font-heading">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-lg bg-muted ${stat.color}`}>
                <stat.icon className="h-6 w-6" strokeWidth={1.5} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="p-6">
          <h3 className="text-xl font-heading font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full text-left px-4 py-3 rounded-md bg-muted hover:bg-muted/80 transition-colors">
              <div className="flex items-center gap-3">
                <FolderKanban className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Create New Project</span>
              </div>
            </button>
            <button className="w-full text-left px-4 py-3 rounded-md bg-muted hover:bg-muted/80 transition-colors">
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Draft Proposal</span>
              </div>
            </button>
            <button className="w-full text-left px-4 py-3 rounded-md bg-muted hover:bg-muted/80 transition-colors">
              <div className="flex items-center gap-3">
                <CheckSquare className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Add Task</span>
              </div>
            </button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="text-xl font-heading font-semibold mb-4">Recent Activity</h3>
          <div className="space-y-4">
            <div className="flex items-start gap-3 pb-4 border-b last:border-0">
              <div className="p-2 rounded-md bg-muted">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">System Initialized</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Your AdvantEdge360 platform is ready to use
                </p>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
