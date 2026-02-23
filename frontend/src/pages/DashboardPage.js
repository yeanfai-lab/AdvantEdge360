import React, { useEffect, useState } from 'react';
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
import { FolderKanban, FileText, CheckSquare, Users, TrendingUp, Calendar, AlertCircle, Clock, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const taskStatuses = [
  { id: 'not_started', label: 'Not Started', color: 'bg-muted' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-500' },
  { id: 'on_hold', label: 'On Hold', color: 'bg-yellow-500' },
  { id: 'under_review', label: 'Under Review', color: 'bg-purple-500' },
  { id: 'completed', label: 'Completed', color: 'bg-green-500' }
];

export const DashboardPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    projects: 0,
    proposals: 0,
    tasks: 0,
    team: 0
  });
  const [loading, setLoading] = useState(true);
  const [myTasks, setMyTasks] = useState([]);
  const [teamTasks, setTeamTasks] = useState([]);
  
  // Quick action dialogs
  const [projectDialog, setProjectDialog] = useState(false);
  const [proposalDialog, setProposalDialog] = useState(false);
  const [taskDialog, setTaskDialog] = useState(false);
  const [projects, setProjects] = useState([]);
  
  const [projectForm, setProjectForm] = useState({
    name: '',
    description: '',
    client_name: '',
    budget: ''
  });
  
  const [proposalForm, setProposalForm] = useState({
    title: '',
    client_name: '',
    description: '',
    amount: ''
  });
  
  const [taskForm, setTaskForm] = useState({
    project_id: '',
    title: '',
    description: '',
    priority: 'medium'
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const requests = [
          axios.get(`${API_URL}/projects`, { withCredentials: true }),
          axios.get(`${API_URL}/proposals`, { withCredentials: true }),
          axios.get(`${API_URL}/tasks`, { withCredentials: true }),
          axios.get(`${API_URL}/team`, { withCredentials: true }),
          axios.get(`${API_URL}/dashboard/my-tasks`, { withCredentials: true })
        ];
        
        // Only fetch team tasks for managers
        const isManager = user?.role && ['admin', 'manager', 'team_lead'].includes(user.role);
        if (isManager) {
          requests.push(axios.get(`${API_URL}/dashboard/team-tasks`, { withCredentials: true }));
        }
        
        const responses = await Promise.all(requests);
        const [projectsRes, proposalsRes, tasksRes, teamRes, myTasksRes] = responses;

        setStats({
          projects: projectsRes.data.length,
          proposals: proposalsRes.data.length,
          tasks: tasksRes.data.length,
          team: teamRes.data.length
        });
        setProjects(projectsRes.data);
        setMyTasks(myTasksRes.data);
        
        if (isManager && responses[5]) {
          setTeamTasks(responses[5].data);
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
  }, [user]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/projects`, {
        ...projectForm,
        budget: projectForm.budget ? parseFloat(projectForm.budget) : null
      }, { withCredentials: true });
      toast.success('Project created successfully');
      setProjectDialog(false);
      setProjectForm({ name: '', description: '', client_name: '', budget: '' });
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
      setProposalForm({ title: '', client_name: '', description: '', amount: '' });
      navigate('/proposals');
    } catch (error) {
      toast.error('Failed to create proposal');
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/tasks`, taskForm, { withCredentials: true });
      toast.success('Task created successfully');
      setTaskDialog(false);
      setTaskForm({ project_id: '', title: '', description: '', priority: 'medium' });
      navigate('/tasks');
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

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
        <Card className="p-6">
          <h3 className="text-xl font-heading font-semibold mb-4">Quick Actions</h3>
          <div className="space-y-3">
            <button 
              className="w-full text-left px-4 py-3 rounded-md bg-muted hover:bg-muted/80 transition-colors"
              onClick={() => setProjectDialog(true)}
            >
              <div className="flex items-center gap-3">
                <FolderKanban className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Create New Project</span>
              </div>
            </button>
            <button 
              className="w-full text-left px-4 py-3 rounded-md bg-muted hover:bg-muted/80 transition-colors"
              onClick={() => setProposalDialog(true)}
            >
              <div className="flex items-center gap-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Draft Proposal</span>
              </div>
            </button>
            <button 
              className="w-full text-left px-4 py-3 rounded-md bg-muted hover:bg-muted/80 transition-colors"
              onClick={() => setTaskDialog(true)}
            >
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

      {/* My Tasks Section */}
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
              return (
                <div 
                  key={task.task_id} 
                  className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => {
                    const project = projects.find(p => p.project_id === task.project_id);
                    if (project) navigate(`/projects/${task.project_id}`);
                  }}
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-sm">{task.title}</h4>
                      <span className={`w-2 h-2 rounded-full ${statusInfo.color}`}></span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className={`px-2 py-0.5 rounded-full ${
                        task.priority === 'urgent' ? 'bg-red-500/20 text-red-600' :
                        task.priority === 'high' ? 'bg-orange-500/20 text-orange-600' :
                        task.priority === 'medium' ? 'bg-blue-500/20 text-blue-600' :
                        'bg-slate-500/20 text-slate-600'
                      }`}>{task.priority}</span>
                      {task.due_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {task.due_date}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Team Kanban for Managers */}
      {user?.role && ['admin', 'manager', 'team_lead'].includes(user.role) && teamTasks.length > 0 && (
        <Card className="p-6" data-testid="team-kanban-section">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-heading font-semibold">Team Tasks Overview</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {taskStatuses.filter(s => s.id !== 'not_started').map((status) => (
              <div key={status.id} className="bg-muted/30 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-3 h-3 rounded-full ${status.color}`}></span>
                  <h4 className="font-medium text-sm">{status.label}</h4>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {teamTasks.flatMap(tm => 
                    tm.tasks.filter(t => t.status === status.id).map(task => ({
                      ...task,
                      assignee: tm.user.name
                    }))
                  ).slice(0, 5).map((task) => (
                    <div 
                      key={task.task_id} 
                      className="p-2 bg-card rounded border text-xs cursor-pointer hover:shadow-sm transition-shadow"
                      onClick={() => navigate(`/projects/${task.project_id}`)}
                    >
                      <p className="font-medium mb-1 line-clamp-1">{task.title}</p>
                      <p className="text-muted-foreground">{task.assignee}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Create Project Dialog */}
      <Dialog open={projectDialog} onOpenChange={setProjectDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProject} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Project Name</label>
              <Input
                value={projectForm.name}
                onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                placeholder="Enter project name"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
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
                <label className="text-sm font-medium mb-2 block">Budget</label>
                <Input
                  type="number"
                  value={projectForm.budget}
                  onChange={(e) => setProjectForm({ ...projectForm, budget: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setProjectDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Project</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Proposal Dialog */}
      <Dialog open={proposalDialog} onOpenChange={setProposalDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Draft New Proposal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateProposal} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Proposal Title</label>
              <Input
                value={proposalForm.title}
                onChange={(e) => setProposalForm({ ...proposalForm, title: e.target.value })}
                placeholder="Enter proposal title"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Client Name</label>
              <Input
                value={proposalForm.client_name}
                onChange={(e) => setProposalForm({ ...proposalForm, client_name: e.target.value })}
                placeholder="Client name"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                value={proposalForm.description}
                onChange={(e) => setProposalForm({ ...proposalForm, description: e.target.value })}
                placeholder="Proposal description"
                required
                rows={4}
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Amount</label>
              <Input
                type="number"
                value={proposalForm.amount}
                onChange={(e) => setProposalForm({ ...proposalForm, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setProposalDialog(false)}>
                Cancel
              </Button>
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
            <div>
              <label className="text-sm font-medium mb-2 block">Project</label>
              <select
                className="w-full px-3 py-2 border rounded-md"
                value={taskForm.project_id}
                onChange={(e) => setTaskForm({ ...taskForm, project_id: e.target.value })}
                required
              >
                <option value="">Select project</option>
                {projects.map((project) => (
                  <option key={project.project_id} value={project.project_id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Task Title</label>
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
              <select
                className="w-full px-3 py-2 border rounded-md"
                value={taskForm.priority}
                onChange={(e) => setTaskForm({ ...taskForm, priority: e.target.value })}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setTaskDialog(false)}>
                Cancel
              </Button>
              <Button type="submit">Create Task</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
