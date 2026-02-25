import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Play, Pause, Square, X, Clock, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const formatTime = (minutes) => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
};

const formatSeconds = (seconds) => {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const GlobalTimerRibbon = () => {
  const [activeTimer, setActiveTimer] = useState(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [billable, setBillable] = useState(true);
  const [isPaused, setIsPaused] = useState(false);

  const fetchActiveTimer = async () => {
    try {
      const res = await axios.get(`${API_URL}/timer/active`, { withCredentials: true });
      if (res.data.active) {
        setActiveTimer(res.data);
        setIsPaused(res.data.is_paused || false);
        
        // Calculate elapsed time
        if (res.data.is_paused) {
          setElapsedSeconds(res.data.paused_time || 0);
        } else {
          const start = new Date(res.data.start_time);
          const now = new Date();
          const elapsed = Math.floor((now - start) / 1000) + (res.data.paused_time || 0);
          setElapsedSeconds(elapsed);
        }
      } else {
        setActiveTimer(null);
      }
    } catch (error) {
      // Silently fail - user might not be logged in
    }
  };

  useEffect(() => {
    fetchActiveTimer();
    // Poll for active timer every 30 seconds
    const interval = setInterval(fetchActiveTimer, 30000);
    return () => clearInterval(interval);
  }, []);

  // Update elapsed time every second
  useEffect(() => {
    let interval;
    if (activeTimer && !isPaused) {
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTimer, isPaused]);

  const handlePauseTimer = async () => {
    try {
      await axios.post(`${API_URL}/timer/pause`, null, { withCredentials: true });
      setIsPaused(true);
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
        params: { billable },
        withCredentials: true
      });
      toast.success(`Timer stopped - ${formatTime(res.data.duration_minutes)} logged${billable ? ' (Billable)' : ' (Non-billable)'}`);
      setActiveTimer(null);
    } catch (error) {
      toast.error('Failed to stop timer');
    }
  };

  const handleCancelTimer = async () => {
    if (!window.confirm('Cancel timer without logging time?')) return;
    try {
      await axios.delete(`${API_URL}/timer/cancel`, { withCredentials: true });
      toast.success('Timer cancelled');
      setActiveTimer(null);
    } catch (error) {
      toast.error('Failed to cancel timer');
    }
  };

  if (!activeTimer) return null;

  return (
    <div 
      className="sticky top-0 z-50 bg-primary text-primary-foreground shadow-lg"
      data-testid="global-timer-ribbon"
    >
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`}></div>
              <Clock className="h-4 w-4" />
            </div>
            
            <div className="flex items-center gap-1 text-sm">
              {activeTimer.project_name && (
                <>
                  <span className="font-medium">{activeTimer.project_name}</span>
                  <ChevronRight className="h-3 w-3 opacity-60" />
                </>
              )}
              {activeTimer.parent_task_title && (
                <>
                  <span className="opacity-80">{activeTimer.parent_task_title}</span>
                  <ChevronRight className="h-3 w-3 opacity-60" />
                </>
              )}
              <span className="font-semibold">{activeTimer.task_title}</span>
            </div>
            
            {activeTimer.client_name && (
              <span className="text-xs opacity-70 hidden md:inline">
                ({activeTimer.client_name})
              </span>
            )}
            
            {isPaused && (
              <span className="px-2 py-0.5 text-xs bg-yellow-500 text-yellow-900 rounded font-semibold">PAUSED</span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="font-mono text-lg font-bold tabular-nums">
              {formatSeconds(elapsedSeconds)}
            </div>
            
            <div className="flex items-center gap-2 text-sm">
              <span className={billable ? 'opacity-100' : 'opacity-50'}>Billable</span>
              <Switch 
                checked={billable} 
                onCheckedChange={setBillable}
                className="data-[state=checked]:bg-green-500"
              />
            </div>
            
            <div className="flex items-center gap-1">
              {isPaused ? (
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={handleResumeTimer}
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  <Play className="mr-1 h-3 w-3" />
                  Resume
                </Button>
              ) : (
                <Button 
                  size="sm" 
                  variant="secondary"
                  onClick={handlePauseTimer}
                  className="bg-yellow-500 hover:bg-yellow-600 text-yellow-900"
                >
                  <Pause className="mr-1 h-3 w-3" />
                  Pause
                </Button>
              )}
              <Button 
                size="sm" 
                variant="secondary"
                onClick={handleStopTimer}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                <Square className="mr-1 h-3 w-3" />
                Stop & Log
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleCancelTimer}
                className="hover:bg-primary-foreground/20"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
