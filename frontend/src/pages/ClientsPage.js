import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Plus, Users, Mail, Phone, Building2, Inbox, Edit, Trash2, UserPlus, MapPin, FileText } from 'lucide-react';
import { toast } from 'sonner';

export const ClientsPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [clients, setClients] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isClientDialogOpen, setIsClientDialogOpen] = useState(false);
  const [isCompanyDialogOpen, setIsCompanyDialogOpen] = useState(false);
  const [isEditClientDialogOpen, setIsEditClientDialogOpen] = useState(false);
  const [isEditCompanyDialogOpen, setIsEditCompanyDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);
  const [editingCompany, setEditingCompany] = useState(null);
  const [view, setView] = useState('clients');
  
  const [clientForm, setClientForm] = useState({
    name: '',
    email: '',
    phone: '',
    position: '',
    company_id: '',
    address: '',
    business_address: '',
    gst_number: '',
    pan_number: '',
    notes: '',
    custom_fields: {}
  });
  
  const [companyForm, setCompanyForm] = useState({
    name: '',
    industry: '',
    website: '',
    address: '',
    business_address: '',
    phone: '',
    gst_number: '',
    pan_number: '',
    custom_fields: {}
  });
  
  const [customField, setCustomField] = useState({ key: '', value: '' });

  useEffect(() => {
    if (searchParams.get('gmail_connected') === 'true') {
      toast.success('Gmail connected successfully');
    }
  }, [searchParams]);

  const fetchData = async () => {
    try {
      const [clientsRes, companiesRes] = await Promise.all([
        axios.get(`${API_URL}/clients`, { withCredentials: true }),
        axios.get(`${API_URL}/companies`, { withCredentials: true })
      ]);
      setClients(clientsRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const resetClientForm = () => {
    setClientForm({
      name: '', email: '', phone: '', position: '', company_id: '',
      address: '', business_address: '', gst_number: '', pan_number: '',
      notes: '', custom_fields: {}
    });
  };

  const resetCompanyForm = () => {
    setCompanyForm({
      name: '', industry: '', website: '', address: '', business_address: '',
      phone: '', gst_number: '', pan_number: '', custom_fields: {}
    });
  };

  const handleCreateClient = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/clients`, clientForm, { withCredentials: true });
      toast.success('Contact created successfully');
      setIsClientDialogOpen(false);
      resetClientForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to create contact');
    }
  };

  const handleCreateCompany = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/companies`, companyForm, { withCredentials: true });
      toast.success('Company created successfully');
      setIsCompanyDialogOpen(false);
      resetCompanyForm();
      fetchData();
    } catch (error) {
      toast.error('Failed to create company');
    }
  };

  const handleEditClient = (client) => {
    setEditingClient({ ...client });
    setIsEditClientDialogOpen(true);
  };

  const handleEditCompany = (company) => {
    setEditingCompany({ ...company });
    setIsEditCompanyDialogOpen(true);
  };

  const handleUpdateClient = async () => {
    try {
      await axios.patch(`${API_URL}/clients/${editingClient.client_id}`, editingClient, { withCredentials: true });
      toast.success('Contact updated successfully');
      setIsEditClientDialogOpen(false);
      setEditingClient(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to update contact');
    }
  };

  const handleUpdateCompany = async () => {
    try {
      await axios.patch(`${API_URL}/companies/${editingCompany.company_id}`, editingCompany, { withCredentials: true });
      toast.success('Company updated successfully');
      setIsEditCompanyDialogOpen(false);
      setEditingCompany(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to update company');
    }
  };

  const handleDeleteClient = async (clientId) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    try {
      await axios.delete(`${API_URL}/clients/${clientId}`, { withCredentials: true });
      toast.success('Contact deleted successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete contact');
    }
  };

  const handleDeleteCompany = async (companyId) => {
    if (!window.confirm('Are you sure you want to delete this company? This will fail if there are contacts associated.')) return;
    try {
      await axios.delete(`${API_URL}/companies/${companyId}`, { withCredentials: true });
      toast.success('Company deleted successfully');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete company');
    }
  };

  const handleConnectGmail = async () => {
    try {
      const response = await axios.get(`${API_URL}/gmail/connect`, { withCredentials: true });
      window.location.href = response.data.authorization_url;
    } catch (error) {
      toast.error('Failed to connect Gmail');
    }
  };

  const addCustomField = (isCompany = false) => {
    if (!customField.key || !customField.value) return;
    if (isCompany) {
      setCompanyForm({
        ...companyForm,
        custom_fields: { ...companyForm.custom_fields, [customField.key]: customField.value }
      });
    } else {
      setClientForm({
        ...clientForm,
        custom_fields: { ...clientForm.custom_fields, [customField.key]: customField.value }
      });
    }
    setCustomField({ key: '', value: '' });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div data-testid="clients-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Clients & Companies</h1>
          <p className="text-base text-muted-foreground">Manage your business relationships</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleConnectGmail}>
            <Inbox className="mr-2 h-4 w-4" />
            Connect Gmail
          </Button>
        </div>
      </div>

      <Tabs value={view} onValueChange={setView} className="space-y-6">
        <TabsList>
          <TabsTrigger value="clients">Contacts</TabsTrigger>
          <TabsTrigger value="companies">Companies</TabsTrigger>
        </TabsList>

        {/* CONTACTS TAB */}
        <TabsContent value="clients" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={isClientDialogOpen} onOpenChange={setIsClientDialogOpen}>
              <DialogTrigger asChild>
                <Button data-testid="create-client-button">
                  <UserPlus className="mr-2 h-4 w-4" />
                  New Contact
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Add New Contact</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateClient} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Contact Name *</label>
                    <Input value={clientForm.name} onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })} placeholder="Enter contact name" required />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Company</label>
                    <Select value={clientForm.company_id || '__none__'} onValueChange={(value) => setClientForm({ ...clientForm, company_id: value === '__none__' ? '' : value })}>
                      <SelectTrigger><SelectValue placeholder="Select company (optional)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {companies.map((company) => (
                          <SelectItem key={company.company_id} value={company.company_id}>{company.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Email</label>
                      <Input type="email" value={clientForm.email} onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })} placeholder="contact@example.com" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Phone</label>
                      <Input value={clientForm.phone} onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })} placeholder="+91 98765 43210" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Position</label>
                    <Input value={clientForm.position} onChange={(e) => setClientForm({ ...clientForm, position: e.target.value })} placeholder="e.g., CEO, Manager" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Business Address</label>
                    <Textarea value={clientForm.business_address} onChange={(e) => setClientForm({ ...clientForm, business_address: e.target.value })} placeholder="Full business address" rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">GST Number</label>
                      <Input value={clientForm.gst_number} onChange={(e) => setClientForm({ ...clientForm, gst_number: e.target.value })} placeholder="22AAAAA0000A1Z5" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">PAN Number</label>
                      <Input value={clientForm.pan_number} onChange={(e) => setClientForm({ ...clientForm, pan_number: e.target.value })} placeholder="AAAAA0000A" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Notes</label>
                    <Textarea value={clientForm.notes} onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })} placeholder="Additional notes" rows={2} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Custom Fields</label>
                    <div className="flex gap-2 mb-2">
                      <Input placeholder="Field name" value={customField.key} onChange={(e) => setCustomField({ ...customField, key: e.target.value })} />
                      <Input placeholder="Value" value={customField.value} onChange={(e) => setCustomField({ ...customField, value: e.target.value })} />
                      <Button type="button" onClick={() => addCustomField(false)}>Add</Button>
                    </div>
                    {Object.keys(clientForm.custom_fields).length > 0 && (
                      <div className="space-y-1">
                        {Object.entries(clientForm.custom_fields).map(([key, value]) => (
                          <div key={key} className="text-sm bg-muted p-2 rounded"><strong>{key}:</strong> {value}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsClientDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">Create Contact</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {clients.length === 0 ? (
            <Card className="p-12 text-center">
              <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-heading font-semibold mb-2">No contacts yet</h3>
              <p className="text-muted-foreground mb-6">Add your first contact to get started</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {clients.map((client) => (
                <Card key={client.client_id} className="p-6 hover:shadow-md transition-shadow cursor-pointer relative" data-testid={`client-card-${client.client_id}`}>
                  <div className="absolute top-4 right-4 flex gap-2">
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); handleEditClient(client); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); handleDeleteClient(client.client_id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div onClick={() => navigate(`/clients/${client.client_id}`)}>
                    <div className="flex items-start justify-between mb-4 pr-20">
                      <div className="flex-1">
                        <h3 className="text-xl font-heading font-semibold mb-2">{client.name}</h3>
                        {client.position && <p className="text-sm text-muted-foreground mb-2">{client.position}</p>}
                        {client.company_name && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                            <Building2 className="h-4 w-4" />{client.company_name}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      {client.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" /><span className="truncate">{client.email}</span>
                        </div>
                      )}
                      {client.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />{client.phone}
                        </div>
                      )}
                      {client.gst_number && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <FileText className="h-4 w-4" />GST: {client.gst_number}
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* COMPANIES TAB */}
        <TabsContent value="companies" className="space-y-6">
          <div className="flex justify-end">
            <Dialog open={isCompanyDialogOpen} onOpenChange={setIsCompanyDialogOpen}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />New Company</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Add New Company</DialogTitle></DialogHeader>
                <form onSubmit={handleCreateCompany} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Company Name *</label>
                    <Input value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })} placeholder="Enter company name" required />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Industry</label>
                      <Input value={companyForm.industry} onChange={(e) => setCompanyForm({ ...companyForm, industry: e.target.value })} placeholder="e.g., Technology, Finance" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Website</label>
                      <Input value={companyForm.website} onChange={(e) => setCompanyForm({ ...companyForm, website: e.target.value })} placeholder="https://example.com" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Phone</label>
                    <Input value={companyForm.phone} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })} placeholder="+91 98765 43210" />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Business Address</label>
                    <Textarea value={companyForm.business_address} onChange={(e) => setCompanyForm({ ...companyForm, business_address: e.target.value })} placeholder="Full business/registered address" rows={2} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">GST Number</label>
                      <Input value={companyForm.gst_number} onChange={(e) => setCompanyForm({ ...companyForm, gst_number: e.target.value })} placeholder="22AAAAA0000A1Z5" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">PAN Number</label>
                      <Input value={companyForm.pan_number} onChange={(e) => setCompanyForm({ ...companyForm, pan_number: e.target.value })} placeholder="AAAAA0000A" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Custom Fields</label>
                    <div className="flex gap-2 mb-2">
                      <Input placeholder="Field name" value={customField.key} onChange={(e) => setCustomField({ ...customField, key: e.target.value })} />
                      <Input placeholder="Value" value={customField.value} onChange={(e) => setCustomField({ ...customField, value: e.target.value })} />
                      <Button type="button" onClick={() => addCustomField(true)}>Add</Button>
                    </div>
                    {Object.keys(companyForm.custom_fields).length > 0 && (
                      <div className="space-y-1">
                        {Object.entries(companyForm.custom_fields).map(([key, value]) => (
                          <div key={key} className="text-sm bg-muted p-2 rounded"><strong>{key}:</strong> {value}</div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={() => setIsCompanyDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">Create Company</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          {companies.length === 0 ? (
            <Card className="p-12 text-center">
              <Building2 className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-heading font-semibold mb-2">No companies yet</h3>
              <p className="text-muted-foreground mb-6">Add your first company to get started</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {companies.map((company) => {
                const companyClients = clients.filter(c => c.company_id === company.company_id);
                return (
                  <Card key={company.company_id} className="p-6 hover:shadow-md transition-shadow relative">
                    <div className="absolute top-4 right-4 flex gap-2">
                      <Button size="icon" variant="ghost" onClick={() => handleEditCompany(company)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDeleteCompany(company.company_id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                    <div>
                      <h3 className="text-xl font-heading font-semibold mb-2 pr-20">{company.name}</h3>
                      {company.industry && <p className="text-sm text-muted-foreground mb-2">{company.industry}</p>}
                      {company.website && (
                        <a href={company.website} target="_blank" rel="noopener noreferrer" className="text-sm text-accent hover:underline block mb-2">
                          {company.website}
                        </a>
                      )}
                      {company.business_address && (
                        <div className="flex items-start gap-2 text-sm text-muted-foreground mb-2">
                          <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <span>{company.business_address}</span>
                        </div>
                      )}
                      {company.gst_number && (
                        <div className="text-sm text-muted-foreground mb-1">
                          <strong>GST:</strong> {company.gst_number}
                        </div>
                      )}
                      {company.pan_number && (
                        <div className="text-sm text-muted-foreground mb-2">
                          <strong>PAN:</strong> {company.pan_number}
                        </div>
                      )}
                      <div className="mt-4 pt-4 border-t">
                        <p className="text-sm text-muted-foreground">
                          {companyClients.length} contact{companyClients.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Client Dialog */}
      {editingClient && (
        <Dialog open={isEditClientDialogOpen} onOpenChange={setIsEditClientDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Contact</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Contact Name</label>
                <Input value={editingClient.name} onChange={(e) => setEditingClient({ ...editingClient, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Email</label>
                  <Input value={editingClient.email || ''} onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Phone</label>
                  <Input value={editingClient.phone || ''} onChange={(e) => setEditingClient({ ...editingClient, phone: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Position</label>
                <Input value={editingClient.position || ''} onChange={(e) => setEditingClient({ ...editingClient, position: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Business Address</label>
                <Textarea value={editingClient.business_address || ''} onChange={(e) => setEditingClient({ ...editingClient, business_address: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">GST Number</label>
                  <Input value={editingClient.gst_number || ''} onChange={(e) => setEditingClient({ ...editingClient, gst_number: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">PAN Number</label>
                  <Input value={editingClient.pan_number || ''} onChange={(e) => setEditingClient({ ...editingClient, pan_number: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Notes</label>
                <Textarea value={editingClient.notes || ''} onChange={(e) => setEditingClient({ ...editingClient, notes: e.target.value })} rows={2} />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditClientDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleUpdateClient}>Save Changes</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Edit Company Dialog */}
      {editingCompany && (
        <Dialog open={isEditCompanyDialogOpen} onOpenChange={setIsEditCompanyDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Edit Company</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Company Name</label>
                <Input value={editingCompany.name} onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Industry</label>
                  <Input value={editingCompany.industry || ''} onChange={(e) => setEditingCompany({ ...editingCompany, industry: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Website</label>
                  <Input value={editingCompany.website || ''} onChange={(e) => setEditingCompany({ ...editingCompany, website: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Phone</label>
                <Input value={editingCompany.phone || ''} onChange={(e) => setEditingCompany({ ...editingCompany, phone: e.target.value })} />
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Business Address</label>
                <Textarea value={editingCompany.business_address || ''} onChange={(e) => setEditingCompany({ ...editingCompany, business_address: e.target.value })} rows={2} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">GST Number</label>
                  <Input value={editingCompany.gst_number || ''} onChange={(e) => setEditingCompany({ ...editingCompany, gst_number: e.target.value })} />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">PAN Number</label>
                  <Input value={editingCompany.pan_number || ''} onChange={(e) => setEditingCompany({ ...editingCompany, pan_number: e.target.value })} />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsEditCompanyDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleUpdateCompany}>Save Changes</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};
