"""
Test Phase 1 Time Tracking Features:
- Timer pause/resume
- Time log CRUD (edit/delete)
- Task creation with subtasks
"""
import pytest
import requests
import os
import time

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL').rstrip('/')


class TestTimerPauseResume:
    """Timer Pause/Resume functionality tests"""
    
    @pytest.fixture(autouse=True)
    def setup(self, auth_token, api_client):
        """Setup for each test - ensure no active timer"""
        self.auth_token = auth_token
        self.api_client = api_client
        # Cancel any existing timer before tests
        try:
            api_client.delete(f"{BASE_URL}/api/timer/cancel", 
                             headers={"Authorization": f"Bearer {auth_token}"})
        except:
            pass
        yield
        # Cleanup after tests
        try:
            api_client.delete(f"{BASE_URL}/api/timer/cancel", 
                             headers={"Authorization": f"Bearer {auth_token}"})
        except:
            pass
    
    def test_start_timer_success(self, auth_token, api_client, test_task_id):
        """Test starting timer on a task"""
        response = api_client.post(
            f"{BASE_URL}/api/timer/start",
            params={"task_id": test_task_id, "description": "Testing timer start"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "timer_id" in data
        assert "start_time" in data
        assert data["task_id"] == test_task_id
        print(f"✓ Timer started successfully: {data['timer_id']}")
    
    def test_get_active_timer(self, auth_token, api_client, test_task_id):
        """Test getting active timer status"""
        # Start a timer first
        api_client.post(
            f"{BASE_URL}/api/timer/start",
            params={"task_id": test_task_id},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Get active timer
        response = api_client.get(
            f"{BASE_URL}/api/timer/active",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["active"] == True
        assert data["task_id"] == test_task_id
        assert "is_paused" in data
        assert "paused_time" in data
        print(f"✓ Active timer retrieved with is_paused={data['is_paused']}")
    
    def test_pause_timer(self, auth_token, api_client, test_task_id):
        """Test pausing an active timer"""
        # Start timer
        api_client.post(
            f"{BASE_URL}/api/timer/start",
            params={"task_id": test_task_id},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Wait a moment for timer to accumulate time
        time.sleep(1)
        
        # Pause timer
        response = api_client.post(
            f"{BASE_URL}/api/timer/pause",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Timer paused"
        assert "elapsed_seconds" in data
        print(f"✓ Timer paused with elapsed_seconds={data['elapsed_seconds']}")
        
        # Verify timer is paused
        active_response = api_client.get(
            f"{BASE_URL}/api/timer/active",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        active_data = active_response.json()
        assert active_data["is_paused"] == True
        print("✓ Timer status confirmed as paused")
    
    def test_pause_already_paused_timer(self, auth_token, api_client, test_task_id):
        """Test pausing an already paused timer returns error"""
        # Start and pause timer
        api_client.post(
            f"{BASE_URL}/api/timer/start",
            params={"task_id": test_task_id},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        api_client.post(
            f"{BASE_URL}/api/timer/pause",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Try to pause again
        response = api_client.post(
            f"{BASE_URL}/api/timer/pause",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 400
        assert "already paused" in response.json()["detail"].lower()
        print("✓ Correctly rejected pausing already paused timer")
    
    def test_resume_timer(self, auth_token, api_client, test_task_id):
        """Test resuming a paused timer"""
        # Start and pause timer
        api_client.post(
            f"{BASE_URL}/api/timer/start",
            params={"task_id": test_task_id},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        api_client.post(
            f"{BASE_URL}/api/timer/pause",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Resume timer
        response = api_client.post(
            f"{BASE_URL}/api/timer/resume",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["message"] == "Timer resumed"
        print("✓ Timer resumed successfully")
        
        # Verify timer is no longer paused
        active_response = api_client.get(
            f"{BASE_URL}/api/timer/active",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        active_data = active_response.json()
        assert active_data["is_paused"] == False
        print("✓ Timer status confirmed as running")
    
    def test_resume_non_paused_timer(self, auth_token, api_client, test_task_id):
        """Test resuming a non-paused timer returns error"""
        # Start timer (don't pause)
        api_client.post(
            f"{BASE_URL}/api/timer/start",
            params={"task_id": test_task_id},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Try to resume without pausing first
        response = api_client.post(
            f"{BASE_URL}/api/timer/resume",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 400
        assert "not paused" in response.json()["detail"].lower()
        print("✓ Correctly rejected resuming non-paused timer")
    
    def test_stop_timer_with_billable(self, auth_token, api_client, test_task_id):
        """Test stopping timer and logging time as billable"""
        # Start timer
        api_client.post(
            f"{BASE_URL}/api/timer/start",
            params={"task_id": test_task_id, "description": "Billable work"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        time.sleep(1)
        
        # Stop timer
        response = api_client.post(
            f"{BASE_URL}/api/timer/stop",
            params={"billable": True, "description": "Test billable work"},
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "duration_minutes" in data
        assert "log_id" in data
        print(f"✓ Timer stopped, logged {data['duration_minutes']} minutes, log_id={data['log_id']}")


class TestTimeLogEditDelete:
    """Time log edit/delete functionality tests"""
    
    @pytest.fixture
    def test_time_log(self, auth_token, api_client, test_task_id):
        """Create a test time log"""
        response = api_client.post(
            f"{BASE_URL}/api/time-logs",
            json={
                "task_id": test_task_id,
                "duration_minutes": 60,
                "description": "Test time log for editing",
                "date": "2026-02-25",
                "billable": True
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        return response.json()
    
    def test_create_time_log(self, auth_token, api_client, test_task_id):
        """Test creating a time log"""
        response = api_client.post(
            f"{BASE_URL}/api/time-logs",
            json={
                "task_id": test_task_id,
                "duration_minutes": 90,
                "description": "Manual time entry test",
                "date": "2026-02-25",
                "billable": True
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        data = response.json()
        assert "log_id" in data
        assert data["duration_minutes"] == 90
        assert data["description"] == "Manual time entry test"
        assert data["billable"] == True
        print(f"✓ Time log created: {data['log_id']}")
    
    def test_update_time_log(self, auth_token, api_client, test_time_log):
        """Test updating a time log (PATCH endpoint)"""
        log_id = test_time_log["log_id"]
        
        response = api_client.patch(
            f"{BASE_URL}/api/time-logs/{log_id}",
            json={
                "duration_minutes": 120,
                "description": "Updated description",
                "billable": False
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Time log updated"
        print(f"✓ Time log {log_id} updated")
        
        # Verify the update by fetching all time logs
        logs_response = api_client.get(
            f"{BASE_URL}/api/time-logs",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        logs = logs_response.json()
        updated_log = next((l for l in logs if l["log_id"] == log_id), None)
        assert updated_log is not None
        assert updated_log["duration_minutes"] == 120
        assert updated_log["description"] == "Updated description"
        assert updated_log["billable"] == False
        print(f"✓ Time log update verified: duration={updated_log['duration_minutes']}, billable={updated_log['billable']}")
    
    def test_delete_time_log(self, auth_token, api_client, test_time_log):
        """Test deleting a time log (DELETE endpoint)"""
        log_id = test_time_log["log_id"]
        
        response = api_client.delete(
            f"{BASE_URL}/api/time-logs/{log_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Time log deleted"
        print(f"✓ Time log {log_id} deleted")
        
        # Verify deletion
        logs_response = api_client.get(
            f"{BASE_URL}/api/time-logs",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        logs = logs_response.json()
        deleted_log = next((l for l in logs if l["log_id"] == log_id), None)
        assert deleted_log is None
        print(f"✓ Time log deletion verified")
    
    def test_delete_nonexistent_time_log(self, auth_token, api_client):
        """Test deleting a non-existent time log returns 404"""
        response = api_client.delete(
            f"{BASE_URL}/api/time-logs/nonexistent_log_id",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert response.status_code == 404
        print("✓ Correctly returned 404 for non-existent time log")


class TestTaskWithSubtasks:
    """Task creation with subtasks/nesting functionality"""
    
    def test_create_task_with_parent(self, auth_token, api_client, test_project_id):
        """Test creating a task nested under a parent task"""
        # First create a parent task
        parent_response = api_client.post(
            f"{BASE_URL}/api/tasks",
            json={
                "project_id": test_project_id,
                "title": "Parent Task for Nesting Test",
                "description": "This is a parent task",
                "priority": "high"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert parent_response.status_code == 200
        parent_task = parent_response.json()
        parent_task_id = parent_task["task_id"]
        print(f"✓ Parent task created: {parent_task_id}")
        
        # Create a subtask
        subtask_response = api_client.post(
            f"{BASE_URL}/api/tasks",
            json={
                "project_id": test_project_id,
                "title": "Subtask under Parent",
                "description": "This is a subtask",
                "priority": "medium",
                "parent_task_id": parent_task_id
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert subtask_response.status_code == 200
        subtask = subtask_response.json()
        assert subtask["parent_task_id"] == parent_task_id
        print(f"✓ Subtask created: {subtask['task_id']} under parent {parent_task_id}")
        
        # Verify parent task has subtask in its subtasks array
        parent_detail = api_client.get(
            f"{BASE_URL}/api/tasks/{parent_task_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        parent_data = parent_detail.json()
        assert subtask["task_id"] in parent_data.get("subtasks", [])
        print(f"✓ Parent task subtasks array verified")
    
    def test_get_task_with_subtask_details(self, auth_token, api_client, test_project_id):
        """Test that task details include subtask_details"""
        # Create parent and subtask
        parent_response = api_client.post(
            f"{BASE_URL}/api/tasks",
            json={
                "project_id": test_project_id,
                "title": "Parent for subtask details test",
                "priority": "medium"
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        parent_task_id = parent_response.json()["task_id"]
        
        # Create subtask
        api_client.post(
            f"{BASE_URL}/api/tasks",
            json={
                "project_id": test_project_id,
                "title": "Subtask for details test",
                "priority": "low",
                "parent_task_id": parent_task_id
            },
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        
        # Get task details
        detail_response = api_client.get(
            f"{BASE_URL}/api/tasks/{parent_task_id}",
            headers={"Authorization": f"Bearer {auth_token}"}
        )
        assert detail_response.status_code == 200
        data = detail_response.json()
        
        assert "subtask_details" in data
        assert len(data["subtask_details"]) > 0
        print(f"✓ Task details include {len(data['subtask_details'])} subtask(s) with full details")


# ========== FIXTURES ==========

@pytest.fixture(scope="session")
def api_client():
    """Shared requests session"""
    session = requests.Session()
    session.headers.update({"Content-Type": "application/json"})
    return session


@pytest.fixture(scope="session")
def auth_token():
    """Get or create authentication token"""
    import subprocess
    result = subprocess.run([
        "mongosh", "--quiet", "--eval", """
use('test_database');
var userId = 'test-user-pytest-' + Date.now();
var sessionToken = 'test_session_pytest_' + Date.now();
db.users.insertOne({
  user_id: userId,
  email: 'pytest.' + Date.now() + '@example.com',
  name: 'Pytest User',
  role: 'admin',
  created_at: new Date()
});
db.user_sessions.insertOne({
  user_id: userId,
  session_token: sessionToken,
  expires_at: new Date(Date.now() + 7*24*60*60*1000),
  created_at: new Date()
});
print(sessionToken);
"""
    ], capture_output=True, text=True)
    return result.stdout.strip()


@pytest.fixture(scope="session")
def test_project_id(api_client, auth_token):
    """Create or get test project"""
    # Check for existing project
    response = api_client.get(
        f"{BASE_URL}/api/projects",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    projects = response.json()
    if projects:
        return projects[0]["project_id"]
    
    # Create new project
    response = api_client.post(
        f"{BASE_URL}/api/projects",
        json={
            "name": "Phase 1 Test Project",
            "description": "Testing timer and time tracking features",
            "client_name": "Test Client"
        },
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    return response.json()["project_id"]


@pytest.fixture(scope="session")
def test_task_id(api_client, auth_token, test_project_id):
    """Create or get test task"""
    # Check for existing tasks
    response = api_client.get(
        f"{BASE_URL}/api/tasks",
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    tasks = response.json()
    if tasks:
        # Prefer a non-subtask
        parent_tasks = [t for t in tasks if not t.get("parent_task_id")]
        if parent_tasks:
            return parent_tasks[0]["task_id"]
        return tasks[0]["task_id"]
    
    # Create new task
    response = api_client.post(
        f"{BASE_URL}/api/tasks",
        json={
            "project_id": test_project_id,
            "title": "Phase 1 Test Task",
            "description": "Testing timer features",
            "priority": "medium"
        },
        headers={"Authorization": f"Bearer {auth_token}"}
    )
    return response.json()["task_id"]
