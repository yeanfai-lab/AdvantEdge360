import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Users, Mail, Edit, Trash2, Shield, Eye, EyeOff, UserPlus, Settings, Send, Clock, CheckCircle, XCircle, RefreshCw, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

const roleColors = {
  admin: 'bg-red-500/20 text-red-600 border-red-500/30',
  manager: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  team_lead: 'bg-purple-500/20 text-purple-600 border-purple-500/30',
  team_member: 'bg-slate-500/20 text-slate-600 border-slate-500/30'
};

const roleDescriptions = {
  admin: 'Full access to all features including financials',
  manager: 'Project management with financial access',
  team_lead: 'Team coordination and management',
  team_member: 'Own tasks only'
};

const invitationStatusColors = {
  pending: 'bg-yellow-500/20 text-yellow-600',
  accepted: 'bg-green-500/20 text-green-600',
  expired: 'bg-red-500/20 text-red-600',
  cancelled: 'bg-slate-500/20 text-slate-600'
};

export const TeamPage = () => {
  const [teamMembers, setTeamMembers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [projects, setProjects] = useState([]);
  const [permissions, setPermissions] = useState(null);
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditDialog, setIsEditDialog] = useState(false);
  const [isInviteDialog, setIsInviteDialog] = useState(false);
  const [selectedMember, setSelectedMember] = useState(null);
  const { user } = useAuth();

  const [editForm, setEditForm] = useState({
    role: '',
    skills: '',
    assigned_projects: []
  });

  const [inviteForm, setInviteForm] = useState({
    email: '',
    name: '',
    role: 'team_member'
  });

  const fetchData = async () => {
    try {
      const [teamRes, rolesRes, projectsRes, permRes] = await Promise.all([
        axios.get(`${API_URL}/team`, { withCredentials: true }),
        axios.get(`${API_URL}/roles`, { withCredentials: true }),
        axios.get(`${API_URL}/projects`, { withCredentials: true }),
        axios.get(`${API_URL}/user/permissions`, { withCredentials: true })
      ]);
      setTeamMembers(teamRes.data);
      setRoles(rolesRes.data);
      setProjects(projectsRes.data);
      setPermissions(permRes.data);
      
      // Fetch invitations if user can invite
      if (permRes.data?.permissions?.can_invite_team) {
        const invRes = await axios.get(`${API_URL}/team/invitations`, { withCredentials: true });
        setInvitations(invRes.data);
      }
    } catch (error) {
      toast.error('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const canManageTeam = permissions?.permissions?.can_manage_team || user?.role === 'admin';
  const canInviteTeam = permissions?.permissions?.can_invite_team || false;

  const handleEditMember = (member) => {
    setSelectedMember(member);
    setEditForm({
      role: member.role,
      skills: (member.skills || []).join(', '),
      assigned_projects: member.assigned_projects || []
    });
    setIsEditDialog(true);
  };

  const handleUpdateMember = async (e) => {
    e.preventDefault();
    try {
      await axios.patch(`${API_URL}/team/${selectedMember.user_id}`, {
        role: editForm.role,
        skills: editForm.skills.split(',').map(s => s.trim()).filter(s => s),
        assigned_projects: editForm.assigned_projects
      }, { withCredentials: true });
      toast.success('Team member updated');
      setIsEditDialog(false);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to update member');
    }
  };

  const handleDeleteMember = async (memberId) => {
    if (!window.confirm('Delete this team member? This action cannot be undone.')) return;
    try {
      await axios.delete(`${API_URL}/team/${memberId}`, { withCredentials: true });
      toast.success('Team member deleted');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to delete member');
    }
  };

  const handleSendInvitation = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/team/invitations`, inviteForm, { withCredentials: true });
      toast.success(`Invitation sent to ${inviteForm.email}`);
      if (response.data.demo_mode) {
        toast.info('Note: Email is in demo mode - not actually sent');
      }
      setIsInviteDialog(false);
      setInviteForm({ email: '', name: '', role: 'team_member' });
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send invitation');
    }
  };

  const handleCancelInvitation = async (invitationId) => {
    if (!window.confirm('Cancel this invitation?')) return;
    try {
      await axios.delete(`${API_URL}/team/invitations/${invitationId}`, { withCredentials: true });
      toast.success('Invitation cancelled');
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to cancel invitation');
    }
  };

  const handleResendInvitation = async (invitationId) => {
    try {
      const response = await axios.post(`${API_URL}/team/invitations/${invitationId}/resend`, {}, { withCredentials: true });
      toast.success('Invitation resent');
      if (response.data.demo_mode) {
        toast.info('Note: Email is in demo mode - not actually sent');
      }
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to resend invitation');
    }
  };

  const copyInvitationLink = (token) => {
    const link = `${window.location.origin}?invite=${token}`;
    navigator.clipboard.writeText(link);
    toast.success('Invitation link copied to clipboard');
  };

  const formatRole = (role) => {
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div data-testid="team-page" className="pt-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Team Management</h1>
          <p className="text-base text-muted-foreground">Manage team members, roles, and project assignments</p>
        </div>
        <div className="flex items-center gap-4">
          {canInviteTeam && (
            <Button onClick={() => setIsInviteDialog(true)} data-testid="invite-team-btn">
              <UserPlus className="h-4 w-4 mr-2" />
              Invite Team Member
            </Button>
          )}
          {permissions && (
            <div className="flex items-center gap-2 text-sm">
              <Shield className="h-4 w-4" />
              <span>Your role: <Badge className={roleColors[permissions.role]}>{formatRole(permissions.role)}</Badge></span>
            </div>
          )}
        </div>
      </div>

      {/* Role Permissions Overview */}
      <Card className="p-6 mb-6">
        <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Role Permissions Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {roles.map((role) => (
            <div key={role.id} className={`p-4 rounded-lg border ${roleColors[role.id] || 'bg-muted'}`}>
              <h4 className="font-semibold mb-1">{formatRole(role.id)}</h4>
              <p className="text-xs mb-2 opacity-80">{role.description}</p>
              <div className="flex gap-2 flex-wrap">
                {role.can_view_financial && (
                  <span className="text-xs px-1.5 py-0.5 bg-green-500/20 text-green-600 rounded flex items-center gap-1">
                    <Eye className="h-3 w-3" /> Financial
                  </span>
                )}
                {!role.can_view_financial && (
                  <span className="text-xs px-1.5 py-0.5 bg-muted text-muted-foreground rounded flex items-center gap-1">
                    <EyeOff className="h-3 w-3" /> No Financial
                  </span>
                )}
                {role.can_manage_team && (
                  <span className="text-xs px-1.5 py-0.5 bg-blue-500/20 text-blue-600 rounded flex items-center gap-1">
                    <Users className="h-3 w-3" /> Manage Team
                  </span>
                )}
                {role.can_invite_team && (
                  <span className="text-xs px-1.5 py-0.5 bg-purple-500/20 text-purple-600 rounded flex items-center gap-1">
                    <UserPlus className="h-3 w-3" /> Can Invite
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Team Members */}
      {teamMembers.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-heading font-semibold mb-2">No team members yet</h3>
          <p className="text-muted-foreground mb-6">Team members will appear here after signing up</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teamMembers.map((member) => (
            <Card key={member.user_id} className="p-6 hover:shadow-md transition-shadow" data-testid={`team-member-${member.user_id}`}>
              <div className="flex items-start gap-4">
                <Avatar className="h-14 w-14">
                  <AvatarImage src={member.picture} />
                  <AvatarFallback className="text-lg bg-primary/10">{member.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-heading font-semibold">{member.name}</h3>
                    {canManageTeam && member.user_id !== user?.user_id && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleEditMember(member)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {user?.role === 'admin' && (
                          <Button size="sm" variant="ghost" onClick={() => handleDeleteMember(member.user_id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                  </div>
                  <Badge className={`${roleColors[member.role]} border`}>
                    {formatRole(member.role)}
                  </Badge>
                  {member.user_id === user?.user_id && (
                    <Badge variant="outline" className="ml-2">You</Badge>
                  )}
                  {member.skills && member.skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {member.skills.slice(0, 3).map((skill, index) => (
                        <span key={index} className="px-2 py-0.5 text-xs bg-muted rounded-md">
                          {skill}
                        </span>
                      ))}
                      {member.skills.length > 3 && (
                        <span className="px-2 py-0.5 text-xs bg-muted rounded-md">
                          +{member.skills.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Edit Member Dialog */}
      <Dialog open={isEditDialog} onOpenChange={setIsEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Team Member</DialogTitle>
          </DialogHeader>
          {selectedMember && (
            <form onSubmit={handleUpdateMember} className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-lg">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={selectedMember.picture} />
                  <AvatarFallback>{selectedMember.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{selectedMember.name}</p>
                  <p className="text-sm text-muted-foreground">{selectedMember.email}</p>
                </div>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Role</label>
                <Select 
                  value={editForm.role} 
                  onValueChange={(value) => setEditForm({ ...editForm, role: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roles.map((role) => (
                      <SelectItem key={role.id} value={role.id}>
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${roleColors[role.id]?.split(' ')[0] || 'bg-muted'}`}></span>
                          {formatRole(role.id)}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Skills (comma-separated)</label>
                <Input
                  value={editForm.skills}
                  onChange={(e) => setEditForm({ ...editForm, skills: e.target.value })}
                  placeholder="React, Python, Project Management"
                />
              </div>
              
              <div>
                <label className="text-sm font-medium mb-2 block">Assigned Projects</label>
                <Select 
                  value={editForm.assigned_projects[0] || '__none__'} 
                  onValueChange={(value) => setEditForm({ ...editForm, assigned_projects: value === '__none__' ? [] : [value] })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">No project assigned</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.project_id} value={p.project_id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsEditDialog(false)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Invite Team Member Dialog */}
      <Dialog open={isInviteDialog} onOpenChange={setIsInviteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSendInvitation} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Email Address *</label>
              <Input
                type="email"
                value={inviteForm.email}
                onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                placeholder="email@example.com"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Full Name *</label>
              <Input
                value={inviteForm.name}
                onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Role</label>
              <Select value={inviteForm.role} onValueChange={(value) => setInviteForm({ ...inviteForm, role: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${roleColors[role.id]?.split(' ')[0] || 'bg-muted'}`}></span>
                        {formatRole(role.id)} - {role.description}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-muted/50 p-3 rounded-lg text-sm text-muted-foreground">
              <p>An email invitation will be sent to the recipient with a signup link. They will be assigned the selected role upon signing up.</p>
              <p className="mt-1 text-xs opacity-75">Note: Email is currently in demo mode - invitation will be stored but not actually sent.</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsInviteDialog(false)}>Cancel</Button>
              <Button type="submit">
                <Send className="h-4 w-4 mr-2" />
                Send Invitation
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pending Invitations Section */}
      {canInviteTeam && invitations.length > 0 && (
        <Card className="p-6 mb-6">
          <h3 className="text-lg font-heading font-semibold mb-4 flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Pending Invitations
            <Badge variant="secondary" className="ml-2">{invitations.filter(i => i.status === 'pending').length} pending</Badge>
          </h3>
          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div key={invitation.invitation_id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${invitationStatusColors[invitation.status]}`}>
                    {invitation.status === 'pending' && <Clock className="h-5 w-5" />}
                    {invitation.status === 'accepted' && <CheckCircle className="h-5 w-5" />}
                    {invitation.status === 'expired' && <XCircle className="h-5 w-5" />}
                    {invitation.status === 'cancelled' && <XCircle className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-medium">{invitation.name}</p>
                    <p className="text-sm text-muted-foreground">{invitation.email}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={roleColors[invitation.role] || 'bg-muted'}>{formatRole(invitation.role)}</Badge>
                      <Badge className={invitationStatusColors[invitation.status]}>{invitation.status}</Badge>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {invitation.status === 'pending' && (
                    <>
                      <Button size="sm" variant="outline" onClick={() => copyInvitationLink(invitation.token)} title="Copy invitation link">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleResendInvitation(invitation.invitation_id)} title="Resend invitation">
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button size="sm" variant="destructive" onClick={() => handleCancelInvitation(invitation.invitation_id)} title="Cancel invitation">
                        <XCircle className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                  {invitation.status === 'expired' && (
                    <Button size="sm" variant="outline" onClick={() => handleResendInvitation(invitation.invitation_id)}>
                      <RefreshCw className="h-4 w-4 mr-1" /> Resend
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
