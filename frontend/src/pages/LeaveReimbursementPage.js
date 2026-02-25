import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Badge } from '../components/ui/badge';
import { Plus, Calendar, DollarSign, FileText, Check, X, Clock, User, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const leaveTypes = [
  { id: 'casual', label: 'Casual Leave', color: 'bg-blue-500/20 text-blue-600' },
  { id: 'sick', label: 'Sick Leave', color: 'bg-red-500/20 text-red-600' },
  { id: 'earned', label: 'Earned/Annual Leave', color: 'bg-green-500/20 text-green-600' },
  { id: 'unpaid', label: 'Unpaid Leave', color: 'bg-gray-500/20 text-gray-600' },
  { id: 'wfh', label: 'Work from Home', color: 'bg-purple-500/20 text-purple-600' }
];

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

export const LeaveReimbursementPage = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [reimbursements, setReimbursements] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isReimbursementDialogOpen, setIsReimbursementDialogOpen] = useState(false);
  const [approvalComment, setApprovalComment] = useState('');

  const [leaveForm, setLeaveForm] = useState({
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: ''
  });

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
      const [leavesRes, reimbursementsRes, projectsRes] = await Promise.all([
        axios.get(`${API_URL}/leaves`, { withCredentials: true }),
        axios.get(`${API_URL}/reimbursements`, { withCredentials: true }),
        axios.get(`${API_URL}/projects`, { withCredentials: true })
      ]);
      setLeaves(leavesRes.data);
      setReimbursements(reimbursementsRes.data);
      setProjects(projectsRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleLeaveSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/leaves`, leaveForm, { withCredentials: true });
      toast.success('Leave application submitted');
      setIsLeaveDialogOpen(false);
      setLeaveForm({ leave_type: '', start_date: '', end_date: '', reason: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to submit leave application');
    }
  };

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

  const handleLeaveAction = async (leaveId, action) => {
    try {
      await axios.patch(`${API_URL}/leaves/${leaveId}/${action}`, null, {
        params: { comments: approvalComment || null },
        withCredentials: true
      });
      toast.success(`Leave ${action}d`);
      setApprovalComment('');
      fetchData();
    } catch (error) {
      toast.error(`Failed to ${action} leave`);
    }
  };

  const handleReimbursementAction = async (reimbursementId, action) => {
    try {
      await axios.patch(`${API_URL}/reimbursements/${reimbursementId}/${action}`, null, {
        params: { comments: approvalComment || null },
        withCredentials: true
      });
      toast.success(`Reimbursement ${action.replace('-', ' ')}`);
      setApprovalComment('');
      fetchData();
    } catch (error) {
      toast.error(`Failed to process reimbursement`);
    }
  };

  const handleDeleteLeave = async (leaveId) => {
    if (!window.confirm('Delete this leave application?')) return;
    try {
      await axios.delete(`${API_URL}/leaves/${leaveId}`, { withCredentials: true });
      toast.success('Leave deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
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

  const getLeaveTypeInfo = (type) => leaveTypes.find(t => t.id === type) || { label: type, color: 'bg-muted' };

  const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  const pendingLeaves = leaves.filter(l => l.status === 'pending');
  const pendingReimbursements = reimbursements.filter(r => r.status === 'pending');

  return (
    <div data-testid="leave-reimbursement-page" className="pt-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Leave & Reimbursements</h1>
          <p className="text-base text-muted-foreground">Manage leave applications and expense reimbursements</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" data-testid="apply-leave-btn">
                <Calendar className="mr-2 h-4 w-4" />
                Apply Leave
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Apply for Leave</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleLeaveSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Leave Type</label>
                  <Select value={leaveForm.leave_type} onValueChange={(value) => setLeaveForm({ ...leaveForm, leave_type: value })} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {leaveTypes.map((type) => (
                        <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Start Date</label>
                    <Input type="date" value={leaveForm.start_date} onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })} required />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">End Date</label>
                    <Input type="date" value={leaveForm.end_date} onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })} required />
                  </div>
                </div>
                {leaveForm.start_date && leaveForm.end_date && (
                  <p className="text-sm text-muted-foreground">
                    Duration: {calculateDays(leaveForm.start_date, leaveForm.end_date)} day(s)
                  </p>
                )}
                <div>
                  <label className="text-sm font-medium mb-2 block">Reason</label>
                  <Textarea value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} rows={3} required />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsLeaveDialogOpen(false)}>Cancel</Button>
                  <Button type="submit">Submit Application</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isReimbursementDialogOpen} onOpenChange={setIsReimbursementDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="request-reimbursement-btn">
                <DollarSign className="mr-2 h-4 w-4" />
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
                    <label className="text-sm font-medium mb-2 block">Amount</label>
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
      </div>

      {/* Summary Cards */}
      {canApprove && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="p-4 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Leaves</p>
                <p className="text-3xl font-heading font-bold text-amber-600">{pendingLeaves.length}</p>
              </div>
              <Calendar className="h-8 w-8 text-amber-600" />
            </div>
          </Card>
          <Card className="p-4 border-amber-500/30 bg-amber-500/5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Reimbursements</p>
                <p className="text-3xl font-heading font-bold text-amber-600">{pendingReimbursements.length}</p>
              </div>
              <DollarSign className="h-8 w-8 text-amber-600" />
            </div>
          </Card>
        </div>
      )}

      <Tabs defaultValue="leaves" className="space-y-6">
        <TabsList>
          <TabsTrigger value="leaves">Leave Applications</TabsTrigger>
          <TabsTrigger value="reimbursements">Reimbursements</TabsTrigger>
        </TabsList>

        {/* Leaves Tab */}
        <TabsContent value="leaves" className="space-y-4">
          {leaves.length === 0 ? (
            <Card className="p-12 text-center">
              <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-heading font-semibold mb-2">No leave applications</h3>
              <p className="text-muted-foreground">Click "Apply Leave" to submit a new application</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {leaves.map((leave) => {
                const typeInfo = getLeaveTypeInfo(leave.leave_type);
                return (
                  <Card key={leave.leave_id} className="p-4" data-testid={`leave-${leave.leave_id}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${typeInfo.color}`}>
                            {typeInfo.label}
                          </span>
                          <Badge className={`${statusColors[leave.status]} border`}>
                            {leave.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm mb-2">
                          <span className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            {leave.user_name}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {leave.start_date} to {leave.end_date}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {leave.days} day(s)
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{leave.reason}</p>
                        {leave.approver_comments && (
                          <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded">
                            <strong>Comment:</strong> {leave.approver_comments}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        {leave.status === 'pending' && canApprove && leave.user_id !== user?.user_id && (
                          <>
                            <Button size="sm" variant="outline" className="text-green-600 border-green-600" onClick={() => handleLeaveAction(leave.leave_id, 'approve')}>
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="outline" className="text-red-600 border-red-600" onClick={() => handleLeaveAction(leave.leave_id, 'reject')}>
                              <X className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {(leave.status === 'pending' && leave.user_id === user?.user_id) || user?.role === 'admin' ? (
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteLeave(leave.leave_id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Reimbursements Tab */}
        <TabsContent value="reimbursements" className="space-y-4">
          {reimbursements.length === 0 ? (
            <Card className="p-12 text-center">
              <DollarSign className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
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
                        <span className="text-2xl font-heading font-bold">${r.amount.toLocaleString()}</span>
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
        </TabsContent>
      </Tabs>
    </div>
  );
};
