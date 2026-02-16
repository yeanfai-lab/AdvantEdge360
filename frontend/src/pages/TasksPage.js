import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Plus, CheckSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

export const TasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState('');
  const [view, setView] = useState('list');
  const { user } = useAuth();
  
  const [formData, setFormData] = useState({
    project_id: '',
    title: '',
    description: '',
    priority: 'medium',
    assigned_to: '',
    due_date: '',
    parent_task_id: null
  });

  const fetchTasks = async (projectId = '') => {
    try {
      const url = projectId ? `${API_URL}/tasks?project_id=${projectId}` : `${API_URL}/tasks`;
      const response = await axios.get(url, { withCredentials: true });
      setTasks(response.data);
    } catch (error) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [projectsRes, teamRes] = await Promise.all([
          axios.get(`${API_URL}/projects`, { withCredentials: true }),
          axios.get(`${API_URL}/team`, { withCredentials: true })
        ]);
        setProjects(projectsRes.data);
        setTeamMembers(teamRes.data);
      } catch (error) {
        toast.error('Failed to load data');
      }
    };
    fetchData();
    fetchTasks();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/tasks`, formData, { withCredentials: true });
      toast.success('Task created successfully');
      setIsDialogOpen(false);
      setFormData({ project_id: '', title: '', description: '', priority: 'medium', assigned_to: '', due_date: '', parent_task_id: null });
      fetchTasks(selectedProject);
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await axios.patch(`${API_URL}/tasks/${taskId}`, { status: newStatus }, { withCredentials: true });
      fetchTasks(selectedProject);
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const getPriorityColor = (priority) => {
    const colors = {
      low: 'bg-chart-4/20 text-chart-4',
      medium: 'bg-chart-3/20 text-chart-3',
      high: 'bg-chart-2/20 text-chart-2',
      urgent: 'bg-destructive/20 text-destructive'
    };
    return colors[priority] || 'bg-muted';
  };

  const getStatusColor = (status) => {
    const colors = {
      todo: 'bg-muted text-foreground',
      'in-progress': 'bg-chart-3/20 text-chart-3',
      'in-review': 'bg-chart-2/20 text-chart-2',
      done: 'bg-chart-4/20 text-chart-4'
    };
    return colors[status] || 'bg-muted';
  };

  const statusColumns = [
    { id: 'todo', title: 'To Do' },
    { id: 'in-progress', title: 'In Progress' },
    { id: 'in-review', title: 'In Review' },
    { id: 'done', title: 'Done' }
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div data-testid="tasks-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Tasks</h1>
          <p className="text-base text-muted-foreground">Manage tasks and subtasks across projects</p>
        </div>
        <div className="flex gap-2">
          <Button variant={view === 'list' ? 'default' : 'outline'} onClick={() => setView('list')}>
            List
          </Button>
          <Button variant={view === 'kanban' ? 'default' : 'outline'} onClick={() => setView('kanban')}>
            Kanban
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="create-task-button">
                <Plus className="mr-2 h-4 w-4" />
                New Task
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Task</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Project</label>
                  <Select value={formData.project_id} onValueChange={(value) => setFormData({ ...formData, project_id: value })} required>
                    <SelectTrigger data-testid="task-project-select">
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.length > 0 ? (
                        projects.map((project) => (
                          <SelectItem key={project.project_id} value={project.project_id || 'placeholder'}>
                            {project.name}
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="no-projects" disabled>No projects available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Task Title</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter task title"
                    required
                    data-testid="task-title-input"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Description</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Task description"
                    rows={3}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Priority</label>
                    <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                        <SelectItem value="urgent">Urgent</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Assign To</label>
                    <Select value={formData.assigned_to} onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Unassigned" />
                      </SelectTrigger>
                      <SelectContent>
                        {teamMembers.length > 0 ? (
                          teamMembers.map((member) => (
                            <SelectItem key={member.user_id} value={member.user_id || 'placeholder'}>
                              {member.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-members" disabled>No team members</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Due Date</label>
                  <Input
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="submit-task-button">
                    Create Task
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="mb-6">
        <Select value={selectedProject} onValueChange={(value) => { setSelectedProject(value); fetchTasks(value); }}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="All Projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Projects</SelectItem>
            {projects.map((project) => (
              <SelectItem key={project.project_id} value={project.project_id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tasks.length === 0 ? (
        <Card className="p-12 text-center">
          <CheckSquare className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-heading font-semibold mb-2">No tasks yet</h3>
          <p className="text-muted-foreground mb-6">Create your first task to get started</p>
        </Card>
      ) : view === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6" data-testid="kanban-view">
          {statusColumns.map((column) => (
            <div key={column.id} className="bg-muted/30 rounded-lg p-4">
              <h3 className="font-heading font-semibold mb-4">{column.title}</h3>
              <div className="space-y-3">
                {tasks
                  .filter((task) => task.status === column.id)
                  .map((task) => (
                    <Card key={task.task_id} className="p-4 cursor-pointer hover:shadow-md transition-shadow" data-testid={`task-card-${task.task_id}`}>
                      <h4 className="font-medium mb-2">{task.title}</h4>
                      {task.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{task.description}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                        {task.due_date && (
                          <span className="text-xs text-muted-foreground">
                            Due: {new Date(task.due_date).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </Card>
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3" data-testid="list-view">
          {tasks.map((task) => (
            <Card key={task.task_id} className="p-4" data-testid={`task-card-${task.task_id}`}>
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-medium mb-1">{task.title}</h4>
                  {task.description && (
                    <p className="text-sm text-muted-foreground mb-2">{task.description}</p>
                  )}
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(task.status)}`}>
                      {task.status}
                    </span>
                    {task.due_date && (
                      <span className="text-xs text-muted-foreground">
                        Due: {new Date(task.due_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
                <Select value={task.status} onValueChange={(value) => handleStatusChange(task.task_id, value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="in-review">In Review</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
