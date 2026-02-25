import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ArrowLeft, Mail, Phone, Building2, FileText, FolderKanban, CheckSquare, RefreshCw, IndianRupee } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

export const ClientDetailPage = () => {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const fetchClientData = async () => {
    try {
      const response = await axios.get(`${API_URL}/clients/${clientId}/overview`, { withCredentials: true });
      setData(response.data);
    } catch (error) {
      toast.error('Failed to load client data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClientData();
  }, [clientId]);

  const handleSyncEmails = async () => {
    setSyncing(true);
    try {
      await axios.post(`${API_URL}/gmail/sync/${clientId}`, {}, { withCredentials: true });
      toast.success('Emails synced successfully');
      fetchClientData();
    } catch (error) {
      if (error.response?.status === 400) {
        toast.error('Please connect Gmail first');
      } else {
        toast.error('Failed to sync emails');
      }
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  if (!data) {
    return <Card className="p-12 text-center"><p className="text-muted-foreground">Client not found</p></Card>;
  }

  const { client, projects, proposals, finance, tasks, communications } = data;

  return (
    <div data-testid="client-detail-page">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/clients')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Clients
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">{client.name}</h1>
            {client.company && <p className="text-lg text-muted-foreground flex items-center gap-2"><Building2 className="h-5 w-5" />{client.company}</p>}
          </div>
          <span className="px-3 py-1 text-sm font-semibold rounded-full bg-chart-4/20 text-chart-4">
            {client.status}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        {client.email && (
          <Card className="p-4 flex items-center gap-3">
            <Mail className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{client.email}</p>
            </div>
          </Card>
        )}
        {client.phone && (
          <Card className="p-4 flex items-center gap-3">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{client.phone}</p>
            </div>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <FolderKanban className="h-5 w-5 text-chart-1" />
            <p className="text-sm text-muted-foreground">Projects</p>
          </div>
          <p className="text-3xl font-heading font-bold">{projects.active}</p>
          <p className="text-xs text-muted-foreground mt-1">of {projects.total} total</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-5 w-5 text-chart-2" />
            <p className="text-sm text-muted-foreground">Proposals</p>
          </div>
          <p className="text-3xl font-heading font-bold">{proposals.approved}</p>
          <p className="text-xs text-muted-foreground mt-1">of {proposals.total} approved</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckSquare className="h-5 w-5 text-chart-3" />
            <p className="text-sm text-muted-foreground">Tasks</p>
          </div>
          <p className="text-3xl font-heading font-bold">{tasks.completed}</p>
          <p className="text-xs text-muted-foreground mt-1">of {tasks.total} completed</p>
        </Card>

        {finance && user?.role && ['admin', 'manager', 'finance'].includes(user.role) && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <IndianRupee className="h-5 w-5 text-chart-4" />
              <p className="text-sm text-muted-foreground">Revenue</p>
            </div>
            <p className="text-3xl font-heading font-bold">INR {finance.total_revenue.toLocaleString()}</p>
            <p className="text-xs text-muted-foreground mt-1">INR {finance.pending_revenue.toLocaleString()} pending</p>
          </Card>
        )}
      </div>

      <Tabs defaultValue="projects" className="space-y-6">
        <TabsList>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          {finance && <TabsTrigger value="finance">Finance</TabsTrigger>}
          <TabsTrigger value="communications">Communications</TabsTrigger>
        </TabsList>

        <TabsContent value="projects" className="space-y-4">
          {projects.list.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">No projects yet</p></Card>
          ) : (
            projects.list.map((project) => (
              <Card key={project.project_id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium mb-1">{project.name}</h4>
                    <p className="text-sm text-muted-foreground">{project.description}</p>
                  </div>
                  <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-chart-4/20 text-chart-4">
                    {project.status}
                  </span>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="proposals" className="space-y-4">
          {proposals.list.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">No proposals yet</p></Card>
          ) : (
            proposals.list.map((proposal) => (
              <Card key={proposal.proposal_id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium mb-1">{proposal.title}</h4>
                    {proposal.amount && <p className="text-sm text-muted-foreground">INR {proposal.amount.toLocaleString()}</p>}
                  </div>
                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                    proposal.status === 'approved' ? 'bg-chart-4/20 text-chart-4' : 'bg-muted text-foreground'
                  }`}>
                    {proposal.status}
                  </span>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="tasks" className="space-y-4">
          {tasks.list.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">No tasks yet</p></Card>
          ) : (
            tasks.list.map((task) => (
              <Card key={task.task_id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium mb-1">{task.title}</h4>
                    {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}
                  </div>
                  <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-muted">
                    {task.status}
                  </span>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        {finance && (
          <TabsContent value="finance" className="space-y-4">
            {finance.invoices.length === 0 ? (
              <Card className="p-8 text-center"><p className="text-muted-foreground">No invoices yet</p></Card>
            ) : (
              finance.invoices.map((invoice) => (
                <Card key={invoice.invoice_id} className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium mb-1">Invoice #{invoice.invoice_id.slice(-6)}</h4>
                      {invoice.due_date && <p className="text-sm text-muted-foreground">Due: {new Date(invoice.due_date).toLocaleDateString()}</p>}
                    </div>
                    <div className="text-right">
                      <p className="text-xl font-heading font-bold">INR {invoice.amount.toLocaleString()}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        invoice.status === 'paid' ? 'bg-chart-4/20 text-chart-4' : 'bg-chart-2/20 text-chart-2'
                      }`}>
                        {invoice.status}
                      </span>
                    </div>
                  </div>
                </Card>
              ))
            )}
          </TabsContent>
        )}

        <TabsContent value="communications" className="space-y-4">
          <div className="flex justify-end mb-4">
            <Button onClick={handleSyncEmails} disabled={syncing}>
              <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
              Sync Emails
            </Button>
          </div>
          {communications.recent.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground mb-4">No email communications synced yet</p>
              <p className="text-sm text-muted-foreground">Connect Gmail and sync emails to see communication history</p>
            </Card>
          ) : (
            communications.recent.map((email, index) => (
              <Card key={index} className="p-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">{email.subject}</h4>
                    <span className="text-xs text-muted-foreground">{email.date}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">From: {email.from}</p>
                  <p className="text-sm text-muted-foreground line-clamp-2">{email.snippet}</p>
                </div>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};
