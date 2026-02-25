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
import { Plus, DollarSign, TrendingUp, TrendingDown, Clock, Target, FileText, Edit, Trash2, Check, X, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const expenseCategories = ['Travel', 'Equipment', 'Office Supplies', 'Client Entertainment', 'Software', 'Utilities', 'Other'];

export const FinancePage = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [timeLogs, setTimeLogs] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isEditExpenseDialog, setIsEditExpenseDialog] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  
  const [invoiceForm, setInvoiceForm] = useState({
    client_id: '',
    project_id: '',
    amount: '',
    due_date: '',
    items: []
  });

  const [expenseForm, setExpenseForm] = useState({
    project_id: '',
    category: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  // Labor rate assumption (can be made configurable)
  const HOURLY_RATE = 50; // Default hourly rate

  useEffect(() => {
    if (user?.role && !['admin', 'manager', 'finance'].includes(user.role)) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      try {
        const [invoicesRes, expensesRes, clientsRes, projectsRes, tasksRes, logsRes, teamRes] = await Promise.all([
          axios.get(`${API_URL}/invoices`, { withCredentials: true }),
          axios.get(`${API_URL}/expenses`, { withCredentials: true }),
          axios.get(`${API_URL}/clients`, { withCredentials: true }),
          axios.get(`${API_URL}/projects`, { withCredentials: true }),
          axios.get(`${API_URL}/tasks`, { withCredentials: true }),
          axios.get(`${API_URL}/time-logs`, { withCredentials: true }),
          axios.get(`${API_URL}/team`, { withCredentials: true })
        ]);
        setInvoices(invoicesRes.data);
        setExpenses(expensesRes.data);
        setClients(clientsRes.data);
        setProjects(projectsRes.data);
        setTasks(tasksRes.data);
        setTimeLogs(logsRes.data);
        setTeamMembers(teamRes.data);
      } catch (error) {
        toast.error('Failed to load finance data');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user]);

  const handleInvoiceSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/invoices`, {
        ...invoiceForm,
        amount: parseFloat(invoiceForm.amount)
      }, { withCredentials: true });
      toast.success('Invoice created');
      setIsInvoiceDialogOpen(false);
      setInvoiceForm({ client_id: '', project_id: '', amount: '', due_date: '', items: [] });
      const res = await axios.get(`${API_URL}/invoices`, { withCredentials: true });
      setInvoices(res.data);
    } catch (error) {
      toast.error('Failed to create invoice');
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/expenses`, {
        ...expenseForm,
        amount: parseFloat(expenseForm.amount)
      }, { withCredentials: true });
      toast.success('Expense added');
      setIsExpenseDialogOpen(false);
      setExpenseForm({ project_id: '', category: '', amount: '', description: '', date: new Date().toISOString().split('T')[0] });
      const res = await axios.get(`${API_URL}/expenses`, { withCredentials: true });
      setExpenses(res.data);
    } catch (error) {
      toast.error('Failed to add expense');
    }
  };

  const handleEditExpense = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(`${API_URL}/expenses/${editingExpense.expense_id}`, {
        category: expenseForm.category,
        amount: parseFloat(expenseForm.amount),
        description: expenseForm.description,
        date: expenseForm.date
      }, { withCredentials: true });
      toast.success('Expense updated');
      setIsEditExpenseDialog(false);
      const res = await axios.get(`${API_URL}/expenses`, { withCredentials: true });
      setExpenses(res.data);
    } catch (error) {
      toast.error('Failed to update expense');
    }
  };

  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      await axios.delete(`${API_URL}/expenses/${expenseId}`, { withCredentials: true });
      toast.success('Expense deleted');
      const res = await axios.get(`${API_URL}/expenses`, { withCredentials: true });
      setExpenses(res.data);
    } catch (error) {
      toast.error('Failed to delete expense');
    }
  };

  const handleInvoiceStatusChange = async (invoiceId, newStatus) => {
    try {
      await axios.patch(`${API_URL}/invoices/${invoiceId}`, {
        status: newStatus,
        ...(newStatus === 'paid' ? { paid_date: new Date().toISOString().split('T')[0] } : {})
      }, { withCredentials: true });
      const res = await axios.get(`${API_URL}/invoices`, { withCredentials: true });
      setInvoices(res.data);
      toast.success('Invoice updated');
    } catch (error) {
      toast.error('Failed to update invoice');
    }
  };

  // Calculate project profitability
  const projectProfitability = useMemo(() => {
    return projects.map(project => {
      const projectInvoices = invoices.filter(inv => inv.project_id === project.project_id);
      const projectExpenses = expenses.filter(exp => exp.project_id === project.project_id);
      const projectLogs = timeLogs.filter(log => log.project_id === project.project_id);
      
      const totalIncome = projectInvoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
      const pendingIncome = projectInvoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + inv.amount, 0);
      const totalExpenses = projectExpenses.reduce((sum, exp) => sum + exp.amount, 0);
      
      const totalBillableHours = projectLogs.filter(log => log.billable).reduce((sum, log) => sum + log.duration_minutes, 0) / 60;
      const laborCost = totalBillableHours * HOURLY_RATE;
      
      const workCompleted = project.completion_percentage || 0;
      const profit = totalIncome - totalExpenses - laborCost;
      
      return {
        ...project,
        totalIncome,
        pendingIncome,
        totalExpenses,
        laborCost,
        totalBillableHours,
        workCompleted,
        profit
      };
    });
  }, [projects, invoices, expenses, timeLogs]);

  // Cash flow calculations
  const cashFlowData = useMemo(() => {
    const months = [];
    const now = new Date();
    
    for (let i = 0; i < 6; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthKey = monthDate.toISOString().slice(0, 7);
      const monthName = monthDate.toLocaleString('default', { month: 'short', year: 'numeric' });
      
      // Project income based on milestones (simplified: distribute budget over project duration)
      let projectedIncome = 0;
      projects.forEach(p => {
        if (p.end_date) {
          const endDate = new Date(p.end_date);
          const startDate = p.start_date ? new Date(p.start_date) : now;
          if (monthDate >= startDate && monthDate <= endDate && p.budget) {
            const monthsInProject = Math.max(1, Math.ceil((endDate - startDate) / (30 * 24 * 60 * 60 * 1000)));
            projectedIncome += p.budget / monthsInProject;
          }
        }
      });
      
      // Actual income from invoices due in this month
      const actualIncome = invoices
        .filter(inv => inv.due_date && inv.due_date.startsWith(monthKey))
        .reduce((sum, inv) => sum + inv.amount, 0);
      
      // Expenses in this month
      const monthExpenses = expenses
        .filter(exp => exp.date && exp.date.startsWith(monthKey))
        .reduce((sum, exp) => sum + exp.amount, 0);
      
      months.push({
        month: monthName,
        projectedIncome: Math.round(projectedIncome),
        actualIncome: Math.round(actualIncome),
        expenses: Math.round(monthExpenses),
        netCashFlow: Math.round((actualIncome || projectedIncome) - monthExpenses)
      });
    }
    
    return months;
  }, [projects, invoices, expenses]);

  const totalRevenue = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
  const pendingRevenue = invoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + inv.amount, 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const totalBillableHours = timeLogs.filter(log => log.billable).reduce((sum, log) => sum + log.duration_minutes, 0) / 60;
  const laborCost = totalBillableHours * HOURLY_RATE;
  const profit = totalRevenue - totalExpenses - laborCost;

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
          <p className="text-base text-muted-foreground">Manage invoices, expenses, and financial tracking</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
          <p className="text-2xl font-heading font-bold text-green-600">${totalRevenue.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Pending</p>
          <p className="text-2xl font-heading font-bold text-amber-600">${pendingRevenue.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Expenses</p>
          <p className="text-2xl font-heading font-bold text-red-600">${totalExpenses.toLocaleString()}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Labor Cost</p>
          <p className="text-2xl font-heading font-bold text-orange-600">${laborCost.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">{totalBillableHours.toFixed(1)}h × ${HOURLY_RATE}/h</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-muted-foreground mb-1">Net Profit</p>
          <div className="flex items-center gap-2">
            <p className={`text-2xl font-heading font-bold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${Math.abs(profit).toLocaleString()}
            </p>
            {profit >= 0 ? <TrendingUp className="h-5 w-5 text-green-600" /> : <TrendingDown className="h-5 w-5 text-red-600" />}
          </div>
        </Card>
      </div>

      <Tabs defaultValue="invoices" className="space-y-6">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="profitability">Profitability</TabsTrigger>
          <TabsTrigger value="cashflow">Cash Flow</TabsTrigger>
          <TabsTrigger value="labor">Labor Costs</TabsTrigger>
        </TabsList>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />New Invoice</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Create Invoice</DialogTitle></DialogHeader>
                <form onSubmit={handleInvoiceSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Client</label>
                    <Select value={invoiceForm.client_id} onValueChange={(value) => setInvoiceForm({ ...invoiceForm, client_id: value })} required>
                      <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.client_id} value={client.client_id}>{client.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Project</label>
                    <Select value={invoiceForm.project_id || '__none__'} onValueChange={(value) => setInvoiceForm({ ...invoiceForm, project_id: value === '__none__' ? '' : value })}>
                      <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.project_id} value={project.project_id}>{project.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Amount</label>
                      <Input type="number" step="0.01" value={invoiceForm.amount} onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })} required />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Due Date</label>
                      <Input type="date" value={invoiceForm.due_date} onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsInvoiceDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">Create Invoice</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {invoices.length === 0 ? (
            <Card className="p-12 text-center">
              <DollarSign className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No invoices yet</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <Card key={invoice.invoice_id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-medium">Invoice #{invoice.invoice_id.slice(-6)}</h4>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          invoice.status === 'paid' ? 'bg-green-500/20 text-green-600' : 
                          invoice.status === 'overdue' ? 'bg-red-500/20 text-red-600' : 'bg-amber-500/20 text-amber-600'
                        }`}>{invoice.status}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {clients.find(c => c.client_id === invoice.client_id)?.name || 'Unknown Client'}
                        {invoice.project_id && ` • ${projects.find(p => p.project_id === invoice.project_id)?.name || ''}`}
                      </p>
                      {invoice.due_date && (
                        <p className="text-xs text-muted-foreground mt-1">Due: {new Date(invoice.due_date).toLocaleDateString()}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-2xl font-heading font-bold">${invoice.amount.toLocaleString()}</p>
                      <Select value={invoice.status} onValueChange={(value) => handleInvoiceStatusChange(invoice.invoice_id, value)}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Expenses Tab */}
        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Add Expense</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Expense</DialogTitle></DialogHeader>
                <form onSubmit={handleExpenseSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Category</label>
                    <Select value={expenseForm.category} onValueChange={(value) => setExpenseForm({ ...expenseForm, category: value })} required>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {expenseCategories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Project</label>
                    <Select value={expenseForm.project_id || '__none__'} onValueChange={(value) => setExpenseForm({ ...expenseForm, project_id: value === '__none__' ? '' : value })}>
                      <SelectTrigger><SelectValue placeholder="Select project" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None (General)</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.project_id} value={project.project_id}>{project.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Amount</label>
                      <Input type="number" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} required />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Date</label>
                      <Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} required />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Description</label>
                    <Textarea value={expenseForm.description} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} rows={2} />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsExpenseDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">Add Expense</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {expenses.length === 0 ? (
            <Card className="p-12 text-center">
              <p className="text-muted-foreground">No expenses recorded</p>
            </Card>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.expense_id}>
                    <TableCell>{new Date(expense.date).toLocaleDateString()}</TableCell>
                    <TableCell><span className="px-2 py-0.5 text-xs rounded-full bg-muted">{expense.category}</span></TableCell>
                    <TableCell>{projects.find(p => p.project_id === expense.project_id)?.name || '-'}</TableCell>
                    <TableCell className="max-w-xs truncate">{expense.description || '-'}</TableCell>
                    <TableCell className="text-right font-semibold text-red-600">-${expense.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => {
                          setEditingExpense(expense);
                          setExpenseForm({ ...expense });
                          setIsEditExpenseDialog(true);
                        }}><Edit className="h-4 w-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDeleteExpense(expense.expense_id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>

        {/* Project Profitability Tab */}
        <TabsContent value="profitability" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
              <Target className="h-5 w-5" /> Project Profitability
            </h3>
            {projects.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No projects to analyze</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Income</TableHead>
                    <TableHead className="text-right">Pending</TableHead>
                    <TableHead className="text-right">Expenses</TableHead>
                    <TableHead className="text-right">Labor Cost</TableHead>
                    <TableHead className="text-right">Billable Hours</TableHead>
                    <TableHead className="text-center">Progress</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projectProfitability.map((p) => (
                    <TableRow key={p.project_id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell>{p.client_name || '-'}</TableCell>
                      <TableCell className="text-right text-green-600">${p.totalIncome.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-amber-600">${p.pendingIncome.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-red-600">${p.totalExpenses.toLocaleString()}</TableCell>
                      <TableCell className="text-right text-orange-600">${p.laborCost.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{p.totalBillableHours.toFixed(1)}h</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-primary" style={{ width: `${p.workCompleted}%` }}></div>
                          </div>
                          <span className="text-xs">{p.workCompleted.toFixed(0)}%</span>
                        </div>
                      </TableCell>
                      <TableCell className={`text-right font-semibold ${p.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        ${Math.abs(p.profit).toLocaleString()}
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
            <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" /> 6-Month Cash Flow Projection
            </h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Projected Income</TableHead>
                  <TableHead className="text-right">Invoice Due</TableHead>
                  <TableHead className="text-right">Expenses</TableHead>
                  <TableHead className="text-right">Net Cash Flow</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cashFlowData.map((month, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{month.month}</TableCell>
                    <TableCell className="text-right">${month.projectedIncome.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-green-600">${month.actualIncome.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-red-600">${month.expenses.toLocaleString()}</TableCell>
                    <TableCell className={`text-right font-semibold ${month.netCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${Math.abs(month.netCashFlow).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Labor Costs Tab */}
        <TabsContent value="labor" className="space-y-4">
          <Card className="p-6">
            <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
              <Clock className="h-5 w-5" /> Labor Cost per Project
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              Calculated using cumulative billable hours × ${HOURLY_RATE}/hour rate
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project</TableHead>
                  <TableHead className="text-right">Billable Hours</TableHead>
                  <TableHead className="text-right">Non-Billable Hours</TableHead>
                  <TableHead className="text-right">Total Hours</TableHead>
                  <TableHead className="text-right">Labor Cost</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Labor %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((p) => {
                  const projectLogs = timeLogs.filter(log => log.project_id === p.project_id);
                  const billableHours = projectLogs.filter(log => log.billable).reduce((sum, log) => sum + log.duration_minutes, 0) / 60;
                  const nonBillableHours = projectLogs.filter(log => !log.billable).reduce((sum, log) => sum + log.duration_minutes, 0) / 60;
                  const totalHours = billableHours + nonBillableHours;
                  const laborCost = billableHours * HOURLY_RATE;
                  const laborPercent = p.budget ? (laborCost / p.budget * 100) : 0;
                  
                  return (
                    <TableRow key={p.project_id}>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="text-right">{billableHours.toFixed(1)}h</TableCell>
                      <TableCell className="text-right text-muted-foreground">{nonBillableHours.toFixed(1)}h</TableCell>
                      <TableCell className="text-right">{totalHours.toFixed(1)}h</TableCell>
                      <TableCell className="text-right font-semibold text-orange-600">${laborCost.toLocaleString()}</TableCell>
                      <TableCell className="text-right">{p.budget ? `$${p.budget.toLocaleString()}` : '-'}</TableCell>
                      <TableCell className="text-right">
                        {p.budget ? (
                          <span className={laborPercent > 80 ? 'text-red-600' : laborPercent > 50 ? 'text-amber-600' : 'text-green-600'}>
                            {laborPercent.toFixed(1)}%
                          </span>
                        ) : '-'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit Expense Dialog */}
      <Dialog open={isEditExpenseDialog} onOpenChange={setIsEditExpenseDialog}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit Expense</DialogTitle></DialogHeader>
          <form onSubmit={handleEditExpense} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Category</label>
              <Select value={expenseForm.category} onValueChange={(value) => setExpenseForm({ ...expenseForm, category: value })} required>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {expenseCategories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Amount</label>
                <Input type="number" step="0.01" value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} required />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Date</label>
                <Input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} required />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Description</label>
              <Textarea value={expenseForm.description || ''} onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })} rows={2} />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditExpenseDialog(false)}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};
