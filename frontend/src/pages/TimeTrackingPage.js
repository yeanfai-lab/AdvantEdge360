import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Switch } from '../components/ui/switch';
import { Plus, Clock, Play, Pause, Square, Edit, Trash2, Calendar, ChevronRight, ChevronDown, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

export const TimeTrackingPage = () => {
  const [timeLogs, setTimeLogs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [activeTimer, setActiveTimer] = useState(null);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [pausedTime, setPausedTime] = useState(0);
  const [editingLog, setEditingLog] = useState(null);
  const { user } = useAuth();

  // Timer selection state
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedTask, setSelectedTask] = useState('');
  const [selectedSubtask, setSelectedSubtask] = useState('');
  const [timerBillable, setTimerBillable] = useState(true);
  const [timerDescription, setTimerDescription] = useState('');

  // Manual entry form
  const [formData, setFormData] = useState({
    project_id: '',
    task_id: '',
    subtask_id: '',
    duration_minutes: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    billable: true
  });

  // Edit form
  const [editForm, setEditForm] = useState({
    duration_minutes: '',
    description: '',
    date: '',
    billable: true
  });

  const fetchData = async () => {
    try {
      const [logsRes, projectsRes, tasksRes, timerRes] = await Promise.all([
        axios.get(`${API_URL}/time-logs`, { withCredentials: true }),
        axios.get(`${API_URL}/projects`, { withCredentials: true }),
        axios.get(`${API_URL}/tasks`, { withCredentials: true }),
        axios.get(`${API_URL}/timer/active`, { withCredentials: true })
      ]);
      setTimeLogs(logsRes.data);
      setProjects(projectsRes.data);
      setTasks(tasksRes.data);
      if (timerRes.data.active) {
        setActiveTimer(timerRes.data);
        // Calculate elapsed time
        const start = new Date(timerRes.data.start_time);
        const now = new Date();
        const elapsed = Math.floor((now - start) / 1000);
        setTimerSeconds(elapsed);
        setPausedTime(timerRes.data.paused_time || 0);
        setIsPaused(timerRes.data.is_paused || false);
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Timer tick effect
  useEffect(() => {
    let interval;
    if (activeTimer && !isPaused) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTimer, isPaused]);

  // Filter tasks by project
  const projectTasks = useMemo(() => {
    if (!selectedProject) return [];
    return tasks.filter(t => t.project_id === selectedProject && !t.parent_task_id);
  }, [selectedProject, tasks]);

  // Filter subtasks by task
  const taskSubtasks = useMemo(() => {
    if (!selectedTask) return [];
    return tasks.filter(t => t.parent_task_id === selectedTask);
  }, [selectedTask, tasks]);

  // Form tasks/subtasks
  const formProjectTasks = useMemo(() => {
    if (!formData.project_id) return [];
    return tasks.filter(t => t.project_id === formData.project_id && !t.parent_task_id);
  }, [formData.project_id, tasks]);

  const formTaskSubtasks = useMemo(() => {
    if (!formData.task_id) return [];
    return tasks.filter(t => t.parent_task_id === formData.task_id);
  }, [formData.task_id, tasks]);

  const handleStartTimer = async () => {
    const taskToTrack = selectedSubtask || selectedTask;
    if (!taskToTrack) {
      toast.error('Please select a task to track');
      return;
    }
    try {
      const res = await axios.post(`${API_URL}/timer/start`, null, {
        params: { task_id: taskToTrack, description: timerDescription },
        withCredentials: true
      });
      setActiveTimer({
        active: true,
        ...res.data,
        is_billable: timerBillable
      });
      setTimerSeconds(0);
      setPausedTime(0);
      setIsPaused(false);
      toast.success('Timer started');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to start timer');
    }
  };

  const handlePauseTimer = async () => {
    try {
      await axios.post(`${API_URL}/timer/pause`, null, { withCredentials: true });
      setIsPaused(true);
      setPausedTime(timerSeconds);
      toast.success('Timer paused');
    } catch (error) {
      toast.error('Failed to pause timer');
    }
  };

  const handleResumeTimer = async () => {
    try {
      await axios.post(`${API_URL}/timer/resume`, null, { withCredentials: true });
      setIsPaused(false);
      toast.success('Timer resumed');
    } catch (error) {
      toast.error('Failed to resume timer');
    }
  };

  const handleStopTimer = async () => {
    try {
      const res = await axios.post(`${API_URL}/timer/stop`, null, {
        params: { billable: timerBillable, description: timerDescription },
        withCredentials: true
      });
      toast.success(`Timer stopped - ${res.data.duration_minutes} minutes logged`);
      setActiveTimer(null);
      setTimerSeconds(0);
      setSelectedProject('');
      setSelectedTask('');
      setSelectedSubtask('');
      setTimerDescription('');
      fetchData();
    } catch (error) {
      toast.error('Failed to stop timer');
    }
  };

  const handleCancelTimer = async () => {
    if (!window.confirm('Cancel timer without logging time?')) return;
    try {
      await axios.delete(`${API_URL}/timer/cancel`, { withCredentials: true });
      setActiveTimer(null);
      setTimerSeconds(0);
      setIsPaused(false);
      toast.success('Timer cancelled');
    } catch (error) {
      toast.error('Failed to cancel timer');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const taskToLog = formData.subtask_id || formData.task_id;
    if (!taskToLog) {
      toast.error('Please select a task');
      return;
    }
    try {
      await axios.post(`${API_URL}/time-logs`, {
        task_id: taskToLog,
        duration_minutes: parseInt(formData.duration_minutes),
        description: formData.description,
        date: formData.date,
        billable: formData.billable
      }, { withCredentials: true });
      toast.success('Time log added');
      setIsDialogOpen(false);
      setFormData({
        project_id: '', task_id: '', subtask_id: '',
        duration_minutes: '', description: '',
        date: new Date().toISOString().split('T')[0], billable: true
      });
      fetchData();
    } catch (error) {
      toast.error('Failed to add time log');
    }
  };

  const handleEditLog = (log) => {
    setEditingLog(log);
    setEditForm({
      duration_minutes: log.duration_minutes.toString(),
      description: log.description || '',
      date: log.date,
      billable: log.billable
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdateLog = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(`${API_URL}/time-logs/${editingLog.log_id}`, {
        duration_minutes: parseInt(editForm.duration_minutes),
        description: editForm.description,
        date: editForm.date,
        billable: editForm.billable
      }, { withCredentials: true });
      toast.success('Time log updated');
      setIsEditDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Failed to update time log');
    }
  };

  const handleDeleteLog = async (logId) => {
    if (!window.confirm('Delete this time entry?')) return;
    try {
      await axios.delete(`${API_URL}/time-logs/${logId}`, { withCredentials: true });
      toast.success('Time log deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete time log');
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Weekly timesheet calculations
  const getWeekDates = () => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - dayOfWeek);
    
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(startOfWeek);
      d.setDate(startOfWeek.getDate() + i);
      dates.push(d.toISOString().split('T')[0]);
    }
    return dates;
  };

  const weekDates = getWeekDates();
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const weeklyData = useMemo(() => {
    const data = {};
    timeLogs.forEach(log => {
      if (weekDates.includes(log.date)) {
        if (!data[log.date]) {
          data[log.date] = { total: 0, billable: 0, entries: [] };
        }
        data[log.date].total += log.duration_minutes;
        if (log.billable) data[log.date].billable += log.duration_minutes;
        data[log.date].entries.push(log);
      }
    });
    return data;
  }, [timeLogs, weekDates]);

  const totalHours = timeLogs.reduce((sum, log) => sum + log.duration_minutes, 0) / 60;
  const billableHours = timeLogs.filter(log => log.billable).reduce((sum, log) => sum + log.duration_minutes, 0) / 60;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div data-testid="time-tracking-page" className="pt-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Time Tracking</h1>
          <p className="text-base text-muted-foreground">Track time spent on tasks and projects</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="add-time-log-button">
              <Plus className="mr-2 h-4 w-4" />
              Manual Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Add Time Log</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Project</label>
                <Select value={formData.project_id} onValueChange={(value) => setFormData({ ...formData, project_id: value, task_id: '', subtask_id: '' })}>
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
              <div>
                <label className="text-sm font-medium mb-2 block">Task</label>
                <Select value={formData.task_id} onValueChange={(value) => setFormData({ ...formData, task_id: value, subtask_id: '' })} disabled={!formData.project_id}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select task" />
                  </SelectTrigger>
                  <SelectContent>
                    {formProjectTasks.map((t) => (
                      <SelectItem key={t.task_id} value={t.task_id}>{t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {formTaskSubtasks.length > 0 && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Subtask (optional)</label>
                  <Select value={formData.subtask_id} onValueChange={(value) => setFormData({ ...formData, subtask_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subtask" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">No subtask</SelectItem>
                      {formTaskSubtasks.map((st) => (
                        <SelectItem key={st.task_id} value={st.task_id}>{st.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Duration (minutes)</label>
                  <Input
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                    placeholder="60"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Date</label>
                  <Input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What did you work on?"
                  rows={2}
                />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={formData.billable} onCheckedChange={(checked) => setFormData({ ...formData, billable: checked })} />
                <label className="text-sm font-medium">Billable</label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Add Time Log</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Hours</p>
          <p className="text-3xl font-heading font-bold">{totalHours.toFixed(1)}h</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Billable Hours</p>
          <p className="text-3xl font-heading font-bold text-green-600">{billableHours.toFixed(1)}h</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Non-Billable Hours</p>
          <p className="text-3xl font-heading font-bold text-muted-foreground">{(totalHours - billableHours).toFixed(1)}h</p>
        </Card>
      </div>

      {/* Timer Section */}
      <Card className="p-6 mb-6">
        <h3 className="text-xl font-heading font-semibold mb-4">Timer</h3>
        {activeTimer ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg">
              <div className={`w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`}></div>
              <div className="flex-1">
                <div className="flex items-center gap-2 text-sm">
                  {activeTimer.project_name && <span className="font-medium">{activeTimer.project_name}</span>}
                  {activeTimer.project_name && <ChevronRight className="h-4 w-4" />}
                  {activeTimer.parent_task_title && <span>{activeTimer.parent_task_title}</span>}
                  {activeTimer.parent_task_title && <ChevronRight className="h-4 w-4" />}
                  <span className="font-semibold">{activeTimer.task_title}</span>
                </div>
                {activeTimer.client_name && <p className="text-xs text-muted-foreground">{activeTimer.client_name}</p>}
              </div>
              <div className="text-3xl font-mono font-bold">{formatTime(timerSeconds)}</div>
              {isPaused && <span className="px-2 py-1 text-xs bg-yellow-500/20 text-yellow-600 rounded">PAUSED</span>}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={timerBillable} onCheckedChange={setTimerBillable} />
                <span className="text-sm">Billable</span>
              </div>
              <Input
                placeholder="Description (optional)"
                value={timerDescription}
                onChange={(e) => setTimerDescription(e.target.value)}
                className="flex-1"
              />
              <div className="flex gap-2">
                {isPaused ? (
                  <Button onClick={handleResumeTimer} className="bg-blue-500 hover:bg-blue-600">
                    <Play className="mr-1 h-4 w-4" />
                    Resume
                  </Button>
                ) : (
                  <Button onClick={handlePauseTimer} variant="outline">
                    <Pause className="mr-1 h-4 w-4" />
                    Pause
                  </Button>
                )}
                <Button onClick={handleStopTimer} className="bg-green-600 hover:bg-green-700">
                  <Square className="mr-1 h-4 w-4" />
                  Stop & Log
                </Button>
                <Button onClick={handleCancelTimer} variant="ghost">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Project</label>
                <Select value={selectedProject} onValueChange={(value) => { setSelectedProject(value); setSelectedTask(''); setSelectedSubtask(''); }}>
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
              <div>
                <label className="text-sm font-medium mb-2 block">Task</label>
                <Select value={selectedTask} onValueChange={(value) => { setSelectedTask(value); setSelectedSubtask(''); }} disabled={!selectedProject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select task" />
                  </SelectTrigger>
                  <SelectContent>
                    {projectTasks.map((t) => (
                      <SelectItem key={t.task_id} value={t.task_id}>{t.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Subtask (optional)</label>
                <Select value={selectedSubtask} onValueChange={setSelectedSubtask} disabled={!selectedTask || taskSubtasks.length === 0}>
                  <SelectTrigger>
                    <SelectValue placeholder={taskSubtasks.length === 0 ? "No subtasks" : "Select subtask"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Track on parent task</SelectItem>
                    {taskSubtasks.map((st) => (
                      <SelectItem key={st.task_id} value={st.task_id}>{st.title}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={timerBillable} onCheckedChange={setTimerBillable} />
                <span className="text-sm">Billable</span>
              </div>
              <Input
                placeholder="Description (optional)"
                value={timerDescription}
                onChange={(e) => setTimerDescription(e.target.value)}
                className="flex-1"
              />
              <Button onClick={handleStartTimer} disabled={!selectedTask} data-testid="start-timer-button">
                <Play className="mr-2 h-4 w-4" />
                Start Timer
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Tabs for different views */}
      <Tabs defaultValue="logs" className="space-y-4">
        <TabsList>
          <TabsTrigger value="logs">Time Logs</TabsTrigger>
          <TabsTrigger value="weekly">Weekly Timesheet</TabsTrigger>
        </TabsList>

        <TabsContent value="logs">
          <Card className="p-6">
            <h3 className="text-xl font-heading font-semibold mb-4">Recent Time Logs</h3>
            {timeLogs.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No time logs yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {timeLogs.slice(0, 20).map((log) => {
                  const task = tasks.find(t => t.task_id === log.task_id);
                  const project = projects.find(p => p.project_id === log.project_id);
                  return (
                    <div key={log.log_id} className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm">
                          {project && <span className="text-muted-foreground">{project.name}</span>}
                          {project && <ChevronRight className="h-3 w-3" />}
                          <span className="font-medium">{task?.title || 'Unknown Task'}</span>
                        </div>
                        {log.description && <p className="text-sm text-muted-foreground mt-1">{log.description}</p>}
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground">{new Date(log.date).toLocaleDateString()}</span>
                        <span className="font-mono font-semibold">{(log.duration_minutes / 60).toFixed(1)}h</span>
                        {log.billable ? (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-500/20 text-green-600">Billable</span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-muted text-muted-foreground">Non-billable</span>
                        )}
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => handleEditLog(log)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteLog(log.log_id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="weekly">
          <Card className="p-6">
            <h3 className="text-xl font-heading font-semibold mb-4">Weekly Timesheet</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 font-medium">Day</th>
                    <th className="text-center p-3 font-medium">Date</th>
                    <th className="text-center p-3 font-medium">Total</th>
                    <th className="text-center p-3 font-medium">Billable</th>
                    <th className="text-center p-3 font-medium">Entries</th>
                  </tr>
                </thead>
                <tbody>
                  {weekDates.map((date, idx) => {
                    const data = weeklyData[date] || { total: 0, billable: 0, entries: [] };
                    const isToday = date === new Date().toISOString().split('T')[0];
                    return (
                      <tr key={date} className={`border-b ${isToday ? 'bg-primary/5' : ''}`}>
                        <td className="p-3 font-medium">{dayNames[idx]}</td>
                        <td className="p-3 text-center text-muted-foreground">{new Date(date).toLocaleDateString()}</td>
                        <td className="p-3 text-center font-mono">{(data.total / 60).toFixed(1)}h</td>
                        <td className="p-3 text-center font-mono text-green-600">{(data.billable / 60).toFixed(1)}h</td>
                        <td className="p-3 text-center">{data.entries.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-semibold">
                    <td className="p-3" colSpan="2">Week Total</td>
                    <td className="p-3 text-center font-mono">
                      {(Object.values(weeklyData).reduce((sum, d) => sum + d.total, 0) / 60).toFixed(1)}h
                    </td>
                    <td className="p-3 text-center font-mono text-green-600">
                      {(Object.values(weeklyData).reduce((sum, d) => sum + d.billable, 0) / 60).toFixed(1)}h
                    </td>
                    <td className="p-3 text-center">
                      {Object.values(weeklyData).reduce((sum, d) => sum + d.entries.length, 0)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Time Log Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Time Log</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateLog} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Duration (minutes)</label>
                <Input
                  type="number"
                  value={editForm.duration_minutes}
                  onChange={(e) => setEditForm({ ...editForm, duration_minutes: e.target.value })}
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Date</label>
                <Input
                  type="date"
                  value={editForm.date}
                  onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                rows={2}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={editForm.billable} onCheckedChange={(checked) => setEditForm({ ...editForm, billable: checked })} />
              <label className="text-sm font-medium">Billable</label>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
