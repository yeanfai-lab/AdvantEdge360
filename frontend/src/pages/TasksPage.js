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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { 
  Plus, CheckSquare, Clock, Calendar, MessageSquare, Send, Check, X, 
  Edit, Trash2, Play, ChevronDown, ChevronRight, CornerDownRight, Filter, RotateCcw
} from 'lucide-react';
import { toast } from 'sonner';

const taskStatuses = [
  { id: 'not_started', label: 'Not Started', color: 'bg-muted text-muted-foreground' },
  { id: 'assigned', label: 'Assigned', color: 'bg-cyan-500/20 text-cyan-600' },
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

export const TasksPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTaskDialog, setIsTaskDialog] = useState(false);
  const [isTaskDetailDialog, setIsTaskDetailDialog] = useState(false);
  const [isSubtaskDialog, setIsSubtaskDialog] = useState(false);
  const [isEditDialog, setIsEditDialog] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [expandedTasks, setExpandedTasks] = useState({});
  const [newComment, setNewComment] = useState('');
  const [editingComment, setEditingComment] = useState(null);
  const [editCommentText, setEditCommentText] = useState('');
  
  // Filters
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [filterProject, setFilterProject] = useState('all');
  
  const [taskForm, setTaskForm] = useState({
    project_id: '',
    is_internal: false,
    title: '',
    description: '',
    priority: 'medium',
    assigned_to: '',
    start_date: '',
    end_date: '',
    reviewer_id: '',
    parent_task_id: '',  // For nesting under existing task
    subtasks_to_create: []  // Auto-create subtasks
  });
  
  const [subtaskForm, setSubtaskForm] = useState({
    title: '',
    description: '',
    priority: 'medium',
    assigned_to: ''
  });
  
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  
  const [editForm, setEditForm] = useState({});

  const fetchData = async () => {
    try {
      const [tasksRes, projectsRes, teamRes] = await Promise.all([
        axios.get(`${API_URL}/tasks`, { withCredentials: true }),
        axios.get(`${API_URL}/projects`, { withCredentials: true }),
        axios.get(`${API_URL}/team`, { withCredentials: true })
      ]);
      setTasks(tasksRes.data);
      setProjects(projectsRes.data);
      setTeamMembers(teamRes.data);
    } catch (error) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter tasks
  const filteredTasks = tasks.filter(task => {
    if (task.parent_task_id) return false; // Only show parent tasks, subtasks shown nested
    if (filterPriority !== 'all' && task.priority !== filterPriority) return false;
    if (filterAssignee !== 'all' && task.assigned_to !== filterAssignee) return false;
    if (filterProject !== 'all' && task.project_id !== filterProject) return false;
    return true;
  });

  const handleCreateTask = async (e) => {
    e.preventDefault();
    try {
      // Create main task
      const taskRes = await axios.post(`${API_URL}/tasks`, {
        project_id: taskForm.project_id,
        title: taskForm.title,
        description: taskForm.description,
        priority: taskForm.priority,
        assigned_to: taskForm.assigned_to || null,
        start_date: taskForm.start_date || null,
        end_date: taskForm.end_date || null,
        reviewer_id: taskForm.reviewer_id || null,
        parent_task_id: taskForm.parent_task_id || null
      }, { withCredentials: true });
      
      // Create subtasks if any
      if (taskForm.subtasks_to_create.length > 0) {
        const subtaskIds = [];
        for (const subtask of taskForm.subtasks_to_create) {
          const stRes = await axios.post(`${API_URL}/tasks`, {
            project_id: taskForm.project_id,
            parent_task_id: taskRes.data.task_id,
            title: subtask.title,
            description: subtask.description || '',
            priority: taskForm.priority,
            assigned_to: taskForm.assigned_to || null
          }, { withCredentials: true });
          subtaskIds.push(stRes.data.task_id);
        }
        // Update parent task with subtask IDs
        await axios.patch(`${API_URL}/tasks/${taskRes.data.task_id}`, {
          subtasks: subtaskIds
        }, { withCredentials: true });
      }
      
      // If nested under another task, update parent's subtasks array
      if (taskForm.parent_task_id) {
        const parentTask = tasks.find(t => t.task_id === taskForm.parent_task_id);
        if (parentTask) {
          await axios.patch(`${API_URL}/tasks/${taskForm.parent_task_id}`, {
            subtasks: [...(parentTask.subtasks || []), taskRes.data.task_id]
          }, { withCredentials: true });
        }
      }
      
      toast.success(taskForm.subtasks_to_create.length > 0 
        ? `Task created with ${taskForm.subtasks_to_create.length} subtasks` 
        : 'Task created');
      setIsTaskDialog(false);
      setTaskForm({ 
        project_id: '', title: '', description: '', priority: 'medium', 
        assigned_to: '', start_date: '', end_date: '', reviewer_id: '',
        parent_task_id: '', subtasks_to_create: []
      });
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
        project_id: selectedTask.project_id,
        parent_task_id: selectedTask.task_id,
        ...subtaskForm
      }, { withCredentials: true });
      
      await axios.patch(`${API_URL}/tasks/${selectedTask.task_id}`, {
        subtasks: [...(selectedTask.subtasks || []), res.data.task_id]
      }, { withCredentials: true });
      
      toast.success('Subtask created');
      setIsSubtaskDialog(false);
      setSubtaskForm({ title: '', description: '', priority: 'medium', assigned_to: '' });
      fetchData();
      refreshSelectedTask();
    } catch (error) {
      toast.error('Failed to create subtask');
    }
  };

  const handleUpdateTask = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(`${API_URL}/tasks/${selectedTask.task_id}`, editForm, { withCredentials: true });
      toast.success('Task updated');
      setIsEditDialog(false);
      fetchData();
      refreshSelectedTask();
    } catch (error) {
      toast.error('Failed to update task');
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (!window.confirm('Delete this task and all its subtasks?')) return;
    try {
      await axios.delete(`${API_URL}/tasks/${taskId}`, { withCredentials: true });
      toast.success('Task deleted');
      setIsTaskDetailDialog(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to delete task');
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

  const refreshSelectedTask = async () => {
    if (!selectedTask) return;
    try {
      const res = await axios.get(`${API_URL}/tasks/${selectedTask.task_id}`, { withCredentials: true });
      setSelectedTask(res.data);
    } catch (error) {
      // Task might have been deleted
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
      refreshSelectedTask();
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
      refreshSelectedTask();
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
      refreshSelectedTask();
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
      await axios.post(`${API_URL}/tasks/${taskId}/approve-review`, null, { withCredentials: true });
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

  const handleStartTimer = async (taskId) => {
    try {
      await axios.post(`${API_URL}/timer/start`, null, {
        params: { task_id: taskId },
        withCredentials: true
      });
      toast.success('Timer started');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start timer');
    }
  };

  const openTaskDetail = (task) => {
    setSelectedTask(task);
    setEditForm(task);
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

  const isReviewer = selectedTask?.reviewer_id === user?.user_id;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div data-testid="tasks-page" className="pt-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Tasks</h1>
          <p className="text-base text-muted-foreground">Manage all tasks across projects</p>
        </div>
        <Button onClick={() => setIsTaskDialog(true)} data-testid="create-task-btn">
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4 mb-6">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">Filters:</span>
          </div>
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Projects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Priorities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priorities</SelectItem>
              {priorities.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All Assignees" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Assignees</SelectItem>
              {teamMembers.map((m) => (
                <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {(filterProject !== 'all' || filterPriority !== 'all' || filterAssignee !== 'all') && (
            <Button variant="ghost" size="sm" onClick={() => {
              setFilterProject('all');
              setFilterPriority('all');
              setFilterAssignee('all');
            }}>
              Clear Filters
            </Button>
          )}
        </div>
      </Card>

      {/* Tasks List */}
      <Card className="p-6">
        <h3 className="text-lg font-heading font-semibold mb-4">
          Tasks ({filteredTasks.length})
        </h3>
        {filteredTasks.length === 0 ? (
          <div className="text-center py-8">
            <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No tasks match your filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => {
              const subtasks = tasks.filter(t => t.parent_task_id === task.task_id);
              const isExpanded = expandedTasks[task.task_id];
              const project = projects.find(p => p.project_id === task.project_id);
              
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
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {project && (
                            <span className="px-2 py-0.5 bg-muted rounded">{project.name}</span>
                          )}
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
                        <Button size="sm" variant="ghost" onClick={() => handleStartTimer(task.task_id)} title="Start Timer">
                          <Play className="h-4 w-4" />
                        </Button>
                        <Select value={task.status} onValueChange={(value) => handleStatusChange(task.task_id, value)}>
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreateTask} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Project *</label>
              <Select value={taskForm.project_id} onValueChange={(value) => setTaskForm({ ...taskForm, project_id: value, parent_task_id: '' })} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Nest under existing task option */}
            {taskForm.project_id && (
              <div>
                <label className="text-sm font-medium mb-2 block">Nest Under Task (Optional)</label>
                <Select value={taskForm.parent_task_id || '__none__'} onValueChange={(value) => setTaskForm({ ...taskForm, parent_task_id: value === '__none__' ? '' : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Create as parent task" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Create as parent task</SelectItem>
                    {tasks.filter(t => t.project_id === taskForm.project_id && !t.parent_task_id).map((t) => (
                      <SelectItem key={t.task_id} value={t.task_id}>
                        <div className="flex items-center gap-2">
                          <CornerDownRight className="h-3 w-3" />
                          {t.title}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">Select a parent task to create this as a subtask</p>
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
                <Select value={taskForm.assigned_to || '__none__'} onValueChange={(value) => setTaskForm({ ...taskForm, assigned_to: value === '__none__' ? '' : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Unassigned</SelectItem>
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
                <Input type="date" value={taskForm.start_date} onChange={(e) => setTaskForm({ ...taskForm, start_date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">End Date</label>
                <Input type="date" value={taskForm.end_date} onChange={(e) => setTaskForm({ ...taskForm, end_date: e.target.value })} />
              </div>
            </div>
            
            {/* Auto-create subtasks */}
            {!taskForm.parent_task_id && (
              <div className="border rounded-lg p-4 bg-muted/30">
                <label className="text-sm font-medium mb-3 block">Auto-Create Subtasks (Optional)</label>
                <div className="space-y-2">
                  {taskForm.subtasks_to_create.map((st, idx) => (
                    <div key={idx} className="flex items-center gap-2 p-2 bg-background rounded border">
                      <CornerDownRight className="h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 text-sm">{st.title}</span>
                      <Button 
                        type="button" 
                        size="sm" 
                        variant="ghost"
                        onClick={() => setTaskForm({
                          ...taskForm,
                          subtasks_to_create: taskForm.subtasks_to_create.filter((_, i) => i !== idx)
                        })}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      placeholder="Enter subtask title"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (newSubtaskTitle.trim()) {
                            setTaskForm({
                              ...taskForm,
                              subtasks_to_create: [...taskForm.subtasks_to_create, { title: newSubtaskTitle.trim() }]
                            });
                            setNewSubtaskTitle('');
                          }
                        }
                      }}
                    />
                    <Button 
                      type="button" 
                      variant="outline"
                      onClick={() => {
                        if (newSubtaskTitle.trim()) {
                          setTaskForm({
                            ...taskForm,
                            subtasks_to_create: [...taskForm.subtasks_to_create, { title: newSubtaskTitle.trim() }]
                          });
                          setNewSubtaskTitle('');
                        }
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Press Enter or click + to add subtasks</p>
                </div>
              </div>
            )}
            
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => {
                setIsTaskDialog(false);
                setNewSubtaskTitle('');
              }}>Cancel</Button>
              <Button type="submit">
                {taskForm.subtasks_to_create.length > 0 
                  ? `Create Task with ${taskForm.subtasks_to_create.length} Subtasks` 
                  : 'Create Task'}
              </Button>
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
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
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

      {/* Edit Task Dialog */}
      <Dialog open={isEditDialog} onOpenChange={setIsEditDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateTask} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Task Title</label>
              <Input
                value={editForm.title || ''}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                value={editForm.description || ''}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Priority</label>
                <Select value={editForm.priority || 'medium'} onValueChange={(value) => setEditForm({ ...editForm, priority: value })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {priorities.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Assign To</label>
                <Select value={editForm.assigned_to || ''} onValueChange={(value) => setEditForm({ ...editForm, assigned_to: value })}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
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
                <Input type="date" value={editForm.start_date || ''} onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">End Date</label>
                <Input type="date" value={editForm.end_date || ''} onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Reviewer</label>
              <Select value={editForm.reviewer_id || ''} onValueChange={(value) => setEditForm({ ...editForm, reviewer_id: value })}>
                <SelectTrigger><SelectValue placeholder="No reviewer" /></SelectTrigger>
                <SelectContent>
                  {teamMembers.filter(m => ['admin', 'manager', 'team_lead'].includes(m.role)).map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>{member.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialog(false)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
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

              {selectedTask.description && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Description</p>
                  <p className="text-sm">{selectedTask.description}</p>
                </div>
              )}

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
                          <Select value={st.status} onValueChange={(value) => handleStatusChange(st.task_id, value)}>
                            <SelectTrigger className="w-28 h-7 text-xs"><SelectValue /></SelectTrigger>
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
                <Button variant="outline" onClick={() => { setEditForm(selectedTask); setIsEditDialog(true); }}>
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button variant="outline" onClick={() => handleStartTimer(selectedTask.task_id)}>
                  <Play className="mr-2 h-4 w-4" />
                  Start Timer
                </Button>
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
                    <Button variant="outline" onClick={() => handleReturnToOwner(selectedTask.task_id)}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Return to Owner
                    </Button>
                  </>
                )}
                <Button variant="destructive" onClick={() => handleDeleteTask(selectedTask.task_id)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
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
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">{new Date(comment.timestamp).toLocaleString()}</p>
                          {comment.user_id === user?.user_id && !comment.is_system && (
                            <div className="opacity-0 group-hover:opacity-100 flex gap-1">
                              <button className="p-1 hover:bg-background rounded" onClick={() => { setEditingComment(comment.comment_id); setEditCommentText(comment.comment); }}>
                                <Edit className="h-3 w-3" />
                              </button>
                              <button className="p-1 hover:bg-background rounded text-destructive" onClick={() => handleDeleteComment(comment.comment_id)}>
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                      {editingComment === comment.comment_id ? (
                        <div className="flex gap-2 mt-2">
                          <Input value={editCommentText} onChange={(e) => setEditCommentText(e.target.value)} className="flex-1" autoFocus />
                          <Button size="sm" onClick={() => handleEditComment(comment.comment_id)}><Check className="h-3 w-3" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingComment(null)}><X className="h-3 w-3" /></Button>
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
    </div>
  );
};
