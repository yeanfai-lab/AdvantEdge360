import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { FileText, TrendingUp, Users, Clock, Download, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

export const ReportsPage = () => {
  const [overview, setOverview] = useState(null);
  const [projectPerformance, setProjectPerformance] = useState([]);
  const [teamProductivity, setTeamProductivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const [overviewRes, projectsRes, teamRes] = await Promise.all([
          axios.get(`${API_URL}/reports/overview`, { withCredentials: true }),
          axios.get(`${API_URL}/reports/project-performance`, { withCredentials: true }),
          axios.get(`${API_URL}/reports/team-productivity`, { withCredentials: true })
        ]);
        setOverview(overviewRes.data);
        setProjectPerformance(projectsRes.data);
        setTeamProductivity(teamRes.data);
      } catch (error) {
        toast.error('Failed to load reports');
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, []);

  const COLORS = ['hsl(180, 84%, 45%)', 'hsl(160, 75%, 40%)', 'hsl(200, 70%, 50%)', 'hsl(140, 65%, 45%)'];

  const handleExport = async (endpoint, filename) => {
    try {
      const response = await axios.get(`${API_URL}/reports/export/${endpoint}`, {
        withCredentials: true,
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Report exported successfully');
    } catch (error) {
      toast.error('Failed to export report');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div data-testid="reports-page">
      <div className="mb-8">
        <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Reports & Analytics</h1>
        <p className="text-base text-muted-foreground">Insights and performance metrics across your organization</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="projects">Project Performance</TabsTrigger>
          <TabsTrigger value="team">Team Productivity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="flex justify-end gap-2 mb-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button data-testid="export-overview-btn">
                  <Download className="mr-2 h-4 w-4" />
                  Export Overview
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport('overview/pdf', 'overview_report.pdf')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export as PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('tasks', 'tasks_export.csv')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Tasks CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('tasks/pdf', 'tasks_report.pdf')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Tasks PDF
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('time-logs', 'time_logs_export.csv')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Time Logs CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('time-logs/pdf', 'time_logs_report.pdf')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Time Logs PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          {overview && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <FileText className="h-5 w-5 text-chart-1" />
                    <p className="text-sm text-muted-foreground">Active Projects</p>
                  </div>
                  <p className="text-3xl font-heading font-bold">{overview.projects.active}</p>
                  <p className="text-xs text-muted-foreground mt-1">of {overview.projects.total} total</p>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="h-5 w-5 text-chart-2" />
                    <p className="text-sm text-muted-foreground">Task Completion</p>
                  </div>
                  <p className="text-3xl font-heading font-bold">{overview.tasks.completion_rate.toFixed(1)}%</p>
                  <p className="text-xs text-muted-foreground mt-1">{overview.tasks.completed} of {overview.tasks.total}</p>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Clock className="h-5 w-5 text-chart-3" />
                    <p className="text-sm text-muted-foreground">Total Hours</p>
                  </div>
                  <p className="text-3xl font-heading font-bold">{overview.time.total_hours}</p>
                  <p className="text-xs text-muted-foreground mt-1">{overview.time.billable_hours} billable</p>
                </Card>

                <Card className="p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="h-5 w-5 text-chart-4" />
                    <p className="text-sm text-muted-foreground">Team Members</p>
                  </div>
                  <p className="text-3xl font-heading font-bold">{overview.team.total}</p>
                </Card>
              </div>

              {overview.finance && Object.keys(overview.finance).length > 0 && (
                <Card className="p-6">
                  <h3 className="text-xl font-heading font-semibold mb-6">Financial Overview</h3>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Revenue</p>
                      <p className="text-2xl font-heading font-bold text-chart-4">
                        ${overview.finance.total_revenue?.toLocaleString() || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Pending</p>
                      <p className="text-2xl font-heading font-bold text-chart-2">
                        ${overview.finance.pending_revenue?.toLocaleString() || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Expenses</p>
                      <p className="text-2xl font-heading font-bold text-destructive">
                        ${overview.finance.total_expenses?.toLocaleString() || 0}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Profit</p>
                      <p className="text-2xl font-heading font-bold">
                        ${overview.finance.profit?.toLocaleString() || 0}
                      </p>
                    </div>
                  </div>
                </Card>
              )}

              <Card className="p-6">
                <h3 className="text-xl font-heading font-semibold mb-6">Time Distribution</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Billable Hours', value: overview.time.billable_hours },
                        { name: 'Non-Billable Hours', value: overview.time.non_billable_hours }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[0, 1].map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="projects" className="space-y-6">
          <div className="flex justify-end gap-2 mb-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button data-testid="export-projects-btn">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport('projects', 'projects_export.csv')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('projects/pdf', 'projects_report.pdf')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Card className="p-6">
            <h3 className="text-xl font-heading font-semibold mb-6">Project Performance Metrics</h3>
            {projectPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={projectPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="project_name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total_tasks" fill="hsl(210, 11%, 15%)" name="Total Tasks" />
                  <Bar dataKey="completed_tasks" fill="hsl(180, 84%, 45%)" name="Completed Tasks" />
                  <Bar dataKey="total_hours" fill="hsl(160, 75%, 40%)" name="Hours Spent" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No project data available</p>
            )}
          </Card>

          {projectPerformance.length > 0 && (
            <div className="space-y-3">
              {projectPerformance.map((project) => (
                <Card key={project.project_id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h4 className="font-medium mb-1">{project.project_name}</h4>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Tasks: {project.completed_tasks}/{project.total_tasks}</span>
                        <span>Completion: {project.completion_rate.toFixed(1)}%</span>
                        <span>Hours: {project.total_hours}</span>
                        {project.budget > 0 && <span>Budget: ${project.budget.toLocaleString()}</span>}
                      </div>
                    </div>
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                      project.status === 'active' ? 'bg-chart-4/20 text-chart-4' : 'bg-muted text-foreground'
                    }`}>
                      {project.status}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="team" className="space-y-6">
          <div className="flex justify-end gap-2 mb-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button data-testid="export-team-btn">
                  <Download className="mr-2 h-4 w-4" />
                  Export
                  <ChevronDown className="ml-2 h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleExport('team-productivity', 'team_productivity_export.csv')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport('team-productivity/pdf', 'team_productivity_report.pdf')}>
                  <FileText className="mr-2 h-4 w-4" />
                  Export as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <Card className="p-6">
            <h3 className="text-xl font-heading font-semibold mb-6">Team Productivity Overview</h3>
            {teamProductivity.length > 0 ? (
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={teamProductivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total_tasks" fill="hsl(210, 11%, 15%)" name="Total Tasks" />
                  <Bar dataKey="completed_tasks" fill="hsl(180, 84%, 45%)" name="Completed" />
                  <Bar dataKey="total_hours" fill="hsl(160, 75%, 40%)" name="Hours" />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-center text-muted-foreground py-8">No team data available</p>
            )}
          </Card>

          {teamProductivity.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {teamProductivity.map((member) => (
                <Card key={member.user_id} className="p-4">
                  <h4 className="font-medium mb-2">{member.name}</h4>
                  <p className="text-xs text-muted-foreground mb-3">{member.role}</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Tasks:</span>
                      <span className="font-medium">{member.total_tasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Completed:</span>
                      <span className="font-medium text-chart-4">{member.completed_tasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Hours:</span>
                      <span className="font-medium">{member.total_hours}</span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
