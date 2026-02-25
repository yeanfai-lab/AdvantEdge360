import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Button } from './ui/button';
import { Switch } from './ui/switch';
import { Play, Square, X, Clock, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';

const formatTime = (minutes) => {
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const secs = Math.floor((minutes % 1) * 60);
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
};

const formatElapsedTime = (startTime) => {
  const start = new Date(startTime);
  const now = new Date();
  const diff = Math.floor((now - start) / 1000);
  const hrs = Math.floor(diff / 3600);
  const mins = Math.floor((diff % 3600) / 60);
  const secs = diff % 60;
  
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const GlobalTimerRibbon = () => {
  const [activeTimer, setActiveTimer] = useState(null);
  const [elapsedTime, setElapsedTime] = useState('0:00');
  const [billable, setBillable] = useState(true);

  const fetchActiveTimer = async () => {
    try {
      const res = await axios.get(`${API_URL}/timer/active`, { withCredentials: true });
      if (res.data.active) {
        setActiveTimer(res.data);
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
    if (activeTimer) {
      const updateTime = () => {
        setElapsedTime(formatElapsedTime(activeTimer.start_time));
      };
      updateTime();
      interval = setInterval(updateTime, 1000);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

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
      className="fixed top-0 left-0 right-0 z-50 bg-primary text-primary-foreground shadow-lg"
      data-testid="global-timer-ribbon"
    >
      <div className="container mx-auto px-4 py-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
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
          </div>

          <div className="flex items-center gap-4">
            <div className="font-mono text-lg font-bold tabular-nums">
              {elapsedTime}
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
