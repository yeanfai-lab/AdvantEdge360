import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Plus, User, GraduationCap, Briefcase, CreditCard, Phone, Home, X, Check, FileText, Send } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const statusColors = {
  pending: 'bg-gray-500/20 text-gray-600 border-gray-500/30',
  submitted: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  approved: 'bg-green-500/20 text-green-600 border-green-500/30'
};

export const OnboardingPage = () => {
  const { user } = useAuth();
  const [myForm, setMyForm] = useState(null);
  const [allForms, setAllForms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false);

  const canApprove = ['admin', 'manager'].includes(user?.role);

  const [formData, setFormData] = useState({
    full_name: '',
    date_of_birth: '',
    phone: '',
    address: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    emergency_contact_relation: '',
    bank_name: '',
    account_number: '',
    ifsc_code: '',
    education: [],
    work_experience: []
  });

  const [newEducation, setNewEducation] = useState({ degree: '', institution: '', year: '', grade: '' });
  const [newExperience, setNewExperience] = useState({ company: '', role: '', duration: '', responsibilities: '' });

  const fetchData = async () => {
    try {
      const [myFormRes, allFormsRes] = await Promise.all([
        axios.get(`${API_URL}/onboarding/my`, { withCredentials: true }),
        canApprove ? axios.get(`${API_URL}/onboarding`, { withCredentials: true }) : Promise.resolve({ data: [] })
      ]);
      setMyForm(myFormRes.data);
      setAllForms(allFormsRes.data || []);
      if (myFormRes.data) {
        setFormData(myFormRes.data);
      }
    } catch (error) {
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    try {
      if (myForm) {
        await axios.patch(`${API_URL}/onboarding/${myForm.form_id}`, formData, { withCredentials: true });
        toast.success('Form saved');
      } else {
        await axios.post(`${API_URL}/onboarding`, formData, { withCredentials: true });
        toast.success('Form created');
      }
      setIsEditing(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save form');
    }
  };

  const handleSubmit = async () => {
    if (!myForm) return;
    try {
      await axios.patch(`${API_URL}/onboarding/${myForm.form_id}/submit`, {}, { withCredentials: true });
      toast.success('Form submitted for approval');
      fetchData();
    } catch (error) {
      toast.error('Failed to submit form');
    }
  };

  const handleApprove = async (formId) => {
    try {
      await axios.patch(`${API_URL}/onboarding/${formId}/approve`, {}, { withCredentials: true });
      toast.success('Form approved');
      fetchData();
    } catch (error) {
      toast.error('Failed to approve form');
    }
  };

  const addEducation = () => {
    if (!newEducation.degree || !newEducation.institution) return;
    setFormData({
      ...formData,
      education: [...formData.education, { ...newEducation }]
    });
    setNewEducation({ degree: '', institution: '', year: '', grade: '' });
  };

  const removeEducation = (index) => {
    setFormData({
      ...formData,
      education: formData.education.filter((_, i) => i !== index)
    });
  };

  const addExperience = () => {
    if (!newExperience.company || !newExperience.role) return;
    setFormData({
      ...formData,
      work_experience: [...formData.work_experience, { ...newExperience }]
    });
    setNewExperience({ company: '', role: '', duration: '', responsibilities: '' });
  };

  const removeExperience = (index) => {
    setFormData({
      ...formData,
      work_experience: formData.work_experience.filter((_, i) => i !== index)
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div data-testid="onboarding-page" className="pt-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Onboarding</h1>
          <p className="text-base text-muted-foreground">Complete your onboarding details</p>
        </div>
        {myForm && myForm.status === 'pending' && !isEditing && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setIsEditing(true)}>Edit Form</Button>
            <Button onClick={handleSubmit}>
              <Send className="mr-2 h-4 w-4" />
              Submit for Approval
            </Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="my-form" className="space-y-6">
        <TabsList>
          <TabsTrigger value="my-form">My Onboarding Form</TabsTrigger>
          {canApprove && <TabsTrigger value="all-forms">All Forms ({allForms.length})</TabsTrigger>}
        </TabsList>

        {/* My Form Tab */}
        <TabsContent value="my-form" className="space-y-6">
          {myForm && !isEditing ? (
            <div className="space-y-6">
              <div className="flex items-center gap-3 mb-4">
                <Badge className={`${statusColors[myForm.status]} border`}>{myForm.status}</Badge>
                {myForm.status === 'approved' && <span className="text-green-600 text-sm">Your onboarding has been approved!</span>}
              </div>

              {/* Personal Info Card */}
              <Card className="p-6">
                <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
                  <User className="h-5 w-5" /> Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Full Name:</span> <span className="font-medium">{myForm.full_name}</span></div>
                  <div><span className="text-muted-foreground">Date of Birth:</span> <span className="font-medium">{myForm.date_of_birth || '-'}</span></div>
                  <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{myForm.phone || '-'}</span></div>
                  <div><span className="text-muted-foreground">Address:</span> <span className="font-medium">{myForm.address || '-'}</span></div>
                </div>
              </Card>

              {/* Emergency Contact Card */}
              <Card className="p-6">
                <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
                  <Phone className="h-5 w-5" /> Emergency Contact
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{myForm.emergency_contact_name || '-'}</span></div>
                  <div><span className="text-muted-foreground">Phone:</span> <span className="font-medium">{myForm.emergency_contact_phone || '-'}</span></div>
                  <div><span className="text-muted-foreground">Relation:</span> <span className="font-medium">{myForm.emergency_contact_relation || '-'}</span></div>
                </div>
              </Card>

              {/* Bank Details Card */}
              <Card className="p-6">
                <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
                  <CreditCard className="h-5 w-5" /> Bank Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div><span className="text-muted-foreground">Bank Name:</span> <span className="font-medium">{myForm.bank_name || '-'}</span></div>
                  <div><span className="text-muted-foreground">Account Number:</span> <span className="font-medium">{myForm.account_number ? '****' + myForm.account_number.slice(-4) : '-'}</span></div>
                  <div><span className="text-muted-foreground">IFSC Code:</span> <span className="font-medium">{myForm.ifsc_code || '-'}</span></div>
                </div>
              </Card>

              {/* Education Card */}
              <Card className="p-6">
                <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" /> Education
                </h3>
                {myForm.education?.length > 0 ? (
                  <div className="space-y-3">
                    {myForm.education.map((edu, idx) => (
                      <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                        <p className="font-medium">{edu.degree}</p>
                        <p className="text-sm text-muted-foreground">{edu.institution} • {edu.year}</p>
                        {edu.grade && <p className="text-sm text-muted-foreground">Grade: {edu.grade}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No education added</p>
                )}
              </Card>

              {/* Work Experience Card */}
              <Card className="p-6">
                <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
                  <Briefcase className="h-5 w-5" /> Work Experience
                </h3>
                {myForm.work_experience?.length > 0 ? (
                  <div className="space-y-3">
                    {myForm.work_experience.map((exp, idx) => (
                      <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                        <p className="font-medium">{exp.role}</p>
                        <p className="text-sm text-muted-foreground">{exp.company} • {exp.duration}</p>
                        {exp.responsibilities && <p className="text-sm mt-1">{exp.responsibilities}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No work experience added</p>
                )}
              </Card>
            </div>
          ) : (
            // Edit/Create Form
            <div className="space-y-6">
              {/* Personal Info */}
              <Card className="p-6">
                <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
                  <User className="h-5 w-5" /> Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Full Name *</label>
                    <Input value={formData.full_name} onChange={(e) => setFormData({ ...formData, full_name: e.target.value })} required />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Date of Birth</label>
                    <Input type="date" value={formData.date_of_birth || ''} onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Phone</label>
                    <Input value={formData.phone || ''} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Address</label>
                    <Input value={formData.address || ''} onChange={(e) => setFormData({ ...formData, address: e.target.value })} />
                  </div>
                </div>
              </Card>

              {/* Emergency Contact */}
              <Card className="p-6">
                <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
                  <Phone className="h-5 w-5" /> Emergency Contact
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Name</label>
                    <Input value={formData.emergency_contact_name || ''} onChange={(e) => setFormData({ ...formData, emergency_contact_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Phone</label>
                    <Input value={formData.emergency_contact_phone || ''} onChange={(e) => setFormData({ ...formData, emergency_contact_phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Relation</label>
                    <Input value={formData.emergency_contact_relation || ''} onChange={(e) => setFormData({ ...formData, emergency_contact_relation: e.target.value })} />
                  </div>
                </div>
              </Card>

              {/* Bank Details */}
              <Card className="p-6">
                <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
                  <CreditCard className="h-5 w-5" /> Bank Details
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Bank Name</label>
                    <Input value={formData.bank_name || ''} onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Account Number</label>
                    <Input value={formData.account_number || ''} onChange={(e) => setFormData({ ...formData, account_number: e.target.value })} />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">IFSC Code</label>
                    <Input value={formData.ifsc_code || ''} onChange={(e) => setFormData({ ...formData, ifsc_code: e.target.value })} />
                  </div>
                </div>
              </Card>

              {/* Education */}
              <Card className="p-6">
                <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" /> Education
                </h3>
                {formData.education?.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {formData.education.map((edu, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{edu.degree}</p>
                          <p className="text-sm text-muted-foreground">{edu.institution} • {edu.year}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => removeEducation(idx)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <Input placeholder="Degree" value={newEducation.degree} onChange={(e) => setNewEducation({ ...newEducation, degree: e.target.value })} />
                  <Input placeholder="Institution" value={newEducation.institution} onChange={(e) => setNewEducation({ ...newEducation, institution: e.target.value })} />
                  <Input placeholder="Year" value={newEducation.year} onChange={(e) => setNewEducation({ ...newEducation, year: e.target.value })} />
                  <Button type="button" variant="outline" onClick={addEducation}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </Card>

              {/* Work Experience */}
              <Card className="p-6">
                <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
                  <Briefcase className="h-5 w-5" /> Work Experience
                </h3>
                {formData.work_experience?.length > 0 && (
                  <div className="space-y-2 mb-4">
                    {formData.work_experience.map((exp, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{exp.role}</p>
                          <p className="text-sm text-muted-foreground">{exp.company} • {exp.duration}</p>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => removeExperience(idx)}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
                  <Input placeholder="Company" value={newExperience.company} onChange={(e) => setNewExperience({ ...newExperience, company: e.target.value })} />
                  <Input placeholder="Role" value={newExperience.role} onChange={(e) => setNewExperience({ ...newExperience, role: e.target.value })} />
                  <Input placeholder="Duration" value={newExperience.duration} onChange={(e) => setNewExperience({ ...newExperience, duration: e.target.value })} />
                  <Button type="button" variant="outline" onClick={addExperience}>
                    <Plus className="h-4 w-4 mr-1" /> Add
                  </Button>
                </div>
              </Card>

              <div className="flex justify-end gap-2">
                {myForm && <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>}
                <Button onClick={handleSave}>Save Form</Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* All Forms Tab (for approvers) */}
        {canApprove && (
          <TabsContent value="all-forms" className="space-y-4">
            {allForms.length === 0 ? (
              <Card className="p-12 text-center">
                <FileText className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No onboarding forms submitted</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {allForms.map((form) => (
                  <Card key={form.form_id} className="p-4" data-testid={`onboarding-form-${form.form_id}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                          <h3 className="font-semibold">{form.full_name}</h3>
                          <Badge className={`${statusColors[form.status]} border`}>{form.status}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {form.education?.length || 0} education entries • {form.work_experience?.length || 0} work experiences
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => {
                          setSelectedForm(form);
                          setIsViewDialogOpen(true);
                        }}>
                          <FileText className="mr-1 h-3 w-3" /> View
                        </Button>
                        {form.status === 'submitted' && (
                          <Button size="sm" onClick={() => handleApprove(form.form_id)}>
                            <Check className="mr-1 h-3 w-3" /> Approve
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        )}
      </Tabs>

      {/* View Form Dialog */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Onboarding Form Details</DialogTitle>
          </DialogHeader>
          {selectedForm && (
            <div className="space-y-4">
              <div className="p-4 bg-muted/50 rounded-lg">
                <h3 className="font-semibold text-lg">{selectedForm.full_name}</h3>
                <p className="text-sm text-muted-foreground">DOB: {selectedForm.date_of_birth || '-'} • Phone: {selectedForm.phone || '-'}</p>
                <p className="text-sm text-muted-foreground">{selectedForm.address || '-'}</p>
              </div>
              
              {selectedForm.education?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Education</h4>
                  {selectedForm.education.map((edu, idx) => (
                    <div key={idx} className="p-2 bg-muted/30 rounded mb-2">
                      <p className="font-medium">{edu.degree}</p>
                      <p className="text-sm text-muted-foreground">{edu.institution} • {edu.year}</p>
                    </div>
                  ))}
                </div>
              )}
              
              {selectedForm.work_experience?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Work Experience</h4>
                  {selectedForm.work_experience.map((exp, idx) => (
                    <div key={idx} className="p-2 bg-muted/30 rounded mb-2">
                      <p className="font-medium">{exp.role}</p>
                      <p className="text-sm text-muted-foreground">{exp.company} • {exp.duration}</p>
                      {exp.responsibilities && <p className="text-sm mt-1">{exp.responsibilities}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
