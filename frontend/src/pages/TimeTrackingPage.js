import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Plus, Clock, Play, Pause } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

export const TimeTrackingPage = () => {
  const [timeLogs, setTimeLogs] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [selectedTask, setSelectedTask] = useState('');
  const { user } = useAuth();

  const [formData, setFormData] = useState({
    task_id: '',
    duration_minutes: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    billable: true
  });

  const fetchTimeLogs = async () => {
    try {
      const response = await axios.get(`${API_URL}/time-logs`, { withCredentials: true });
      setTimeLogs(response.data);
    } catch (error) {
      toast.error('Failed to load time logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await axios.get(`${API_URL}/tasks`, { withCredentials: true });
        setTasks(response.data);
      } catch (error) {
        toast.error('Failed to load tasks');
      }
    };
    fetchTasks();
    fetchTimeLogs();
  }, []);

  useEffect(() => {
    let interval;
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/time-logs`, {
        ...formData,
        duration_minutes: parseInt(formData.duration_minutes)
      }, { withCredentials: true });
      toast.success('Time log added successfully');
      setIsDialogOpen(false);
      setFormData({ task_id: '', duration_minutes: '', description: '', date: new Date().toISOString().split('T')[0], billable: true });
      fetchTimeLogs();
    } catch (error) {
      toast.error('Failed to add time log');
    }
  };

  const handleStopTimer = async () => {
    if (!selectedTask) {
      toast.error('Please select a task');
      return;
    }
    setIsTimerRunning(false);
    const minutes = Math.floor(timerSeconds / 60);
    if (minutes > 0) {
      try {
        await axios.post(`${API_URL}/time-logs`, {
          task_id: selectedTask,
          duration_minutes: minutes,
          description: 'Tracked time',
          date: new Date().toISOString().split('T')[0],
          billable: true
        }, { withCredentials: true });
        toast.success(`${minutes} minutes logged`);
        setTimerSeconds(0);
        setSelectedTask('');
        fetchTimeLogs();
      } catch (error) {
        toast.error('Failed to log time');
      }
    }
  };

  const formatTime = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalHours = timeLogs.reduce((sum, log) => sum + log.duration_minutes, 0) / 60;
  const billableHours = timeLogs.filter(log => log.billable).reduce((sum, log) => sum + log.duration_minutes, 0) / 60;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div data-testid="time-tracking-page">
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
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Time Log</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Task</label>
                <Select value={formData.task_id} onValueChange={(value) => setFormData({ ...formData, task_id: value })} required>
                  <SelectTrigger data-testid="timelog-task-select">
                    <SelectValue placeholder="Select task" />
                  </SelectTrigger>
                  <SelectContent>
                    {tasks.length > 0 ? (
                      tasks.map((task) => (
                        <SelectItem key={task.task_id} value={task.task_id || 'placeholder'}>
                          {task.title}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-tasks" disabled>No tasks available</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Duration (minutes)</label>
                <Input
                  type="number"
                  value={formData.duration_minutes}
                  onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                  placeholder="60"
                  required
                  data-testid="timelog-duration-input"
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
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="What did you work on?"
                  rows={3}
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.billable}
                  onChange={(e) => setFormData({ ...formData, billable: e.target.checked })}
                  id="billable"
                />
                <label htmlFor="billable" className="text-sm font-medium">Billable</label>
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="submit-timelog-button">
                  Add Time Log
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground mb-1">Total Hours</p>
          <p className="text-3xl font-heading font-bold">{totalHours.toFixed(2)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground mb-1">Billable Hours</p>
          <p className="text-3xl font-heading font-bold text-chart-4">{billableHours.toFixed(2)}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground mb-1">Non-Billable Hours</p>
          <p className="text-3xl font-heading font-bold text-muted-foreground">{(totalHours - billableHours).toFixed(2)}</p>
        </Card>
      </div>

      <Card className="p-6 mb-8">
        <h3 className="text-xl font-heading font-semibold mb-4">Timer</h3>
        <div className="flex items-center gap-4">
          <Select value={selectedTask} onValueChange={setSelectedTask} disabled={isTimerRunning}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select task" />
            </SelectTrigger>
            <SelectContent>
              {tasks.length > 0 ? (
                tasks.map((task) => (
                  <SelectItem key={task.task_id} value={task.task_id || 'placeholder'}>
                    {task.title}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value="no-tasks" disabled>No tasks available</SelectItem>
              )}
            </SelectContent>
          </Select>
          <div className="text-3xl font-mono font-bold">{formatTime(timerSeconds)}</div>
          <div className="flex gap-2">
            {!isTimerRunning ? (
              <Button
                onClick={() => setIsTimerRunning(true)}
                disabled={!selectedTask}
                data-testid="start-timer-button"
              >
                <Play className="mr-2 h-4 w-4" />
                Start
              </Button>
            ) : (
              <Button onClick={handleStopTimer} variant="destructive" data-testid="stop-timer-button">
                <Pause className="mr-2 h-4 w-4" />
                Stop & Save
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6">
        <h3 className="text-xl font-heading font-semibold mb-4">Time Logs</h3>
        {timeLogs.length === 0 ? (
          <div className="text-center py-8">
            <Clock className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No time logs yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {timeLogs.map((log) => {
              const task = tasks.find(t => t.task_id === log.task_id);
              return (
                <div key={log.log_id} className="flex items-center justify-between p-3 rounded-md bg-muted" data-testid={`timelog-${log.log_id}`}>
                  <div className="flex-1">
                    <p className="font-medium">{task?.title || 'Unknown Task'}</p>
                    {log.description && (
                      <p className="text-sm text-muted-foreground">{log.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">{new Date(log.date).toLocaleDateString()}</span>
                    <span className="font-mono font-semibold">{(log.duration_minutes / 60).toFixed(2)}h</span>
                    {log.billable && (
                      <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-chart-4/20 text-chart-4">
                        Billable
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
};
