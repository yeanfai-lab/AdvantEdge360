import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Plus, TrendingUp, TrendingDown, Clock, Target, Edit, Trash2, ChevronLeft, ChevronRight, IndianRupee, Users, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const deliverableStatuses = [
  { value: 'not_started', label: 'Not Started' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'on_hold', label: 'On Hold' },
  { value: 'completed', label: 'Completed' }
];

const invoiceStatuses = [
  { value: 'not_invoiced', label: 'Not Invoiced' },
  { value: 'invoiced', label: 'Invoiced' },
  { value: 'paid', label: 'Paid' }
];

const paymentStatuses = [
  { value: 'pending', label: 'Pending' },
  { value: 'received', label: 'Received' }
];

const formatCurrency = (amount) => {
  return `INR ${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  }).format(amount)}`;
};

export const FinancePage = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [feeStructure, setFeeStructure] = useState([]);
  const [teamSalaries, setTeamSalaries] = useState([]);
  const [cashflowExpenses, setCashflowExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Fee Structure state
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isFeeDialogOpen, setIsFeeDialogOpen] = useState(false);
  const [isEditFeeDialog, setIsEditFeeDialog] = useState(false);
  const [editingFeeItem, setEditingFeeItem] = useState(null);
  const [feeForm, setFeeForm] = useState({
    project_id: '',
    stage: '',
    deliverable: '',
    percentage: '',
    amount: '',
    tentative_billing_date: '',
    deliverable_status: 'not_started',
    invoice_status: 'not_invoiced',
    payment_status: 'pending'
  });

  // Team Salary state
  const [isSalaryDialogOpen, setIsSalaryDialogOpen] = useState(false);
  const [salaryForm, setSalaryForm] = useState({
    user_id: '',
    monthly_salary: '',
    hourly_rate: '',
    daily_rate: ''
  });

  // Cash Flow state
  const [cashflowPeriod, setCashflowPeriod] = useState(0); // 0 = months 1-6, 1 = months 7-12
  const [isCashflowExpenseDialogOpen, setIsCashflowExpenseDialogOpen] = useState(false);
  const [cashflowExpenseForm, setCashflowExpenseForm] = useState({
    expense_head: '',
    sub_head: '',
    month_year: '',
    amount: ''
  });

  useEffect(() => {
    if (user?.role && !['admin', 'manager', 'finance'].includes(user.role)) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [user]);

  const fetchData = async () => {
    try {
      const [projectsRes, logsRes, teamRes, feeRes, salaryRes, cashflowRes] = await Promise.all([
        axios.get(`${API_URL}/projects`, { withCredentials: true }),
        axios.get(`${API_URL}/time-logs`, { withCredentials: true }),
        axios.get(`${API_URL}/team`, { withCredentials: true }),
        axios.get(`${API_URL}/fee-structure`, { withCredentials: true }),
        axios.get(`${API_URL}/team-salaries`, { withCredentials: true }),
        axios.get(`${API_URL}/cashflow-expenses`, { withCredentials: true })
      ]);
      setProjects(projectsRes.data);
      setTimeLogs(logsRes.data);
      setTeamMembers(teamRes.data);
      setFeeStructure(feeRes.data);
      setTeamSalaries(salaryRes.data);
      setCashflowExpenses(cashflowRes.data);
    } catch (error) {
      toast.error('Failed to load finance data');
    } finally {
      setLoading(false);
    }
  };

  // Calculate project value from fee structure for percentage calculations
  const getProjectValue = (projectId) => {
    const project = projects.find(p => p.project_id === projectId);
    return project?.budget || 0;
  };

  // Fee Structure handlers
  const handleFeeSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/fee-structure`, {
        ...feeForm,
        percentage: parseFloat(feeForm.percentage),
        amount: parseFloat(feeForm.amount)
      }, { withCredentials: true });
      toast.success('Fee structure item added');
      setIsFeeDialogOpen(false);
      resetFeeForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to add fee structure item');
    }
  };

  const handleEditFeeSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(`${API_URL}/fee-structure/${editingFeeItem.item_id}`, {
        stage: feeForm.stage,
        deliverable: feeForm.deliverable,
        percentage: parseFloat(feeForm.percentage),
        amount: parseFloat(feeForm.amount),
        tentative_billing_date: feeForm.tentative_billing_date,
        deliverable_status: feeForm.deliverable_status,
        invoice_status: feeForm.invoice_status,
        payment_status: feeForm.payment_status
      }, { withCredentials: true });
      toast.success('Fee structure item updated');
      setIsEditFeeDialog(false);
      resetFeeForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to update fee structure item');
    }
  };

  const handleDeleteFeeItem = async (itemId) => {
    if (!window.confirm('Delete this fee structure item?')) return;
    try {
      await axios.delete(`${API_URL}/fee-structure/${itemId}`, { withCredentials: true });
      toast.success('Fee structure item deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete fee structure item');
    }
  };

  const resetFeeForm = () => {
    setFeeForm({
      project_id: selectedProjectId,
      stage: '',
      deliverable: '',
      percentage: '',
      amount: '',
      tentative_billing_date: '',
      deliverable_status: 'not_started',
      invoice_status: 'not_invoiced',
      payment_status: 'pending'
    });
    setEditingFeeItem(null);
  };

  // Team Salary handlers
  const handleSalarySubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/team-salaries`, {
        ...salaryForm,
        monthly_salary: parseFloat(salaryForm.monthly_salary),
        hourly_rate: parseFloat(salaryForm.hourly_rate),
        daily_rate: parseFloat(salaryForm.daily_rate)
      }, { withCredentials: true });
      toast.success('Salary information saved');
      setIsSalaryDialogOpen(false);
      setSalaryForm({ user_id: '', monthly_salary: '', hourly_rate: '', daily_rate: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to save salary information');
    }
  };

  const handleDeleteSalary = async (salaryId) => {
    if (!window.confirm('Delete this salary record?')) return;
    try {
      await axios.delete(`${API_URL}/team-salaries/${salaryId}`, { withCredentials: true });
      toast.success('Salary record deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete salary record');
    }
  };

  // Cash Flow Expense handlers
  const handleCashflowExpenseSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/cashflow-expenses`, {
        ...cashflowExpenseForm,
        amount: parseFloat(cashflowExpenseForm.amount)
      }, { withCredentials: true });
      toast.success('Expense added to cash flow');
      setIsCashflowExpenseDialogOpen(false);
      setCashflowExpenseForm({ expense_head: '', sub_head: '', month_year: '', amount: '' });
      fetchData();
    } catch (error) {
      toast.error('Failed to add expense');
    }
  };

  const handleDeleteCashflowExpense = async (expenseId) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await axios.delete(`${API_URL}/cashflow-expenses/${expenseId}`, { withCredentials: true });
      toast.success('Expense deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete expense');
    }
  };

  // Update cash flow expense inline
  const handleUpdateCashflowExpenseAmount = async (expenseId, newAmount) => {
    try {
      await axios.patch(`${API_URL}/cashflow-expenses/${expenseId}`, {
        amount: parseFloat(newAmount)
      }, { withCredentials: true });
      fetchData();
    } catch (error) {
      toast.error('Failed to update expense');
    }
  };

  // Filter fee structure by selected project
  const filteredFeeStructure = useMemo(() => {
    if (!selectedProjectId) return [];
    return feeStructure.filter(item => item.project_id === selectedProjectId);
  }, [feeStructure, selectedProjectId]);

  // Calculate Project Profitability (read-only, derived from Fee Structure + Labor Costs)
  const projectProfitability = useMemo(() => {
    return projects.map(project => {
      const projectFees = feeStructure.filter(f => f.project_id === project.project_id);
      const projectLogs = timeLogs.filter(log => log.project_id === project.project_id);
      
      // Income from fee structure (paid items)
      const paidIncome = projectFees
        .filter(f => f.payment_status === 'received')
        .reduce((sum, f) => sum + f.amount, 0);
      
      // Pending income (invoiced but not paid)
      const pendingIncome = projectFees
        .filter(f => f.invoice_status === 'invoiced' && f.payment_status === 'pending')
        .reduce((sum, f) => sum + f.amount, 0);
      
      // Total project value from fee structure
      const totalProjectValue = projectFees.reduce((sum, f) => sum + f.amount, 0);
      
      // Labor cost calculation based on team salaries
      let laborCost = 0;
      const billableHoursByUser = {};
      
      projectLogs.filter(log => log.billable).forEach(log => {
        const userId = log.user_id;
        if (!billableHoursByUser[userId]) {
          billableHoursByUser[userId] = 0;
        }
        billableHoursByUser[userId] += log.duration_minutes / 60;
      });
      
      Object.entries(billableHoursByUser).forEach(([userId, hours]) => {
        const salary = teamSalaries.find(s => s.user_id === userId);
        if (salary) {
          laborCost += hours * salary.hourly_rate;
        }
      });
      
      const totalBillableHours = Object.values(billableHoursByUser).reduce((sum, h) => sum + h, 0);
      const profit = paidIncome - laborCost;
      
      return {
        ...project,
        totalProjectValue,
        paidIncome,
        pendingIncome,
        laborCost,
        totalBillableHours,
        profit
      };
    });
  }, [projects, feeStructure, timeLogs, teamSalaries]);

  // Generate months for cash flow
  const getCashFlowMonths = useMemo(() => {
    const months = [];
    const now = new Date();
    const startOffset = cashflowPeriod * 6;
    
    for (let i = startOffset; i < startOffset + 6; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthKey = monthDate.toISOString().slice(0, 7);
      const monthName = monthDate.toLocaleString('default', { month: 'short', year: 'numeric' });
      months.push({ key: monthKey, name: monthName });
    }
    return months;
  }, [cashflowPeriod]);

  // Calculate Cash Flow data
  const cashFlowData = useMemo(() => {
    const months = getCashFlowMonths;
    
    // Income from Fee Structure (based on invoice status and tentative billing dates)
    const incomeByMonth = {};
    months.forEach(m => { incomeByMonth[m.key] = 0; });
    
    feeStructure.forEach(item => {
      if (item.tentative_billing_date) {
        const billingMonth = item.tentative_billing_date.slice(0, 7);
        if (incomeByMonth[billingMonth] !== undefined) {
          if (item.payment_status === 'received') {
            incomeByMonth[billingMonth] += item.amount;
          } else if (item.invoice_status === 'invoiced' || item.invoice_status === 'not_invoiced') {
            incomeByMonth[billingMonth] += item.amount;
          }
        }
      }
    });

    // Expenses from cashflow_expenses table
    const expensesByMonth = {};
    months.forEach(m => { expensesByMonth[m.key] = 0; });
    
    cashflowExpenses.forEach(exp => {
      if (expensesByMonth[exp.month_year] !== undefined) {
        expensesByMonth[exp.month_year] += exp.amount;
      }
    });

    // Group expenses by head/sub-head for detailed view
    const expenseGroups = {};
    cashflowExpenses.forEach(exp => {
      const key = exp.sub_head ? `${exp.expense_head} - ${exp.sub_head}` : exp.expense_head;
      if (!expenseGroups[key]) {
        expenseGroups[key] = { head: exp.expense_head, subHead: exp.sub_head, byMonth: {} };
        months.forEach(m => { expenseGroups[key].byMonth[m.key] = { amount: 0, expenseId: null }; });
      }
      if (expenseGroups[key].byMonth[exp.month_year]) {
        expenseGroups[key].byMonth[exp.month_year] = { amount: exp.amount, expenseId: exp.expense_id };
      }
    });

    return {
      months,
      incomeByMonth,
      expensesByMonth,
      expenseGroups: Object.values(expenseGroups),
      netByMonth: months.map(m => ({
        month: m.key,
        income: incomeByMonth[m.key],
        expenses: expensesByMonth[m.key],
        net: incomeByMonth[m.key] - expensesByMonth[m.key]
      }))
    };
  }, [getCashFlowMonths, feeStructure, cashflowExpenses]);

  // Calculate labor costs per project with user breakdown
  const laborCostsByProject = useMemo(() => {
    return projects.map(project => {
      const projectLogs = timeLogs.filter(log => log.project_id === project.project_id);
      const userBreakdown = {};
      
      projectLogs.forEach(log => {
        const userId = log.user_id;
        if (!userBreakdown[userId]) {
          const member = teamMembers.find(m => m.user_id === userId);
          const salary = teamSalaries.find(s => s.user_id === userId);
          userBreakdown[userId] = {
            name: member?.name || log.user_name || 'Unknown',
            billableHours: 0,
            hourlyRate: salary?.hourly_rate || 0,
            cost: 0
          };
        }
        if (log.billable) {
          const hours = log.duration_minutes / 60;
          userBreakdown[userId].billableHours += hours;
          userBreakdown[userId].cost = userBreakdown[userId].billableHours * userBreakdown[userId].hourlyRate;
        }
      });
      
      const totalCost = Object.values(userBreakdown).reduce((sum, u) => sum + u.cost, 0);
      
      return {
        ...project,
        userBreakdown: Object.values(userBreakdown),
        totalLaborCost: totalCost
      };
    });
  }, [projects, timeLogs, teamMembers, teamSalaries]);

  // Summary calculations
  const totalPaidIncome = feeStructure.filter(f => f.payment_status === 'received').reduce((sum, f) => sum + f.amount, 0);
  const totalPendingIncome = feeStructure.filter(f => f.payment_status === 'pending').reduce((sum, f) => sum + f.amount, 0);
  const totalLaborCost = projectProfitability.reduce((sum, p) => sum + p.laborCost, 0);
  const totalProfit = totalPaidIncome - totalLaborCost;

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  if (!user || !['admin', 'manager', 'finance'].includes(user.role)) {
    return (
      <Card className="p-12 text-center">
        <h3 className="text-xl font-heading font-semibold mb-2">Access Restricted</h3>
        <p className="text-muted-foreground">This section is only available to Admin, Manager, and Finance roles</p>
      </Card>
    );
  }

  return (
    <div data-testid="finance-page" className="pt-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Finance</h1>
          <p className="text-base text-muted-foreground">Manage fee structures, cash flow, and labor costs</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Received</p>
          <p className="text-2xl font-heading font-bold text-green-600">{formatCurrency(totalPaidIncome)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Pending Income</p>
          <p className="text-2xl font-heading font-bold text-amber-600">{formatCurrency(totalPendingIncome)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Labor Cost</p>
          <p className="text-2xl font-heading font-bold text-orange-600">{formatCurrency(totalLaborCost)}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Net Profit</p>
          <div className="flex items-center gap-2">
            <p className={`text-2xl font-heading font-bold ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {formatCurrency(Math.abs(totalProfit))}
            </p>
            {totalProfit >= 0 ? <TrendingUp className="h-5 w-5 text-green-600" /> : <TrendingDown className="h-5 w-5 text-red-600" />}
          </div>
        </Card>
      </div>

      <Tabs defaultValue="fee-structure" className="space-y-6">
        <TabsList className="grid grid-cols-4 w-full max-w-xl">
          <TabsTrigger value="fee-structure">Fee Structure</TabsTrigger>
          <TabsTrigger value="profitability">Profitability</TabsTrigger>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
          <TabsTrigger value="labor">Labor Costs</TabsTrigger>
        </TabsList>

        {/* Fee Structure Tab */}
        <TabsContent value="fee-structure" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-4">
                <h3 className="text-lg font-heading font-semibold flex items-center gap-2">
                  <FileText className="h-5 w-5" /> Project Fee Structure
                </h3>
                <Select value={selectedProjectId || '__none__'} onValueChange={(v) => setSelectedProjectId(v === '__none__' ? '' : v)}>
                  <SelectTrigger className="w-64">
                    <SelectValue placeholder="Select a project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">-- Select Project --</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedProjectId && (
                <Dialog open={isFeeDialogOpen} onOpenChange={setIsFeeDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setFeeForm({ ...feeForm, project_id: selectedProjectId })}>
                      <Plus className="mr-2 h-4 w-4" />Add Deliverable
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle>Add Fee Structure Item</DialogTitle></DialogHeader>
                    <form onSubmit={handleFeeSubmit} className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Stage</label>
                          <Input value={feeForm.stage} onChange={(e) => setFeeForm({ ...feeForm, stage: e.target.value })} placeholder="e.g., Design, Development" required />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Deliverable</label>
                          <Input value={feeForm.deliverable} onChange={(e) => setFeeForm({ ...feeForm, deliverable: e.target.value })} placeholder="e.g., Wireframes" required />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">% of Total Value</label>
                          <Input type="number" step="0.01" value={feeForm.percentage} onChange={(e) => {
                            const pct = parseFloat(e.target.value) || 0;
                            const projectValue = getProjectValue(selectedProjectId);
                            setFeeForm({ ...feeForm, percentage: e.target.value, amount: ((pct / 100) * projectValue).toFixed(0) });
                          }} required />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Amount (INR)</label>
                          <Input type="number" value={feeForm.amount} onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })} required />
                        </div>
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Tentative Billing Date</label>
                        <Input type="date" value={feeForm.tentative_billing_date} onChange={(e) => setFeeForm({ ...feeForm, tentative_billing_date: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Deliverable Status</label>
                          <Select value={feeForm.deliverable_status} onValueChange={(v) => setFeeForm({ ...feeForm, deliverable_status: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {deliverableStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Invoice Status</label>
                          <Select value={feeForm.invoice_status} onValueChange={(v) => setFeeForm({ ...feeForm, invoice_status: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {invoiceStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Payment Status</label>
                          <Select value={feeForm.payment_status} onValueChange={(v) => setFeeForm({ ...feeForm, payment_status: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {paymentStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsFeeDialogOpen(false)}>Cancel</Button>
                        <Button type="submit">Add Item</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              )}
            </div>

            {!selectedProjectId ? (
              <div className="text-center py-12 text-muted-foreground">
                <FileText className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p>Select a project to view and manage its fee structure</p>
              </div>
            ) : filteredFeeStructure.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No fee structure items for this project yet</p>
                <p className="text-sm">Click "Add Deliverable" to create one</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Stage</TableHead>
                    <TableHead>Deliverable</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Billing Date</TableHead>
                    <TableHead>Deliverable</TableHead>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Payment</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredFeeStructure.map((item) => (
                    <TableRow key={item.item_id}>
                      <TableCell className="font-medium">{item.stage}</TableCell>
                      <TableCell>{item.deliverable}</TableCell>
                      <TableCell className="text-right">{item.percentage}%</TableCell>
                      <TableCell className="text-right font-semibold">{formatCurrency(item.amount)}</TableCell>
                      <TableCell>{item.tentative_billing_date ? new Date(item.tentative_billing_date).toLocaleDateString('en-IN') : '-'}</TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          item.deliverable_status === 'completed' ? 'bg-green-500/20 text-green-600' :
                          item.deliverable_status === 'in_progress' ? 'bg-blue-500/20 text-blue-600' :
                          item.deliverable_status === 'on_hold' ? 'bg-amber-500/20 text-amber-600' :
                          'bg-gray-500/20 text-gray-600'
                        }`}>
                          {deliverableStatuses.find(s => s.value === item.deliverable_status)?.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          item.invoice_status === 'paid' ? 'bg-green-500/20 text-green-600' :
                          item.invoice_status === 'invoiced' ? 'bg-blue-500/20 text-blue-600' :
                          'bg-gray-500/20 text-gray-600'
                        }`}>
                          {invoiceStatuses.find(s => s.value === item.invoice_status)?.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          item.payment_status === 'received' ? 'bg-green-500/20 text-green-600' : 'bg-amber-500/20 text-amber-600'
                        }`}>
                          {paymentStatuses.find(s => s.value === item.payment_status)?.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => {
                            setEditingFeeItem(item);
                            setFeeForm({ ...item });
                            setIsEditFeeDialog(true);
                          }}><Edit className="h-4 w-4" /></Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteFeeItem(item.item_id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {/* Total Row */}
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell colSpan={2}>Total</TableCell>
                    <TableCell className="text-right">{filteredFeeStructure.reduce((sum, f) => sum + f.percentage, 0).toFixed(1)}%</TableCell>
                    <TableCell className="text-right">{formatCurrency(filteredFeeStructure.reduce((sum, f) => sum + f.amount, 0))}</TableCell>
                    <TableCell colSpan={5}></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Project Profitability Tab (Read-Only) */}
        <TabsContent value="profitability" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5" /> Project Profitability
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Read-only view derived from Fee Structure and Labor Costs
            </p>
            {projects.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No projects to analyze</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Project Value</TableHead>
                    <TableHead className="text-right">Received</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Labor Cost</TableHead>
                    <TableHead className="text-right">Billable Hours</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectProfitability.map((p) => (
                    <TableRow key={p.project_id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.client_name || '-'}</TableCell>
                      <TableCell className="text-right">{formatCurrency(p.totalProjectValue)}</TableCell>
                      <TableCell className="text-right text-green-600">{formatCurrency(p.paidIncome)}</TableCell>
                      <TableCell className="text-right text-amber-600">{formatCurrency(p.pendingIncome)}</TableCell>
                      <TableCell className="text-right text-orange-600">{formatCurrency(p.laborCost)}</TableCell>
                      <TableCell className="text-right">{p.totalBillableHours.toFixed(1)}h</TableCell>
                      <TableCell className={`text-right font-semibold ${p.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(p.profit))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>
        </TabsContent>

        {/* Cash Flow Tab */}
        <TabsContent value="cashflow" className="space-y-4">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading font-semibold flex items-center gap-2">
                <TrendingUp className="h-5 w-5" /> Cash Flow Projection
              </h3>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" disabled={cashflowPeriod === 0} onClick={() => setCashflowPeriod(0)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium px-2">
                  {cashflowPeriod === 0 ? 'Months 1-6' : 'Months 7-12'}
                </span>
                <Button variant="outline" size="sm" disabled={cashflowPeriod === 1} onClick={() => setCashflowPeriod(1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Income Row (from Fee Structure) */}
            <div className="mb-6">
              <h4 className="font-medium mb-2 text-green-600 flex items-center gap-2">
                <IndianRupee className="h-4 w-4" /> Income (from Fee Structure)
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Category</TableHead>
                    {cashFlowData.months.map(m => (
                      <TableHead key={m.key} className="text-right">{m.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Expected Income</TableCell>
                    {cashFlowData.months.map(m => (
                      <TableCell key={m.key} className="text-right text-green-600 font-semibold">
                        {formatCurrency(cashFlowData.incomeByMonth[m.key])}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Expenses (Editable) */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-red-600 flex items-center gap-2">
                  <IndianRupee className="h-4 w-4" /> Expenses (Editable)
                </h4>
                <Dialog open={isCashflowExpenseDialogOpen} onOpenChange={setIsCashflowExpenseDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline">
                      <Plus className="mr-2 h-4 w-4" />Add Expense
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader><DialogTitle>Add Cash Flow Expense</DialogTitle></DialogHeader>
                    <form onSubmit={handleCashflowExpenseSubmit} className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Expense Head</label>
                        <Input value={cashflowExpenseForm.expense_head} onChange={(e) => setCashflowExpenseForm({ ...cashflowExpenseForm, expense_head: e.target.value })} placeholder="e.g., Salaries, Rent" required />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Sub-Head (Optional)</label>
                        <Input value={cashflowExpenseForm.sub_head} onChange={(e) => setCashflowExpenseForm({ ...cashflowExpenseForm, sub_head: e.target.value })} placeholder="e.g., Marketing Team" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Month</label>
                          <Select value={cashflowExpenseForm.month_year || '__none__'} onValueChange={(v) => setCashflowExpenseForm({ ...cashflowExpenseForm, month_year: v === '__none__' ? '' : v })} required>
                            <SelectTrigger><SelectValue placeholder="Select month" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">-- Select --</SelectItem>
                              {[...getCashFlowMonths, ...Array.from({ length: 6 }, (_, i) => {
                                const d = new Date();
                                d.setMonth(d.getMonth() + 6 + i);
                                return { key: d.toISOString().slice(0, 7), name: d.toLocaleString('default', { month: 'short', year: 'numeric' }) };
                              })].map(m => (
                                <SelectItem key={m.key} value={m.key}>{m.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Amount (INR)</label>
                          <Input type="number" value={cashflowExpenseForm.amount} onChange={(e) => setCashflowExpenseForm({ ...cashflowExpenseForm, amount: e.target.value })} required />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" onClick={() => setIsCashflowExpenseDialogOpen(false)}>Cancel</Button>
                        <Button type="submit">Add Expense</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Expense Head</TableHead>
                    {cashFlowData.months.map(m => (
                      <TableHead key={m.key} className="text-right">{m.name}</TableHead>
                    ))}
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cashFlowData.expenseGroups.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={cashFlowData.months.length + 2} className="text-center text-muted-foreground py-4">
                        No expenses added yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    cashFlowData.expenseGroups.map((group, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          {group.head}
                          {group.subHead && <span className="text-muted-foreground text-sm ml-1">- {group.subHead}</span>}
                        </TableCell>
                        {cashFlowData.months.map(m => (
                          <TableCell key={m.key} className="text-right text-red-600">
                            {group.byMonth[m.key]?.amount > 0 ? formatCurrency(group.byMonth[m.key].amount) : '-'}
                          </TableCell>
                        ))}
                        <TableCell>
                          {Object.values(group.byMonth).some(v => v.expenseId) && (
                            <Button size="sm" variant="ghost" onClick={() => {
                              const expenseId = Object.values(group.byMonth).find(v => v.expenseId)?.expenseId;
                              if (expenseId) handleDeleteCashflowExpense(expenseId);
                            }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  {/* Total Expenses Row */}
                  <TableRow className="bg-red-50 dark:bg-red-950/20 font-semibold">
                    <TableCell>Total Expenses</TableCell>
                    {cashFlowData.months.map(m => (
                      <TableCell key={m.key} className="text-right text-red-600">
                        {formatCurrency(cashFlowData.expensesByMonth[m.key])}
                      </TableCell>
                    ))}
                    <TableCell></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>

            {/* Net Cash Flow */}
            <div>
              <h4 className="font-medium mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4" /> Net Cash Flow
              </h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-48">Category</TableHead>
                    {cashFlowData.months.map(m => (
                      <TableHead key={m.key} className="text-right">{m.name}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-muted/50 font-semibold">
                    <TableCell>Net Cash Flow</TableCell>
                    {cashFlowData.netByMonth.map((item, idx) => (
                      <TableCell key={idx} className={`text-right ${item.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatCurrency(Math.abs(item.net))}
                        {item.net < 0 && <span className="text-xs ml-1">(deficit)</span>}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* Labor Costs Tab */}
        <TabsContent value="labor" className="space-y-4">
          {/* Team Salary Table */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-heading font-semibold flex items-center gap-2">
                <Users className="h-5 w-5" /> Team Salary Information
              </h3>
              <Dialog open={isSalaryDialogOpen} onOpenChange={setIsSalaryDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-2 h-4 w-4" />Add/Update Salary
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add/Update Team Member Salary</DialogTitle></DialogHeader>
                  <form onSubmit={handleSalarySubmit} className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Team Member</label>
                      <Select value={salaryForm.user_id || '__none__'} onValueChange={(v) => setSalaryForm({ ...salaryForm, user_id: v === '__none__' ? '' : v })} required>
                        <SelectTrigger><SelectValue placeholder="Select team member" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">-- Select --</SelectItem>
                          {teamMembers.map(m => (
                            <SelectItem key={m.user_id} value={m.user_id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Monthly Salary (INR)</label>
                      <Input type="number" value={salaryForm.monthly_salary} onChange={(e) => setSalaryForm({ ...salaryForm, monthly_salary: e.target.value })} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Hourly Rate (INR)</label>
                        <Input type="number" step="0.01" value={salaryForm.hourly_rate} onChange={(e) => setSalaryForm({ ...salaryForm, hourly_rate: e.target.value })} required />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block">Daily Rate (INR)</label>
                        <Input type="number" step="0.01" value={salaryForm.daily_rate} onChange={(e) => setSalaryForm({ ...salaryForm, daily_rate: e.target.value })} required />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setIsSalaryDialogOpen(false)}>Cancel</Button>
                      <Button type="submit">Save</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
            
            {teamSalaries.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No salary information added yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Team Member</TableHead>
                    <TableHead className="text-right">Monthly Salary</TableHead>
                    <TableHead className="text-right">Hourly Rate</TableHead>
                    <TableHead className="text-right">Daily Rate</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {teamSalaries.map(s => (
                    <TableRow key={s.salary_id}>
                      <TableCell className="font-medium">{s.user_name}</TableCell>
                      <TableCell className="text-right">{formatCurrency(s.monthly_salary)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(s.hourly_rate)}/hr</TableCell>
                      <TableCell className="text-right">{formatCurrency(s.daily_rate)}/day</TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteSalary(s.salary_id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </Card>

          {/* Labor Cost per Project */}
          <Card className="p-6">
            <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" /> Labor Cost per Project
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Calculated as: Hourly Rate × Billable Hours per team member
            </p>
            {projects.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No projects to analyze</p>
            ) : (
              <div className="space-y-4">
                {laborCostsByProject.map(p => (
                  <div key={p.project_id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium">{p.name}</h4>
                      <span className="text-lg font-heading font-bold text-orange-600">{formatCurrency(p.totalLaborCost)}</span>
                    </div>
                    {p.userBreakdown.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Team Member</TableHead>
                            <TableHead className="text-right">Billable Hours</TableHead>
                            <TableHead className="text-right">Hourly Rate</TableHead>
                            <TableHead className="text-right">Cost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {p.userBreakdown.map((u, idx) => (
                            <TableRow key={idx}>
                              <TableCell>{u.name}</TableCell>
                              <TableCell className="text-right">{u.billableHours.toFixed(1)}h</TableCell>
                              <TableCell className="text-right">{formatCurrency(u.hourlyRate)}/hr</TableCell>
                              <TableCell className="text-right font-semibold text-orange-600">{formatCurrency(u.cost)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground">No time logged for this project</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Fee Structure Dialog */}
      <Dialog open={isEditFeeDialog} onOpenChange={setIsEditFeeDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Edit Fee Structure Item</DialogTitle></DialogHeader>
          <form onSubmit={handleEditFeeSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Stage</label>
                <Input value={feeForm.stage} onChange={(e) => setFeeForm({ ...feeForm, stage: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Deliverable</label>
                <Input value={feeForm.deliverable} onChange={(e) => setFeeForm({ ...feeForm, deliverable: e.target.value })} required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">% of Total Value</label>
                <Input type="number" step="0.01" value={feeForm.percentage} onChange={(e) => setFeeForm({ ...feeForm, percentage: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Amount (INR)</label>
                <Input type="number" value={feeForm.amount} onChange={(e) => setFeeForm({ ...feeForm, amount: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Tentative Billing Date</label>
              <Input type="date" value={feeForm.tentative_billing_date || ''} onChange={(e) => setFeeForm({ ...feeForm, tentative_billing_date: e.target.value })} />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Deliverable Status</label>
                <Select value={feeForm.deliverable_status} onValueChange={(v) => setFeeForm({ ...feeForm, deliverable_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {deliverableStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Invoice Status</label>
                <Select value={feeForm.invoice_status} onValueChange={(v) => setFeeForm({ ...feeForm, invoice_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {invoiceStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Payment Status</label>
                <Select value={feeForm.payment_status} onValueChange={(v) => setFeeForm({ ...feeForm, payment_status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {paymentStatuses.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditFeeDialog(false)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
