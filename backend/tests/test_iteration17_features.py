"""
Backend tests for Iteration 17 - AdvantEdge360
Tests:
1. Roles endpoint returns ONLY: admin, manager, team_lead, team_member (NO finance, NO supervisor)
2. Dashboard Team Tasks excludes 'not_started' status
3. Team Invitation workflow (POST, GET, DELETE)
4. First user signup gets admin role automatically
"""

import pytest
import requests
import os
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    BASE_URL = "https://project-hub-360.preview.emergentagent.com"

# Admin session token created by test setup
ADMIN_SESSION_TOKEN = "test_session_1772046822258"


class TestRolesEndpoint:
    """Test /api/roles endpoint - should return ONLY 4 roles: admin, manager, team_lead, team_member"""
    
    def test_roles_endpoint_returns_only_four_roles(self):
        """Verify roles endpoint returns exactly 4 roles with no finance or supervisor"""
        response = requests.get(
            f"{BASE_URL}/api/roles",
            headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        roles = response.json()
        role_ids = [r['id'] for r in roles]
        
        # Assert exactly 4 roles
        assert len(roles) == 4, f"Expected exactly 4 roles, got {len(roles)}: {role_ids}"
        
        # Assert required roles are present
        expected_roles = ['admin', 'manager', 'team_lead', 'team_member']
        for role in expected_roles:
            assert role in role_ids, f"Missing expected role: {role}"
        
        # Assert NO finance or supervisor roles
        assert 'finance' not in role_ids, "Finance role should NOT be present"
        assert 'supervisor' not in role_ids, "Supervisor role should NOT be present"
        
        print(f"PASS: Roles endpoint returns exactly 4 roles: {role_ids}")
    
    def test_admin_role_has_correct_permissions(self):
        """Admin role should have can_invite_team=True"""
        response = requests.get(
            f"{BASE_URL}/api/roles",
            headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200
        roles = {r['id']: r for r in response.json()}
        
        admin = roles.get('admin')
        assert admin is not None, "Admin role not found"
        assert admin.get('can_invite_team') == True, "Admin should have can_invite_team=True"
        assert admin.get('can_manage_team') == True, "Admin should have can_manage_team=True"
        assert admin.get('can_view_financial') == True, "Admin should have can_view_financial=True"
        print("PASS: Admin role has correct permissions")
    
    def test_manager_role_has_correct_permissions(self):
        """Manager role should have can_invite_team=True"""
        response = requests.get(
            f"{BASE_URL}/api/roles",
            headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200
        roles = {r['id']: r for r in response.json()}
        
        manager = roles.get('manager')
        assert manager is not None, "Manager role not found"
        assert manager.get('can_invite_team') == True, "Manager should have can_invite_team=True"
        assert manager.get('can_manage_team') == True, "Manager should have can_manage_team=True"
        print("PASS: Manager role has correct permissions")
    
    def test_team_lead_cannot_invite(self):
        """Team Lead should NOT have can_invite_team permission"""
        response = requests.get(
            f"{BASE_URL}/api/roles",
            headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200
        roles = {r['id']: r for r in response.json()}
        
        team_lead = roles.get('team_lead')
        assert team_lead is not None, "Team Lead role not found"
        assert team_lead.get('can_invite_team') == False, "Team Lead should NOT have can_invite_team"
        assert team_lead.get('can_manage_team') == True, "Team Lead should have can_manage_team=True"
        print("PASS: Team Lead has correct permissions (cannot invite)")
    
    def test_team_member_has_limited_permissions(self):
        """Team Member should have minimal permissions"""
        response = requests.get(
            f"{BASE_URL}/api/roles",
            headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200
        roles = {r['id']: r for r in response.json()}
        
        team_member = roles.get('team_member')
        assert team_member is not None, "Team Member role not found"
        assert team_member.get('can_invite_team') == False, "Team Member should NOT have can_invite_team"
        assert team_member.get('can_manage_team') == False, "Team Member should NOT have can_manage_team"
        assert team_member.get('can_view_financial') == False, "Team Member should NOT have can_view_financial"
        print("PASS: Team Member has limited permissions")


class TestTeamInvitationWorkflow:
    """Test team invitation endpoints - POST, GET, DELETE"""
    
    invitation_id = None
    
    def test_create_invitation(self):
        """POST /api/team/invitations - Create a new team invitation"""
        payload = {
            "email": "invited.user@test.com",
            "name": "Invited User",
            "role": "team_member"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/team/invitations",
            json=payload,
            headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'invitation_id' in data, "Response should contain invitation_id"
        assert data.get('email') == payload['email'], "Email should match"
        assert data.get('role') == payload['role'], "Role should match"
        assert 'token' in data, "Response should contain token"
        assert data.get('demo_mode') == True, "Should indicate demo mode"
        
        TestTeamInvitationWorkflow.invitation_id = data['invitation_id']
        print(f"PASS: Created invitation {data['invitation_id']} for {payload['email']}")
    
    def test_get_invitations(self):
        """GET /api/team/invitations - List all invitations"""
        response = requests.get(
            f"{BASE_URL}/api/team/invitations",
            headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        invitations = response.json()
        assert isinstance(invitations, list), "Response should be a list"
        assert len(invitations) >= 1, "Should have at least 1 invitation"
        
        # Find our created invitation
        our_invitation = next((inv for inv in invitations if inv.get('email') == 'invited.user@test.com'), None)
        assert our_invitation is not None, "Our created invitation should be in the list"
        assert our_invitation.get('status') == 'pending', "Status should be pending"
        
        print(f"PASS: GET invitations returned {len(invitations)} invitations")
    
    def test_duplicate_invitation_fails(self):
        """Creating duplicate invitation for same email should fail"""
        payload = {
            "email": "invited.user@test.com",  # Same email as before
            "name": "Invited User Again",
            "role": "team_member"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/team/invitations",
            json=payload,
            headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 400, f"Expected 400 for duplicate, got {response.status_code}"
        print("PASS: Duplicate invitation correctly rejected")
    
    def test_cancel_invitation(self):
        """DELETE /api/team/invitations/{id} - Cancel an invitation"""
        # First create a new invitation to cancel
        payload = {
            "email": "cancel.test@test.com",
            "name": "Cancel Test User",
            "role": "team_member"
        }
        
        create_response = requests.post(
            f"{BASE_URL}/api/team/invitations",
            json=payload,
            headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
        )
        
        assert create_response.status_code == 200
        invitation_id = create_response.json()['invitation_id']
        
        # Now cancel it
        delete_response = requests.delete(
            f"{BASE_URL}/api/team/invitations/{invitation_id}",
            headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
        )
        
        assert delete_response.status_code == 200, f"Expected 200, got {delete_response.status_code}"
        
        # Verify it's cancelled
        get_response = requests.get(
            f"{BASE_URL}/api/team/invitations",
            headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
        )
        
        invitations = get_response.json()
        cancelled_inv = next((inv for inv in invitations if inv.get('invitation_id') == invitation_id), None)
        assert cancelled_inv is not None, "Cancelled invitation should still exist"
        assert cancelled_inv.get('status') == 'cancelled', "Status should be 'cancelled'"
        
        print("PASS: Invitation successfully cancelled")
    
    def test_create_invitation_with_valid_roles(self):
        """Test that only valid roles can be used in invitations"""
        # Test with valid role
        valid_payload = {
            "email": "manager.invite@test.com",
            "name": "Manager Invite",
            "role": "manager"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/team/invitations",
            json=valid_payload,
            headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Valid role should work: {response.text}"
        print("PASS: Invitation with valid role (manager) created")
    
    def test_create_invitation_with_invalid_role_fails(self):
        """Test that invalid roles are rejected"""
        # Test with invalid role (finance - removed)
        invalid_payload = {
            "email": "finance.invite@test.com",
            "name": "Finance Invite",
            "role": "finance"  # This role was removed
        }
        
        response = requests.post(
            f"{BASE_URL}/api/team/invitations",
            json=invalid_payload,
            headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 400, f"Invalid role 'finance' should fail: {response.text}"
        print("PASS: Invalid role 'finance' correctly rejected")
        
        # Test with another invalid role (supervisor)
        invalid_payload2 = {
            "email": "supervisor.invite@test.com",
            "name": "Supervisor Invite",
            "role": "supervisor"  # This role was removed
        }
        
        response2 = requests.post(
            f"{BASE_URL}/api/team/invitations",
            json=invalid_payload2,
            headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
        )
        
        assert response2.status_code == 400, f"Invalid role 'supervisor' should fail"
        print("PASS: Invalid role 'supervisor' correctly rejected")


class TestDashboardTeamTasks:
    """Test Dashboard Team Tasks endpoint - should exclude 'not_started' status"""
    
    @pytest.fixture(autouse=True)
    def setup_test_data(self):
        """Create test project and tasks with different statuses"""
        # Create a test project first
        project_response = requests.post(
            f"{BASE_URL}/api/projects",
            json={
                "name": "Test Project for Dashboard",
                "description": "Test project for dashboard team tasks",
                "client_name": "Test Client"
            },
            headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
        )
        
        if project_response.status_code != 200:
            pytest.skip("Could not create test project")
        
        self.project_id = project_response.json()['project_id']
        
        # Create tasks with different statuses
        statuses = ['not_started', 'assigned', 'in_progress', 'on_hold', 'under_review', 'completed']
        self.task_ids = {}
        
        for status in statuses:
            task_response = requests.post(
                f"{BASE_URL}/api/tasks",
                json={
                    "project_id": self.project_id,
                    "title": f"Test Task - {status}",
                    "priority": "medium"
                },
                headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
            )
            
            if task_response.status_code == 200:
                task_id = task_response.json()['task_id']
                self.task_ids[status] = task_id
                
                # Update task status (except not_started which is default)
                if status != 'not_started':
                    requests.patch(
                        f"{BASE_URL}/api/tasks/{task_id}",
                        json={"status": status},
                        headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
                    )
        
        yield
        
        # Cleanup - delete tasks and project
        for task_id in self.task_ids.values():
            requests.delete(
                f"{BASE_URL}/api/tasks/{task_id}",
                headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
            )
        
        requests.delete(
            f"{BASE_URL}/api/projects/{self.project_id}",
            headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
        )
    
    def test_team_tasks_excludes_not_started(self):
        """GET /api/dashboard/team-tasks should NOT include 'not_started' tasks"""
        response = requests.get(
            f"{BASE_URL}/api/dashboard/team-tasks",
            headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        team_tasks = response.json()
        
        # Collect all task statuses from the response
        all_statuses = []
        for member_data in team_tasks:
            for task in member_data.get('tasks', []):
                all_statuses.append(task.get('status'))
        
        # Assert no 'not_started' tasks
        assert 'not_started' not in all_statuses, f"'not_started' should not be in team tasks. Found statuses: {set(all_statuses)}"
        
        # Assert no 'completed' tasks (as per backend code)
        assert 'completed' not in all_statuses, f"'completed' should not be in team tasks. Found statuses: {set(all_statuses)}"
        
        print(f"PASS: Team tasks excludes 'not_started' and 'completed'. Found statuses: {set(all_statuses)}")


class TestUserPermissionsEndpoint:
    """Test user permissions endpoint"""
    
    def test_get_user_permissions(self):
        """GET /api/user/permissions - Returns correct permissions for admin"""
        response = requests.get(
            f"{BASE_URL}/api/user/permissions",
            headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        data = response.json()
        assert data.get('role') == 'admin', "Should return admin role"
        assert data.get('permissions', {}).get('can_invite_team') == True, "Admin should have can_invite_team"
        
        print(f"PASS: User permissions returned correctly for role: {data.get('role')}")


class TestTeamEndpoint:
    """Test team listing endpoint"""
    
    def test_get_team_members(self):
        """GET /api/team - Returns team members list"""
        response = requests.get(
            f"{BASE_URL}/api/team",
            headers={"Authorization": f"Bearer {ADMIN_SESSION_TOKEN}"}
        )
        
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        team = response.json()
        assert isinstance(team, list), "Should return a list"
        assert len(team) >= 1, "Should have at least 1 team member (admin)"
        
        # First member should be admin
        admin_found = any(m.get('role') == 'admin' for m in team)
        assert admin_found, "Admin user should be in team list"
        
        print(f"PASS: Team endpoint returned {len(team)} members")


# Run specific tests
if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
