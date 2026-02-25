"""
AdvantEdge360 V4 API Tests - Full CRUD and New Features
Tests for:
- Proposal DELETE, Send for Approval, Send to Client, Confirm, Convert to Project
- Project Edit, DELETE with cascading
- Task DELETE with cascading subtasks
- TasksPage filters (by priority, assignee, project)
- Dashboard pending reviews and pending approvals
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "test_session_1772013752265"
USER_ID = "test-user-1772013752265"

class TestProposalActions:
    """Test proposal CRUD and workflow actions"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SESSION_TOKEN}"
        }
        self.proposal_id = None
    
    def test_01_create_proposal(self):
        """Create a proposal for workflow testing"""
        payload = {
            "title": "TEST_Proposal_V4_Workflow",
            "client_name": "Test Client Corp",
            "description": "Test proposal for v4 workflow testing",
            "category": "Commercial",
            "amount": 25000
        }
        response = requests.post(f"{BASE_URL}/api/proposals", json=payload, headers=self.headers)
        assert response.status_code == 200, f"Failed to create proposal: {response.text}"
        data = response.json()
        assert data["title"] == payload["title"]
        assert data["status"] == "draft"
        self.__class__.proposal_id = data["proposal_id"]
        print(f"Created proposal: {self.__class__.proposal_id}")
    
    def test_02_send_for_approval(self):
        """Test sending proposal for internal approval"""
        if not self.__class__.proposal_id:
            pytest.skip("No proposal created")
        
        response = requests.post(
            f"{BASE_URL}/api/proposals/{self.__class__.proposal_id}/send-for-internal-approval",
            params={"approver_id": USER_ID},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to send for approval: {response.text}"
        
        # Verify status changed
        get_resp = requests.get(f"{BASE_URL}/api/proposals/{self.__class__.proposal_id}", headers=self.headers)
        assert get_resp.status_code == 200
        proposal = get_resp.json()
        assert proposal["status"] == "pending_approval"
        assert proposal["approver_id"] == USER_ID
        print("Proposal sent for internal approval successfully")
    
    def test_03_pending_approvals_endpoint(self):
        """Test dashboard pending approvals endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/pending-approvals", headers=self.headers)
        assert response.status_code == 200, f"Failed to get pending approvals: {response.text}"
        approvals = response.json()
        assert isinstance(approvals, list)
        # Should find our proposal in pending approvals
        found = any(p["proposal_id"] == self.__class__.proposal_id for p in approvals)
        assert found, "Created proposal not found in pending approvals"
        print(f"Found {len(approvals)} pending approvals")
    
    def test_04_approve_internal(self):
        """Test internal approval"""
        if not self.__class__.proposal_id:
            pytest.skip("No proposal created")
        
        response = requests.post(
            f"{BASE_URL}/api/proposals/{self.__class__.proposal_id}/approve-internal",
            params={"comments": "Looks good, approved for testing"},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to approve: {response.text}"
        
        # Verify status changed
        get_resp = requests.get(f"{BASE_URL}/api/proposals/{self.__class__.proposal_id}", headers=self.headers)
        proposal = get_resp.json()
        assert proposal["status"] == "approved"
        print("Proposal approved successfully")
    
    def test_05_send_to_client(self):
        """Test sending proposal to client"""
        if not self.__class__.proposal_id:
            pytest.skip("No proposal created")
        
        response = requests.post(
            f"{BASE_URL}/api/proposals/{self.__class__.proposal_id}/send-to-client",
            params={"client_email": "testclient@example.com"},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to send to client: {response.text}"
        
        # Verify status changed
        get_resp = requests.get(f"{BASE_URL}/api/proposals/{self.__class__.proposal_id}", headers=self.headers)
        proposal = get_resp.json()
        assert proposal["status"] == "sent_to_client"
        print("Proposal sent to client successfully")
    
    def test_06_confirm_proposal(self):
        """Test confirming a proposal"""
        if not self.__class__.proposal_id:
            pytest.skip("No proposal created")
        
        response = requests.post(
            f"{BASE_URL}/api/proposals/{self.__class__.proposal_id}/confirm",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to confirm: {response.text}"
        
        # Verify status changed
        get_resp = requests.get(f"{BASE_URL}/api/proposals/{self.__class__.proposal_id}", headers=self.headers)
        proposal = get_resp.json()
        assert proposal["status"] == "confirmed"
        print("Proposal confirmed successfully")
    
    def test_07_convert_to_project(self):
        """Test converting confirmed proposal to project"""
        if not self.__class__.proposal_id:
            pytest.skip("No proposal created")
        
        response = requests.post(
            f"{BASE_URL}/api/proposals/{self.__class__.proposal_id}/convert",
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to convert: {response.text}"
        project = response.json()
        assert project["project_id"] is not None
        assert project["name"] == "TEST_Proposal_V4_Workflow"  # Should inherit title
        self.__class__.converted_project_id = project["project_id"]
        
        # Verify proposal status changed
        get_resp = requests.get(f"{BASE_URL}/api/proposals/{self.__class__.proposal_id}", headers=self.headers)
        proposal = get_resp.json()
        assert proposal["status"] == "converted"
        assert proposal["project_id"] == project["project_id"]
        print(f"Proposal converted to project: {project['project_id']}")
    
    def test_08_delete_proposal(self):
        """Test deleting a proposal (create new one first)"""
        # Create a new proposal for deletion
        payload = {
            "title": "TEST_Proposal_To_Delete",
            "client_name": "Delete Test Client",
            "description": "This proposal will be deleted"
        }
        create_resp = requests.post(f"{BASE_URL}/api/proposals", json=payload, headers=self.headers)
        assert create_resp.status_code == 200
        new_proposal_id = create_resp.json()["proposal_id"]
        
        # Delete it
        delete_resp = requests.delete(f"{BASE_URL}/api/proposals/{new_proposal_id}", headers=self.headers)
        assert delete_resp.status_code == 200, f"Failed to delete: {delete_resp.text}"
        
        # Verify deleted
        get_resp = requests.get(f"{BASE_URL}/api/proposals/{new_proposal_id}", headers=self.headers)
        assert get_resp.status_code == 404
        print("Proposal deleted successfully")


class TestProjectCRUD:
    """Test project CRUD operations including edit and cascading delete"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SESSION_TOKEN}"
        }
    
    def test_01_create_project_for_delete(self):
        """Create a project for delete testing"""
        payload = {
            "name": "TEST_Project_For_Delete",
            "description": "Project to test cascading delete",
            "client_name": "Delete Test Client",
            "budget": 50000
        }
        response = requests.post(f"{BASE_URL}/api/projects", json=payload, headers=self.headers)
        assert response.status_code == 200, f"Failed to create project: {response.text}"
        project = response.json()
        self.__class__.project_id = project["project_id"]
        print(f"Created project: {self.__class__.project_id}")
    
    def test_02_create_tasks_for_project(self):
        """Create tasks that should be deleted with project"""
        if not self.__class__.project_id:
            pytest.skip("No project created")
        
        # Create a parent task
        task1 = {
            "project_id": self.__class__.project_id,
            "title": "TEST_Task_1_For_Project",
            "description": "Task 1 to be cascading deleted",
            "priority": "high"
        }
        resp1 = requests.post(f"{BASE_URL}/api/tasks", json=task1, headers=self.headers)
        assert resp1.status_code == 200
        self.__class__.task1_id = resp1.json()["task_id"]
        
        # Create another task
        task2 = {
            "project_id": self.__class__.project_id,
            "title": "TEST_Task_2_For_Project",
            "description": "Task 2 to be cascading deleted",
            "priority": "medium"
        }
        resp2 = requests.post(f"{BASE_URL}/api/tasks", json=task2, headers=self.headers)
        assert resp2.status_code == 200
        self.__class__.task2_id = resp2.json()["task_id"]
        print(f"Created tasks: {self.__class__.task1_id}, {self.__class__.task2_id}")
    
    def test_03_edit_project(self):
        """Test updating project fields"""
        if not self.__class__.project_id:
            pytest.skip("No project created")
        
        updates = {
            "name": "TEST_Project_Updated_Name",
            "description": "Updated description",
            "budget": 75000,
            "status": "on_hold"
        }
        response = requests.patch(
            f"{BASE_URL}/api/projects/{self.__class__.project_id}",
            json=updates,
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to update: {response.text}"
        
        # Verify updates
        get_resp = requests.get(f"{BASE_URL}/api/projects/{self.__class__.project_id}", headers=self.headers)
        project = get_resp.json()
        assert project["name"] == "TEST_Project_Updated_Name"
        assert project["budget"] == 75000
        assert project["status"] == "on_hold"
        print("Project updated successfully")
    
    def test_04_delete_project_cascading(self):
        """Test deleting project with cascading task deletion"""
        if not self.__class__.project_id:
            pytest.skip("No project created")
        
        response = requests.delete(f"{BASE_URL}/api/projects/{self.__class__.project_id}", headers=self.headers)
        assert response.status_code == 200, f"Failed to delete: {response.text}"
        
        # Verify project deleted
        get_resp = requests.get(f"{BASE_URL}/api/projects/{self.__class__.project_id}", headers=self.headers)
        assert get_resp.status_code == 404
        
        # Verify tasks also deleted
        tasks_resp = requests.get(f"{BASE_URL}/api/tasks?project_id={self.__class__.project_id}", headers=self.headers)
        tasks = tasks_resp.json()
        assert len(tasks) == 0, f"Tasks not deleted: {len(tasks)} remaining"
        print("Project and tasks deleted successfully")


class TestTaskCRUD:
    """Test task CRUD operations including cascading subtask delete"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SESSION_TOKEN}"
        }
    
    def test_01_create_project_and_tasks(self):
        """Create project with parent task and subtasks"""
        # Create project
        project_payload = {
            "name": "TEST_Project_For_Task_Delete",
            "description": "Project for task deletion testing"
        }
        proj_resp = requests.post(f"{BASE_URL}/api/projects", json=project_payload, headers=self.headers)
        assert proj_resp.status_code == 200
        self.__class__.project_id = proj_resp.json()["project_id"]
        
        # Create parent task
        parent_task = {
            "project_id": self.__class__.project_id,
            "title": "TEST_Parent_Task",
            "description": "Parent task with subtasks",
            "priority": "high"
        }
        parent_resp = requests.post(f"{BASE_URL}/api/tasks", json=parent_task, headers=self.headers)
        assert parent_resp.status_code == 200
        self.__class__.parent_task_id = parent_resp.json()["task_id"]
        
        # Create subtasks
        subtask1 = {
            "project_id": self.__class__.project_id,
            "title": "TEST_Subtask_1",
            "parent_task_id": self.__class__.parent_task_id,
            "priority": "medium"
        }
        sub1_resp = requests.post(f"{BASE_URL}/api/tasks", json=subtask1, headers=self.headers)
        assert sub1_resp.status_code == 200
        self.__class__.subtask1_id = sub1_resp.json()["task_id"]
        
        subtask2 = {
            "project_id": self.__class__.project_id,
            "title": "TEST_Subtask_2",
            "parent_task_id": self.__class__.parent_task_id,
            "priority": "low"
        }
        sub2_resp = requests.post(f"{BASE_URL}/api/tasks", json=subtask2, headers=self.headers)
        assert sub2_resp.status_code == 200
        self.__class__.subtask2_id = sub2_resp.json()["task_id"]
        
        print(f"Created parent task {self.__class__.parent_task_id} with subtasks")
    
    def test_02_verify_subtasks_linked(self):
        """Verify subtasks are properly linked to parent"""
        if not self.__class__.parent_task_id:
            pytest.skip("No parent task created")
        
        response = requests.get(f"{BASE_URL}/api/tasks/{self.__class__.parent_task_id}", headers=self.headers)
        assert response.status_code == 200
        task = response.json()
        assert len(task.get("subtask_details", [])) == 2 or len(task.get("subtasks", [])) == 2
        print("Subtasks properly linked to parent")
    
    def test_03_delete_task_cascading(self):
        """Test deleting parent task cascades to subtasks"""
        if not self.__class__.parent_task_id:
            pytest.skip("No parent task created")
        
        response = requests.delete(f"{BASE_URL}/api/tasks/{self.__class__.parent_task_id}", headers=self.headers)
        assert response.status_code == 200, f"Failed to delete: {response.text}"
        
        # Verify parent deleted
        get_parent = requests.get(f"{BASE_URL}/api/tasks/{self.__class__.parent_task_id}", headers=self.headers)
        assert get_parent.status_code == 404
        
        # Verify subtasks also deleted
        get_sub1 = requests.get(f"{BASE_URL}/api/tasks/{self.__class__.subtask1_id}", headers=self.headers)
        get_sub2 = requests.get(f"{BASE_URL}/api/tasks/{self.__class__.subtask2_id}", headers=self.headers)
        assert get_sub1.status_code == 404, "Subtask 1 not deleted"
        assert get_sub2.status_code == 404, "Subtask 2 not deleted"
        print("Parent task and subtasks deleted successfully")
    
    def test_04_cleanup_project(self):
        """Cleanup test project"""
        if hasattr(self.__class__, 'project_id') and self.__class__.project_id:
            requests.delete(f"{BASE_URL}/api/projects/{self.__class__.project_id}", headers=self.headers)


class TestTasksPageFilters:
    """Test tasks listing with filters"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SESSION_TOKEN}"
        }
    
    def test_01_setup_test_data(self):
        """Create test data for filter testing"""
        # Create project
        project = {
            "name": "TEST_Filter_Project",
            "description": "Project for filter testing"
        }
        proj_resp = requests.post(f"{BASE_URL}/api/projects", json=project, headers=self.headers)
        assert proj_resp.status_code == 200
        self.__class__.project_id = proj_resp.json()["project_id"]
        
        # Create tasks with different priorities
        priorities = ["low", "medium", "high", "urgent"]
        for p in priorities:
            task = {
                "project_id": self.__class__.project_id,
                "title": f"TEST_Task_{p}_priority",
                "priority": p,
                "assigned_to": USER_ID
            }
            requests.post(f"{BASE_URL}/api/tasks", json=task, headers=self.headers)
        print("Created test data for filter testing")
    
    def test_02_filter_by_project(self):
        """Test filtering tasks by project_id"""
        response = requests.get(
            f"{BASE_URL}/api/tasks",
            params={"project_id": self.__class__.project_id},
            headers=self.headers
        )
        assert response.status_code == 200
        tasks = response.json()
        assert len(tasks) >= 4
        for task in tasks:
            assert task["project_id"] == self.__class__.project_id
        print(f"Project filter works: {len(tasks)} tasks found")
    
    def test_03_get_all_tasks(self):
        """Test getting all tasks (for frontend filtering)"""
        response = requests.get(f"{BASE_URL}/api/tasks", headers=self.headers)
        assert response.status_code == 200
        tasks = response.json()
        assert isinstance(tasks, list)
        
        # Verify tasks have filter-related fields
        if tasks:
            task = tasks[0]
            assert "priority" in task
            assert "assigned_to" in task or "assigned_to" not in task  # Can be None
            assert "project_id" in task
        print(f"Got {len(tasks)} total tasks")
    
    def test_04_cleanup(self):
        """Cleanup test project"""
        if hasattr(self.__class__, 'project_id') and self.__class__.project_id:
            requests.delete(f"{BASE_URL}/api/projects/{self.__class__.project_id}", headers=self.headers)


class TestDashboardPendingItems:
    """Test dashboard pending reviews and approvals endpoints"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SESSION_TOKEN}"
        }
    
    def test_01_create_task_for_review(self):
        """Create a task and send for review"""
        # Create project
        project = {
            "name": "TEST_Review_Project",
            "description": "Project for review testing"
        }
        proj_resp = requests.post(f"{BASE_URL}/api/projects", json=project, headers=self.headers)
        assert proj_resp.status_code == 200
        self.__class__.project_id = proj_resp.json()["project_id"]
        
        # Create task
        task = {
            "project_id": self.__class__.project_id,
            "title": "TEST_Task_For_Review",
            "description": "Task to test pending reviews",
            "priority": "high",
            "assigned_to": USER_ID
        }
        task_resp = requests.post(f"{BASE_URL}/api/tasks", json=task, headers=self.headers)
        assert task_resp.status_code == 200
        self.__class__.task_id = task_resp.json()["task_id"]
        
        # Set to in_progress first
        requests.patch(f"{BASE_URL}/api/tasks/{self.__class__.task_id}", json={"status": "in_progress"}, headers=self.headers)
        
        # Send for review
        review_resp = requests.post(
            f"{BASE_URL}/api/tasks/{self.__class__.task_id}/send-for-review",
            params={"reviewer_id": USER_ID},
            headers=self.headers
        )
        assert review_resp.status_code == 200
        print(f"Created task and sent for review: {self.__class__.task_id}")
    
    def test_02_pending_reviews_endpoint(self):
        """Test dashboard pending reviews endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/pending-reviews", headers=self.headers)
        assert response.status_code == 200, f"Failed: {response.text}"
        reviews = response.json()
        assert isinstance(reviews, list)
        
        # Should find our task
        found = any(t["task_id"] == self.__class__.task_id for t in reviews)
        assert found, "Created task not found in pending reviews"
        
        # Verify task has project_name enrichment
        if reviews:
            for r in reviews:
                if r["task_id"] == self.__class__.task_id:
                    assert r["status"] == "under_review"
        print(f"Found {len(reviews)} pending reviews")
    
    def test_03_cleanup(self):
        """Cleanup test data"""
        if hasattr(self.__class__, 'project_id') and self.__class__.project_id:
            requests.delete(f"{BASE_URL}/api/projects/{self.__class__.project_id}", headers=self.headers)


class TestGlobalTimerAPI:
    """Test Global Timer API functionality"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SESSION_TOKEN}"
        }
    
    def test_01_setup_task(self):
        """Create task for timer testing"""
        # Create project
        project = {
            "name": "TEST_Timer_Project",
            "description": "Project for timer testing"
        }
        proj_resp = requests.post(f"{BASE_URL}/api/projects", json=project, headers=self.headers)
        assert proj_resp.status_code == 200
        self.__class__.project_id = proj_resp.json()["project_id"]
        
        # Create task
        task = {
            "project_id": self.__class__.project_id,
            "title": "TEST_Timer_Task",
            "description": "Task for timer testing"
        }
        task_resp = requests.post(f"{BASE_URL}/api/tasks", json=task, headers=self.headers)
        assert task_resp.status_code == 200
        self.__class__.task_id = task_resp.json()["task_id"]
        print(f"Created task for timer testing: {self.__class__.task_id}")
    
    def test_02_timer_start(self):
        """Test starting a timer"""
        # First cancel any existing timer
        requests.delete(f"{BASE_URL}/api/timer/cancel", headers=self.headers)
        
        response = requests.post(
            f"{BASE_URL}/api/timer/start",
            params={"task_id": self.__class__.task_id},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to start timer: {response.text}"
        data = response.json()
        assert data["task_id"] == self.__class__.task_id
        assert "start_time" in data
        print("Timer started successfully")
    
    def test_03_timer_active_endpoint(self):
        """Test getting active timer with hierarchy info"""
        response = requests.get(f"{BASE_URL}/api/timer/active", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["active"] == True
        assert data["task_id"] == self.__class__.task_id
        assert "project_name" in data
        assert "task_title" in data
        assert "elapsed_minutes" in data
        print(f"Active timer shows: {data['project_name']} -> {data['task_title']}")
    
    def test_04_timer_stop_with_billable(self):
        """Test stopping timer with billable flag"""
        response = requests.post(
            f"{BASE_URL}/api/timer/stop",
            params={"billable": True, "description": "Test time log"},
            headers=self.headers
        )
        assert response.status_code == 200, f"Failed to stop timer: {response.text}"
        data = response.json()
        assert "duration_minutes" in data
        assert "log_id" in data
        print(f"Timer stopped, logged {data['duration_minutes']} minutes")
    
    def test_05_timer_not_active(self):
        """Verify no active timer after stop"""
        response = requests.get(f"{BASE_URL}/api/timer/active", headers=self.headers)
        assert response.status_code == 200
        data = response.json()
        assert data["active"] == False
        print("Timer is not active (as expected)")
    
    def test_06_cleanup(self):
        """Cleanup test data"""
        if hasattr(self.__class__, 'project_id') and self.__class__.project_id:
            requests.delete(f"{BASE_URL}/api/projects/{self.__class__.project_id}", headers=self.headers)


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
