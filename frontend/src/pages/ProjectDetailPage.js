import React, { useEffect, useState, useCallback } from 'react';
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
  MessageSquare, Send, Check, X, Edit, Trash2, Calendar,
  Play, Square, ChevronDown, ChevronRight, CornerDownRight, RotateCcw
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

const formatTime = (minutes) => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
};

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
  const [isSubtaskDialog, setIsSubtaskDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [expandedTasks, setExpandedTasks] = useState({});
  const [activeTimer, setActiveTimer] = useState(null);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const [editingComment, setEditingComment] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assigned_to: '',
    start_date: '',
    end_date: '',
    reviewer_id: ''
  });
  const [subtaskForm, setSubtaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assigned_to: ''
  });

  const fetchData = async () => {
    try {
      const [projectRes, tasksRes, teamRes, statsRes, timerRes] = await Promise.all([
        axios.get(`${API_URL}/projects/${projectId}`, { withCredentials: true }),
        axios.get(`${API_URL}/tasks?project_id=${projectId}`, { withCredentials: true }),
        axios.get(`${API_URL}/team`, { withCredentials: true }),
        axios.get(`${API_URL}/projects/${projectId}/stats`, { withCredentials: true }),
        axios.get(`${API_URL}/timer/active`, { withCredentials: true })
      ]);
      setProject(projectRes.data);
      setTasks(tasksRes.data);
      setTeamMembers(teamRes.data);
      setStats(statsRes.data);
      if (timerRes.data.active) {
        setActiveTimer(timerRes.data);
        setTimerElapsed(timerRes.data.elapsed_minutes);
      }
    } catch (error) {
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [projectId]);

  // Timer tick effect
  useEffect(() => {
    let interval;
    if (activeTimer) {
      interval = setInterval(() => {
        const start = new Date(activeTimer.start_time);
        const now = new Date();
        const elapsed = Math.floor((now - start) / 60000);
        setTimerElapsed(elapsed);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  const handleStartTimer = async (taskId) => {
    try {
      const res = await axios.post(`${API_URL}/timer/start`, null, {
        params: { task_id: taskId },
        withCredentials: true
      });
      setActiveTimer({
        active: true,
        task_id: taskId,
        task_title: res.data.task_title,
        start_time: res.data.start_time
      });
      setTimerElapsed(0);
      toast.success('Timer started');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start timer');
    }
  };

  const handleStopTimer = async () => {
    try {
      const res = await axios.post(`${API_URL}/timer/stop`, null, {
        params: { billable: true },
        withCredentials: true
      });
      toast.success(`Timer stopped - ${formatTime(res.data.duration_minutes)} logged`);
      setActiveTimer(null);
      setTimerElapsed(0);
      fetchData();
    } catch (error) {
      toast.error('Failed to stop timer');
    }
  };

  const handleCancelTimer = async () => {
    try {
      await axios.delete(`${API_URL}/timer/cancel`, { withCredentials: true });
      setActiveTimer(null);
      setTimerElapsed(0);
      toast.success('Timer cancelled');
    } catch (error) {
      toast.error('Failed to cancel timer');
    }
  };

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

  const handleCreateSubtask = async (e) => {
    e.preventDefault();
    if (!selectedTask) return;
    try {
      const res = await axios.post(`${API_URL}/tasks`, {
        project_id: projectId,
        parent_task_id: selectedTask.task_id,
        ...subtaskForm
      }, { withCredentials: true });
      
      // Update parent task's subtasks array
      await axios.patch(`${API_URL}/tasks/${selectedTask.task_id}`, {
        subtasks: [...(selectedTask.subtasks || []), res.data.task_id]
      }, { withCredentials: true });
      
      toast.success('Subtask created');
      setIsSubtaskDialog(false);
      setSubtaskForm({ title: '', description: '', priority: 'medium', assigned_to: '' });
      fetchData();
      // Refresh selected task
      const taskRes = await axios.get(`${API_URL}/tasks/${selectedTask.task_id}`, { withCredentials: true });
      setSelectedTask(taskRes.data);
    } catch (error) {
      toast.error('Failed to create subtask');
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
      const res = await axios.post(
        `${API_URL}/tasks/${selectedTask.task_id}/add-comment`,
        null,
        { params: { comment: newComment }, withCredentials: true }
      );
      toast.success('Comment added');
      setNewComment('');
      
      // Refresh the task
      const taskRes = await axios.get(`${API_URL}/tasks/${selectedTask.task_id}`, { withCredentials: true });
      setSelectedTask(taskRes.data);
      fetchData();
    } catch (error) {
      toast.error('Failed to add comment');
    }
  };

  const handleEditComment = async (commentId) => {
    if (!editCommentText.trim()) return;
    try {
      await axios.patch(
        `${API_URL}/tasks/${selectedTask.task_id}/comments/${commentId}`,
        null,
        { params: { new_comment: editCommentText }, withCredentials: true }
      );
      toast.success('Comment updated');
      setEditingComment(null);
      setEditCommentText('');
      const taskRes = await axios.get(`${API_URL}/tasks/${selectedTask.task_id}`, { withCredentials: true });
      setSelectedTask(taskRes.data);
    } catch (error) {
      toast.error('Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await axios.delete(
        `${API_URL}/tasks/${selectedTask.task_id}/comments/${commentId}`,
        { withCredentials: true }
      );
      toast.success('Comment deleted');
      const taskRes = await axios.get(`${API_URL}/tasks/${selectedTask.task_id}`, { withCredentials: true });
      setSelectedTask(taskRes.data);
    } catch (error) {
      toast.error('Failed to delete comment');
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
      setIsTaskDetailDialog(false);
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

  const handleReturnToOwner = async (taskId) => {
    const notes = window.prompt('Enter notes for the task owner (optional):');
    try {
      await axios.post(
        `${API_URL}/tasks/${taskId}/return-to-owner`,
        null,
        { params: { notes }, withCredentials: true }
      );
      toast.success('Task returned to owner');
      setIsTaskDetailDialog(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to return task');
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

  const handleDeleteProject = async () => {
    if (!window.confirm('Are you sure you want to delete this project and all its tasks? This action cannot be undone.')) return;
    try {
      await axios.delete(`${API_URL}/projects/${projectId}`, { withCredentials: true });
      toast.success('Project deleted');
      navigate('/projects');
    } catch (error) {
      toast.error('Failed to delete project');
    }
  };

  const [isEditProjectDialog, setIsEditProjectDialog] = useState(false);
  const [projectForm, setProjectForm] = useState({});

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(`${API_URL}/projects/${projectId}`, projectForm, { withCredentials: true });
      toast.success('Project updated');
      setIsEditProjectDialog(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to update project');
    }
  };

  return (
    <div data-testid="project-detail-page" className="pt-12">
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
            <Button variant="outline" onClick={() => { setProjectForm(project); setIsEditProjectDialog(true); }}>
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button onClick={() => setIsTaskDialog(true)} data-testid="add-task-btn">
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
            <Button variant="destructive" onClick={handleDeleteProject}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Active Timer Banner */}
      {activeTimer && (
        <Card className="p-4 mb-6 bg-primary/10 border-primary">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
              <div>
                <p className="font-medium">Timer Running: {activeTimer.task_title}</p>
                <p className="text-sm text-muted-foreground">Elapsed: {formatTime(timerElapsed)}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleStopTimer} className="bg-green-500 hover:bg-green-600">
                <Square className="mr-1 h-3 w-3" />
                Stop & Log
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancelTimer}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </Card>
      )}

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
        <h3 className="text-lg font-heading font-semibold mb-4">Tasks ({tasks.filter(t => !t.parent_task_id).length})</h3>
        {tasks.filter(t => !t.parent_task_id).length === 0 ? (
          <div className="text-center py-8">
            <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No tasks yet. Create your first task to get started.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {tasks.filter(t => !t.parent_task_id).map((task) => {
              const subtasks = tasks.filter(t => t.parent_task_id === task.task_id);
              const isExpanded = expandedTasks[task.task_id];
              
              return (
                <div key={task.task_id}>
                  <div 
                    className="p-4 rounded-lg border bg-card hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => openTaskDetail(task)}
                    data-testid={`task-item-${task.task_id}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          {subtasks.length > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setExpandedTasks(prev => ({ ...prev, [task.task_id]: !prev[task.task_id] }));
                              }}
                              className="p-1 hover:bg-muted rounded"
                            >
                              {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </button>
                          )}
                          <h4 className="font-medium">{task.title}</h4>
                          {getStatusBadge(task.status)}
                          {getPriorityBadge(task.priority)}
                          {subtasks.length > 0 && (
                            <span className="text-xs text-muted-foreground">({subtasks.length} subtasks)</span>
                          )}
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
                          {task.total_tracked_time > 0 && (
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatTime(task.total_tracked_time)}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        {!activeTimer && (
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            onClick={() => handleStartTimer(task.task_id)}
                            title="Start Timer"
                          >
                            <Play className="h-4 w-4" />
                          </Button>
                        )}
                        <Select 
                          value={task.status} 
                          onValueChange={(value) => handleStatusChange(task.task_id, value)}
                        >
                          <SelectTrigger className="w-36">
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
                  </div>
                  
                  {/* Subtasks */}
                  {isExpanded && subtasks.length > 0 && (
                    <div className="ml-8 mt-2 space-y-2">
                      {subtasks.map((subtask) => (
                        <div 
                          key={subtask.task_id}
                          className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors flex items-center gap-3"
                          onClick={() => openTaskDetail(subtask)}
                        >
                          <CornerDownRight className="h-4 w-4 text-muted-foreground" />
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">{subtask.title}</span>
                              {getStatusBadge(subtask.status)}
                            </div>
                          </div>
                          <Select 
                            value={subtask.status} 
                            onValueChange={(value) => { 
                              event?.stopPropagation(); 
                              handleStatusChange(subtask.task_id, value); 
                            }}
                          >
                            <SelectTrigger className="w-28 h-8 text-xs" onClick={(e) => e.stopPropagation()}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {taskStatuses.map((status) => (
                                <SelectItem key={status.id} value={status.id}>{status.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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

      {/* Create Subtask Dialog */}
      <Dialog open={isSubtaskDialog} onOpenChange={setIsSubtaskDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Subtask for "{selectedTask?.title}"</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateSubtask} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Subtask Title</label>
              <Input
                value={subtaskForm.title}
                onChange={(e) => setSubtaskForm({ ...subtaskForm, title: e.target.value })}
                placeholder="Enter subtask title"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                value={subtaskForm.description}
                onChange={(e) => setSubtaskForm({ ...subtaskForm, description: e.target.value })}
                placeholder="Subtask description"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Priority</label>
                <Select value={subtaskForm.priority} onValueChange={(value) => setSubtaskForm({ ...subtaskForm, priority: value })}>
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
                <Select value={subtaskForm.assigned_to} onValueChange={(value) => setSubtaskForm({ ...subtaskForm, assigned_to: value })}>
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
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsSubtaskDialog(false)}>Cancel</Button>
              <Button type="submit">Create Subtask</Button>
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
                {selectedTask.total_tracked_time > 0 && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">Time Tracked</p>
                    <p className="font-medium flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {formatTime(selectedTask.total_tracked_time)}
                    </p>
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

              {/* Subtasks Section */}
              {!selectedTask.parent_task_id && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium">Subtasks ({selectedTask.subtasks?.length || 0})</p>
                    <Button size="sm" variant="outline" onClick={() => setIsSubtaskDialog(true)}>
                      <Plus className="mr-1 h-3 w-3" />
                      Add Subtask
                    </Button>
                  </div>
                  {selectedTask.subtask_details?.length > 0 ? (
                    <div className="space-y-2">
                      {selectedTask.subtask_details.map((st) => (
                        <div key={st.task_id} className="flex items-center justify-between p-2 bg-muted/50 rounded">
                          <div className="flex items-center gap-2">
                            <CornerDownRight className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{st.title}</span>
                            {getStatusBadge(st.status)}
                          </div>
                          <Select 
                            value={st.status} 
                            onValueChange={(value) => handleStatusChange(st.task_id, value)}
                          >
                            <SelectTrigger className="w-28 h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {taskStatuses.map((status) => (
                                <SelectItem key={status.id} value={status.id}>{status.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">No subtasks</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-wrap gap-2">
                {!activeTimer && (
                  <Button variant="outline" onClick={() => handleStartTimer(selectedTask.task_id)}>
                    <Play className="mr-2 h-4 w-4" />
                    Start Timer
                  </Button>
                )}
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
                      Approve & Continue
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => handleReturnToOwner(selectedTask.task_id)}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Return to Owner
                    </Button>
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        const notes = window.prompt('Enter revision notes:');
                        if (notes) handleReturnForRevision(selectedTask.task_id, notes);
                      }}
                    >
                      <X className="mr-2 h-4 w-4" />
                      Reject
                    </Button>
                  </>
                )}
              </div>

              {/* Comments */}
              <div>
                <p className="text-sm font-medium mb-3">Comments ({selectedTask.comments?.length || 0})</p>
                <div className="space-y-3 max-h-64 overflow-y-auto mb-3">
                  {selectedTask.comments?.map((comment) => (
                    <div key={comment.comment_id || comment.timestamp} className="p-3 bg-muted rounded-lg group">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{comment.user_name}</p>
                          {comment.edited && <span className="text-xs text-muted-foreground">(edited)</span>}
                          {comment.is_system && <span className="text-xs text-yellow-600 bg-yellow-500/20 px-1 rounded">System</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">
                            {new Date(comment.timestamp).toLocaleString()}
                          </p>
                          {comment.user_id === user?.user_id && !comment.is_system && (
                            <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                              <button
                                className="p-1 hover:bg-background rounded"
                                onClick={() => {
                                  setEditingComment(comment.comment_id);
                                  setEditCommentText(comment.comment);
                                }}
                              >
                                <Edit className="h-3 w-3" />
                              </button>
                              <button
                                className="p-1 hover:bg-background rounded text-destructive"
                                onClick={() => handleDeleteComment(comment.comment_id)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      {editingComment === comment.comment_id ? (
                        <div className="flex gap-2 mt-2">
                          <Input
                            value={editCommentText}
                            onChange={(e) => setEditCommentText(e.target.value)}
                            className="flex-1"
                            autoFocus
                          />
                          <Button size="sm" onClick={() => handleEditComment(comment.comment_id)}>
                            <Check className="h-3 w-3" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingComment(null)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      ) : (
                        <p className="text-sm">{comment.comment}</p>
                      )}
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

      {/* Edit Project Dialog */}
      <Dialog open={isEditProjectDialog} onOpenChange={setIsEditProjectDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateProject} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Project Name</label>
              <Input
                value={projectForm.name || ''}
                onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                value={projectForm.description || ''}
                onChange={(e) => setProjectForm({ ...projectForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Client Name</label>
                <Input
                  value={projectForm.client_name || ''}
                  onChange={(e) => setProjectForm({ ...projectForm, client_name: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Budget</label>
                <Input
                  type="number"
                  value={projectForm.budget || ''}
                  onChange={(e) => setProjectForm({ ...projectForm, budget: parseFloat(e.target.value) || null })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Start Date</label>
                <Input
                  type="date"
                  value={projectForm.start_date || ''}
                  onChange={(e) => setProjectForm({ ...projectForm, start_date: e.target.value })}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">End Date</label>
                <Input
                  type="date"
                  value={projectForm.end_date || ''}
                  onChange={(e) => setProjectForm({ ...projectForm, end_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={projectForm.status || 'active'} onValueChange={(value) => setProjectForm({ ...projectForm, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="on_hold">On Hold</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditProjectDialog(false)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
