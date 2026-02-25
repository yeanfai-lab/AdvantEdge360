import { useState, useCallback, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { toast } from 'sonner';

export const useTimer = () => {
  const [activeTimer, setActiveTimer] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchActiveTimer = useCallback(async () => {
    try {
      const response = await axios.get(`${API_URL}/timer/active`, { withCredentials: true });
      if (response.data.active) {
        setActiveTimer(response.data);
      } else {
        setActiveTimer(null);
      }
      return response.data;
    } catch (err) {
      console.error('Failed to fetch active timer:', err);
      return null;
    }
  }, []);

  const startTimer = useCallback(async (taskId, description = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ task_id: taskId });
      if (description) params.append('description', description);
      
      const response = await axios.post(
        `${API_URL}/timer/start?${params.toString()}`,
        {},
        { withCredentials: true }
      );
      
      setActiveTimer({
        active: true,
        ...response.data
      });
      toast.success('Timer started');
      return response.data;
    } catch (err) {
      if (err.response?.data?.detail) {
        toast.error(err.response.data.detail);
      } else {
        toast.error('Failed to start timer');
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const stopTimer = useCallback(async (description = '', billable = true) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ billable: billable.toString() });
      if (description) params.append('description', description);
      
      const response = await axios.post(
        `${API_URL}/timer/stop?${params.toString()}`,
        {},
        { withCredentials: true }
      );
      
      setActiveTimer(null);
      toast.success(`Timer stopped. Logged ${response.data.duration_minutes} minutes`);
      return response.data;
    } catch (err) {
      toast.error('Failed to stop timer');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const cancelTimer = useCallback(async () => {
    setLoading(true);
    try {
      await axios.delete(`${API_URL}/timer/cancel`, { withCredentials: true });
      setActiveTimer(null);
      toast.success('Timer cancelled');
      return true;
    } catch (err) {
      toast.error('Failed to cancel timer');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Poll for active timer on mount
  useEffect(() => {
    fetchActiveTimer();
  }, [fetchActiveTimer]);

  return {
    activeTimer,
    loading,
    fetchActiveTimer,
    startTimer,
    stopTimer,
    cancelTimer
  };
};
