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
import { Plus, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

export const FinancePage = () => {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  
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

  useEffect(() => {
    if (user?.role && !['admin', 'manager', 'finance'].includes(user.role)) {
      toast.error('Access denied');
      return;
    }

    const fetchData = async () => {
      try {
        const [invoicesRes, expensesRes, clientsRes, projectsRes] = await Promise.all([
          axios.get(`${API_URL}/invoices`, { withCredentials: true }),
          axios.get(`${API_URL}/expenses`, { withCredentials: true }),
          axios.get(`${API_URL}/clients`, { withCredentials: true }),
          axios.get(`${API_URL}/projects`, { withCredentials: true })
        ]);
        setInvoices(invoicesRes.data);
        setExpenses(expensesRes.data);
        setClients(clientsRes.data);
        setProjects(projectsRes.data);
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

  const totalRevenue = invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + inv.amount, 0);
  const pendingRevenue = invoices.filter(inv => inv.status === 'pending').reduce((sum, inv) => sum + inv.amount, 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const profit = totalRevenue - totalExpenses;

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
    <div data-testid="finance-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Finance</h1>
          <p className="text-base text-muted-foreground">Manage invoices, expenses, and financial tracking</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <p className="text-sm text-muted-foreground mb-1">Total Revenue</p>
          <p className="text-3xl font-heading font-bold text-chart-4">${totalRevenue.toLocaleString()}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground mb-1">Pending</p>
          <p className="text-3xl font-heading font-bold text-chart-2">${pendingRevenue.toLocaleString()}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground mb-1">Expenses</p>
          <p className="text-3xl font-heading font-bold text-destructive">${totalExpenses.toLocaleString()}</p>
        </Card>
        <Card className="p-6">
          <p className="text-sm text-muted-foreground mb-1">Profit</p>
          <div className="flex items-center gap-2">
            <p className="text-3xl font-heading font-bold">${profit.toLocaleString()}</p>
            {profit >= 0 ? <TrendingUp className="h-5 w-5 text-chart-4" /> : <TrendingDown className="h-5 w-5 text-destructive" />}
          </div>
        </Card>
      </div>

      <Tabs defaultValue="invoices" className="space-y-6">
        <TabsList>
          <TabsTrigger value="invoices">Invoices</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
        </TabsList>

        <TabsContent value="invoices" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Invoice
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Invoice</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleInvoiceSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Client</label>
                    <Select value={invoiceForm.client_id} onValueChange={(value) => setInvoiceForm({ ...invoiceForm, client_id: value })} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.length > 0 ? (
                          clients.map((client) => (
                            <SelectItem key={client.client_id} value={client.client_id}>
                              {client.name}
                            </SelectItem>
                          ))
                        ) : (
                          <SelectItem value="no-clients" disabled>No clients</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Project (Optional)</label>
                    <Select value={invoiceForm.project_id} onValueChange={(value) => setInvoiceForm({ ...invoiceForm, project_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.project_id} value={project.project_id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Amount</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={invoiceForm.amount}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, amount: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Due Date</label>
                    <Input
                      type="date"
                      value={invoiceForm.due_date}
                      onChange={(e) => setInvoiceForm({ ...invoiceForm, due_date: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsInvoiceDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      Create Invoice
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {invoices.length === 0 ? (
              <Card className="p-12 text-center">
                <DollarSign className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No invoices yet</p>
              </Card>
            ) : (
              invoices.map((invoice) => (
                <Card key={invoice.invoice_id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h4 className="font-medium">Invoice #{invoice.invoice_id.slice(-6)}</h4>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                          invoice.status === 'paid' ? 'bg-chart-4/20 text-chart-4' : 'bg-chart-2/20 text-chart-2'
                        }`}>
                          {invoice.status}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {clients.find(c => c.client_id === invoice.client_id)?.name || 'Unknown Client'}
                      </p>
                      {invoice.due_date && (
                        <p className="text-xs text-muted-foreground mt-1">Due: {new Date(invoice.due_date).toLocaleDateString()}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-2xl font-heading font-bold">${invoice.amount.toLocaleString()}</p>
                      <Select value={invoice.status} onValueChange={(value) => handleInvoiceStatusChange(invoice.invoice_id, value)}>
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="overdue">Overdue</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="expenses" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Expense
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Expense</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleExpenseSubmit} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Category</label>
                    <Input
                      value={expenseForm.category}
                      onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                      placeholder="e.g., Software, Travel, Office"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Project (Optional)</label>
                    <Select value={expenseForm.project_id} onValueChange={(value) => setExpenseForm({ ...expenseForm, project_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {projects.map((project) => (
                          <SelectItem key={project.project_id} value={project.project_id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Amount</label>
                    <Input
                      type="number"
                      step="0.01"
                      value={expenseForm.amount}
                      onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Date</label>
                    <Input
                      type="date"
                      value={expenseForm.date}
                      onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Description</label>
                    <Textarea
                      value={expenseForm.description}
                      onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                      placeholder="Expense details"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsExpenseDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      Add Expense
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-3">
            {expenses.length === 0 ? (
              <Card className="p-12 text-center">
                <p className="text-muted-foreground">No expenses recorded</p>
              </Card>
            ) : (
              expenses.map((expense) => (
                <Card key={expense.expense_id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h4 className="font-medium">{expense.category}</h4>
                        <span className="px-2 py-0.5 text-xs rounded-full bg-muted">
                          {new Date(expense.date).toLocaleDateString()}
                        </span>
                      </div>
                      {expense.description && (
                        <p className="text-sm text-muted-foreground">{expense.description}</p>
                      )}
                    </div>
                    <p className="text-xl font-heading font-bold text-destructive">-${expense.amount.toLocaleString()}</p>
                  </div>
                </Card>
              ))
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};
