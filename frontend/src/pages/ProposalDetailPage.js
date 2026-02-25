import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { ArrowLeft, Edit, Send, Check, X, FileText, MessageSquare, History, RotateCcw, Clock } from 'lucide-react';
import { toast } from 'sonner';

const categories = [
  'Individual - Residential',
  'Housing',
  'Commercial',
  'Institutional',
  'Hospitality'
];

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'pending_approval', label: 'Pending Approval' },
  { value: 'approved', label: 'Approved' },
  { value: 'sent_to_client', label: 'Sent to Client' },
  { value: 'signed', label: 'Signed' },
  { value: 'converted', label: 'Converted' },
  { value: 'rejected', label: 'Rejected' }
];

export const ProposalDetailPage = () => {
  const { proposalId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [proposal, setProposal] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isApproverDialog, setIsApproverDialog] = useState(false);
  const [isSendDialog, setIsSendDialog] = useState(false);
  const [isManualApprovalDialog, setIsManualApprovalDialog] = useState(false);
  const [isVersionHistoryOpen, setIsVersionHistoryOpen] = useState(false);
  const [versionHistory, setVersionHistory] = useState([]);
  const [editForm, setEditForm] = useState({});
  const [selectedApprover, setSelectedApprover] = useState('');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [approverComments, setApproverComments] = useState('');
  const [manualApprovalDate, setManualApprovalDate] = useState(new Date().toISOString().split('T')[0]);
  const [editingField, setEditingField] = useState(null);
  const [fieldValue, setFieldValue] = useState('');

  const fetchProposal = async () => {
    try {
      const [proposalRes, teamRes] = await Promise.all([
        axios.get(`${API_URL}/proposals/${proposalId}`, { withCredentials: true }),
        axios.get(`${API_URL}/team`, { withCredentials: true })
      ]);
      setProposal(proposalRes.data);
      setEditForm(proposalRes.data);
      setTeamMembers(teamRes.data);
    } catch (error) {
      toast.error('Failed to load proposal');
    } finally {
      setLoading(false);
    }
  };

  const fetchVersionHistory = async () => {
    try {
      const res = await axios.get(`${API_URL}/proposals/${proposalId}/versions`, { withCredentials: true });
      setVersionHistory(res.data.version_history || []);
      setIsVersionHistoryOpen(true);
    } catch (error) {
      toast.error('Failed to load version history');
    }
  };

  const handleRestoreVersion = async (versionNumber) => {
    try {
      await axios.post(`${API_URL}/proposals/${proposalId}/restore-version/${versionNumber}`, {}, { withCredentials: true });
      toast.success(`Restored to version ${versionNumber}`);
      setIsVersionHistoryOpen(false);
      fetchProposal();
    } catch (error) {
      toast.error('Failed to restore version');
    }
  };

  useEffect(() => {
    fetchProposal();
  }, [proposalId]);

  const handleUpdate = async () => {
    try {
      const res = await axios.patch(`${API_URL}/proposals/${proposalId}`, editForm, { withCredentials: true });
      toast.success(`Proposal updated (v${res.data.version})`);
      setIsEditing(false);
      fetchProposal();
    } catch (error) {
      toast.error('Failed to update proposal');
    }
  };

  const handleInlineEdit = async (field, value) => {
    try {
      const res = await axios.patch(`${API_URL}/proposals/${proposalId}`, { [field]: value }, { withCredentials: true });
      toast.success('Updated');
      setEditingField(null);
      fetchProposal();
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const startInlineEdit = (field, currentValue) => {
    setEditingField(field);
    setFieldValue(currentValue || '');
  };

  const handleSendForInternalApproval = async () => {
    try {
      await axios.post(
        `${API_URL}/proposals/${proposalId}/send-for-internal-approval`,
        null,
        { params: { approver_id: selectedApprover }, withCredentials: true }
      );
      toast.success('Sent for internal approval');
      setIsApproverDialog(false);
      fetchProposal();
    } catch (error) {
      toast.error('Failed to send for approval');
    }
  };

  const handleApprove = async () => {
    try {
      await axios.post(
        `${API_URL}/proposals/${proposalId}/approve-internal`,
        null,
        { params: { comments: approverComments }, withCredentials: true }
      );
      toast.success('Proposal approved');
      fetchProposal();
    } catch (error) {
      toast.error('Failed to approve');
    }
  };

  const handleReturn = async () => {
    try {
      await axios.post(
        `${API_URL}/proposals/${proposalId}/return-to-sender`,
        null,
        { params: { comments: approverComments }, withCredentials: true }
      );
      toast.success('Proposal returned to sender');
      fetchProposal();
    } catch (error) {
      toast.error('Failed to return proposal');
    }
  };

  const handleSendToClient = async (useZohoSign) => {
    try {
      if (useZohoSign) {
        await axios.post(
          `${API_URL}/proposals/${proposalId}/send-for-signature`,
          null,
          { params: { recipient_email: recipientEmail }, withCredentials: true }
        );
        toast.success('Sent to client via Zoho Sign');
      } else {
        // Manual approval flow
        setIsManualApprovalDialog(true);
        return;
      }
      setIsSendDialog(false);
      fetchProposal();
    } catch (error) {
      toast.error('Failed to send to client');
    }
  };

  const handleManualApproval = async () => {
    try {
      await axios.post(
        `${API_URL}/proposals/${proposalId}/manual-approval`,
        null,
        { params: { approval_date: manualApprovalDate }, withCredentials: true }
      );
      toast.success('Manual approval recorded');
      setIsManualApprovalDialog(false);
      setIsSendDialog(false);
      fetchProposal();
    } catch (error) {
      toast.error('Failed to record approval');
    }
  };

  const handleReject = async () => {
    if (!window.confirm('Are you sure you want to reject this proposal?')) return;
    try {
      await axios.post(
        `${API_URL}/proposals/${proposalId}/reject`,
        null,
        { params: { reason: approverComments }, withCredentials: true }
      );
      toast.success('Proposal rejected');
      fetchProposal();
    } catch (error) {
      toast.error('Failed to reject');
    }
  };

  const handleConvert = async () => {
    try {
      await axios.post(`${API_URL}/proposals/${proposalId}/convert`, {}, { withCredentials: true });
      toast.success('Converted to project');
      navigate('/projects');
    } catch (error) {
      toast.error('Failed to convert');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  if (!proposal) {
    return <Card className="p-12 text-center"><p className="text-muted-foreground">Proposal not found</p></Card>;
  }

  const isCreator = proposal.created_by === user?.user_id;
  const isApprover = proposal.approver_id === user?.user_id;
  const canEdit = isCreator && ['draft', 'returned'].includes(proposal.status);
  const canApprove = isApprover && proposal.status === 'pending_approval';

  const InlineEditField = ({ field, value, label, multiline = false }) => {
    if (editingField === field) {
      return (
        <div className="flex gap-2 items-start">
          {multiline ? (
            <Textarea
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              className="flex-1"
              rows={3}
              autoFocus
            />
          ) : (
            <Input
              value={fieldValue}
              onChange={(e) => setFieldValue(e.target.value)}
              className="flex-1"
              autoFocus
            />
          )}
          <Button size="sm" onClick={() => handleInlineEdit(field, fieldValue)}><Check className="h-4 w-4" /></Button>
          <Button size="sm" variant="ghost" onClick={() => setEditingField(null)}><X className="h-4 w-4" /></Button>
        </div>
      );
    }
    return (
      <div 
        className={`group ${canEdit ? 'cursor-pointer hover:bg-muted/50' : ''} p-2 -m-2 rounded`}
        onClick={() => canEdit && startInlineEdit(field, value)}
      >
        <p className="text-sm">{value || <span className="text-muted-foreground italic">Click to add</span>}</p>
        {canEdit && <Edit className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 inline ml-2" />}
      </div>
    );
  };

  return (
    <div data-testid="proposal-detail-page">
      <div className="mb-6">
        <Button variant="ghost" onClick={() => navigate('/proposals')} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Proposals
        </Button>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-4xl font-heading font-bold tracking-tight">{proposal.title}</h1>
              <span className="text-sm text-muted-foreground bg-muted px-2 py-1 rounded">v{proposal.version || 1}</span>
            </div>
            <p className="text-lg text-muted-foreground">{proposal.client_name}</p>
          </div>
          <div className="flex gap-2 items-start">
            <Button variant="outline" size="sm" onClick={fetchVersionHistory}>
              <History className="mr-2 h-4 w-4" />
              History
            </Button>
            <span className="px-3 py-1 text-sm font-semibold rounded-full bg-chart-2/20 text-chart-2">
              {proposal.status.replace('_', ' ').toUpperCase()}
            </span>
            {proposal.category && (
              <span className="px-3 py-1 text-sm font-semibold rounded-full bg-muted">
                {proposal.category}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Version History Dialog */}
      <Dialog open={isVersionHistoryOpen} onOpenChange={setIsVersionHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-primary/10 rounded-lg border-2 border-primary">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold">Current Version (v{proposal.version || 1})</span>
                <span className="text-xs text-muted-foreground">Active</span>
              </div>
              <p className="text-sm text-muted-foreground">{proposal.title}</p>
            </div>
            {versionHistory.length === 0 ? (
              <p className="text-center text-muted-foreground py-4">No previous versions</p>
            ) : (
              versionHistory.slice().reverse().map((version, index) => (
                <div key={index} className="p-4 bg-muted/50 rounded-lg">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Version {version.version}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">
                        {new Date(version.saved_at).toLocaleString()}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => handleRestoreVersion(version.version)}>
                        <RotateCcw className="mr-1 h-3 w-3" />
                        Restore
                      </Button>
                    </div>
                  </div>
                  <p className="text-sm font-medium">{version.title}</p>
                  {version.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{version.description}</p>
                  )}
                  {version.amount && (
                    <p className="text-sm text-muted-foreground mt-1">Amount: ${version.amount.toLocaleString()}</p>
                  )}
                  {version.note && (
                    <p className="text-xs text-yellow-600 mt-1">{version.note}</p>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {isEditing ? (
        <Card className="p-6 space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">Title</label>
            <Input
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Category</label>
            <Select value={editForm.category} onValueChange={(value) => setEditForm({ ...editForm, category: value })}>
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
          <div>
            <label className="text-sm font-medium mb-2 block">Requirement</label>
            <Textarea
              value={editForm.requirement || ''}
              onChange={(e) => setEditForm({ ...editForm, requirement: e.target.value })}
              rows={3}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Scope/Area to be Built/Worked On</label>
            <Textarea
              value={editForm.scope_area || ''}
              onChange={(e) => setEditForm({ ...editForm, scope_area: e.target.value })}
              rows={3}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Final Proposal</label>
            <Textarea
              value={editForm.final_proposal || ''}
              onChange={(e) => setEditForm({ ...editForm, final_proposal: e.target.value })}
              rows={4}
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Amount</label>
            <Input
              type="number"
              value={editForm.amount || ''}
              onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <Button onClick={handleUpdate}>Save Changes</Button>
            <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
            <Card className="lg:col-span-2 p-6 space-y-6">
              <div>
                <h3 className="text-lg font-heading font-semibold mb-2">Requirement</h3>
                <InlineEditField field="requirement" value={proposal.requirement} multiline />
              </div>
              <div>
                <h3 className="text-lg font-heading font-semibold mb-2">Scope/Area</h3>
                <InlineEditField field="scope_area" value={proposal.scope_area} multiline />
              </div>
              {(proposal.final_proposal || canEdit) && (
                <div>
                  <h3 className="text-lg font-heading font-semibold mb-2">Final Proposal</h3>
                  <p className="text-muted-foreground whitespace-pre-wrap">{proposal.final_proposal}</p>
                </div>
              )}
              <div>
                <h3 className="text-lg font-heading font-semibold mb-2">Description</h3>
                <p className="text-muted-foreground">{proposal.description}</p>
              </div>
            </Card>

            <div className="space-y-6">
              <Card className="p-6">
                <h3 className="text-lg font-heading font-semibold mb-4">Details</h3>
                {proposal.amount && (
                  <div className="mb-4">
                    <p className="text-sm text-muted-foreground">Amount</p>
                    <p className="text-2xl font-heading font-bold">${proposal.amount.toLocaleString()}</p>
                  </div>
                )}
                {proposal.approver_comments && (
                  <div className="mt-4 p-3 bg-muted rounded">
                    <p className="text-sm font-medium mb-1">Approver Comments</p>
                    <p className="text-sm text-muted-foreground">{proposal.approver_comments}</p>
                  </div>
                )}
              </Card>

              <Card className="p-6">
                <h3 className="text-lg font-heading font-semibold mb-4">Actions</h3>
                <div className="space-y-2">
                  {canEdit && (
                    <>
                      <Button className="w-full" onClick={() => setIsEditing(true)}>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Proposal
                      </Button>
                      {proposal.status === 'draft' && (
                        <Button className="w-full" variant="outline" onClick={() => setIsApproverDialog(true)}>
                          <Send className="mr-2 h-4 w-4" />
                          Send for Internal Approval
                        </Button>
                      )}
                    </>
                  )}
                  {canApprove && (
                    <>
                      <Button className="w-full" onClick={handleApprove}>
                        <Check className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button className="w-full" variant="outline" onClick={() => setApproverComments('')}>
                        <MessageSquare className="mr-2 h-4 w-4" />
                        Return with Comments
                      </Button>
                      <Button className="w-full" variant="destructive" onClick={handleReject}>
                        <X className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </>
                  )}
                  {proposal.status === 'approved' && isCreator && (
                    <Button className="w-full" onClick={() => setIsSendDialog(true)}>
                      <Send className="mr-2 h-4 w-4" />
                      Send to Client
                    </Button>
                  )}
                  {proposal.status === 'signed' && (
                    <Button className="w-full" onClick={handleConvert}>
                      <FileText className="mr-2 h-4 w-4" />
                      Convert to Project
                    </Button>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </>
      )}

      {/* Dialogs */}
      <Dialog open={isApproverDialog} onOpenChange={setIsApproverDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send for Internal Approval</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Select Approver</label>
              <Select value={selectedApprover} onValueChange={setSelectedApprover}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose approver" />
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
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsApproverDialog(false)}>Cancel</Button>
              <Button onClick={handleSendForInternalApproval}>Send</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isSendDialog} onOpenChange={setIsSendDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send to Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Client Email</label>
              <Input
                type="email"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
                placeholder="client@example.com"
              />
            </div>
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => handleSendToClient(true)}>
                <Send className="mr-2 h-4 w-4" />
                Zoho Sign
              </Button>
              <Button className="flex-1" variant="outline" onClick={() => handleSendToClient(false)}>
                Manual Approval
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={isManualApprovalDialog} onOpenChange={setIsManualApprovalDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Manual Approval</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Approval Date</label>
              <Input
                type="date"
                value={manualApprovalDate}
                onChange={(e) => setManualApprovalDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setIsManualApprovalDialog(false)}>Cancel</Button>
              <Button onClick={handleManualApproval}>Record Approval</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};
