import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Progress } from '../components/ui/progress';
import { 
  ArrowLeft, Plus, CheckSquare, Clock, AlertCircle, 
  MessageSquare, Send, Check, X, Edit, Trash2, Calendar
} from 'lucide-react';
import { toast } from 'sonner';

const taskStatuses = [
  { id: 'not_started', label: 'Not Started', color: 'bg-muted text-muted-foreground' },
  { id: 'in_progress', label: 'In Progress', color: 'bg-blue-500/20 text-blue-600' },
  { id: 'on_hold', label: 'On Hold', color: 'bg-yellow-500/20 text-yellow-600' },
  { id: 'under_review', label: 'Under Review', color: 'bg-purple-500/20 text-purple-600' },
  { id: 'completed', label: 'Completed', color: 'bg-green-500/20 text-green-600' }
];

const priorities = [
  { id: 'low', label: 'Low', color: 'bg-slate-500/20 text-slate-600' },
  { id: 'medium', label: 'Medium', color: 'bg-blue-500/20 text-blue-600' },
  { id: 'high', label: 'High', color: 'bg-orange-500/20 text-orange-600' },
  { id: 'urgent', label: 'Urgent', color: 'bg-red-500/20 text-red-600' }
];

export const ProjectDetailPage = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isTaskDialog, setIsTaskDialog] = useState(false);
  const [isTaskDetailDialog, setIsTaskDetailDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assigned_to: '',
    start_date: '',
    end_date: '',
    reviewer_id: ''
  });

  const fetchData = async () => {
    try {
      const [projectRes, tasksRes, teamRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/projects/${projectId}`, { withCredentials: true }),
        axios.get(`${API_URL}/tasks?project_id=${projectId}`, { withCredentials: true }),
        axios.get(`${API_URL}/team`, { withCredentials: true }),
        axios.get(`${API_URL}/projects/${projectId}/stats`, { withCredentials: true })
      ]);
      setProject(projectRes.data);
      setTasks(tasksRes.data);
      setTeamMembers(teamRes.data);
      setStats(statsRes.data);
    } catch (error) {
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/tasks`, {
        project_id: projectId,
        ...taskForm
      }, { withCredentials: true });
      toast.success('Task created');
      setIsTaskDialog(false);
      setTaskForm({ title: '', description: '', priority: 'medium', assigned_to: '', start_date: '', end_date: '', reviewer_id: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to create task');
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await axios.patch(`${API_URL}/tasks/${taskId}`, { status: newStatus }, { withCredentials: true });
      fetchData();
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      await axios.post(
        `${API_URL}/tasks/${selectedTask.task_id}/add-comment`,
        null,
        { params: { comment: newComment }, withCredentials: true }
      );
      toast.success('Comment added');
      setNewComment('');
      
      // Refresh the task
      const taskRes = await axios.get(`${API_URL}/tasks?project_id=${projectId}`, { withCredentials: true });
      const updatedTask = taskRes.data.find(t => t.task_id === selectedTask.task_id);
      setSelectedTask(updatedTask);
      setTasks(taskRes.data);
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const handleSendForReview = async (taskId, reviewerId) => {
    try {
      await axios.post(
        `${API_URL}/tasks/${taskId}/send-for-review`,
        null,
        { params: { reviewer_id: reviewerId }, withCredentials: true }
      );
      toast.success('Task sent for review');
      fetchData();
    } catch (error) {
      toast.error('Failed to send for review');
    }
  };

  const handleApproveReview = async (taskId) => {
    try {
      await axios.post(
        `${API_URL}/tasks/${taskId}/approve-review`,
        null,
        { withCredentials: true }
      );
      toast.success('Task approved');
      setIsTaskDetailDialog(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to approve');
    }
  };

  const handleReturnForRevision = async (taskId, notes) => {
    try {
      await axios.post(
        `${API_URL}/tasks/${taskId}/return-for-revision`,
        null,
        { params: { notes }, withCredentials: true }
      );
      toast.success('Task returned for revision');
      setIsTaskDetailDialog(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to return task');
    }
  };

  const openTaskDetail = (task) => {
    setSelectedTask(task);
    setIsTaskDetailDialog(true);
  };

  const getStatusBadge = (status) => {
    const statusInfo = taskStatuses.find(s => s.id === status) || taskStatuses[0];
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${statusInfo.color}`}>{statusInfo.label}</span>;
  };

  const getPriorityBadge = (priority) => {
    const priorityInfo = priorities.find(p => p.id === priority) || priorities[1];
    return <span className={`px-2 py-1 text-xs font-medium rounded-full ${priorityInfo.color}`}>{priorityInfo.label}</span>;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  if (!project) {
    return <Card className="p-12 text-center"><p className="text-muted-foreground">Project not found</p></Card>;
  }

  const isManager = user?.role && ['admin', 'manager', 'team_lead'].includes(user.role);
  const isReviewer = selectedTask?.reviewer_id === user?.user_id;

  return (
    <div data-testid="project-detail-page">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/projects')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">{project.name}</h1>
            <p className="text-lg text-muted-foreground">{project.client_name || 'No client assigned'}</p>
          </div>
          <div className="flex gap-2 items-center">
            <span className="px-3 py-1 text-sm font-semibold rounded-full bg-primary/20 text-primary">
              {project.status}
            </span>
            <Button onClick={() => setIsTaskDialog(true)} data-testid="add-task-btn">
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </div>
        </div>
      </div>

      {/* Project Stats & Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
        <Card className="lg:col-span-3 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-heading font-semibold">Project Completion</h3>
            <span className="text-2xl font-bold text-primary">{stats?.completion_percentage || 0}%</span>
          </div>
          <Progress value={stats?.completion_percentage || 0} className="h-3 mb-4" />
          <div className="grid grid-cols-5 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold">{stats?.total_tasks || 0}</p>
              <p className="text-xs text-muted-foreground">Total</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-muted-foreground">{stats?.not_started || 0}</p>
              <p className="text-xs text-muted-foreground">Not Started</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-500">{stats?.in_progress || 0}</p>
              <p className="text-xs text-muted-foreground">In Progress</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-500">{stats?.under_review || 0}</p>
              <p className="text-xs text-muted-foreground">Under Review</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-green-500">{stats?.completed || 0}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-heading font-semibold mb-4">Details</h3>
          <div className="space-y-3">
            {project.budget && (
              <div>
                <p className="text-xs text-muted-foreground">Budget</p>
                <p className="text-lg font-bold">${project.budget.toLocaleString()}</p>
              </div>
            )}
            {project.start_date && (
              <div>
                <p className="text-xs text-muted-foreground">Start Date</p>
                <p className="text-sm font-medium">{project.start_date}</p>
              </div>
            )}
            {project.end_date && (
              <div>
                <p className="text-xs text-muted-foreground">End Date</p>
                <p className="text-sm font-medium">{project.end_date}</p>
              </div>
            )}
            {stats?.overdue > 0 && (
              <div className="flex items-center gap-2 text-red-500">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm font-medium">{stats.overdue} Overdue</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Tasks List */}
      <Card className="p-6">
        <h3 className="text-lg font-heading font-semibold mb-4">Tasks ({tasks.length})</h3>
        {tasks.length === 0 ? (
          <div className="text-center py-8">
            <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No tasks yet. Create your first task to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div 
                key={task.task_id} 
                className="p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                onClick={() => openTaskDetail(task)}
                data-testid={`task-item-${task.task_id}`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-medium">{task.title}</h4>
                      {getStatusBadge(task.status)}
                      {getPriorityBadge(task.priority)}
                    </div>
                    {task.description && (
                      <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{task.description}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {task.assigned_to && (
                        <span>Assigned: {teamMembers.find(m => m.user_id === task.assigned_to)?.name || 'Unknown'}</span>
                      )}
                      {task.end_date && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Due: {task.end_date}
                        </span>
                      )}
                      {task.comments?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {task.comments.length}
                        </span>
                      )}
                    </div>
                  </div>
                  <Select 
                    value={task.status} 
                    onValueChange={(value) => { 
                      event?.stopPropagation(); 
                      handleStatusChange(task.task_id, value); 
                    }}
                  >
                    <SelectTrigger className="w-36" onClick={(e) => e.stopPropagation()}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {taskStatuses.map((status) => (
                        <SelectItem key={status.id} value={status.id}>{status.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Create Task Dialog */}
      <Dialog open={isTaskDialog} onOpenChange={setIsTaskDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Task Title</label>
              <Input
                value={taskForm.title}
                onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                placeholder="Enter task title"
                required
                data-testid="task-title-input"
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Priority</label>
                <Select value={taskForm.priority} onValueChange={(value) => setTaskForm({ ...taskForm, priority: value })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {priorities.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Assign To</label>
                <Select value={taskForm.assigned_to} onValueChange={(value) => setTaskForm({ ...taskForm, assigned_to: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>{member.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Start Date</label>
                <Input
                  type="date"
                  value={taskForm.start_date}
                  onChange={(e) => setTaskForm({ ...taskForm, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">End Date</label>
                <Input
                  type="date"
                  value={taskForm.end_date}
                  onChange={(e) => setTaskForm({ ...taskForm, end_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Reviewer (Optional)</label>
              <Select value={taskForm.reviewer_id} onValueChange={(value) => setTaskForm({ ...taskForm, reviewer_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select reviewer" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.filter(m => ['admin', 'manager', 'team_lead'].includes(m.role)).map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>{member.name} ({member.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsTaskDialog(false)}>Cancel</Button>
              <Button type="submit" data-testid="submit-task-btn">Create Task</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Task Detail Dialog */}
      <Dialog open={isTaskDetailDialog} onOpenChange={setIsTaskDetailDialog}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {selectedTask?.title}
              {selectedTask && getStatusBadge(selectedTask.status)}
            </DialogTitle>
          </DialogHeader>
          {selectedTask && (
            <div className="space-y-6">
              {/* Task Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Priority</p>
                  {getPriorityBadge(selectedTask.priority)}
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Assigned To</p>
                  <p className="font-medium">{teamMembers.find(m => m.user_id === selectedTask.assigned_to)?.name || 'Unassigned'}</p>
                </div>
                {selectedTask.start_date && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Start Date</p>
                    <p className="font-medium">{selectedTask.start_date}</p>
                  </div>
                )}
                {selectedTask.end_date && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Due Date</p>
                    <p className="font-medium">{selectedTask.end_date}</p>
                  </div>
                )}
              </div>

              {/* Description */}
              {selectedTask.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Description</p>
                  <p className="text-sm">{selectedTask.description}</p>
                </div>
              )}

              {/* Review Notes */}
              {selectedTask.review_notes && (
                <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
                  <p className="text-sm font-medium text-yellow-600 mb-1">Reviewer Notes</p>
                  <p className="text-sm">{selectedTask.review_notes}</p>
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {selectedTask.status === 'in_progress' && selectedTask.assigned_to === user?.user_id && (
                  <Select onValueChange={(reviewerId) => handleSendForReview(selectedTask.task_id, reviewerId)}>
                    <SelectTrigger className="w-48">
                      <div className="flex items-center gap-2">
                        <Send className="h-4 w-4" />
                        <span>Send for Review</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {teamMembers.filter(m => ['admin', 'manager', 'team_lead'].includes(m.role)).map((member) => (
                        <SelectItem key={member.user_id} value={member.user_id}>{member.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedTask.status === 'under_review' && isReviewer && (
                  <>
                    <Button onClick={() => handleApproveReview(selectedTask.task_id)} className="bg-green-500 hover:bg-green-600">
                      <Check className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => {
                        const notes = window.prompt('Enter revision notes:');
                        if (notes) handleReturnForRevision(selectedTask.task_id, notes);
                      }}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Return for Revision
                    </Button>
                  </>
                )}
              </div>

              {/* Comments */}
              <div>
                <p className="text-sm font-medium mb-3">Comments ({selectedTask.comments?.length || 0})</p>
                <div className="space-y-3 max-h-48 overflow-y-auto mb-3">
                  {selectedTask.comments?.map((comment, index) => (
                    <div key={index} className="p-3 bg-muted rounded-lg">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-sm font-medium">{comment.user_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(comment.timestamp).toLocaleString()}
                        </p>
                      </div>
                      <p className="text-sm">{comment.comment}</p>
                    </div>
                  ))}
                  {(!selectedTask.comments || selectedTask.comments.length === 0) && (
                    <p className="text-sm text-muted-foreground text-center py-4">No comments yet</p>
                  )}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    onKeyPress={(e) => e.key === 'Enter' && handleAddComment()}
                  />
                  <Button onClick={handleAddComment} disabled={!newComment.trim()}>
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
