import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Progress } from '../components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Plus, FolderKanban, ChevronRight, LayoutGrid, List, ArrowUpDown } from 'lucide-react';
import { toast } from 'sonner';

export const ProjectsPage = () => {
  const navigate = useNavigate();
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('projectsViewMode') || 'tile');
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    client_name: '',
    budget: '',
    start_date: '',
    end_date: ''
  });

  useEffect(() => {
    localStorage.setItem('projectsViewMode', viewMode);
  }, [viewMode]);

  const fetchProjects = async () => {
    try {
      const response = await axios.get(`${API_URL}/projects`, { withCredentials: true });
      setProjects(response.data);
    } catch (error) {
      toast.error('Failed to load projects');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/projects`, {
        ...formData,
        budget: formData.budget ? parseFloat(formData.budget) : null
      }, { withCredentials: true });
      toast.success('Project created successfully');
      setIsDialogOpen(false);
      setFormData({ name: '', description: '', client_name: '', budget: '', start_date: '', end_date: '' });
      fetchProjects();
    } catch (error) {
      toast.error('Failed to create project');
    }
  };

  const sortedProjects = [...projects].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (sortField === 'budget' || sortField === 'completion_percentage') {
      aVal = aVal || 0;
      bVal = bVal || 0;
    }
    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div data-testid="projects-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Projects</h1>
          <p className="text-base text-muted-foreground">Manage your client projects and deliverables</p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded-md">
            <Button 
              variant={viewMode === 'tile' ? 'default' : 'ghost'} 
              size="sm" 
              className="rounded-r-none"
              onClick={() => setViewMode('tile')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'default' : 'ghost'} 
              size="sm" 
              className="rounded-l-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="create-project-button">
                <Plus className="mr-2 h-4 w-4" />
                New Project
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Create New Project</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Project Name</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Enter project name"
                    required
                    data-testid="project-name-input"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Project description"
                  required
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Client Name</label>
                  <Input
                    value={formData.client_name}
                    onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                    placeholder="Client name"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Budget</label>
                  <Input
                    type="number"
                    value={formData.budget}
                    onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Start Date</label>
                  <Input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">End Date</label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="submit-project-button">
                  Create Project
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {projects.length === 0 ? (
        <Card className="p-12 text-center">
          <FolderKanban className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-heading font-semibold mb-2">No projects yet</h3>
          <p className="text-muted-foreground mb-6">Get started by creating your first project</p>
        </Card>
      ) : viewMode === 'list' ? (
        /* List View */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium cursor-pointer hover:bg-muted" onClick={() => toggleSort('name')}>
                    <div className="flex items-center gap-2">Name <ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                  <th className="text-left p-4 font-medium cursor-pointer hover:bg-muted" onClick={() => toggleSort('client_name')}>
                    <div className="flex items-center gap-2">Client <ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                  <th className="text-left p-4 font-medium cursor-pointer hover:bg-muted" onClick={() => toggleSort('status')}>
                    <div className="flex items-center gap-2">Status <ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                  <th className="text-left p-4 font-medium cursor-pointer hover:bg-muted" onClick={() => toggleSort('completion_percentage')}>
                    <div className="flex items-center gap-2">Progress <ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                  <th className="text-left p-4 font-medium cursor-pointer hover:bg-muted" onClick={() => toggleSort('budget')}>
                    <div className="flex items-center gap-2">Budget <ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                  <th className="text-right p-4 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {sortedProjects.map((project) => (
                  <tr 
                    key={project.project_id} 
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/projects/${project.project_id}`)}
                    data-testid={`project-row-${project.project_id}`}
                  >
                    <td className="p-4">
                      <p className="font-medium">{project.name}</p>
                      {project.description && (
                        <p className="text-sm text-muted-foreground line-clamp-1">{project.description}</p>
                      )}
                    </td>
                    <td className="p-4 text-muted-foreground">{project.client_name || '-'}</td>
                    <td className="p-4">
                      <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-primary/20 text-primary">
                        {project.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <Progress value={project.completion_percentage || 0} className="h-2 w-20" />
                        <span className="text-sm">{project.completion_percentage || 0}%</span>
                      </div>
                    </td>
                    <td className="p-4 font-mono">{project.budget ? `$${project.budget.toLocaleString()}` : '-'}</td>
                    <td className="p-4 text-right">
                      <ChevronRight className="h-5 w-5 text-muted-foreground inline" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Tile View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedProjects.map((project) => (
            <Card 
              key={project.project_id} 
              className="p-6 hover:shadow-md transition-shadow cursor-pointer" 
              data-testid={`project-card-${project.project_id}`}
              onClick={() => navigate(`/projects/${project.project_id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-heading font-semibold mb-2">{project.name}</h3>
                  {project.client_name && (
                    <p className="text-sm text-muted-foreground mb-2">Client: {project.client_name}</p>
                  )}
                </div>
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-primary/20 text-primary">
                  {project.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{project.description}</p>
              
              {/* Completion Progress */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">Completion</span>
                  <span className="text-xs font-medium">{project.completion_percentage || 0}%</span>
                </div>
                <Progress value={project.completion_percentage || 0} className="h-2" />
              </div>
              
              {project.budget && (
                <div className="pt-4 border-t flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Budget</p>
                    <p className="text-lg font-mono font-semibold">${project.budget.toLocaleString()}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
              {!project.budget && (
                <div className="pt-4 border-t flex items-center justify-end">
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
