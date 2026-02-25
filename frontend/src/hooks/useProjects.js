import { useState, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { toast } from 'sonner';

export const useProjects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/projects`, { withCredentials: true });
      setProjects(response.data);
      return response.data;
    } catch (err) {
      setError(err.message);
      toast.error('Failed to fetch projects');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProject = useCallback(async (projectId) => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/projects/${projectId}`, { withCredentials: true });
      return response.data;
    } catch (err) {
      toast.error('Failed to fetch project');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = useCallback(async (projectData) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/projects`, projectData, { withCredentials: true });
      setProjects(prev => [...prev, response.data]);
      toast.success('Project created successfully');
      return response.data;
    } catch (err) {
      toast.error('Failed to create project');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProject = useCallback(async (projectId, updates) => {
    try {
      await axios.patch(`${API_URL}/projects/${projectId}`, updates, { withCredentials: true });
      setProjects(prev => prev.map(p => 
        p.project_id === projectId ? { ...p, ...updates } : p
      ));
      toast.success('Project updated');
      return true;
    } catch (err) {
      toast.error('Failed to update project');
      throw err;
    }
  }, []);

  const deleteProject = useCallback(async (projectId) => {
    try {
      await axios.delete(`${API_URL}/projects/${projectId}`, { withCredentials: true });
      setProjects(prev => prev.filter(p => p.project_id !== projectId));
      toast.success('Project deleted');
      return true;
    } catch (err) {
      toast.error('Failed to delete project');
      throw err;
    }
  }, []);

  const getProjectStats = useCallback(async (projectId) => {
    try {
      const response = await axios.get(`${API_URL}/projects/${projectId}/stats`, { withCredentials: true });
      return response.data;
    } catch (err) {
      toast.error('Failed to fetch project stats');
      throw err;
    }
  }, []);

  return {
    projects,
    loading,
    error,
    fetchProjects,
    fetchProject,
    createProject,
    updateProject,
    deleteProject,
    getProjectStats
  };
};
