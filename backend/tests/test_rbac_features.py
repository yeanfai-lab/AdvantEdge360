"""
Test RBAC Features for Phase 3 and Time Tracking for Phase 1
Tests new endpoints: GET /api/roles, GET /api/user/permissions, DELETE /api/team/{user_id}
Also tests timer pause/resume, time log edit/delete, and task filtering by role
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://project-hub-360.preview.emergentagent.com').rstrip('/')

# Test credentials from setup
ADMIN_SESSION = "test_session_iter9_1772030832941"
ADMIN_USER_ID = "test-user-iter9-1772030832941"
TEAM_MEMBER_ID = "test-member-iter9-1772030832941"


class TestRolesEndpoint:
    """Tests for GET /api/roles endpoint"""

    def test_get_roles_returns_all_roles(self):
        """Test that GET /api/roles returns all available roles with permissions"""
        response = requests.get(
            f"{BASE_URL}/api/roles",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        roles = response.json()
        assert isinstance(roles, list), "Response should be a list"
        assert len(roles) == 5, f"Expected 5 roles, got {len(roles)}"
        
        # Check role IDs present
        role_ids = [r['id'] for r in roles]
        expected_roles = ['admin', 'supervisor', 'manager', 'team_lead', 'team_member']
        for expected in expected_roles:
            assert expected in role_ids, f"Role '{expected}' not found in response"
        
        # Check admin role structure
        admin_role = next(r for r in roles if r['id'] == 'admin')
        assert admin_role['level'] == 100
        assert admin_role['can_view_financial'] == True
        assert admin_role['can_manage_team'] == True
        assert 'description' in admin_role
        
        # Check supervisor role - no financial access
        supervisor_role = next(r for r in roles if r['id'] == 'supervisor')
        assert supervisor_role['level'] == 80
        assert supervisor_role['can_view_financial'] == False
        assert supervisor_role['can_manage_team'] == True
        
        # Check team_member role
        team_member_role = next(r for r in roles if r['id'] == 'team_member')
        assert team_member_role['level'] == 10
        assert team_member_role['can_view_financial'] == False
        assert team_member_role['can_manage_team'] == False
        
        print("PASS: GET /api/roles returns all roles with correct permissions")

    def test_roles_sorted_by_level_descending(self):
        """Test that roles are sorted by level in descending order"""
        response = requests.get(
            f"{BASE_URL}/api/roles",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert response.status_code == 200
        
        roles = response.json()
        levels = [r['level'] for r in roles]
        assert levels == sorted(levels, reverse=True), "Roles should be sorted by level descending"
        
        print("PASS: Roles sorted by level descending")


class TestUserPermissionsEndpoint:
    """Tests for GET /api/user/permissions endpoint"""

    def test_get_user_permissions_returns_current_user_permissions(self):
        """Test that GET /api/user/permissions returns correct permissions for current user"""
        response = requests.get(
            f"{BASE_URL}/api/user/permissions",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        perms = response.json()
        assert 'role' in perms, "Response should contain 'role'"
        assert 'level' in perms, "Response should contain 'level'"
        assert 'permissions' in perms, "Response should contain 'permissions'"
        
        # Admin user permissions
        assert perms['role'] == 'admin'
        assert perms['level'] == 100
        assert perms['permissions']['can_view_financial'] == True
        assert perms['permissions']['can_manage_team'] == True
        assert perms['permissions']['can_edit_all'] == True
        assert perms['permissions']['can_delete_all'] == True
        
        print("PASS: GET /api/user/permissions returns correct admin permissions")

    def test_permissions_without_auth_returns_401(self):
        """Test that permissions endpoint requires authentication"""
        response = requests.get(f"{BASE_URL}/api/user/permissions")
        assert response.status_code == 401, f"Expected 401 without auth, got {response.status_code}"
        
        print("PASS: /api/user/permissions requires authentication")


class TestDeleteTeamMember:
    """Tests for DELETE /api/team/{user_id} endpoint"""

    def test_admin_can_delete_team_member(self):
        """Test that admin can delete a team member"""
        response = requests.delete(
            f"{BASE_URL}/api/team/{TEAM_MEMBER_ID}",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert 'message' in data
        assert 'deleted' in data['message'].lower()
        
        print("PASS: Admin can delete team member")

    def test_cannot_delete_nonexistent_user(self):
        """Test that deleting non-existent user returns 404"""
        response = requests.delete(
            f"{BASE_URL}/api/team/nonexistent-user-id-12345",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert response.status_code == 404, f"Expected 404 for non-existent user, got {response.status_code}"
        
        print("PASS: DELETE nonexistent user returns 404")


class TestTasksFilteredByRole:
    """Tests for tasks filtering based on user role"""

    @pytest.fixture(autouse=True)
    def setup_test_data(self):
        """Create test project and task for role-based filtering test"""
        timestamp = int(time.time() * 1000)
        
        # Create a test project first
        project_response = requests.post(
            f"{BASE_URL}/api/projects",
            json={
                "name": f"TEST_RBAC_Project_{timestamp}",
                "description": "Test project for RBAC testing"
            },
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        
        if project_response.status_code == 200:
            self.test_project_id = project_response.json().get('project_id')
            
            # Create a task assigned to the admin
            task_response = requests.post(
                f"{BASE_URL}/api/tasks",
                json={
                    "project_id": self.test_project_id,
                    "title": f"TEST_RBAC_Task_{timestamp}",
                    "description": "Test task for RBAC",
                    "priority": "medium",
                    "assigned_to": ADMIN_USER_ID
                },
                headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
            )
            if task_response.status_code == 200:
                self.test_task_id = task_response.json().get('task_id')
        
        yield
        
        # Cleanup
        if hasattr(self, 'test_task_id'):
            requests.delete(
                f"{BASE_URL}/api/tasks/{self.test_task_id}",
                headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
            )
        if hasattr(self, 'test_project_id'):
            requests.delete(
                f"{BASE_URL}/api/projects/{self.test_project_id}",
                headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
            )

    def test_admin_can_see_all_tasks(self):
        """Test that admin can see all tasks"""
        response = requests.get(
            f"{BASE_URL}/api/tasks",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        tasks = response.json()
        assert isinstance(tasks, list), "Response should be a list"
        
        print(f"PASS: Admin can see all tasks ({len(tasks)} tasks)")


class TestTeamMemberRoleUpdate:
    """Tests for updating team member role and skills"""

    @pytest.fixture(autouse=True)
    def setup_test_member(self):
        """Create a test team member for update tests"""
        import pymongo
        from datetime import datetime
        
        client = pymongo.MongoClient(os.environ.get('MONGO_URL', 'mongodb://localhost:27017'))
        db = client[os.environ.get('DB_NAME', 'test_database')]
        
        timestamp = int(time.time() * 1000)
        self.update_test_member_id = f"test-update-member-{timestamp}"
        
        db.users.insert_one({
            "user_id": self.update_test_member_id,
            "email": f"update.test.{timestamp}@example.com",
            "name": "Update Test Member",
            "picture": "https://via.placeholder.com/150",
            "role": "team_member",
            "skills": ["Python"],
            "created_at": datetime.utcnow()
        })
        
        yield
        
        # Cleanup
        db.users.delete_one({"user_id": self.update_test_member_id})
        client.close()

    def test_admin_can_update_team_member_role(self):
        """Test that admin can update a team member's role"""
        response = requests.patch(
            f"{BASE_URL}/api/team/{self.update_test_member_id}",
            json={
                "role": "team_lead",
                "skills": ["Python", "Leadership", "Project Management"]
            },
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify the update
        team_response = requests.get(
            f"{BASE_URL}/api/team",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert team_response.status_code == 200
        
        team = team_response.json()
        member = next((m for m in team if m['user_id'] == self.update_test_member_id), None)
        assert member is not None, "Updated member should be in team list"
        assert member['role'] == 'team_lead', f"Role should be team_lead, got {member['role']}"
        assert 'Leadership' in member['skills'], "Skills should be updated"
        
        print("PASS: Admin can update team member role and skills")


class TestTimerPauseResume:
    """Tests for timer pause/resume endpoints"""

    @pytest.fixture(autouse=True)
    def setup_test_task(self):
        """Create test task for timer tests"""
        timestamp = int(time.time() * 1000)
        
        # Create project
        project_response = requests.post(
            f"{BASE_URL}/api/projects",
            json={
                "name": f"TEST_Timer_Project_{timestamp}",
                "description": "Test project for timer testing"
            },
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        
        if project_response.status_code == 200:
            self.test_project_id = project_response.json().get('project_id')
            
            # Create task
            task_response = requests.post(
                f"{BASE_URL}/api/tasks",
                json={
                    "project_id": self.test_project_id,
                    "title": f"TEST_Timer_Task_{timestamp}",
                    "description": "Test task for timer",
                    "priority": "medium"
                },
                headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
            )
            if task_response.status_code == 200:
                self.test_task_id = task_response.json().get('task_id')
        
        # Cancel any existing timer
        requests.delete(
            f"{BASE_URL}/api/timer/cancel",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        
        yield
        
        # Cleanup
        requests.delete(
            f"{BASE_URL}/api/timer/cancel",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        if hasattr(self, 'test_task_id'):
            requests.delete(
                f"{BASE_URL}/api/tasks/{self.test_task_id}",
                headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
            )
        if hasattr(self, 'test_project_id'):
            requests.delete(
                f"{BASE_URL}/api/projects/{self.test_project_id}",
                headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
            )

    def test_timer_pause_resume_flow(self):
        """Test full timer pause/resume workflow"""
        # Start timer
        start_response = requests.post(
            f"{BASE_URL}/api/timer/start",
            params={"task_id": self.test_task_id, "description": "Test timer"},
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert start_response.status_code == 200, f"Start timer failed: {start_response.text}"
        
        # Wait a bit
        time.sleep(1)
        
        # Pause timer
        pause_response = requests.post(
            f"{BASE_URL}/api/timer/pause",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert pause_response.status_code == 200, f"Pause timer failed: {pause_response.text}"
        
        pause_data = pause_response.json()
        assert 'elapsed_seconds' in pause_data, "Pause should return elapsed_seconds"
        
        # Check active timer shows paused state
        active_response = requests.get(
            f"{BASE_URL}/api/timer/active",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert active_response.status_code == 200
        active_data = active_response.json()
        assert active_data['is_paused'] == True, "Timer should be paused"
        
        # Resume timer
        resume_response = requests.post(
            f"{BASE_URL}/api/timer/resume",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert resume_response.status_code == 200, f"Resume timer failed: {resume_response.text}"
        
        # Check timer is no longer paused
        active_response2 = requests.get(
            f"{BASE_URL}/api/timer/active",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert active_response2.status_code == 200
        active_data2 = active_response2.json()
        assert active_data2['is_paused'] == False, "Timer should not be paused after resume"
        
        # Stop timer
        stop_response = requests.post(
            f"{BASE_URL}/api/timer/stop",
            params={"billable": True},
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert stop_response.status_code == 200, f"Stop timer failed: {stop_response.text}"
        
        print("PASS: Timer pause/resume flow works correctly")


class TestTimeLogEditDelete:
    """Tests for time log edit and delete endpoints"""

    @pytest.fixture(autouse=True)
    def setup_time_log(self):
        """Create test time log for edit/delete tests"""
        timestamp = int(time.time() * 1000)
        
        # Create project
        project_response = requests.post(
            f"{BASE_URL}/api/projects",
            json={
                "name": f"TEST_TimeLog_Project_{timestamp}",
                "description": "Test project for time log testing"
            },
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        
        if project_response.status_code == 200:
            self.test_project_id = project_response.json().get('project_id')
            
            # Create task
            task_response = requests.post(
                f"{BASE_URL}/api/tasks",
                json={
                    "project_id": self.test_project_id,
                    "title": f"TEST_TimeLog_Task_{timestamp}",
                    "priority": "medium"
                },
                headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
            )
            if task_response.status_code == 200:
                self.test_task_id = task_response.json().get('task_id')
                
                # Create time log
                log_response = requests.post(
                    f"{BASE_URL}/api/time-logs",
                    json={
                        "task_id": self.test_task_id,
                        "duration_minutes": 60,
                        "description": "Test time log",
                        "date": "2026-01-15",
                        "billable": True
                    },
                    headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
                )
                if log_response.status_code == 200:
                    self.test_log_id = log_response.json().get('log_id')
        
        yield
        
        # Cleanup
        if hasattr(self, 'test_log_id'):
            requests.delete(
                f"{BASE_URL}/api/time-logs/{self.test_log_id}",
                headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
            )
        if hasattr(self, 'test_task_id'):
            requests.delete(
                f"{BASE_URL}/api/tasks/{self.test_task_id}",
                headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
            )
        if hasattr(self, 'test_project_id'):
            requests.delete(
                f"{BASE_URL}/api/projects/{self.test_project_id}",
                headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
            )

    def test_edit_time_log(self):
        """Test editing a time log"""
        response = requests.patch(
            f"{BASE_URL}/api/time-logs/{self.test_log_id}",
            json={
                "duration_minutes": 90,
                "description": "Updated description",
                "billable": False
            },
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert response.status_code == 200, f"Edit time log failed: {response.text}"
        
        # Verify update
        logs_response = requests.get(
            f"{BASE_URL}/api/time-logs",
            params={"task_id": self.test_task_id},
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert logs_response.status_code == 200
        
        logs = logs_response.json()
        log = next((l for l in logs if l['log_id'] == self.test_log_id), None)
        assert log is not None, "Log should exist"
        assert log['duration_minutes'] == 90, f"Duration should be 90, got {log['duration_minutes']}"
        assert log['billable'] == False, "Billable should be False"
        
        print("PASS: Time log edit works correctly")

    def test_delete_time_log(self):
        """Test deleting a time log"""
        # Create another log for deletion test
        log_response = requests.post(
            f"{BASE_URL}/api/time-logs",
            json={
                "task_id": self.test_task_id,
                "duration_minutes": 30,
                "description": "Log to delete",
                "date": "2026-01-15",
                "billable": True
            },
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert log_response.status_code == 200
        delete_log_id = log_response.json().get('log_id')
        
        # Delete the log
        delete_response = requests.delete(
            f"{BASE_URL}/api/time-logs/{delete_log_id}",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert delete_response.status_code == 200, f"Delete time log failed: {delete_response.text}"
        
        # Verify deletion
        delete_response2 = requests.delete(
            f"{BASE_URL}/api/time-logs/{delete_log_id}",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert delete_response2.status_code == 404, "Deleted log should return 404"
        
        print("PASS: Time log delete works correctly")


class TestTaskCreationWithAutoSubtasks:
    """Tests for task creation with auto-subtasks feature"""

    @pytest.fixture(autouse=True)
    def setup_project(self):
        """Create test project for task creation tests"""
        timestamp = int(time.time() * 1000)
        
        project_response = requests.post(
            f"{BASE_URL}/api/projects",
            json={
                "name": f"TEST_AutoSubtask_Project_{timestamp}",
                "description": "Test project for auto-subtask testing"
            },
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        
        if project_response.status_code == 200:
            self.test_project_id = project_response.json().get('project_id')
        
        self.created_task_ids = []
        
        yield
        
        # Cleanup
        for task_id in self.created_task_ids:
            requests.delete(
                f"{BASE_URL}/api/tasks/{task_id}",
                headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
            )
        if hasattr(self, 'test_project_id'):
            requests.delete(
                f"{BASE_URL}/api/projects/{self.test_project_id}",
                headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
            )

    def test_create_task_as_subtask_of_existing_task(self):
        """Test creating a task as subtask of an existing parent task"""
        timestamp = int(time.time() * 1000)
        
        # Create parent task
        parent_response = requests.post(
            f"{BASE_URL}/api/tasks",
            json={
                "project_id": self.test_project_id,
                "title": f"TEST_Parent_Task_{timestamp}",
                "description": "Parent task",
                "priority": "high"
            },
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert parent_response.status_code == 200, f"Create parent failed: {parent_response.text}"
        parent_task_id = parent_response.json().get('task_id')
        self.created_task_ids.append(parent_task_id)
        
        # Create child task with parent_task_id
        child_response = requests.post(
            f"{BASE_URL}/api/tasks",
            json={
                "project_id": self.test_project_id,
                "title": f"TEST_Child_Task_{timestamp}",
                "description": "Child task",
                "priority": "medium",
                "parent_task_id": parent_task_id
            },
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert child_response.status_code == 200, f"Create child failed: {child_response.text}"
        child_task_id = child_response.json().get('task_id')
        self.created_task_ids.insert(0, child_task_id)  # Delete child first
        
        # Verify parent task has subtask
        parent_detail = requests.get(
            f"{BASE_URL}/api/tasks/{parent_task_id}",
            headers={"Authorization": f"Bearer {ADMIN_SESSION}"}
        )
        assert parent_detail.status_code == 200
        parent_data = parent_detail.json()
        assert child_task_id in parent_data.get('subtasks', []), "Child should be in parent's subtasks"
        
        print("PASS: Task creation with parent_task_id works correctly")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
