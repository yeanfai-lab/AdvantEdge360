import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Calendar, Check, X, Clock, User, Trash2, Plus, ChevronLeft, ChevronRight, Edit, Settings, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const leaveTypes = [
  { id: 'casual', label: 'Casual Leave', color: 'bg-blue-500' },
  { id: 'sick', label: 'Sick Leave', color: 'bg-red-500' },
  { id: 'earned', label: 'Earned/Annual Leave', color: 'bg-green-500' },
  { id: 'unpaid', label: 'Unpaid Leave', color: 'bg-gray-500' },
  { id: 'wfh', label: 'Work from Home', color: 'bg-purple-500' }
];

const statusColors = {
  pending: 'bg-amber-500/20 text-amber-600 border-amber-500/30',
  approved: 'bg-green-500/20 text-green-600 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-600 border-red-500/30'
};

export const LeaveApplicationsPage = () => {
  const { user } = useAuth();
  const [leaves, setLeaves] = useState([]);
  const [publicHolidays, setPublicHolidays] = useState([]);
  const [leaveBalances, setLeaveBalances] = useState([]);
  const [accrualPolicies, setAccrualPolicies] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [isLeaveDialogOpen, setIsLeaveDialogOpen] = useState(false);
  const [isHolidayDialogOpen, setIsHolidayDialogOpen] = useState(false);
  const [isPolicyDialogOpen, setIsPolicyDialogOpen] = useState(false);
  const [editingHoliday, setEditingHoliday] = useState(null);
  const [editingPolicy, setEditingPolicy] = useState(null);
  
  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [selectedMember, setSelectedMember] = useState('all');
  
  // Forms
  const [leaveForm, setLeaveForm] = useState({
    leave_type: '',
    start_date: '',
    end_date: '',
    reason: ''
  });
  
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: '',
    year: new Date().getFullYear()
  });
  
  const [policyForm, setPolicyForm] = useState({
    leave_type: '',
    accrual_per_month: '',
    max_carry_forward: '0',
    max_accumulation: '30'
  });

  const canApprove = ['admin', 'manager', 'supervisor'].includes(user?.role);
  const isAdmin = user?.role === 'admin';

  const fetchData = async () => {
    try {
      const currentYear = calendarDate.getFullYear();
      const [leavesRes, holidaysRes, balancesRes, policiesRes, teamRes] = await Promise.all([
        axios.get(`${API_URL}/leaves`, { withCredentials: true }),
        axios.get(`${API_URL}/public-holidays?year=${currentYear}`, { withCredentials: true }),
        axios.get(`${API_URL}/leave-balances?year=${currentYear}`, { withCredentials: true }),
        axios.get(`${API_URL}/leave-accrual-policies`, { withCredentials: true }),
        axios.get(`${API_URL}/team`, { withCredentials: true })
      ]);
      setLeaves(leavesRes.data);
      setPublicHolidays(holidaysRes.data);
      setLeaveBalances(balancesRes.data);
      setAccrualPolicies(policiesRes.data);
      setTeamMembers(teamRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load leave data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [calendarDate.getFullYear()]);

  // Get user's leave balance for a specific type
  const getUserBalance = (leaveType) => {
    const balance = leaveBalances.find(b => b.user_id === user?.user_id && b.leave_type === leaveType);
    return balance?.available || 0;
  };

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
      await axios.patch(`${API_URL}/leaves/${leaveId}/${action}`, null, { withCredentials: true });
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

  // Holiday CRUD
  const handleHolidaySubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingHoliday) {
        await axios.patch(`${API_URL}/public-holidays/${editingHoliday.holiday_id}`, holidayForm, { withCredentials: true });
        toast.success('Holiday updated');
      } else {
        await axios.post(`${API_URL}/public-holidays`, holidayForm, { withCredentials: true });
        toast.success('Holiday added');
      }
      setIsHolidayDialogOpen(false);
      setHolidayForm({ name: '', date: '', year: new Date().getFullYear() });
      setEditingHoliday(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to save holiday');
    }
  };

  const handleDeleteHoliday = async (holidayId) => {
    if (!window.confirm('Delete this holiday?')) return;
    try {
      await axios.delete(`${API_URL}/public-holidays/${holidayId}`, { withCredentials: true });
      toast.success('Holiday deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete holiday');
    }
  };

  // Policy CRUD
  const handlePolicySubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/leave-accrual-policies`, {
        ...policyForm,
        accrual_per_month: parseFloat(policyForm.accrual_per_month),
        max_carry_forward: parseFloat(policyForm.max_carry_forward),
        max_accumulation: parseFloat(policyForm.max_accumulation)
      }, { withCredentials: true });
      toast.success('Policy saved');
      setIsPolicyDialogOpen(false);
      setPolicyForm({ leave_type: '', accrual_per_month: '', max_carry_forward: '0', max_accumulation: '30' });
      setEditingPolicy(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to save policy');
    }
  };

  const handleDeletePolicy = async (policyId) => {
    if (!window.confirm('Delete this policy?')) return;
    try {
      await axios.delete(`${API_URL}/leave-accrual-policies/${policyId}`, { withCredentials: true });
      toast.success('Policy deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete policy');
    }
  };

  // Calendar helpers
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    // Add empty cells for days before the first day of month
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    
    // Add all days of the month
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const isHoliday = (date) => {
    if (!date) return false;
    const dateStr = date.toISOString().split('T')[0];
    return publicHolidays.some(h => h.date === dateStr);
  };

  const getHolidayName = (date) => {
    if (!date) return null;
    const dateStr = date.toISOString().split('T')[0];
    const holiday = publicHolidays.find(h => h.date === dateStr);
    return holiday?.name;
  };

  const getLeavesForDate = (date) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return leaves.filter(leave => {
      if (leave.status !== 'approved') return false;
      if (selectedMember !== 'all' && leave.user_id !== selectedMember) return false;
      return dateStr >= leave.start_date && dateStr <= leave.end_date;
    });
  };

  const calendarDays = useMemo(() => getDaysInMonth(calendarDate), [calendarDate]);

  const calculateDays = (start, end) => {
    if (!start || !end) return 0;
    const startDate = new Date(start);
    const endDate = new Date(end);
    return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
  };

  const getLeaveTypeInfo = (type) => leaveTypes.find(t => t.id === type) || { label: type, color: 'bg-muted' };

  // Group balances by user for the balance table
  const balancesByUser = useMemo(() => {
    const grouped = {};
    leaveBalances.forEach(b => {
      if (!grouped[b.user_id]) {
        grouped[b.user_id] = { user_id: b.user_id, user_name: b.user_name, balances: {} };
      }
      grouped[b.user_id].balances[b.leave_type] = b;
    });
    return Object.values(grouped);
  }, [leaveBalances]);

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
              <Plus className="mr-2 h-4 w-4" />Apply for Leave
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Apply for Leave</DialogTitle></DialogHeader>
            <form onSubmit={handleLeaveSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Leave Type</label>
                <Select value={leaveForm.leave_type} onValueChange={(value) => setLeaveForm({ ...leaveForm, leave_type: value })} required>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    {leaveTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        {type.label} (Balance: {getUserBalance(type.id)} days)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {leaveForm.leave_type && getUserBalance(leaveForm.leave_type) < 0 && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Negative balance - leave may be unpaid
                  </p>
                )}
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

      <Tabs defaultValue="applications" className="space-y-6">
        <TabsList>
          <TabsTrigger value="applications">Applications</TabsTrigger>
          <TabsTrigger value="calendar">Calendar View</TabsTrigger>
          <TabsTrigger value="balances">Leave Balances</TabsTrigger>
          {isAdmin && <TabsTrigger value="holidays">Public Holidays</TabsTrigger>}
          {isAdmin && <TabsTrigger value="policies">Accrual Policies</TabsTrigger>}
        </TabsList>

        {/* Applications Tab */}
        <TabsContent value="applications" className="space-y-4">
          {canApprove && pendingLeaves.length > 0 && (
            <Card className="p-4 border-amber-500/30 bg-amber-500/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Approvals</p>
                  <p className="text-3xl font-heading font-bold text-amber-600">{pendingLeaves.length}</p>
                </div>
                <Calendar className="h-8 w-8 text-amber-600" />
              </div>
            </Card>
          )}

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
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${typeInfo.color}/20 text-${typeInfo.color.replace('bg-', '')}`}>
                            {typeInfo.label}
                          </span>
                          <Badge className={`${statusColors[leave.status]} border`}>{leave.status}</Badge>
                        </div>
                        <div className="flex items-center gap-4 text-sm mb-2">
                          <span className="flex items-center gap-1"><User className="h-4 w-4" />{leave.user_name}</span>
                          <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{leave.start_date} to {leave.end_date}</span>
                          <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{leave.days} day(s)</span>
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
                        {(leave.status === 'pending' && leave.user_id === user?.user_id) || isAdmin ? (
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

        {/* Calendar View Tab */}
        <TabsContent value="calendar" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1))}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <h3 className="text-xl font-heading font-semibold">
                  {calendarDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                </h3>
                <Button variant="outline" size="icon" onClick={() => setCalendarDate(new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1))}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              {canApprove && (
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Team Members</SelectItem>
                    {teamMembers.map(m => (
                      <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span>Public Holiday</span>
              </div>
              {leaveTypes.slice(0, 4).map(type => (
                <div key={type.id} className="flex items-center gap-2">
                  <div className={`w-4 h-4 ${type.color} rounded`}></div>
                  <span>{type.label}</span>
                </div>
              ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-muted-foreground">{day}</div>
              ))}
              {calendarDays.map((day, idx) => {
                const holidayName = getHolidayName(day);
                const dayLeaves = getLeavesForDate(day);
                const isToday = day && day.toDateString() === new Date().toDateString();
                
                return (
                  <div
                    key={idx}
                    className={`min-h-24 p-1 border rounded-md ${
                      !day ? 'bg-muted/20' : 
                      holidayName ? 'bg-red-500/10 border-red-500/30' :
                      isToday ? 'bg-primary/10 border-primary' : 
                      'hover:bg-muted/50'
                    }`}
                  >
                    {day && (
                      <>
                        <div className={`text-sm font-medium ${isToday ? 'text-primary' : ''}`}>
                          {day.getDate()}
                        </div>
                        {holidayName && (
                          <div className="text-xs text-red-600 font-medium truncate" title={holidayName}>
                            {holidayName}
                          </div>
                        )}
                        {dayLeaves.slice(0, 3).map(leave => {
                          const typeInfo = getLeaveTypeInfo(leave.leave_type);
                          return (
                            <div
                              key={leave.leave_id}
                              className={`text-xs ${typeInfo.color}/20 text-${typeInfo.color.replace('bg-', '')} px-1 rounded truncate mt-0.5`}
                              title={`${leave.user_name} - ${typeInfo.label}`}
                            >
                              {leave.user_name.split(' ')[0]}
                            </div>
                          );
                        })}
                        {dayLeaves.length > 3 && (
                          <div className="text-xs text-muted-foreground">+{dayLeaves.length - 3} more</div>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </TabsContent>

        {/* Leave Balances Tab */}
        <TabsContent value="balances" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-heading font-semibold mb-4">Leave Balances - {calendarDate.getFullYear()}</h3>
            {balancesByUser.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No leave balance data. Configure accrual policies first.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team Member</TableHead>
                    {leaveTypes.map(type => (
                      <TableHead key={type.id} className="text-center">{type.label}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {balancesByUser.map(row => (
                    <TableRow key={row.user_id}>
                      <TableCell className="font-medium">{row.user_name}</TableCell>
                      {leaveTypes.map(type => {
                        const balance = row.balances[type.id];
                        const available = balance?.available ?? 0;
                        return (
                          <TableCell key={type.id} className="text-center">
                            <span className={available < 0 ? 'text-red-600 font-semibold' : available > 0 ? 'text-green-600' : ''}>
                              {available.toFixed(1)}
                            </span>
                            {balance && (
                              <span className="text-xs text-muted-foreground block">
                                ({balance.accrued_balance?.toFixed(1) || 0} accrued, {balance.used || 0} used)
                              </span>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Public Holidays Tab (Admin only) */}
        {isAdmin && (
          <TabsContent value="holidays" className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-heading font-semibold">Public Holidays - {calendarDate.getFullYear()}</h3>
                <Dialog open={isHolidayDialogOpen} onOpenChange={(open) => { setIsHolidayDialogOpen(open); if (!open) setEditingHoliday(null); }}>
                  <DialogTrigger asChild>
                    <Button size="sm" onClick={() => setHolidayForm({ name: '', date: '', year: calendarDate.getFullYear() })}>
                      <Plus className="mr-2 h-4 w-4" />Add Holiday
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>{editingHoliday ? 'Edit Holiday' : 'Add Public Holiday'}</DialogTitle></DialogHeader>
                    <form onSubmit={handleHolidaySubmit} className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Holiday Name</label>
                        <Input value={holidayForm.name} onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })} placeholder="e.g., Diwali" required />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Date</label>
                          <Input type="date" value={holidayForm.date} onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })} required />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Year</label>
                          <Input type="number" value={holidayForm.year} onChange={(e) => setHolidayForm({ ...holidayForm, year: parseInt(e.target.value) })} required />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsHolidayDialogOpen(false)}>Cancel</Button>
                        <Button type="submit">{editingHoliday ? 'Update' : 'Add'} Holiday</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {publicHolidays.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No public holidays added for this year</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Holiday Name</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Day</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {publicHolidays.sort((a, b) => a.date.localeCompare(b.date)).map(h => (
                      <TableRow key={h.holiday_id}>
                        <TableCell className="font-medium">{h.name}</TableCell>
                        <TableCell>{new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</TableCell>
                        <TableCell>{new Date(h.date).toLocaleDateString('en-IN', { weekday: 'long' })}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" onClick={() => {
                              setEditingHoliday(h);
                              setHolidayForm({ name: h.name, date: h.date, year: h.year });
                              setIsHolidayDialogOpen(true);
                            }}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDeleteHoliday(h.holiday_id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>
        )}

        {/* Accrual Policies Tab (Admin only) */}
        {isAdmin && (
          <TabsContent value="policies" className="space-y-4">
            <Card className="p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-heading font-semibold flex items-center gap-2">
                    <Settings className="h-5 w-5" /> Leave Accrual Policies
                  </h3>
                  <p className="text-sm text-muted-foreground">Define how leaves are accrued per month for each leave type</p>
                </div>
                <Dialog open={isPolicyDialogOpen} onOpenChange={setIsPolicyDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" />Add Policy
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add/Update Accrual Policy</DialogTitle></DialogHeader>
                    <form onSubmit={handlePolicySubmit} className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Leave Type</label>
                        <Select value={policyForm.leave_type} onValueChange={(v) => setPolicyForm({ ...policyForm, leave_type: v })} required>
                          <SelectTrigger><SelectValue placeholder="Select leave type" /></SelectTrigger>
                          <SelectContent>
                            {leaveTypes.map(type => (
                              <SelectItem key={type.id} value={type.id}>{type.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Accrual Per Month (days)</label>
                        <Input type="number" step="0.5" value={policyForm.accrual_per_month} onChange={(e) => setPolicyForm({ ...policyForm, accrual_per_month: e.target.value })} placeholder="e.g., 1.5" required />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Max Carry Forward</label>
                          <Input type="number" step="0.5" value={policyForm.max_carry_forward} onChange={(e) => setPolicyForm({ ...policyForm, max_carry_forward: e.target.value })} />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Max Accumulation</label>
                          <Input type="number" step="0.5" value={policyForm.max_accumulation} onChange={(e) => setPolicyForm({ ...policyForm, max_accumulation: e.target.value })} />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsPolicyDialogOpen(false)}>Cancel</Button>
                        <Button type="submit">Save Policy</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              {accrualPolicies.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No accrual policies defined. Add policies to enable leave balance tracking.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Leave Type</TableHead>
                      <TableHead className="text-right">Accrual/Month</TableHead>
                      <TableHead className="text-right">Max Carry Forward</TableHead>
                      <TableHead className="text-right">Max Accumulation</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accrualPolicies.map(p => {
                      const typeInfo = getLeaveTypeInfo(p.leave_type);
                      return (
                        <TableRow key={p.policy_id}>
                          <TableCell className="font-medium">{typeInfo.label}</TableCell>
                          <TableCell className="text-right">{p.accrual_per_month} days</TableCell>
                          <TableCell className="text-right">{p.max_carry_forward} days</TableCell>
                          <TableCell className="text-right">{p.max_accumulation} days</TableCell>
                          <TableCell>
                            <Button size="sm" variant="ghost" onClick={() => handleDeletePolicy(p.policy_id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
