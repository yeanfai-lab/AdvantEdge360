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
import { Calendar, Check, X, Clock, User, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const leaveTypes = [
  { id: 'casual', label: 'Casual Leave', color: 'bg-blue-500/20 text-blue-600' },
  { id: 'sick', label: 'Sick Leave', color: 'bg-red-500/20 text-red-600' },
  { id: 'earned', label: 'Earned/Annual Leave', color: 'bg-green-500/20 text-green-600' },
  { id: 'unpaid', label: 'Unpaid Leave', color: 'bg-gray-500/20 text-gray-600' },
  { id: 'wfh', label: 'Work from Home', color: 'bg-purple-500/20 text-purple-600' }
];

const statusColors = {
  pending: 'bg-amber-500/20 text-amber-600 border-amber-500/30',
  approved: 'bg-green-500/20 text-green-600 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-600 border-red-500/30'
};

export const LeaveApplicationsPage = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);

  const [leaveForm, setLeaveForm] = useState({
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: ''
  });

  const canApprove = ['admin', 'manager', 'supervisor'].includes(user?.role);

  const fetchData = async () => {
    try {
      const res = await axios.get(`${API_URL}/leaves`, { withCredentials: true });
      setLeaves(res.data);
    } catch (error) {
      toast.error('Failed to load leave applications');
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

  const handleLeaveAction = async (leaveId, action) => {
    try {
      await axios.patch(`${API_URL}/leaves/${leaveId}/${action}`, null, {
        withCredentials: true
      });
      toast.success(`Leave ${action}d`);
      fetchData();
    } catch (error) {
      toast.error(`Failed to ${action} leave`);
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

  return (
    <div data-testid="leave-applications-page" className="pt-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Leave Applications</h1>
          <p className="text-base text-muted-foreground">Apply for and manage leave requests</p>
        </div>
        <Dialog open={isLeaveDialogOpen} onOpenChange={setIsLeaveDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="apply-leave-btn">
              <Plus className="mr-2 h-4 w-4" />
              Apply for Leave
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
      </div>

      {/* Summary Card for Managers */}
      {canApprove && pendingLeaves.length > 0 && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Approvals</p>
              <p className="text-3xl font-heading font-bold text-amber-600">{pendingLeaves.length}</p>
            </div>
            <Calendar className="h-8 w-8 text-amber-600" />
          </div>
        </Card>
      )}

      {/* Leave Applications List */}
      {leaves.length === 0 ? (
        <Card className="p-12 text-center">
          <Calendar className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-heading font-semibold mb-2">No leave applications</h3>
          <p className="text-muted-foreground">Click "Apply for Leave" to submit a new application</p>
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
    </div>
  );
};
