"""
Test suite for AdvantEdge360 - Business operations and project management suite
Tests new features:
1. Internal tasks with optional project_id
2. Task status 'assigned' option
3. Company overview endpoint with projects/proposals/tasks/financials
4. Tasks API accepting is_internal flag
"""

import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')
SESSION_TOKEN = "test_session_1772043762960"
USER_ID = "test-user-1772043762960"

headers = {
    "Authorization": f"Bearer {SESSION_TOKEN}",
    "Content-Type": "application/json"
}

# Test data storage
test_data = {
    "company_id": None,
    "project_id": None,
    "task_id": None,
    "internal_task_id": None
}


class TestAuthEndpoint:
    """Test authentication is working"""
    
    def test_auth_me_returns_user(self):
        """Test GET /api/auth/me returns authenticated user"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=headers)
        assert response.status_code == 200, f"Auth failed: {response.text}"
        data = response.json()
        assert "user_id" in data
        assert "role" in data
        print(f"✓ Auth working - User: {data.get('name')}, Role: {data.get('role')}")


class TestCompanyOverviewEndpoint:
    """Test company overview endpoint returns correct structure"""
    
    def test_create_company_for_overview(self):
        """Create a test company"""
        payload = {
            "name": "TEST_Company_Overview_Inc",
            "industry": "Technology",
            "website": "https://test-company.com",
            "phone": "+91 98765 43210",
            "business_address": "123 Test Street, Mumbai",
            "gst_number": "22AAAAA0000A1Z5",
            "pan_number": "AAAAA0000A"
        }
        response = requests.post(f"{BASE_URL}/api/companies", json=payload, headers=headers)
        assert response.status_code == 200, f"Create company failed: {response.text}"
        data = response.json()
        test_data["company_id"] = data["company_id"]
        print(f"✓ Created company: {data['company_id']}")
    
    def test_create_project_for_company(self):
        """Create a project for the company"""
        payload = {
            "name": "TEST_Project_For_Overview",
            "description": "Test project for company overview",
            "client_name": "TEST_Company_Overview_Inc",  # Match company name
            "budget": 500000,
            "start_date": "2025-01-01",
            "end_date": "2025-12-31"
        }
        response = requests.post(f"{BASE_URL}/api/projects", json=payload, headers=headers)
        assert response.status_code == 200, f"Create project failed: {response.text}"
        data = response.json()
        test_data["project_id"] = data["project_id"]
        print(f"✓ Created project: {data['project_id']}")
    
    def test_company_overview_endpoint(self):
        """Test GET /api/companies/{company_id}/overview returns correct structure"""
        company_id = test_data.get("company_id")
        if not company_id:
            pytest.skip("No company_id available")
        
        response = requests.get(f"{BASE_URL}/api/companies/{company_id}/overview", headers=headers)
        assert response.status_code == 200, f"Company overview failed: {response.text}"
        
        data = response.json()
        
        # Verify structure
        assert "company" in data, "Response should have 'company' field"
        assert "contacts" in data, "Response should have 'contacts' field"
        assert "projects" in data, "Response should have 'projects' field"
        assert "proposals" in data, "Response should have 'proposals' field"
        assert "tasks" in data, "Response should have 'tasks' field"
        assert "finance" in data, "Response should have 'finance' field (for admin)"
        
        # Verify contacts structure
        assert "total" in data["contacts"]
        assert "list" in data["contacts"]
        
        # Verify projects structure
        assert "total" in data["projects"]
        assert "active" in data["projects"]
        assert "list" in data["projects"]
        
        # Verify proposals structure
        assert "total" in data["proposals"]
        assert "approved" in data["proposals"]
        assert "list" in data["proposals"]
        
        # Verify tasks structure
        assert "total" in data["tasks"]
        assert "completed" in data["tasks"]
        assert "list" in data["tasks"]
        
        # Verify finance structure (for admin role)
        assert "total_revenue" in data["finance"]
        assert "pending_revenue" in data["finance"]
        
        print(f"✓ Company overview endpoint returns correct structure")
        print(f"  - Contacts: {data['contacts']['total']}")
        print(f"  - Projects: {data['projects']['total']} (active: {data['projects']['active']})")
        print(f"  - Proposals: {data['proposals']['total']}")
        print(f"  - Tasks: {data['tasks']['total']}")


class TestInternalTasks:
    """Test internal task creation with is_internal flag and optional project_id"""
    
    def test_create_internal_task(self):
        """Test POST /api/tasks with is_internal=True and no project_id"""
        payload = {
            "title": "TEST_Internal_Task_No_Project",
            "description": "This is an internal task not billable to any project",
            "is_internal": True,
            "project_id": None,  # No project
            "priority": "medium"
        }
        response = requests.post(f"{BASE_URL}/api/tasks", json=payload, headers=headers)
        assert response.status_code == 200, f"Create internal task failed: {response.text}"
        
        data = response.json()
        test_data["internal_task_id"] = data["task_id"]
        
        # Verify is_internal flag is set
        assert data.get("is_internal") == True, "Task should be marked as internal"
        assert data.get("project_id") is None, "Internal task should have no project_id"
        
        print(f"✓ Created internal task: {data['task_id']}")
        print(f"  - is_internal: {data.get('is_internal')}")
        print(f"  - project_id: {data.get('project_id')}")
    
    def test_create_project_task(self):
        """Test POST /api/tasks with project_id (standard project task)"""
        project_id = test_data.get("project_id")
        if not project_id:
            pytest.skip("No project_id available")
        
        payload = {
            "title": "TEST_Project_Task",
            "description": "This is a task assigned to a project",
            "is_internal": False,
            "project_id": project_id,
            "priority": "high"
        }
        response = requests.post(f"{BASE_URL}/api/tasks", json=payload, headers=headers)
        assert response.status_code == 200, f"Create project task failed: {response.text}"
        
        data = response.json()
        test_data["task_id"] = data["task_id"]
        
        # Verify is_internal flag is False for project task
        assert data.get("is_internal") == False or data.get("is_internal") is None, "Project task should not be internal"
        assert data.get("project_id") == project_id, f"Task should have project_id: {project_id}"
        
        print(f"✓ Created project task: {data['task_id']}")
        print(f"  - is_internal: {data.get('is_internal')}")
        print(f"  - project_id: {data.get('project_id')}")


class TestTaskStatusAssigned:
    """Test that task status can be updated to 'assigned'"""
    
    def test_update_task_status_to_assigned(self):
        """Test PATCH /api/tasks/{task_id} with status='assigned'"""
        task_id = test_data.get("task_id")
        if not task_id:
            pytest.skip("No task_id available")
        
        payload = {"status": "assigned"}
        response = requests.patch(f"{BASE_URL}/api/tasks/{task_id}", json=payload, headers=headers)
        assert response.status_code == 200, f"Update task status failed: {response.text}"
        
        # Verify task was updated
        response = requests.get(f"{BASE_URL}/api/tasks/{task_id}", headers=headers)
        assert response.status_code == 200, f"Get task failed: {response.text}"
        
        data = response.json()
        assert data.get("status") == "assigned", f"Task status should be 'assigned', got: {data.get('status')}"
        
        print(f"✓ Task status updated to 'assigned'")
    
    def test_task_status_cycle(self):
        """Test task status can cycle through all valid statuses including 'assigned'"""
        task_id = test_data.get("task_id")
        if not task_id:
            pytest.skip("No task_id available")
        
        # Test all valid task statuses
        valid_statuses = ["not_started", "assigned", "in_progress", "on_hold", "under_review", "completed"]
        
        for status in valid_statuses:
            payload = {"status": status}
            response = requests.patch(f"{BASE_URL}/api/tasks/{task_id}", json=payload, headers=headers)
            assert response.status_code == 200, f"Failed to update to status '{status}': {response.text}"
        
        print(f"✓ Task status cycled through all statuses: {valid_statuses}")


class TestCleanup:
    """Cleanup test data"""
    
    def test_cleanup_test_data(self):
        """Delete all test data created"""
        # Delete internal task
        if test_data.get("internal_task_id"):
            response = requests.delete(f"{BASE_URL}/api/tasks/{test_data['internal_task_id']}", headers=headers)
            print(f"Deleted internal task: {response.status_code}")
        
        # Delete project task
        if test_data.get("task_id"):
            response = requests.delete(f"{BASE_URL}/api/tasks/{test_data['task_id']}", headers=headers)
            print(f"Deleted project task: {response.status_code}")
        
        # Delete project
        if test_data.get("project_id"):
            response = requests.delete(f"{BASE_URL}/api/projects/{test_data['project_id']}", headers=headers)
            print(f"Deleted project: {response.status_code}")
        
        # Delete company
        if test_data.get("company_id"):
            response = requests.delete(f"{BASE_URL}/api/companies/{test_data['company_id']}", headers=headers)
            print(f"Deleted company: {response.status_code}")
        
        print("✓ Cleanup completed")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
