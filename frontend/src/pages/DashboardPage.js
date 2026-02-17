import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { FolderKanban, FileText, CheckSquare, Users, TrendingUp } from 'lucide-react';
import { toast } from 'sonner';

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
        const [projectsRes, proposalsRes, tasksRes, teamRes] = await Promise.all([
          axios.get(`${API_URL}/projects`, { withCredentials: true }),
          axios.get(`${API_URL}/proposals`, { withCredentials: true }),
          axios.get(`${API_URL}/tasks`, { withCredentials: true }),
          axios.get(`${API_URL}/team`, { withCredentials: true })
        ]);

        setStats({
          projects: projectsRes.data.length,
          proposals: proposalsRes.data.length,
          tasks: tasksRes.data.length,
          team: teamRes.data.length
        });
        setProjects(projectsRes.data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
