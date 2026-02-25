import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { ArrowLeft, Building2, Users, FolderKanban, FileText, CheckSquare, IndianRupee, Globe, MapPin, Phone, FileCheck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const formatCurrency = (amount) => {
  return `INR ${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  }).format(amount || 0)}`;
};

export const CompanyDetailPage = () => {
  const { companyId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchCompanyData = async () => {
    try {
      const response = await axios.get(`${API_URL}/companies/${companyId}/overview`, { withCredentials: true });
      setData(response.data);
    } catch (error) {
      toast.error('Failed to load company data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompanyData();
  }, [companyId]);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  if (!data) {
    return <Card className="p-12 text-center"><p className="text-muted-foreground">Company not found</p></Card>;
  }

  const { company, contacts, projects, proposals, tasks, finance } = data;

  return (
    <div data-testid="company-detail-page">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/clients')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Clients & Companies
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-4xl font-heading font-bold tracking-tight mb-2 flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              {company.name}
            </h1>
            {company.industry && <p className="text-lg text-muted-foreground">{company.industry}</p>}
          </div>
        </div>
      </div>

      {/* Company Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {company.website && (
          <Card className="p-4 flex items-center gap-3">
            <Globe className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Website</p>
              <a href={company.website} target="_blank" rel="noopener noreferrer" className="font-medium text-accent hover:underline">
                {company.website}
              </a>
            </div>
          </Card>
        )}
        {company.phone && (
          <Card className="p-4 flex items-center gap-3">
            <Phone className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{company.phone}</p>
            </div>
          </Card>
        )}
        {company.gst_number && (
          <Card className="p-4 flex items-center gap-3">
            <FileCheck className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">GST Number</p>
              <p className="font-medium">{company.gst_number}</p>
            </div>
          </Card>
        )}
        {company.pan_number && (
          <Card className="p-4 flex items-center gap-3">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <p className="text-sm text-muted-foreground">PAN Number</p>
              <p className="font-medium">{company.pan_number}</p>
            </div>
          </Card>
        )}
      </div>

      {company.business_address && (
        <Card className="p-4 mb-8 flex items-start gap-3">
          <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm text-muted-foreground">Business Address</p>
            <p className="font-medium">{company.business_address}</p>
          </div>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <Users className="h-5 w-5 text-chart-1" />
            <p className="text-sm text-muted-foreground">Contacts</p>
          </div>
          <p className="text-3xl font-heading font-bold">{contacts.total}</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <FolderKanban className="h-5 w-5 text-chart-2" />
            <p className="text-sm text-muted-foreground">Projects</p>
          </div>
          <p className="text-3xl font-heading font-bold">{projects.active}</p>
          <p className="text-xs text-muted-foreground mt-1">of {projects.total} total</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <FileText className="h-5 w-5 text-chart-3" />
            <p className="text-sm text-muted-foreground">Proposals</p>
          </div>
          <p className="text-3xl font-heading font-bold">{proposals.approved}</p>
          <p className="text-xs text-muted-foreground mt-1">of {proposals.total} approved</p>
        </Card>

        <Card className="p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckSquare className="h-5 w-5 text-chart-4" />
            <p className="text-sm text-muted-foreground">Tasks</p>
          </div>
          <p className="text-3xl font-heading font-bold">{tasks.completed}</p>
          <p className="text-xs text-muted-foreground mt-1">of {tasks.total} completed</p>
        </Card>

        {finance && user?.role && ['admin', 'manager', 'finance'].includes(user.role) && (
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <IndianRupee className="h-5 w-5 text-green-500" />
              <p className="text-sm text-muted-foreground">Revenue</p>
            </div>
            <p className="text-3xl font-heading font-bold text-green-600">{formatCurrency(finance.total_revenue)}</p>
            <p className="text-xs text-muted-foreground mt-1">{formatCurrency(finance.pending_revenue)} pending</p>
          </Card>
        )}
      </div>

      <Tabs defaultValue="contacts" className="space-y-6">
        <TabsList>
          <TabsTrigger value="contacts">Contacts</TabsTrigger>
          <TabsTrigger value="projects">Projects</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          {finance && <TabsTrigger value="finance">Finance</TabsTrigger>}
        </TabsList>

        {/* Contacts Tab */}
        <TabsContent value="contacts" className="space-y-4">
          {contacts.list.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">No contacts yet</p></Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {contacts.list.map((contact) => (
                <Card 
                  key={contact.client_id} 
                  className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => navigate(`/clients/${contact.client_id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="font-medium mb-1">{contact.name}</h4>
                      {contact.position && <p className="text-sm text-muted-foreground mb-2">{contact.position}</p>}
                      {contact.email && <p className="text-sm text-muted-foreground">{contact.email}</p>}
                      {contact.phone && <p className="text-sm text-muted-foreground">{contact.phone}</p>}
                    </div>
                    <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-chart-4/20 text-chart-4">
                      {contact.status || 'active'}
                    </span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Projects Tab */}
        <TabsContent value="projects" className="space-y-4">
          {projects.list.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">No projects yet</p></Card>
          ) : (
            projects.list.map((project) => (
              <Card 
                key={project.project_id} 
                className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/projects/${project.project_id}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium mb-1">{project.name}</h4>
                    <p className="text-sm text-muted-foreground">{project.description}</p>
                    {project.budget && (
                      <p className="text-sm text-muted-foreground mt-1">Budget: {formatCurrency(project.budget)}</p>
                    )}
                  </div>
                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                    project.status === 'active' ? 'bg-green-500/20 text-green-600' :
                    project.status === 'completed' ? 'bg-blue-500/20 text-blue-600' :
                    'bg-muted text-foreground'
                  }`}>
                    {project.status}
                  </span>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Proposals Tab */}
        <TabsContent value="proposals" className="space-y-4">
          {proposals.list.length === 0 ? (
            <Card className="p-8 text-center"><p className="text-muted-foreground">No proposals yet</p></Card>
          ) : (
            proposals.list.map((proposal) => (
              <Card 
                key={proposal.proposal_id} 
                className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/proposals/${proposal.proposal_id}`)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium mb-1">{proposal.title}</h4>
                    {proposal.amount && <p className="text-sm text-muted-foreground">{formatCurrency(proposal.amount)}</p>}
                  </div>
                  <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                    proposal.status === 'approved' ? 'bg-green-500/20 text-green-600' :
                    proposal.status === 'converted' ? 'bg-blue-500/20 text-blue-600' :
                    proposal.status === 'pending_approval' ? 'bg-yellow-500/20 text-yellow-600' :
                    'bg-muted text-foreground'
                  }`}>
                    {proposal.status?.replace(/_/g, ' ')}
                  </span>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Tasks Tab */}
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
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${
                      task.priority === 'urgent' ? 'bg-red-500/20 text-red-600' :
                      task.priority === 'high' ? 'bg-orange-500/20 text-orange-600' :
                      task.priority === 'medium' ? 'bg-blue-500/20 text-blue-600' :
                      'bg-slate-500/20 text-slate-600'
                    }`}>
                      {task.priority}
                    </span>
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${
                      task.status === 'completed' ? 'bg-green-500/20 text-green-600' :
                      task.status === 'in_progress' ? 'bg-blue-500/20 text-blue-600' :
                      task.status === 'under_review' ? 'bg-purple-500/20 text-purple-600' :
                      'bg-muted text-foreground'
                    }`}>
                      {task.status?.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Finance Tab */}
        {finance && (
          <TabsContent value="finance" className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Total Project Value</p>
                <p className="text-2xl font-heading font-bold">{formatCurrency(finance.total_project_value)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Revenue Received</p>
                <p className="text-2xl font-heading font-bold text-green-600">{formatCurrency(finance.total_revenue)}</p>
              </Card>
              <Card className="p-4">
                <p className="text-sm text-muted-foreground mb-1">Pending Revenue</p>
                <p className="text-2xl font-heading font-bold text-amber-600">{formatCurrency(finance.pending_revenue)}</p>
              </Card>
            </div>

            <Card className="p-6">
              <h4 className="font-medium mb-4">Recent Invoices</h4>
              {finance.invoices.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">No invoices yet</p>
              ) : (
                <div className="space-y-3">
                  {finance.invoices.map((invoice) => (
                    <div key={invoice.invoice_id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">Invoice #{invoice.invoice_id?.slice(-6)}</p>
                        {invoice.due_date && <p className="text-sm text-muted-foreground">Due: {new Date(invoice.due_date).toLocaleDateString()}</p>}
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-heading font-bold">{formatCurrency(invoice.amount)}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${
                          invoice.status === 'paid' ? 'bg-green-500/20 text-green-600' : 'bg-amber-500/20 text-amber-600'
                        }`}>
                          {invoice.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
};
