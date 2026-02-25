import { useState, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { toast } from 'sonner';

export const useProposals = () => {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchProposals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(`${API_URL}/proposals`, { withCredentials: true });
      setProposals(response.data);
      return response.data;
    } catch (err) {
      setError(err.message);
      toast.error('Failed to fetch proposals');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createProposal = useCallback(async (proposalData) => {
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/proposals`, proposalData, { withCredentials: true });
      setProposals(prev => [...prev, response.data]);
      toast.success('Proposal created successfully');
      return response.data;
    } catch (err) {
      toast.error('Failed to create proposal');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProposal = useCallback(async (proposalId, updates) => {
    try {
      await axios.patch(`${API_URL}/proposals/${proposalId}`, updates, { withCredentials: true });
      setProposals(prev => prev.map(p => 
        p.proposal_id === proposalId ? { ...p, ...updates } : p
      ));
      toast.success('Proposal updated');
      return true;
    } catch (err) {
      toast.error('Failed to update proposal');
      throw err;
    }
  }, []);

  const deleteProposal = useCallback(async (proposalId) => {
    try {
      await axios.delete(`${API_URL}/proposals/${proposalId}`, { withCredentials: true });
      setProposals(prev => prev.filter(p => p.proposal_id !== proposalId));
      toast.success('Proposal deleted');
      return true;
    } catch (err) {
      toast.error('Failed to delete proposal');
      throw err;
    }
  }, []);

  const sendForApproval = useCallback(async (proposalId, approverId) => {
    try {
      await axios.post(
        `${API_URL}/proposals/${proposalId}/send-for-internal-approval?approver_id=${approverId}`,
        {},
        { withCredentials: true }
      );
      toast.success('Proposal sent for approval');
      return true;
    } catch (err) {
      toast.error('Failed to send for approval');
      throw err;
    }
  }, []);

  const approveProposal = useCallback(async (proposalId, comments) => {
    try {
      await axios.post(
        `${API_URL}/proposals/${proposalId}/approve-internal`,
        { comments },
        { withCredentials: true }
      );
      toast.success('Proposal approved');
      return true;
    } catch (err) {
      toast.error('Failed to approve proposal');
      throw err;
    }
  }, []);

  const convertToProject = useCallback(async (proposalId) => {
    try {
      const response = await axios.post(
        `${API_URL}/proposals/${proposalId}/convert`,
        {},
        { withCredentials: true }
      );
      toast.success('Proposal converted to project');
      return response.data;
    } catch (err) {
      toast.error('Failed to convert proposal');
      throw err;
    }
  }, []);

  const getVersionHistory = useCallback(async (proposalId) => {
    try {
      const response = await axios.get(
        `${API_URL}/proposals/${proposalId}/versions`,
        { withCredentials: true }
      );
      return response.data;
    } catch (err) {
      toast.error('Failed to fetch version history');
      throw err;
    }
  }, []);

  const restoreVersion = useCallback(async (proposalId, versionNumber) => {
    try {
      await axios.post(
        `${API_URL}/proposals/${proposalId}/restore-version/${versionNumber}`,
        {},
        { withCredentials: true }
      );
      toast.success(`Restored to version ${versionNumber}`);
      return true;
    } catch (err) {
      toast.error('Failed to restore version');
      throw err;
    }
  }, []);

  return {
    proposals,
    loading,
    error,
    fetchProposals,
    createProposal,
    updateProposal,
    deleteProposal,
    sendForApproval,
    approveProposal,
    convertToProject,
    getVersionHistory,
    restoreVersion
  };
};
