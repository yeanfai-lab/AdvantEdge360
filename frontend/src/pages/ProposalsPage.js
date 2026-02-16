import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Plus, FileText, Check } from 'lucide-react';
import { toast } from 'sonner';

export const ProposalsPage = () => {
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    client_name: '',
    description: '',
    amount: ''
  });

  const fetchProposals = async () => {
    try {
      const response = await axios.get(`${API_URL}/proposals`, { withCredentials: true });
      setProposals(response.data);
    } catch (error) {
      toast.error('Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/proposals`, {
        ...formData,
        amount: formData.amount ? parseFloat(formData.amount) : null
      }, { withCredentials: true });
      toast.success('Proposal created successfully');
      setIsDialogOpen(false);
      setFormData({ title: '', client_name: '', description: '', amount: '' });
      fetchProposals();
    } catch (error) {
      toast.error('Failed to create proposal');
    }
  };

  const handleApprove = async (proposalId) => {
    try {
      await axios.post(`${API_URL}/proposals/${proposalId}/approve`, {}, { withCredentials: true });
      toast.success('Proposal approved');
      fetchProposals();
    } catch (error) {
      toast.error('Failed to approve proposal');
    }
  };

  const handleConvert = async (proposalId) => {
    try {
      await axios.post(`${API_URL}/proposals/${proposalId}/convert`, {}, { withCredentials: true });
      toast.success('Proposal converted to project');
      fetchProposals();
    } catch (error) {
      toast.error('Failed to convert proposal');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-muted text-foreground',
      approved: 'bg-chart-4/20 text-chart-4',
      converted: 'bg-chart-1/20 text-chart-1',
      rejected: 'bg-destructive/20 text-destructive'
    };
    return colors[status] || 'bg-muted';
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div data-testid="proposals-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Proposals</h1>
          <p className="text-base text-muted-foreground">Create and manage client proposals</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="create-proposal-button">
              <Plus className="mr-2 h-4 w-4" />
              New Proposal
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create New Proposal</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Proposal Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Enter proposal title"
                  required
                  data-testid="proposal-title-input"
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Client Name</label>
                <Input
                  value={formData.client_name}
                  onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                  placeholder="Client name"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Proposal description"
                  required
                  rows={4}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Amount</label>
                <Input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" data-testid="submit-proposal-button">
                  Create Proposal
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {proposals.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-heading font-semibold mb-2">No proposals yet</h3>
          <p className="text-muted-foreground mb-6">Create your first proposal to get started</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {proposals.map((proposal) => (
            <Card key={proposal.proposal_id} className="p-6 hover:shadow-md transition-shadow" data-testid={`proposal-card-${proposal.proposal_id}`}>
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-heading font-semibold mb-2">{proposal.title}</h3>
                  <p className="text-sm text-muted-foreground mb-2">Client: {proposal.client_name}</p>
                </div>
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(proposal.status)}`}>
                  {proposal.status}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{proposal.description}</p>
              {proposal.amount && (
                <div className="mb-4 pb-4 border-b">
                  <p className="text-sm text-muted-foreground">Proposed Amount</p>
                  <p className="text-lg font-mono font-semibold">${proposal.amount.toLocaleString()}</p>
                </div>
              )}
              <div className="flex gap-2">
                {proposal.status === 'draft' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => handleApprove(proposal.proposal_id)}
                    data-testid={`approve-proposal-${proposal.proposal_id}`}
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                )}
                {proposal.status === 'approved' && (
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => handleConvert(proposal.proposal_id)}
                    data-testid={`convert-proposal-${proposal.proposal_id}`}
                  >
                    Convert to Project
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
