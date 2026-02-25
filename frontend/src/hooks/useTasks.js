import { useState, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { toast } from 'sonner';

export const useTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchTasks = useCallback(async (projectId = null) => {
    setLoading(true);
    setError(null);
    try {
      const url = projectId 
        ? `${API_URL}/tasks?project_id=${projectId}`
        : `${API_URL}/tasks`;
      const response = await axios.get(url, { withCredentials: true });
      setTasks(response.data);
      return response.data;
    } catch (err) {
      setError(err.message);
      toast.error('Failed to fetch tasks');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTask = useCallback(async (taskId) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/tasks/${taskId}`, { withCredentials: true });
      return response.data;
    } catch (err) {
      toast.error('Failed to fetch task');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createTask = useCallback(async (taskData) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/tasks`, taskData, { withCredentials: true });
      setTasks(prev => [...prev, response.data]);
      toast.success('Task created successfully');
      return response.data;
    } catch (err) {
      toast.error('Failed to create task');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateTask = useCallback(async (taskId, updates) => {
    try {
      await axios.patch(`${API_URL}/tasks/${taskId}`, updates, { withCredentials: true });
      setTasks(prev => prev.map(t => 
        t.task_id === taskId ? { ...t, ...updates } : t
      ));
      toast.success('Task updated');
      return true;
    } catch (err) {
      toast.error('Failed to update task');
      throw err;
    }
  }, []);

  const deleteTask = useCallback(async (taskId) => {
    try {
      await axios.delete(`${API_URL}/tasks/${taskId}`, { withCredentials: true });
      setTasks(prev => prev.filter(t => t.task_id !== taskId));
      toast.success('Task deleted');
      return true;
    } catch (err) {
      toast.error('Failed to delete task');
      throw err;
    }
  }, []);

  const addComment = useCallback(async (taskId, comment) => {
    try {
      const response = await axios.post(
        `${API_URL}/tasks/${taskId}/add-comment?comment=${encodeURIComponent(comment)}`,
        {},
        { withCredentials: true }
      );
      toast.success('Comment added');
      return response.data;
    } catch (err) {
      toast.error('Failed to add comment');
      throw err;
    }
  }, []);

  const editComment = useCallback(async (taskId, commentId, newComment) => {
    try {
      await axios.patch(
        `${API_URL}/tasks/${taskId}/comments/${commentId}?new_comment=${encodeURIComponent(newComment)}`,
        {},
        { withCredentials: true }
      );
      toast.success('Comment updated');
      return true;
    } catch (err) {
      toast.error('Failed to update comment');
      throw err;
    }
  }, []);

  const deleteComment = useCallback(async (taskId, commentId) => {
    try {
      await axios.delete(
        `${API_URL}/tasks/${taskId}/comments/${commentId}`,
        { withCredentials: true }
      );
      toast.success('Comment deleted');
      return true;
    } catch (err) {
      toast.error('Failed to delete comment');
      throw err;
    }
  }, []);

  const sendForReview = useCallback(async (taskId, reviewerId) => {
    try {
      await axios.post(
        `${API_URL}/tasks/${taskId}/send-for-review?reviewer_id=${reviewerId}`,
        {},
        { withCredentials: true }
      );
      toast.success('Task sent for review');
      return true;
    } catch (err) {
      toast.error('Failed to send for review');
      throw err;
    }
  }, []);

  const approveReview = useCallback(async (taskId, notes) => {
    try {
      await axios.post(
        `${API_URL}/tasks/${taskId}/approve-review`,
        { notes },
        { withCredentials: true }
      );
      toast.success('Task approved and completed');
      return true;
    } catch (err) {
      toast.error('Failed to approve task');
      throw err;
    }
  }, []);

  const returnToOwner = useCallback(async (taskId, notes) => {
    try {
      await axios.post(
        `${API_URL}/tasks/${taskId}/return-to-owner`,
        { notes },
        { withCredentials: true }
      );
      toast.success('Task returned to owner');
      return true;
    } catch (err) {
      toast.error('Failed to return task');
      throw err;
    }
  }, []);

  return {
    tasks,
    loading,
    error,
    fetchTasks,
    fetchTask,
    createTask,
    updateTask,
    deleteTask,
    addComment,
    editComment,
    deleteComment,
    sendForReview,
    approveReview,
    returnToOwner
  };
};
