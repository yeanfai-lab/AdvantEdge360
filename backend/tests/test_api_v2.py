"""
Backend API Tests for AdvantEdge360
Testing: Proposals (CRUD + approval workflow), Projects (CRUD + detail), Tasks (CRUD + comments), Dashboard endpoints
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = os.environ.get('TEST_SESSION_TOKEN', '')

@pytest.fixture(scope="module")
def api_client():
    """Shared requests session with auth"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SESSION_TOKEN}"
    })
    return session


class TestAuthEndpoints:
    """Authentication endpoints tests"""
    
    def test_auth_me_returns_user(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert "name" in data
        print(f"[PASS] Auth /me returns user: {data.get('name')}")


class TestProposalEndpoints:
    """Proposal CRUD and workflow tests"""
    
    created_proposal_id = None
    
    def test_create_proposal_with_new_fields(self, api_client):
        """Test creating proposal with category, requirement, scope_area fields"""
        payload = {
            "title": "TEST_Proposal_" + str(os.getpid()),
            "client_name": "Test Client Co",
            "description": "Test proposal description for comprehensive testing",
            "amount": 25000.00,
            "category": "Commercial",
            "requirement": "Client needs full office renovation",
            "scope_area": "Main office building - floors 1-3"
        }
        response = api_client.post(f"{BASE_URL}/api/proposals", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("proposal_id"), "Proposal ID should be returned"
        assert data.get("category") == "Commercial", f"Category should be 'Commercial', got {data.get('category')}"
        TestProposalEndpoints.created_proposal_id = data["proposal_id"]
        print(f"[PASS] Created proposal with ID: {data['proposal_id']}")
    
    def test_get_proposals_list(self, api_client):
        """Test getting list of proposals"""
        response = api_client.get(f"{BASE_URL}/api/proposals")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Should return list of proposals"
        print(f"[PASS] Got {len(data)} proposals")
    
    def test_get_proposal_detail(self, api_client):
        """Test getting single proposal detail"""
        proposal_id = TestProposalEndpoints.created_proposal_id
        if not proposal_id:
            pytest.skip("No proposal created to test detail")
        
        response = api_client.get(f"{BASE_URL}/api/proposals/{proposal_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("proposal_id") == proposal_id
        assert data.get("category") == "Commercial"
        assert "requirement" in data
        assert "scope_area" in data
        print(f"[PASS] Got proposal detail for: {proposal_id}")
    
    def test_update_proposal(self, api_client):
        """Test PATCH /api/proposals/{id} to update proposal"""
        proposal_id = TestProposalEndpoints.created_proposal_id
        if not proposal_id:
            pytest.skip("No proposal created to update")
        
        updates = {
            "title": "TEST_Updated_Proposal",
            "amount": 35000.00,
            "final_proposal": "This is the final proposal content after review"
        }
        response = api_client.patch(f"{BASE_URL}/api/proposals/{proposal_id}", json=updates)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify update was persisted
        verify_response = api_client.get(f"{BASE_URL}/api/proposals/{proposal_id}")
        assert verify_response.status_code == 200
        data = verify_response.json()
        assert data.get("title") == "TEST_Updated_Proposal"
        assert data.get("amount") == 35000.00
        assert data.get("final_proposal") == "This is the final proposal content after review"
        print(f"[PASS] Updated proposal and verified persistence")
    
    def test_approve_proposal(self, api_client):
        """Test approving proposal"""
        proposal_id = TestProposalEndpoints.created_proposal_id
        if not proposal_id:
            pytest.skip("No proposal created to approve")
        
        response = api_client.post(f"{BASE_URL}/api/proposals/{proposal_id}/approve")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify status changed
        verify_response = api_client.get(f"{BASE_URL}/api/proposals/{proposal_id}")
        data = verify_response.json()
        assert data.get("status") == "approved"
        print(f"[PASS] Proposal approved, status: {data.get('status')}")


class TestProjectEndpoints:
    """Project CRUD and stats tests"""
    
    created_project_id = None
    
    def test_create_project(self, api_client):
        """Test creating project"""
        payload = {
            "name": "TEST_Project_" + str(os.getpid()),
            "description": "Test project for comprehensive testing",
            "client_name": "Test Client Corp",
            "budget": 100000.00,
            "start_date": "2026-01-15",
            "end_date": "2026-06-30"
        }
        response = api_client.post(f"{BASE_URL}/api/projects", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("project_id"), "Project ID should be returned"
        TestProjectEndpoints.created_project_id = data["project_id"]
        print(f"[PASS] Created project: {data['project_id']}")
    
    def test_get_projects_list(self, api_client):
        """Test getting list of projects"""
        response = api_client.get(f"{BASE_URL}/api/projects")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"[PASS] Got {len(data)} projects")
    
    def test_get_project_detail(self, api_client):
        """Test getting single project detail"""
        project_id = TestProjectEndpoints.created_project_id
        if not project_id:
            pytest.skip("No project created")
        
        response = api_client.get(f"{BASE_URL}/api/projects/{project_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert data.get("project_id") == project_id
        assert "completion_percentage" in data
        print(f"[PASS] Got project detail: {project_id}")
    
    def test_get_project_stats(self, api_client):
        """Test /api/projects/{id}/stats endpoint"""
        project_id = TestProjectEndpoints.created_project_id
        if not project_id:
            pytest.skip("No project created")
        
        response = api_client.get(f"{BASE_URL}/api/projects/{project_id}/stats")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert "total_tasks" in data
        assert "completed" in data
        assert "in_progress" in data
        assert "completion_percentage" in data
        print(f"[PASS] Got project stats: {data}")


class TestTaskEndpoints:
    """Task CRUD, status change, and comments tests"""
    
    created_task_id = None
    
    def test_create_task_within_project(self, api_client):
        """Test creating task within a project"""
        project_id = TestProjectEndpoints.created_project_id
        if not project_id:
            pytest.skip("No project available for task creation")
        
        payload = {
            "project_id": project_id,
            "title": "TEST_Task_" + str(os.getpid()),
            "description": "Test task for comprehensive testing",
            "priority": "high",
            "due_date": "2026-02-15"
        }
        response = api_client.post(f"{BASE_URL}/api/tasks", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("task_id"), "Task ID should be returned"
        assert data.get("project_id") == project_id
        TestTaskEndpoints.created_task_id = data["task_id"]
        print(f"[PASS] Created task: {data['task_id']}")
    
    def test_get_tasks_by_project(self, api_client):
        """Test getting tasks filtered by project"""
        project_id = TestProjectEndpoints.created_project_id
        if not project_id:
            pytest.skip("No project available")
        
        response = api_client.get(f"{BASE_URL}/api/tasks?project_id={project_id}")
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0, "Should have at least one task"
        print(f"[PASS] Got {len(data)} tasks for project")
    
    def test_change_task_status(self, api_client):
        """Test changing task status via PATCH"""
        task_id = TestTaskEndpoints.created_task_id
        if not task_id:
            pytest.skip("No task created")
        
        response = api_client.patch(f"{BASE_URL}/api/tasks/{task_id}", json={"status": "in_progress"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify status changed
        verify_response = api_client.get(f"{BASE_URL}/api/tasks")
        tasks = verify_response.json()
        task = next((t for t in tasks if t["task_id"] == task_id), None)
        assert task is not None, "Task should be found"
        assert task.get("status") == "in_progress"
        print(f"[PASS] Task status changed to: {task.get('status')}")
    
    def test_add_comment_to_task(self, api_client):
        """Test /api/tasks/{id}/add-comment endpoint"""
        task_id = TestTaskEndpoints.created_task_id
        if not task_id:
            pytest.skip("No task created")
        
        response = api_client.post(
            f"{BASE_URL}/api/tasks/{task_id}/add-comment",
            params={"comment": "This is a test comment from API testing"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify comment was added
        verify_response = api_client.get(f"{BASE_URL}/api/tasks")
        tasks = verify_response.json()
        task = next((t for t in tasks if t["task_id"] == task_id), None)
        assert task is not None
        comments = task.get("comments", [])
        assert len(comments) > 0, "Should have at least one comment"
        assert comments[-1].get("comment") == "This is a test comment from API testing"
        print(f"[PASS] Comment added to task, total comments: {len(comments)}")


class TestDashboardEndpoints:
    """Dashboard specific endpoints tests"""
    
    def test_get_my_tasks(self, api_client):
        """Test /api/dashboard/my-tasks endpoint"""
        response = api_client.get(f"{BASE_URL}/api/dashboard/my-tasks")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        assert isinstance(data, list), "Should return list of tasks"
        print(f"[PASS] Got my tasks: {len(data)} tasks")
    
    def test_get_team_tasks(self, api_client):
        """Test /api/dashboard/team-tasks endpoint"""
        response = api_client.get(f"{BASE_URL}/api/dashboard/team-tasks")
        # May return 403 if not admin/manager, or 200 if authorized
        assert response.status_code in [200, 403], f"Expected 200 or 403, got {response.status_code}"
        if response.status_code == 200:
            data = response.json()
            assert isinstance(data, list)
            print(f"[PASS] Got team tasks: {len(data)} team members")
        else:
            print(f"[PASS] Team tasks restricted (expected for non-managers)")


class TestProposalWorkflow:
    """Test the full proposal approval workflow"""
    
    workflow_proposal_id = None
    
    def test_create_workflow_proposal(self, api_client):
        """Create proposal for workflow testing"""
        payload = {
            "title": "TEST_Workflow_Proposal",
            "client_name": "Workflow Test Client",
            "description": "Testing approval workflow",
            "amount": 50000.00,
            "category": "Institutional"
        }
        response = api_client.post(f"{BASE_URL}/api/proposals", json=payload)
        assert response.status_code == 200
        data = response.json()
        TestProposalWorkflow.workflow_proposal_id = data["proposal_id"]
        assert data.get("status") == "draft"
        print(f"[PASS] Created workflow proposal in draft status")
    
    def test_send_for_internal_approval(self, api_client):
        """Test sending proposal for internal approval"""
        proposal_id = TestProposalWorkflow.workflow_proposal_id
        if not proposal_id:
            pytest.skip("No proposal created")
        
        # Get user to use as approver
        me_response = api_client.get(f"{BASE_URL}/api/auth/me")
        user_id = me_response.json().get("user_id")
        
        response = api_client.post(
            f"{BASE_URL}/api/proposals/{proposal_id}/send-for-internal-approval",
            params={"approver_id": user_id}
        )
        assert response.status_code == 200
        
        # Verify status
        verify_response = api_client.get(f"{BASE_URL}/api/proposals/{proposal_id}")
        data = verify_response.json()
        assert data.get("status") == "pending_approval"
        print(f"[PASS] Proposal sent for internal approval")
    
    def test_approve_internal(self, api_client):
        """Test internal approval"""
        proposal_id = TestProposalWorkflow.workflow_proposal_id
        if not proposal_id:
            pytest.skip("No proposal created")
        
        response = api_client.post(
            f"{BASE_URL}/api/proposals/{proposal_id}/approve-internal",
            params={"comments": "Approved for client submission"}
        )
        assert response.status_code == 200
        
        # Verify status
        verify_response = api_client.get(f"{BASE_URL}/api/proposals/{proposal_id}")
        data = verify_response.json()
        assert data.get("status") == "approved"
        print(f"[PASS] Proposal internally approved")
    
    def test_manual_approval(self, api_client):
        """Test manual approval (client signature)"""
        proposal_id = TestProposalWorkflow.workflow_proposal_id
        if not proposal_id:
            pytest.skip("No proposal created")
        
        response = api_client.post(
            f"{BASE_URL}/api/proposals/{proposal_id}/manual-approval",
            params={"approval_date": "2026-01-20"}
        )
        assert response.status_code == 200
        
        # Verify status
        verify_response = api_client.get(f"{BASE_URL}/api/proposals/{proposal_id}")
        data = verify_response.json()
        assert data.get("status") == "signed"
        assert data.get("signature_type") == "manual"
        print(f"[PASS] Proposal manually approved, status: signed")
    
    def test_convert_to_project(self, api_client):
        """Test converting signed proposal to project"""
        proposal_id = TestProposalWorkflow.workflow_proposal_id
        if not proposal_id:
            pytest.skip("No proposal created")
        
        response = api_client.post(f"{BASE_URL}/api/proposals/{proposal_id}/convert")
        assert response.status_code == 200
        data = response.json()
        assert data.get("project_id"), "Should return created project"
        
        # Verify proposal status
        verify_response = api_client.get(f"{BASE_URL}/api/proposals/{proposal_id}")
        proposal_data = verify_response.json()
        assert proposal_data.get("status") == "converted"
        print(f"[PASS] Proposal converted to project: {data.get('project_id')}")


# Cleanup
@pytest.fixture(scope="module", autouse=True)
def cleanup(api_client):
    """Cleanup test data after all tests"""
    yield
    # Cleanup would happen here if needed
    print("[INFO] Tests completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
