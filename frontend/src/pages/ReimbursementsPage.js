import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { IndianRupee, Check, X, Calendar, User, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const reimbursementCategories = [
  { id: 'travel', label: 'Travel' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'office_supplies', label: 'Office Supplies' },
  { id: 'client_entertainment', label: 'Client Entertainment' },
  { id: 'other', label: 'Other' }
];

const statusColors = {
  pending: 'bg-amber-500/20 text-amber-600 border-amber-500/30',
  approved: 'bg-green-500/20 text-green-600 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-600 border-red-500/30',
  paid: 'bg-blue-500/20 text-blue-600 border-blue-500/30'
};

const formatCurrency = (amount) => {
  return `INR ${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  }).format(amount)}`;
};

export const ReimbursementsPage = () => {
  const { user } = useAuth();
  const [reimbursements, setReimbursements] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isReimbursementDialogOpen, setIsReimbursementDialogOpen] = useState(false);

  const [reimbursementForm, setReimbursementForm] = useState({
    category: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    project_id: ''
  });

  const canApprove = ['admin', 'manager', 'supervisor'].includes(user?.role);
  const canMarkPaid = ['admin', 'finance'].includes(user?.role);

  const fetchData = async () => {
    try {
      const [reimbursementsRes, projectsRes] = await Promise.all([
        axios.get(`${API_URL}/reimbursements`, { withCredentials: true }),
        axios.get(`${API_URL}/projects`, { withCredentials: true })
      ]);
      setReimbursements(reimbursementsRes.data);
      setProjects(projectsRes.data);
    } catch (error) {
      toast.error('Failed to load reimbursements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleReimbursementSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/reimbursements`, {
        ...reimbursementForm,
        amount: parseFloat(reimbursementForm.amount),
        project_id: reimbursementForm.project_id || null
      }, { withCredentials: true });
      toast.success('Reimbursement request submitted');
      setIsReimbursementDialogOpen(false);
      setReimbursementForm({ category: '', amount: '', description: '', date: new Date().toISOString().split('T')[0], project_id: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to submit reimbursement request');
    }
  };

  const handleReimbursementAction = async (reimbursementId, action) => {
    try {
      await axios.patch(`${API_URL}/reimbursements/${reimbursementId}/${action}`, null, {
        withCredentials: true
      });
      toast.success(`Reimbursement ${action.replace('-', ' ')}`);
      fetchData();
    } catch (error) {
      toast.error(`Failed to process reimbursement`);
    }
  };

  const handleDeleteReimbursement = async (reimbursementId) => {
    if (!window.confirm('Delete this reimbursement request?')) return;
    try {
      await axios.delete(`${API_URL}/reimbursements/${reimbursementId}`, { withCredentials: true });
      toast.success('Reimbursement deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  const pendingReimbursements = reimbursements.filter(r => r.status === 'pending');
  const totalPending = pendingReimbursements.reduce((sum, r) => sum + r.amount, 0);

  return (
    <div data-testid="reimbursements-page" className="pt-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Reimbursements</h1>
          <p className="text-base text-muted-foreground">Submit and track expense reimbursement requests</p>
        </div>
        <Dialog open={isReimbursementDialogOpen} onOpenChange={setIsReimbursementDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="request-reimbursement-btn">
              <Plus className="mr-2 h-4 w-4" />
              Request Reimbursement
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Reimbursement</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleReimbursementSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Select value={reimbursementForm.category} onValueChange={(value) => setReimbursementForm({ ...reimbursementForm, category: value })} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {reimbursementCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Amount (₹)</label>
                  <Input type="number" step="0.01" value={reimbursementForm.amount} onChange={(e) => setReimbursementForm({ ...reimbursementForm, amount: e.target.value })} required />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Date</label>
                  <Input type="date" value={reimbursementForm.date} onChange={(e) => setReimbursementForm({ ...reimbursementForm, date: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Project (Optional)</label>
                <Select value={reimbursementForm.project_id || '__none__'} onValueChange={(value) => setReimbursementForm({ ...reimbursementForm, project_id: value === '__none__' ? '' : value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea value={reimbursementForm.description} onChange={(e) => setReimbursementForm({ ...reimbursementForm, description: e.target.value })} rows={3} required />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsReimbursementDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Submit Request</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Summary Card for Managers */}
      {canApprove && pendingReimbursements.length > 0 && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Approvals</p>
              <p className="text-3xl font-heading font-bold text-amber-600">{pendingReimbursements.length}</p>
              <p className="text-sm text-muted-foreground">Total: {formatCurrency(totalPending)}</p>
            </div>
            <IndianRupee className="h-8 w-8 text-amber-600" />
          </div>
        </Card>
      )}

      {/* Reimbursements List */}
      {reimbursements.length === 0 ? (
        <Card className="p-12 text-center">
          <IndianRupee className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-heading font-semibold mb-2">No reimbursement requests</h3>
          <p className="text-muted-foreground">Click "Request Reimbursement" to submit a new request</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reimbursements.map((r) => (
            <Card key={r.reimbursement_id} className="p-4" data-testid={`reimbursement-${r.reimbursement_id}`}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="px-2 py-1 text-xs font-semibold rounded-full bg-muted">
                      {reimbursementCategories.find(c => c.id === r.category)?.label || r.category}
                    </span>
                    <Badge className={`${statusColors[r.status]} border`}>
                      {r.status}
                    </Badge>
                    <span className="text-2xl font-heading font-bold">{formatCurrency(r.amount)}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm mb-2">
                    <span className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      {r.user_name}
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {r.date}
                    </span>
                    {r.project_id && (
                      <span className="text-muted-foreground">
                        Project: {projects.find(p => p.project_id === r.project_id)?.name}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{r.description}</p>
                  {r.approver_comments && (
                    <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded">
                      <strong>Comment:</strong> {r.approver_comments}
                    </p>
                  )}
                </div>
                <div className="flex gap-2">
                  {r.status === 'pending' && canApprove && r.user_id !== user?.user_id && (
                    <>
                      <Button size="sm" variant="outline" className="text-green-600 border-green-600" onClick={() => handleReimbursementAction(r.reimbursement_id, 'approve')}>
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" className="text-red-600 border-red-600" onClick={() => handleReimbursementAction(r.reimbursement_id, 'reject')}>
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {r.status === 'approved' && canMarkPaid && (
                    <Button size="sm" onClick={() => handleReimbursementAction(r.reimbursement_id, 'mark-paid')}>
                      Mark Paid
                    </Button>
                  )}
                  {(r.status === 'pending' && r.user_id === user?.user_id) || user?.role === 'admin' ? (
                    <Button size="sm" variant="ghost" onClick={() => handleDeleteReimbursement(r.reimbursement_id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
