import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { FolderKanban, FileText, CheckSquare, Users, Calendar, AlertCircle, ChevronRight, Clock, IndianRupee, Building2, Filter } from 'lucide-react';
import { toast } from 'sonner';

const taskStatuses = [
  { id: 'not_started', label: 'Not Started', color: 'bg-muted' },
  { id: 'assigned', label: 'Assigned', color: 'bg-cyan-500' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
  { id: 'on_hold', label: 'On Hold', color: 'bg-yellow-500' },
  { id: 'under_review', label: 'Under Review', color: 'bg-purple-500' },
  { id: 'completed', label: 'Completed', color: 'bg-green-500' }
];

export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ projects: 0, proposals: 0, tasks: 0, team: 0 });
  const [loading, setLoading] = useState(true);
  const [myTasks, setMyTasks] = useState([]);
  const [teamTasks, setTeamTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [pendingReimbursements, setPendingReimbursements] = useState([]);
  
  // Team Tasks filter state
  const [teamTasksView, setTeamTasksView] = useState('status'); // 'status', 'member', 'project'
  
  // Quick action dialogs
  const [projectDialog, setProjectDialog] = useState(false);
  const [proposalDialog, setProposalDialog] = useState(false);
  const [taskDialog, setTaskDialog] = useState(false);
  
  const [projectForm, setProjectForm] = useState({
    name: '', description: '', client_name: '', budget: '', start_date: '', end_date: ''
  });
  
  const [proposalForm, setProposalForm] = useState({
    title: '', client_name: '', category: 'commercial', requirement: '', description: '', amount: ''
  });
  
  const [taskForm, setTaskForm] = useState({
    project_id: '', is_internal: false, title: '', description: '', priority: 'medium'
  });

  const [pendingReviews, setPendingReviews] = useState([]);
  const [pendingApprovals, setPendingApprovals] = useState([]);

  const isManager = user?.role && ['admin', 'manager', 'supervisor', 'team_lead'].includes(user.role);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const requests = [
          axios.get(`${API_URL}/projects`, { withCredentials: true }),
          axios.get(`${API_URL}/proposals`, { withCredentials: true }),
          axios.get(`${API_URL}/tasks`, { withCredentials: true }),
          axios.get(`${API_URL}/team`, { withCredentials: true }),
          axios.get(`${API_URL}/dashboard/my-tasks`, { withCredentials: true }),
          axios.get(`${API_URL}/dashboard/pending-reviews`, { withCredentials: true }),
          axios.get(`${API_URL}/dashboard/pending-approvals`, { withCredentials: true }),
          axios.get(`${API_URL}/clients`, { withCredentials: true })
        ];
        
        if (isManager) {
          requests.push(axios.get(`${API_URL}/dashboard/team-tasks`, { withCredentials: true }));
          requests.push(axios.get(`${API_URL}/leaves`, { withCredentials: true }));
          requests.push(axios.get(`${API_URL}/reimbursements`, { withCredentials: true }));
        }
        
        const responses = await Promise.all(requests);
        const [projectsRes, proposalsRes, tasksRes, teamRes, myTasksRes, reviewsRes, approvalsRes, clientsRes] = responses;

        setStats({
          projects: projectsRes.data.length,
          proposals: proposalsRes.data.length,
          tasks: tasksRes.data.length,
          team: teamRes.data.length
        });
        setProjects(projectsRes.data);
        setMyTasks(myTasksRes.data);
        setPendingReviews(reviewsRes.data);
        setPendingApprovals(approvalsRes.data);
        setClients(clientsRes.data);
        
        if (isManager) {
          if (responses[8]) setTeamTasks(responses[8].data);
          if (responses[9]) setPendingLeaves(responses[9].data.filter(l => l.status === 'pending'));
          if (responses[10]) setPendingReimbursements(responses[10].data.filter(r => r.status === 'pending'));
        }
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    if (user) {
      fetchStats();
    }
  }, [user, isManager]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/projects`, {
        ...projectForm,
        budget: projectForm.budget ? parseFloat(projectForm.budget) : null
      }, { withCredentials: true });
      toast.success('Project created successfully');
      setProjectDialog(false);
      setProjectForm({ name: '', description: '', client_name: '', budget: '', start_date: '', end_date: '' });
      navigate('/projects');
    } catch (error) {
      toast.error('Failed to create project');
    }
  };

  const handleCreateProposal = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/proposals`, {
        ...proposalForm,
        amount: proposalForm.amount ? parseFloat(proposalForm.amount) : null
      }, { withCredentials: true });
      toast.success('Proposal created successfully');
      setProposalDialog(false);
      setProposalForm({ title: '', client_name: '', category: 'commercial', requirement: '', description: '', amount: '' });
      navigate('/proposals');
    } catch (error) {
      toast.error('Failed to create proposal');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/tasks`, {
        ...taskForm,
        project_id: taskForm.is_internal ? null : taskForm.project_id
      }, { withCredentials: true });
      toast.success('Task created successfully');
      setTaskDialog(false);
      setTaskForm({ project_id: '', is_internal: false, title: '', description: '', priority: 'medium' });
      navigate('/tasks');
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  // Get project and client info for a task
  const getTaskDetails = (task) => {
    const project = projects.find(p => p.project_id === task.project_id);
    return {
      projectName: project?.name || task.project_name || 'Unknown Project',
      clientName: project?.client_name || 'N/A'
    };
  };

  // Team tasks filtered by view mode (excluding completed)
  const filteredTeamTasksData = useMemo(() => {
    // Flatten all tasks (excluding completed)
    const allTasks = teamTasks.flatMap(tm => 
      tm.tasks
        .filter(t => t.status !== 'completed')
        .map(task => ({
          ...task,
          assignee: tm.user.name,
          assignee_id: tm.user.user_id
        }))
    );

    if (teamTasksView === 'status') {
      // Group by status
      return taskStatuses
        .filter(s => s.id !== 'completed')
        .map(status => ({
          key: status.id,
          label: status.label,
          color: status.color,
          tasks: allTasks.filter(t => t.status === status.id)
        }));
    } else if (teamTasksView === 'member') {
      // Group by team member
      const members = [...new Set(allTasks.map(t => t.assignee))];
      return members.map(member => ({
        key: member,
        label: member,
        color: 'bg-primary',
        tasks: allTasks.filter(t => t.assignee === member)
      }));
    } else {
      // Group by project
      const projectIds = [...new Set(allTasks.map(t => t.project_id).filter(Boolean))];
      return projectIds.map(pid => {
        const project = projects.find(p => p.project_id === pid);
        return {
          key: pid,
          label: project?.name || 'Unknown Project',
          color: 'bg-accent',
          tasks: allTasks.filter(t => t.project_id === pid)
        };
      });
    }
  }, [teamTasks, teamTasksView, projects]);

  const statCards = [
    { name: 'Active Projects', value: stats.projects, icon: FolderKanban, color: 'text-chart-1', link: '/projects' },
    { name: 'Proposals', value: stats.proposals, icon: FileText, color: 'text-chart-2', link: '/proposals' },
    { name: 'Open Tasks', value: stats.tasks, icon: CheckSquare, color: 'text-chart-3', link: '/tasks' },
    { name: 'Team Members', value: stats.team, icon: Users, color: 'text-chart-4', link: '/team' },
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
          <Card 
            key={stat.name} 
            className="p-6 hover:shadow-lg transition-all cursor-pointer transform hover:scale-105" 
            data-testid={`stat-card-${stat.name.toLowerCase().replace(' ', '-')}`}
            onClick={() => navigate(stat.link)}
          >
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Quick Actions - Updated to match actual page dialogs */}
        <Card className="p-6">
          <h3 className="text-xl font-heading font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button 
              className="w-full text-left px-4 py-3 rounded-md bg-muted hover:bg-muted/80 transition-colors"
              onClick={() => setProjectDialog(true)}
              data-testid="quick-action-project"
            >
              <div className="flex items-center gap-3">
                <FolderKanban className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="font-medium block">Create New Project</span>
                  <span className="text-xs text-muted-foreground">Add project with client, budget & timeline</span>
                </div>
              </div>
            </button>
            <button 
              className="w-full text-left px-4 py-3 rounded-md bg-muted hover:bg-muted/80 transition-colors"
              onClick={() => setProposalDialog(true)}
              data-testid="quick-action-proposal"
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="font-medium block">Draft Proposal</span>
                  <span className="text-xs text-muted-foreground">Create proposal with category & requirements</span>
                </div>
              </div>
            </button>
            <button 
              className="w-full text-left px-4 py-3 rounded-md bg-muted hover:bg-muted/80 transition-colors"
              onClick={() => setTaskDialog(true)}
              data-testid="quick-action-task"
            >
              <div className="flex items-center gap-3">
                <CheckSquare className="h-5 w-5 text-muted-foreground" />
                <div>
                  <span className="font-medium block">Add Task</span>
                  <span className="text-xs text-muted-foreground">Create task for a project with priority</span>
                </div>
              </div>
            </button>
          </div>
        </Card>

        {/* Pending Leave & Reimbursement Requests (for Admin/Manager) */}
        {isManager ? (
          <Card className="p-6" data-testid="pending-requests-panel">
            <h3 className="text-xl font-heading font-semibold mb-4">Pending Team Requests</h3>
            <div className="space-y-4">
              {/* Pending Leaves */}
              <div 
                className="flex items-center justify-between p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 cursor-pointer transition-colors"
                onClick={() => navigate('/leave-reimbursement')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-amber-500/20">
                    <Calendar className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="font-medium">Leave Applications</p>
                    <p className="text-xs text-muted-foreground">
                      {pendingLeaves.length} pending approval{pendingLeaves.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-sm font-bold bg-amber-500/20 text-amber-600 rounded-full">
                    {pendingLeaves.length}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              
              {/* Pending Reimbursements */}
              <div 
                className="flex items-center justify-between p-3 rounded-lg border border-green-500/30 bg-green-500/5 hover:bg-green-500/10 cursor-pointer transition-colors"
                onClick={() => navigate('/reimbursements')}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-green-500/20">
                    <IndianRupee className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="font-medium">Reimbursements</p>
                    <p className="text-xs text-muted-foreground">
                      {pendingReimbursements.length} pending approval{pendingReimbursements.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-1 text-sm font-bold bg-green-500/20 text-green-600 rounded-full">
                    {pendingReimbursements.length}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {pendingLeaves.length === 0 && pendingReimbursements.length === 0 && (
                <p className="text-center text-muted-foreground py-4">No pending requests</p>
              )}
            </div>
          </Card>
        ) : (
          <Card className="p-6">
            <h3 className="text-xl font-heading font-semibold mb-4">Your Quick Links</h3>
            <div className="space-y-3">
              <div 
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate('/leave-reimbursement')}
              >
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <span>Apply for Leave</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div 
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate('/reimbursements')}
              >
                <div className="flex items-center gap-3">
                  <IndianRupee className="h-5 w-5 text-muted-foreground" />
                  <span>Request Reimbursement</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div 
                className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => navigate('/time-tracking')}
              >
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <span>Log Time</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Pending Reviews Section */}
      {pendingReviews.length > 0 && (
        <Card className="p-6 mb-6 border-purple-500/50" data-testid="pending-reviews-section">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-purple-500" />
              <h3 className="text-xl font-heading font-semibold">Pending Reviews</h3>
              <span className="px-2 py-0.5 text-xs font-bold bg-purple-500/20 text-purple-600 rounded-full">
                {pendingReviews.length}
              </span>
            </div>
          </div>
          <div className="space-y-3">
            {pendingReviews.map((task) => (
              <div 
                key={task.task_id} 
                className="flex items-center justify-between p-3 rounded-lg border border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/10 cursor-pointer transition-colors"
                onClick={() => navigate(`/projects/${task.project_id}`)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm">{task.title}</h4>
                    <span className="px-2 py-0.5 text-xs bg-purple-500/20 text-purple-600 rounded-full">Under Review</span>
                  </div>
                  <p className="text-xs text-muted-foreground">{task.project_name || 'Unknown Project'}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Pending Proposal Approvals Section */}
      {pendingApprovals.length > 0 && (
        <Card className="p-6 mb-6 border-yellow-500/50" data-testid="pending-approvals-section">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-yellow-600" />
              <h3 className="text-xl font-heading font-semibold">Pending Proposal Approvals</h3>
              <span className="px-2 py-0.5 text-xs font-bold bg-yellow-500/20 text-yellow-600 rounded-full">
                {pendingApprovals.length}
              </span>
            </div>
          </div>
          <div className="space-y-3">
            {pendingApprovals.map((proposal) => (
              <div 
                key={proposal.proposal_id} 
                className="flex items-center justify-between p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/10 cursor-pointer transition-colors"
                onClick={() => navigate(`/proposals/${proposal.proposal_id}`)}
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-medium text-sm">{proposal.title}</h4>
                    <span className="px-2 py-0.5 text-xs bg-yellow-500/20 text-yellow-600 rounded-full">Pending Approval</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Client: {proposal.client_name}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* My Tasks Section - with Project Name & Client Name */}
      <Card className="p-6 mb-6" data-testid="my-tasks-section">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-heading font-semibold">My Tasks</h3>
          <Button variant="ghost" size="sm" onClick={() => navigate('/tasks')}>
            View All <ChevronRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        {myTasks.length === 0 ? (
          <p className="text-muted-foreground text-center py-6">No tasks assigned to you</p>
        ) : (
          <div className="space-y-3">
            {myTasks.slice(0, 5).map((task) => {
              const statusInfo = taskStatuses.find(s => s.id === task.status) || taskStatuses[0];
              const { projectName, clientName } = getTaskDetails(task);
              return (
                <div 
                  key={task.task_id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => {
                    if (task.project_id) navigate(`/projects/${task.project_id}`);
                  }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{task.title}</h4>
                      <span className={`w-2 h-2 rounded-full ${statusInfo.color}`}></span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FolderKanban className="h-3 w-3" />
                        {projectName}
                      </span>
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {clientName}
                      </span>
                      <span className={`px-2 py-0.5 rounded-full ${
                        task.priority === 'urgent' ? 'bg-red-500/20 text-red-600' :
                        task.priority === 'high' ? 'bg-orange-500/20 text-orange-600' :
                        task.priority === 'medium' ? 'bg-blue-500/20 text-blue-600' :
                        'bg-slate-500/20 text-slate-600'
                      }`}>{task.priority}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Team Tasks Overview - with filters (excluding completed) */}
      {isManager && teamTasks.length > 0 && (
        <Card className="p-6" data-testid="team-kanban-section">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-heading font-semibold">Team Tasks Overview</h3>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={teamTasksView} onValueChange={setTeamTasksView}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="status">By Status</SelectItem>
                  <SelectItem value="member">By Team Member</SelectItem>
                  <SelectItem value="project">By Project</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredTeamTasksData.map((group) => (
              <div key={group.key} className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-3 h-3 rounded-full ${group.color}`}></span>
                  <h4 className="font-medium text-sm truncate">{group.label}</h4>
                  <span className="text-xs text-muted-foreground">({group.tasks.length})</span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {group.tasks.slice(0, 5).map((task) => (
                    <div 
                      key={task.task_id} 
                      className="p-2 bg-card rounded border text-xs cursor-pointer hover:shadow-sm transition-shadow"
                      onClick={() => navigate(`/projects/${task.project_id}`)}
                    >
                      <p className="font-medium mb-1 line-clamp-1">{task.title}</p>
                      <p className="text-muted-foreground">
                        {teamTasksView === 'member' 
                          ? projects.find(p => p.project_id === task.project_id)?.name 
                          : task.assignee}
                      </p>
                    </div>
                  ))}
                  {group.tasks.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No tasks</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Create Project Dialog - Enhanced with more fields */}
      <Dialog open={projectDialog} onOpenChange={setProjectDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Project Name *</label>
              <Input
                value={projectForm.name}
                onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                placeholder="Enter project name"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description *</label>
              <Textarea
                value={projectForm.description}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                placeholder="Project description"
                required
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Client Name</label>
                <Input
                  value={projectForm.client_name}
                  onChange={(e) => setProjectForm({ ...projectForm, client_name: e.target.value })}
                  placeholder="Client name"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Budget (INR)</label>
                <Input
                  type="number"
                  value={projectForm.budget}
                  onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })}
                  placeholder="0"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Start Date</label>
                <Input
                  type="date"
                  value={projectForm.start_date}
                  onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">End Date</label>
                <Input
                  type="date"
                  value={projectForm.end_date}
                  onChange={(e) => setProjectForm({ ...projectForm, end_date: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setProjectDialog(false)}>Cancel</Button>
              <Button type="submit">Create Project</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Proposal Dialog - Enhanced with category & requirement */}
      <Dialog open={proposalDialog} onOpenChange={setProposalDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Draft New Proposal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProposal} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Proposal Title *</label>
              <Input
                value={proposalForm.title}
                onChange={(e) => setProposalForm({ ...proposalForm, title: e.target.value })}
                placeholder="Enter proposal title"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Client Name *</label>
                <Input
                  value={proposalForm.client_name}
                  onChange={(e) => setProposalForm({ ...proposalForm, client_name: e.target.value })}
                  placeholder="Client name"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Select value={proposalForm.category} onValueChange={(v) => setProposalForm({ ...proposalForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual_residential">Individual-Residential</SelectItem>
                    <SelectItem value="housing">Housing</SelectItem>
                    <SelectItem value="commercial">Commercial</SelectItem>
                    <SelectItem value="institutional">Institutional</SelectItem>
                    <SelectItem value="hospitality">Hospitality</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Requirement</label>
              <Textarea
                value={proposalForm.requirement}
                onChange={(e) => setProposalForm({ ...proposalForm, requirement: e.target.value })}
                placeholder="Client requirements"
                rows={2}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description *</label>
              <Textarea
                value={proposalForm.description}
                onChange={(e) => setProposalForm({ ...proposalForm, description: e.target.value })}
                placeholder="Proposal description"
                required
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Amount (INR)</label>
              <Input
                type="number"
                value={proposalForm.amount}
                onChange={(e) => setProposalForm({ ...proposalForm, amount: e.target.value })}
                placeholder="0"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setProposalDialog(false)}>Cancel</Button>
              <Button type="submit">Create Proposal</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Task Dialog */}
      <Dialog open={taskDialog} onOpenChange={setTaskDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            {/* Internal Task Toggle */}
            <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
              <input
                type="checkbox"
                id="dashboard_is_internal"
                checked={taskForm.is_internal}
                onChange={(e) => setTaskForm({ 
                  ...taskForm, 
                  is_internal: e.target.checked, 
                  project_id: e.target.checked ? '' : taskForm.project_id
                })}
                className="h-4 w-4 rounded border-gray-300"
              />
              <label htmlFor="dashboard_is_internal" className="flex-1 cursor-pointer">
                <span className="font-medium text-sm">Internal Task</span>
                <p className="text-xs text-muted-foreground">Not billable - internal business operations</p>
              </label>
            </div>

            {!taskForm.is_internal && (
              <div>
                <label className="text-sm font-medium mb-2 block">Project *</label>
                <Select 
                  value={taskForm.project_id || '__none__'} 
                  onValueChange={(v) => setTaskForm({ ...taskForm, project_id: v === '__none__' ? '' : v })} 
                  required={!taskForm.is_internal}
                >
                  <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">-- Select Project --</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.project_id} value={project.project_id}>{project.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-2 block">Task Title *</label>
              <Input
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder="Enter task title"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                value={taskForm.description}
                onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
                placeholder="Task description"
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Priority</label>
              <Select value={taskForm.priority} onValueChange={(v) => setTaskForm({ ...taskForm, priority: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="urgent">Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setTaskDialog(false)}>Cancel</Button>
              <Button type="submit">Create Task</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
