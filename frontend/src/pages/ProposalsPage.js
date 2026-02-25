import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Plus, FileText, Check, HardDrive, Send, Eye, ChevronRight, LayoutGrid, List, ArrowUpDown, MoreVertical, UserCheck, Mail, CheckCircle, FolderOpen } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu';
import { toast } from 'sonner';

const categories = [
  'Individual - Residential',
  'Housing',
  'Commercial',
  'Institutional',
  'Hospitality'
];

export const ProposalsPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState(() => localStorage.getItem('proposalsViewMode') || 'tile');
  const [sortField, setSortField] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDriveDialogOpen, setIsDriveDialogOpen] = useState(false);
  const [isSendDialogOpen, setIsSendDialogOpen] = useState(false);
  const [isApprovalDialogOpen, setIsApprovalDialogOpen] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedApprover, setSelectedApprover] = useState('');
  const [driveFiles, setDriveFiles] = useState([]);
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    client_name: '',
    description: '',
    amount: '',
    category: '',
    requirement: '',
    scope_area: ''
  });

  useEffect(() => {
    localStorage.setItem('proposalsViewMode', viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (searchParams.get('drive_connected') === 'true') {
      toast.success('Google Drive connected successfully');
    }
  }, [searchParams]);

  const fetchProposals = async () => {
    try {
      const [proposalsRes, teamRes] = await Promise.all([
        axios.get(`${API_URL}/proposals`, { withCredentials: true }),
        axios.get(`${API_URL}/team`, { withCredentials: true })
      ]);
      setProposals(proposalsRes.data);
      setTeamMembers(teamRes.data);
    } catch (error) {
      toast.error('Failed to load proposals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProposals();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_URL}/proposals`, {
        ...formData,
        amount: formData.amount ? parseFloat(formData.amount) : null
      }, { withCredentials: true });
      toast.success('Proposal created successfully');
      setIsDialogOpen(false);
      setFormData({ title: '', client_name: '', description: '', amount: '', category: '', requirement: '', scope_area: '' });
      fetchProposals();
    } catch (error) {
      toast.error('Failed to create proposal');
    }
  };

  const handleApprove = async (proposalId) => {
    try {
      await axios.post(`${API_URL}/proposals/${proposalId}/approve`, {}, { withCredentials: true });
      toast.success('Proposal approved');
      fetchProposals();
    } catch (error) {
      toast.error('Failed to approve proposal');
    }
  };

  const handleSendForApproval = async () => {
    if (!selectedApprover) {
      toast.error('Please select an approver');
      return;
    }
    try {
      await axios.post(
        `${API_URL}/proposals/${selectedProposal.proposal_id}/send-for-internal-approval`,
        null,
        { params: { approver_id: selectedApprover }, withCredentials: true }
      );
      toast.success('Proposal sent for approval');
      setIsApprovalDialogOpen(false);
      setSelectedApprover('');
      fetchProposals();
    } catch (error) {
      toast.error('Failed to send for approval');
    }
  };

  const handleSendToClient = async (proposalId) => {
    try {
      await axios.patch(`${API_URL}/proposals/${proposalId}`, { status: 'sent_to_client' }, { withCredentials: true });
      toast.success('Proposal sent to client');
      fetchProposals();
    } catch (error) {
      toast.error('Failed to update proposal status');
    }
  };

  const handleConfirmProposal = async () => {
    try {
      await axios.post(`${API_URL}/proposals/${selectedProposal.proposal_id}/confirm`, {}, { withCredentials: true });
      toast.success('Proposal confirmed');
      setIsConfirmDialogOpen(false);
      fetchProposals();
    } catch (error) {
      toast.error('Failed to confirm proposal');
    }
  };

  const handleConvert = async (proposalId) => {
    try {
      await axios.post(`${API_URL}/proposals/${proposalId}/convert`, {}, { withCredentials: true });
      toast.success('Proposal converted to project');
      fetchProposals();
    } catch (error) {
      toast.error('Failed to convert proposal');
    }
  };

  const handleConnectDrive = async () => {
    try {
      const response = await axios.get(`${API_URL}/drive/connect`, { withCredentials: true });
      window.location.href = response.data.authorization_url;
    } catch (error) {
      toast.error('Failed to connect Google Drive');
    }
  };

  const handleOpenDrivePicker = async (proposal) => {
    setSelectedProposal(proposal);
    try {
      const response = await axios.get(`${API_URL}/drive/files`, { withCredentials: true });
      setDriveFiles(response.data.files);
      setIsDriveDialogOpen(true);
    } catch (error) {
      if (error.response?.status === 400) {
        toast.error('Please connect Google Drive first');
        return;
      }
      toast.error('Failed to load Drive files');
    }
  };

  const handleAttachDriveFile = async (file) => {
    try {
      await axios.patch(`${API_URL}/proposals/${selectedProposal.proposal_id}`, {
        drive_file_id: file.id,
        drive_file_name: file.name,
        drive_file_link: file.webViewLink
      }, { withCredentials: true });
      toast.success('Document attached from Drive');
      setIsDriveDialogOpen(false);
      fetchProposals();
    } catch (error) {
      toast.error('Failed to attach document');
    }
  };

  const handleSendForSignature = async () => {
    if (!recipientEmail) {
      toast.error('Please enter recipient email');
      return;
    }
    
    try {
      const response = await axios.post(
        `${API_URL}/proposals/${selectedProposal.proposal_id}/send-for-signature`,
        null,
        {
          params: { recipient_email: recipientEmail },
          withCredentials: true
        }
      );
      
      if (response.data.demo_mode) {
        toast.success('Proposal sent for signature (Demo Mode)');
      } else {
        toast.success('Proposal sent for signature');
      }
      
      setIsSendDialogOpen(false);
      setRecipientEmail('');
      fetchProposals();
    } catch (error) {
      toast.error('Failed to send proposal');
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      draft: 'bg-muted text-foreground',
      pending_approval: 'bg-yellow-500/20 text-yellow-600',
      approved: 'bg-chart-4/20 text-chart-4',
      sent_to_client: 'bg-blue-500/20 text-blue-600',
      signed: 'bg-green-500/20 text-green-600',
      converted: 'bg-chart-1/20 text-chart-1',
      rejected: 'bg-destructive/20 text-destructive'
    };
    return colors[status] || 'bg-muted';
  };

  const sortedProposals = [...proposals].sort((a, b) => {
    let aVal = a[sortField];
    let bVal = b[sortField];
    if (sortField === 'amount') {
      aVal = aVal || 0;
      bVal = bVal || 0;
    }
    if (sortOrder === 'asc') {
      return aVal > bVal ? 1 : -1;
    }
    return aVal < bVal ? 1 : -1;
  });

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div data-testid="proposals-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Proposals</h1>
          <p className="text-base text-muted-foreground">Create and manage client proposals</p>
        </div>
        <div className="flex gap-2">
          <div className="flex border rounded-md">
            <Button 
              variant={viewMode === 'tile' ? 'default' : 'ghost'} 
              size="sm" 
              className="rounded-r-none"
              onClick={() => setViewMode('tile')}
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button 
              variant={viewMode === 'list' ? 'default' : 'ghost'} 
              size="sm" 
              className="rounded-l-none"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
          <Button variant="outline" onClick={handleConnectDrive}>
            <HardDrive className="mr-2 h-4 w-4" />
            Connect Drive
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="create-proposal-button">
                <Plus className="mr-2 h-4 w-4" />
                New Proposal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Create New Proposal</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Proposal Title</label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Enter proposal title"
                    required
                    data-testid="proposal-title-input"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Client Name</label>
                    <Input
                      value={formData.client_name}
                      onChange={(e) => setFormData({ ...formData, client_name: e.target.value })}
                      placeholder="Client name"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Category</label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Requirement</label>
                  <Textarea
                    value={formData.requirement}
                    onChange={(e) => setFormData({ ...formData, requirement: e.target.value })}
                    placeholder="What does the client need?"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Scope / Area to be Worked On</label>
                  <Textarea
                    value={formData.scope_area}
                    onChange={(e) => setFormData({ ...formData, scope_area: e.target.value })}
                    placeholder="Define the scope and area"
                    rows={2}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Description</label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Proposal description"
                    required
                    rows={3}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Amount</label>
                  <Input
                    type="number"
                    value={formData.amount}
                    onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                    placeholder="0.00"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" data-testid="submit-proposal-button">
                    Create Proposal
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Google Drive File Picker Dialog */}
      <Dialog open={isDriveDialogOpen} onOpenChange={setIsDriveDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Attach Document from Google Drive</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {driveFiles.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No documents found in Drive</p>
            ) : (
              driveFiles.map((file) => (
                <Card
                  key={file.id}
                  className="p-4 hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => handleAttachDriveFile(file)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium">{file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : ''}
                        </p>
                      </div>
                    </div>
                    <Button size="sm" variant="ghost">
                      Select
                    </Button>
                  </div>
                </Card>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Send for Signature Dialog */}
      <Dialog open={isSendDialogOpen} onOpenChange={setIsSendDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send for Signature</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Recipient Email</label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="client@example.com"
                required
              />
            </div>
            <p className="text-sm text-muted-foreground">
              The proposal will be sent to this email address for electronic signature.
              {!process.env.REACT_APP_ZOHO_ENABLED && ' (Demo Mode - No actual signature required)'}
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsSendDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendForSignature}>
                <Send className="mr-2 h-4 w-4" />
                Send
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Send for Approval Dialog */}
      <Dialog open={isApprovalDialogOpen} onOpenChange={setIsApprovalDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send for Internal Approval</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Approver</label>
              <Select value={selectedApprover} onValueChange={setSelectedApprover}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose an approver" />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.filter(m => ['admin', 'manager'].includes(m.role)).map((member) => (
                    <SelectItem key={member.user_id} value={member.user_id}>
                      {member.name} ({member.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">
              The proposal will be sent to the selected approver for review before being sent to the client.
            </p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsApprovalDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSendForApproval}>
                <UserCheck className="mr-2 h-4 w-4" />
                Send for Approval
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirm Proposal Dialog */}
      <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Proposal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm">
              Are you sure you want to confirm this proposal? This indicates that the client has accepted the proposal.
            </p>
            {selectedProposal && (
              <div className="p-4 bg-muted rounded-lg">
                <p className="font-semibold">{selectedProposal.title}</p>
                <p className="text-sm text-muted-foreground">{selectedProposal.client_name}</p>
                {selectedProposal.amount && (
                  <p className="text-lg font-mono mt-2">${selectedProposal.amount.toLocaleString()}</p>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleConfirmProposal} className="bg-green-600 hover:bg-green-700">
                <CheckCircle className="mr-2 h-4 w-4" />
                Confirm Proposal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {proposals.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-heading font-semibold mb-2">No proposals yet</h3>
          <p className="text-muted-foreground mb-6">Create your first proposal to get started</p>
        </Card>
      ) : viewMode === 'list' ? (
        /* List View */
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-4 font-medium cursor-pointer hover:bg-muted" onClick={() => toggleSort('title')}>
                    <div className="flex items-center gap-2">Title <ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                  <th className="text-left p-4 font-medium cursor-pointer hover:bg-muted" onClick={() => toggleSort('client_name')}>
                    <div className="flex items-center gap-2">Client <ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                  <th className="text-left p-4 font-medium">Category</th>
                  <th className="text-left p-4 font-medium cursor-pointer hover:bg-muted" onClick={() => toggleSort('status')}>
                    <div className="flex items-center gap-2">Status <ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                  <th className="text-left p-4 font-medium cursor-pointer hover:bg-muted" onClick={() => toggleSort('amount')}>
                    <div className="flex items-center gap-2">Amount <ArrowUpDown className="h-3 w-3" /></div>
                  </th>
                  <th className="text-left p-4 font-medium">Version</th>
                  <th className="text-right p-4 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sortedProposals.map((proposal) => (
                  <tr 
                    key={proposal.proposal_id} 
                    className="border-b hover:bg-muted/30 cursor-pointer transition-colors"
                    onClick={() => navigate(`/proposals/${proposal.proposal_id}`)}
                    data-testid={`proposal-row-${proposal.proposal_id}`}
                  >
                    <td className="p-4">
                      <p className="font-medium">{proposal.title}</p>
                    </td>
                    <td className="p-4 text-muted-foreground">{proposal.client_name}</td>
                    <td className="p-4 text-sm text-muted-foreground">{proposal.category || '-'}</td>
                    <td className="p-4">
                      <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(proposal.status)}`}>
                        {proposal.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 font-mono">{proposal.amount ? `$${proposal.amount.toLocaleString()}` : '-'}</td>
                    <td className="p-4 text-sm text-muted-foreground">v{proposal.version || 1}</td>
                    <td className="p-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" data-testid={`actions-${proposal.proposal_id}`}>
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/proposals/${proposal.proposal_id}`)}>
                            <Eye className="mr-2 h-4 w-4" />
                            View Details
                          </DropdownMenuItem>
                          
                          {proposal.status === 'draft' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                setSelectedProposal(proposal);
                                setIsApprovalDialogOpen(true);
                              }}>
                                <UserCheck className="mr-2 h-4 w-4" />
                                Send for Approval
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          {proposal.status === 'approved' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                setSelectedProposal(proposal);
                                setIsSendDialogOpen(true);
                              }}>
                                <Mail className="mr-2 h-4 w-4" />
                                Send to Client
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleConvert(proposal.proposal_id)}>
                                <FolderOpen className="mr-2 h-4 w-4" />
                                Convert to Project
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          {proposal.status === 'sent_to_client' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => {
                                setSelectedProposal(proposal);
                                setIsConfirmDialogOpen(true);
                              }}>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Confirm Proposal
                              </DropdownMenuItem>
                            </>
                          )}
                          
                          {['confirmed', 'signed'].includes(proposal.status) && !proposal.project_id && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleConvert(proposal.proposal_id)}>
                                <FolderOpen className="mr-2 h-4 w-4" />
                                Convert to Project
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        /* Tile View */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedProposals.map((proposal) => (
            <Card 
              key={proposal.proposal_id} 
              className="p-6 hover:shadow-md transition-shadow cursor-pointer" 
              data-testid={`proposal-card-${proposal.proposal_id}`}
              onClick={() => navigate(`/proposals/${proposal.proposal_id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-xl font-heading font-semibold">{proposal.title}</h3>
                    <span className="text-xs text-muted-foreground">v{proposal.version || 1}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-1">Client: {proposal.client_name}</p>
                  {proposal.category && (
                    <p className="text-xs text-muted-foreground">{proposal.category}</p>
                  )}
                </div>
                <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(proposal.status)}`}>
                  {proposal.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{proposal.description}</p>
              
              {proposal.drive_file_name && (
                <div className="mb-4 p-2 bg-muted rounded flex items-center gap-2">
                  <FileText className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs truncate">{proposal.drive_file_name}</span>
                  {proposal.drive_file_link && (
                    <a href={proposal.drive_file_link} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      <Eye className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </a>
                  )}
                </div>
              )}
              
              {proposal.amount && (
                <div className="mb-4 pb-4 border-b">
                  <p className="text-sm text-muted-foreground">Proposed Amount</p>
                  <p className="text-lg font-mono font-semibold">${proposal.amount.toLocaleString()}</p>
                </div>
              )}
              
              <div className="flex items-center justify-between">
                <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
                  {proposal.status === 'draft' && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenDrivePicker(proposal)}
                    >
                      <HardDrive className="mr-1 h-3 w-3" />
                      Attach
                    </Button>
                  )}
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" data-testid={`tile-actions-${proposal.proposal_id}`}>
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => navigate(`/proposals/${proposal.proposal_id}`)}>
                        <Eye className="mr-2 h-4 w-4" />
                        View Details
                      </DropdownMenuItem>
                      
                      {proposal.status === 'draft' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => {
                            setSelectedProposal(proposal);
                            setIsApprovalDialogOpen(true);
                          }}>
                            <UserCheck className="mr-2 h-4 w-4" />
                            Send for Approval
                          </DropdownMenuItem>
                        </>
                      )}
                      
                      {proposal.status === 'approved' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => {
                            setSelectedProposal(proposal);
                            setIsSendDialogOpen(true);
                          }}>
                            <Mail className="mr-2 h-4 w-4" />
                            Send to Client
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleConvert(proposal.proposal_id)}>
                            <FolderOpen className="mr-2 h-4 w-4" />
                            Convert to Project
                          </DropdownMenuItem>
                        </>
                      )}
                      
                      {proposal.status === 'sent_to_client' && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => {
                            setSelectedProposal(proposal);
                            setIsConfirmDialogOpen(true);
                          }}>
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Confirm Proposal
                          </DropdownMenuItem>
                        </>
                      )}
                      
                      {['confirmed', 'signed'].includes(proposal.status) && !proposal.project_id && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => handleConvert(proposal.proposal_id)}>
                            <FolderOpen className="mr-2 h-4 w-4" />
                            Convert to Project
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
