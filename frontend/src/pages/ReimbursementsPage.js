import React, { useEffect, useState, useRef } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Check, X, Calendar, User, Trash2, Plus, Upload, FileText, Image, ExternalLink, FolderKanban, Building } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const reimbursementCategories = [
  { id: 'travel', label: 'Travel' },
  { id: 'equipment', label: 'Equipment' },
  { id: 'office_supplies', label: 'Office Supplies' },
  { id: 'client_entertainment', label: 'Client Entertainment' },
  { id: 'other', label: 'Other' }
];

const statusColors = {
  pending: 'bg-amber-500/20 text-amber-600 border-amber-500/30',
  approved: 'bg-green-500/20 text-green-600 border-green-500/30',
  rejected: 'bg-red-500/20 text-red-600 border-red-500/30',
  paid: 'bg-blue-500/20 text-blue-600 border-blue-500/30'
};

const formatCurrency = (amount) => {
  return `INR ${new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0
  }).format(amount)}`;
};

export const ReimbursementsPage = () => {
  const { user } = useAuth();
  const [reimbursements, setReimbursements] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isReimbursementDialogOpen, setIsReimbursementDialogOpen] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(null);
  const fileInputRef = useRef(null);

  const [reimbursementForm, setReimbursementForm] = useState({
    category: '',
    amount: '',
    description: '',
    date: new Date().toISOString().split('T')[0],
    project_id: '',
    expense_type: 'internal' // 'internal' or 'project'
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);

  const canApprove = ['admin', 'manager', 'supervisor'].includes(user?.role);
  const canMarkPaid = ['admin', 'finance'].includes(user?.role);

  const fetchData = async () => {
    try {
      const [reimbursementsRes, projectsRes] = await Promise.all([
        axios.get(`${API_URL}/reimbursements`, { withCredentials: true }),
        axios.get(`${API_URL}/projects`, { withCredentials: true })
      ]);
      setReimbursements(reimbursementsRes.data);
      setProjects(projectsRes.data);
    } catch (error) {
      toast.error('Failed to load reimbursements');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, and PDF files are allowed');
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB');
      return;
    }

    setSelectedFile(file);

    // Create preview for images
    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setFilePreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setFilePreview(null);
    }
  };

  const uploadReceipt = async (reimbursementId) => {
    if (!selectedFile) return null;

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const response = await axios.post(`${API_URL}/upload/receipt`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      // Update reimbursement with receipt URL
      await axios.patch(`${API_URL}/reimbursements/${reimbursementId}/upload-receipt?receipt_url=${response.data.file_url}`, null, {
        withCredentials: true
      });

      return response.data.file_url;
    } catch (error) {
      toast.error('Failed to upload receipt');
      return null;
    }
  };

  const handleReimbursementSubmit = async (e) => {
    e.preventDefault();
    try {
      // Create reimbursement
      const response = await axios.post(`${API_URL}/reimbursements`, {
        category: reimbursementForm.category,
        amount: parseFloat(reimbursementForm.amount),
        description: reimbursementForm.description,
        date: reimbursementForm.date,
        project_id: reimbursementForm.expense_type === 'project' ? reimbursementForm.project_id : null
      }, { withCredentials: true });

      // Upload receipt if selected
      if (selectedFile) {
        await uploadReceipt(response.data.reimbursement_id);
      }

      toast.success('Reimbursement request submitted');
      setIsReimbursementDialogOpen(false);
      setReimbursementForm({
        category: '',
        amount: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        project_id: '',
        expense_type: 'internal'
      });
      setSelectedFile(null);
      setFilePreview(null);
      fetchData();
    } catch (error) {
      toast.error('Failed to submit reimbursement request');
    }
  };

  const handleUploadForExisting = async (reimbursementId) => {
    setUploadingReceipt(reimbursementId);
    fileInputRef.current?.click();
  };

  const handleExistingFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !uploadingReceipt) return;

    // Validate
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only JPG, PNG, and PDF files are allowed');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be under 5MB');
      return;
    }

    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_URL}/upload/receipt`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      await axios.patch(`${API_URL}/reimbursements/${uploadingReceipt}/upload-receipt?receipt_url=${response.data.file_url}`, null, {
        withCredentials: true
      });

      toast.success('Receipt uploaded successfully');
      fetchData();
    } catch (error) {
      toast.error('Failed to upload receipt');
    } finally {
      setUploadingReceipt(null);
      e.target.value = '';
    }
  };

  const handleReimbursementAction = async (reimbursementId, action) => {
    try {
      await axios.patch(`${API_URL}/reimbursements/${reimbursementId}/${action}`, null, {
        withCredentials: true
      });
      toast.success(`Reimbursement ${action.replace('-', ' ')}`);
      fetchData();
    } catch (error) {
      toast.error(`Failed to process reimbursement`);
    }
  };

  const handleDeleteReimbursement = async (reimbursementId) => {
    if (!window.confirm('Delete this reimbursement request?')) return;
    try {
      await axios.delete(`${API_URL}/reimbursements/${reimbursementId}`, { withCredentials: true });
      toast.success('Reimbursement deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  const pendingReimbursements = reimbursements.filter(r => r.status === 'pending');
  const totalPending = pendingReimbursements.reduce((sum, r) => sum + r.amount, 0);

  // Group reimbursements
  const projectReimbursements = reimbursements.filter(r => r.project_id);
  const internalReimbursements = reimbursements.filter(r => !r.project_id);

  return (
    <div data-testid="reimbursements-page" className="pt-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Reimbursements</h1>
          <p className="text-base text-muted-foreground">Submit and track expense reimbursement requests</p>
        </div>
        <Dialog open={isReimbursementDialogOpen} onOpenChange={setIsReimbursementDialogOpen}>
          <DialogTrigger asChild>
            <Button data-testid="request-reimbursement-btn">
              <Plus className="mr-2 h-4 w-4" />
              Request Reimbursement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Request Reimbursement</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleReimbursementSubmit} className="space-y-4">
              {/* Expense Type Toggle */}
              <div>
                <label className="text-sm font-medium mb-2 block">Expense Type</label>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={reimbursementForm.expense_type === 'internal' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setReimbursementForm({ ...reimbursementForm, expense_type: 'internal', project_id: '' })}
                  >
                    <Building className="mr-2 h-4 w-4" />
                    Internal
                  </Button>
                  <Button
                    type="button"
                    variant={reimbursementForm.expense_type === 'project' ? 'default' : 'outline'}
                    className="flex-1"
                    onClick={() => setReimbursementForm({ ...reimbursementForm, expense_type: 'project' })}
                  >
                    <FolderKanban className="mr-2 h-4 w-4" />
                    Project
                  </Button>
                </div>
              </div>

              {/* Project Selection (if project type) */}
              {reimbursementForm.expense_type === 'project' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Select Project *</label>
                  <Select value={reimbursementForm.project_id || '__none__'} onValueChange={(value) => setReimbursementForm({ ...reimbursementForm, project_id: value === '__none__' ? '' : value })} required>
                    <SelectTrigger>
                      <SelectValue placeholder="Select project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">-- Select Project --</SelectItem>
                      {projects.map((p) => (
                        <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-1">
                    This expense will be added to project profitability & cash flow
                  </p>
                </div>
              )}

              <div>
                <label className="text-sm font-medium mb-2 block">Category</label>
                <Select value={reimbursementForm.category} onValueChange={(value) => setReimbursementForm({ ...reimbursementForm, category: value })} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {reimbursementCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Amount (INR)</label>
                  <Input type="number" step="0.01" value={reimbursementForm.amount} onChange={(e) => setReimbursementForm({ ...reimbursementForm, amount: e.target.value })} required />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Date</label>
                  <Input type="date" value={reimbursementForm.date} onChange={(e) => setReimbursementForm({ ...reimbursementForm, date: e.target.value })} required />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea value={reimbursementForm.description} onChange={(e) => setReimbursementForm({ ...reimbursementForm, description: e.target.value })} rows={3} required />
              </div>

              {/* Receipt Upload */}
              <div>
                <label className="text-sm font-medium mb-2 block">Upload Receipt (Optional)</label>
                <div className="border-2 border-dashed rounded-lg p-4 text-center">
                  {selectedFile ? (
                    <div className="space-y-2">
                      {filePreview ? (
                        <img src={filePreview} alt="Receipt preview" className="max-h-32 mx-auto rounded" />
                      ) : (
                        <div className="flex items-center justify-center gap-2 text-muted-foreground">
                          <FileText className="h-8 w-8" />
                          <span>{selectedFile.name}</span>
                        </div>
                      )}
                      <Button type="button" variant="outline" size="sm" onClick={() => { setSelectedFile(null); setFilePreview(null); }}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <label className="cursor-pointer">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Upload className="h-8 w-8" />
                        <span>Click to upload (JPG, PNG, PDF - max 5MB)</span>
                      </div>
                      <input type="file" className="hidden" accept="image/jpeg,image/png,image/jpg,application/pdf" onChange={handleFileSelect} />
                    </label>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsReimbursementDialogOpen(false)}>Cancel</Button>
                <Button type="submit">Submit Request</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Hidden file input for existing reimbursements */}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/jpeg,image/png,image/jpg,application/pdf"
        onChange={handleExistingFileUpload}
      />

      {/* Summary Card for Managers */}
      {canApprove && pendingReimbursements.length > 0 && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/5 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Approvals</p>
              <p className="text-3xl font-heading font-bold text-amber-600">{pendingReimbursements.length}</p>
              <p className="text-sm text-muted-foreground">Total: {formatCurrency(totalPending)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Project: {projectReimbursements.filter(r => r.status === 'pending').length}</p>
              <p className="text-sm text-muted-foreground">Internal: {internalReimbursements.filter(r => r.status === 'pending').length}</p>
            </div>
          </div>
        </Card>
      )}

      {/* Reimbursements List */}
      {reimbursements.length === 0 ? (
        <Card className="p-12 text-center">
          <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-heading font-semibold mb-2">No reimbursement requests</h3>
          <p className="text-muted-foreground">Click "Request Reimbursement" to submit a new request</p>
        </Card>
      ) : (
        <div className="space-y-3">
          {reimbursements.map((r) => {
            const project = projects.find(p => p.project_id === r.project_id);
            return (
              <Card key={r.reimbursement_id} className="p-4" data-testid={`reimbursement-${r.reimbursement_id}`}>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2 flex-wrap">
                      <span className="px-2 py-1 text-xs font-semibold rounded-full bg-muted">
                        {reimbursementCategories.find(c => c.id === r.category)?.label || r.category}
                      </span>
                      <Badge className={`${statusColors[r.status]} border`}>
                        {r.status}
                      </Badge>
                      {r.project_id ? (
                        <Badge variant="outline" className="text-blue-600 border-blue-600">
                          <FolderKanban className="h-3 w-3 mr-1" />
                          {project?.name || 'Project'}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-gray-600 border-gray-600">
                          <Building className="h-3 w-3 mr-1" />
                          Internal
                        </Badge>
                      )}
                      <span className="text-2xl font-heading font-bold">{formatCurrency(r.amount)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm mb-2">
                      <span className="flex items-center gap-1">
                        <User className="h-4 w-4" />
                        {r.user_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {r.date}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{r.description}</p>
                    
                    {/* Receipt */}
                    {r.receipt_url ? (
                      <a 
                        href={`${API_URL.replace('/api', '')}${r.receipt_url}`} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline mt-2"
                      >
                        {r.receipt_url.endsWith('.pdf') ? <FileText className="h-4 w-4" /> : <Image className="h-4 w-4" />}
                        View Receipt
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : r.status === 'pending' && (r.user_id === user?.user_id || user?.role === 'admin') ? (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="mt-2"
                        onClick={() => handleUploadForExisting(r.reimbursement_id)}
                      >
                        <Upload className="h-4 w-4 mr-1" />
                        Upload Receipt
                      </Button>
                    ) : null}
                    
                    {r.approver_comments && (
                      <p className="text-sm text-muted-foreground mt-2 p-2 bg-muted rounded">
                        <strong>Comment:</strong> {r.approver_comments}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {r.status === 'pending' && canApprove && r.user_id !== user?.user_id && (
                      <>
                        <Button size="sm" variant="outline" className="text-green-600 border-green-600" onClick={() => handleReimbursementAction(r.reimbursement_id, 'approve')}>
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 border-red-600" onClick={() => handleReimbursementAction(r.reimbursement_id, 'reject')}>
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                    {r.status === 'approved' && canMarkPaid && (
                      <Button size="sm" onClick={() => handleReimbursementAction(r.reimbursement_id, 'mark-paid')}>
                        Mark Paid
                      </Button>
                    )}
                    {(r.status === 'pending' && r.user_id === user?.user_id) || user?.role === 'admin' ? (
                      <Button size="sm" variant="ghost" onClick={() => handleDeleteReimbursement(r.reimbursement_id)}>
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
