"""
Test iteration 16 features:
1. Currency displays 'INR' in Proposals and Projects (frontend check)
2. Client contact dropdown in proposal creation (frontend check)
3. Dashboard team tasks view excludes not_started and completed tasks
4. Team roles endpoint returns: admin, manager, team_lead, team_member, finance (NO supervisor)
5. Team Lead role has can_manage_team=true
6. Admin and Manager have can_invite_team=true
"""

import pytest
import requests
import os
import json
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Use existing test session or create one
SESSION_TOKEN = "test_session_1772045655414"


class TestRolesConfiguration:
    """Test that roles are correctly configured without supervisor"""

    def test_roles_endpoint_returns_correct_roles(self):
        """Verify /api/roles returns correct roles list without supervisor"""
        response = requests.get(
            f"{BASE_URL}/api/roles",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert response.status_code == 200, f"Roles endpoint failed: {response.text}"
        
        roles_data = response.json()
        role_ids = [r['id'] for r in roles_data]
        
        # Verify supervisor is NOT in the list
        assert 'supervisor' not in role_ids, "Supervisor role should be removed"
        
        # Verify expected roles are present
        expected_roles = ['admin', 'manager', 'team_lead', 'team_member', 'finance']
        for expected_role in expected_roles:
            assert expected_role in role_ids, f"Expected role '{expected_role}' not found"
    
    def test_team_lead_has_can_manage_team(self):
        """Verify Team Lead role has can_manage_team=true"""
        response = requests.get(
            f"{BASE_URL}/api/roles",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        
        roles_data = response.json()
        team_lead = next((r for r in roles_data if r['id'] == 'team_lead'), None)
        
        assert team_lead is not None, "Team Lead role not found"
        assert team_lead.get('can_manage_team') == True, "Team Lead should have can_manage_team=true"
    
    def test_admin_has_can_invite_team(self):
        """Verify Admin role has can_invite_team=true"""
        response = requests.get(
            f"{BASE_URL}/api/roles",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        
        roles_data = response.json()
        admin = next((r for r in roles_data if r['id'] == 'admin'), None)
        
        assert admin is not None, "Admin role not found"
        assert admin.get('can_invite_team') == True, "Admin should have can_invite_team=true"
    
    def test_manager_has_can_invite_team(self):
        """Verify Manager role has can_invite_team=true"""
        response = requests.get(
            f"{BASE_URL}/api/roles",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        
        roles_data = response.json()
        manager = next((r for r in roles_data if r['id'] == 'manager'), None)
        
        assert manager is not None, "Manager role not found"
        assert manager.get('can_invite_team') == True, "Manager should have can_invite_team=true"
    
    def test_team_lead_cannot_invite_team(self):
        """Verify Team Lead does NOT have can_invite_team"""
        response = requests.get(
            f"{BASE_URL}/api/roles",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        
        roles_data = response.json()
        team_lead = next((r for r in roles_data if r['id'] == 'team_lead'), None)
        
        assert team_lead is not None, "Team Lead role not found"
        assert team_lead.get('can_invite_team') == False, "Team Lead should NOT have can_invite_team"
    
    def test_finance_role_exists_with_correct_permissions(self):
        """Verify Finance role exists with can_view_financial=true"""
        response = requests.get(
            f"{BASE_URL}/api/roles",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert response.status_code == 200
        
        roles_data = response.json()
        finance = next((r for r in roles_data if r['id'] == 'finance'), None)
        
        assert finance is not None, "Finance role not found"
        assert finance.get('can_view_financial') == True, "Finance should have can_view_financial=true"
        assert finance.get('can_manage_team') == False, "Finance should NOT have can_manage_team"
        assert finance.get('can_invite_team') == False, "Finance should NOT have can_invite_team"


class TestDashboardTeamTasks:
    """Test team tasks endpoint filtering"""
    
    def test_team_tasks_excludes_not_started_and_completed(self):
        """Verify /dashboard/team-tasks excludes not_started and completed tasks"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/team-tasks",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert response.status_code == 200, f"Team tasks endpoint failed: {response.text}"
        
        team_data = response.json()
        
        # Collect all task statuses
        all_statuses = []
        for member in team_data:
            for task in member.get('tasks', []):
                all_statuses.append(task.get('status'))
        
        # Verify filtering
        assert 'not_started' not in all_statuses, "not_started tasks should be excluded from team tasks"
        assert 'completed' not in all_statuses, "completed tasks should be excluded from team tasks"


class TestClientsEndpoint:
    """Test clients endpoint for proposal dropdown"""
    
    def test_clients_endpoint_accessible(self):
        """Verify /api/clients endpoint returns data for dropdown"""
        response = requests.get(
            f"{BASE_URL}/api/clients",
            headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
        )
        assert response.status_code == 200, f"Clients endpoint failed: {response.text}"
        
        # Should return a list (even if empty)
        data = response.json()
        assert isinstance(data, list), "Clients endpoint should return a list"


class TestProposalsEndpoint:
    """Test proposals endpoint"""
    
    def test_create_proposal_with_client_name(self):
        """Verify proposal can be created with client_name"""
        payload = {
            "title": "Test Proposal for INR Currency",
            "client_name": "Test Client INR",
            "description": "Testing INR currency display",
            "amount": 150000.00,
            "category": "Commercial"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/proposals",
            headers={
                "Authorization": f"Bearer {SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json=payload
        )
        assert response.status_code == 200, f"Create proposal failed: {response.text}"
        
        proposal = response.json()
        assert proposal.get('client_name') == "Test Client INR"
        assert proposal.get('amount') == 150000.00
        
        # Cleanup
        proposal_id = proposal.get('proposal_id')
        if proposal_id:
            requests.delete(
                f"{BASE_URL}/api/proposals/{proposal_id}",
                headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
            )


class TestProjectsEndpoint:
    """Test projects endpoint"""
    
    def test_create_project_with_budget(self):
        """Verify project can be created with budget for INR display"""
        payload = {
            "name": "Test Project INR",
            "description": "Testing INR currency in projects",
            "client_name": "Test Client",
            "budget": 500000.00
        }
        
        response = requests.post(
            f"{BASE_URL}/api/projects",
            headers={
                "Authorization": f"Bearer {SESSION_TOKEN}",
                "Content-Type": "application/json"
            },
            json=payload
        )
        assert response.status_code == 200, f"Create project failed: {response.text}"
        
        project = response.json()
        assert project.get('budget') == 500000.00
        
        # Cleanup
        project_id = project.get('project_id')
        if project_id:
            requests.delete(
                f"{BASE_URL}/api/projects/{project_id}",
                headers={"Authorization": f"Bearer {SESSION_TOKEN}"}
            )


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
