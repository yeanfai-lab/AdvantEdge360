import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_URL } from '../lib/utils';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '../components/ui/avatar';
import { Users, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';

export const TeamPage = () => {
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const fetchTeam = async () => {
      try {
        const response = await axios.get(`${API_URL}/team`, { withCredentials: true });
        setTeamMembers(response.data);
      } catch (error) {
        toast.error('Failed to load team members');
      } finally {
        setLoading(false);
      }
    };
    fetchTeam();
  }, []);

  const getRoleColor = (role) => {
    const colors = {
      admin: 'bg-chart-2/20 text-chart-2',
      manager: 'bg-chart-3/20 text-chart-3',
      team_lead: 'bg-chart-4/20 text-chart-4',
      team_member: 'bg-muted text-foreground',
      finance: 'bg-chart-5/20 text-chart-5'
    };
    return colors[role] || 'bg-muted';
  };

  const formatRole = (role) => {
    return role.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div></div>;
  }

  return (
    <div data-testid="team-page">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-heading font-bold tracking-tight mb-2">Team</h1>
          <p className="text-base text-muted-foreground">Manage team members and assignments</p>
        </div>
      </div>

      {teamMembers.length === 0 ? (
        <Card className="p-12 text-center">
          <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-heading font-semibold mb-2">No team members yet</h3>
          <p className="text-muted-foreground mb-6">Team members will appear here</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {teamMembers.map((member) => (
            <Card key={member.user_id} className="p-6 hover:shadow-md transition-shadow" data-testid={`team-member-${member.user_id}`}>
              <div className="flex items-start gap-4">
                <Avatar className="h-16 w-16">
                  <AvatarImage src={member.picture} />
                  <AvatarFallback className="text-lg">{member.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-heading font-semibold mb-1">{member.name}</h3>
                  <div className="flex items-center gap-2 mb-3">
                    <Mail className="h-3 w-3 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground truncate">{member.email}</p>
                  </div>
                  <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${getRoleColor(member.role)}`}>
                    {formatRole(member.role)}
                  </span>
                  {member.skills && member.skills.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {member.skills.map((skill, index) => (
                        <span key={index} className="px-2 py-0.5 text-xs bg-muted rounded-md">
                          {skill}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};
