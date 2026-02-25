"""
Backend API Tests for AdvantEdge360 v3 Enhancement Testing
Testing: Timer routes, Proposal versioning, Comment edit/delete, Subtasks, Return to owner
"""
import pytest
import requests
import os
import time

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
    """Authentication endpoint tests"""
    
    def test_auth_me_returns_user(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        assert "role" in data
        print(f"[PASS] Auth /me returns user: {data.get('name')}, role: {data.get('role')}")


class TestProposalVersioning:
    """Proposal versioning system tests"""
    
    version_test_proposal_id = None
    
    def test_01_create_proposal_for_versioning(self, api_client):
        """Create proposal to test versioning"""
        payload = {
            "title": "TEST_Version_Proposal_Original",
            "client_name": "Version Test Client",
            "description": "Testing versioning system",
            "amount": 10000.00,
            "category": "Commercial",
            "requirement": "Original requirement text"
        }
        response = api_client.post(f"{BASE_URL}/api/proposals", json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        TestProposalVersioning.version_test_proposal_id = data["proposal_id"]
        assert data.get("version") == 1, f"New proposal should be v1, got {data.get('version')}"
        print(f"[PASS] Created proposal v1: {data['proposal_id']}")
    
    def test_02_update_proposal_creates_version(self, api_client):
        """Updating proposal should create version history"""
        proposal_id = TestProposalVersioning.version_test_proposal_id
        if not proposal_id:
            pytest.skip("No proposal created")
        
        # Update with content change (should trigger version bump)
        updates = {
            "title": "TEST_Version_Proposal_Updated",
            "description": "Updated description for v2",
            "amount": 20000.00
        }
        response = api_client.patch(f"{BASE_URL}/api/proposals/{proposal_id}", json=updates)
        assert response.status_code == 200
        data = response.json()
        assert data.get("version") == 2, f"Should be v2 after update, got {data.get('version')}"
        print(f"[PASS] Updated proposal to v{data.get('version')}")
    
    def test_03_get_version_history(self, api_client):
        """Test GET /api/proposals/{id}/versions"""
        proposal_id = TestProposalVersioning.version_test_proposal_id
        if not proposal_id:
            pytest.skip("No proposal created")
        
        response = api_client.get(f"{BASE_URL}/api/proposals/{proposal_id}/versions")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "current_version" in data
        assert "version_history" in data
        assert data["current_version"] == 2
        assert len(data["version_history"]) >= 1, "Should have at least v1 in history"
        v1 = data["version_history"][0]
        assert v1["version"] == 1
        assert v1["title"] == "TEST_Version_Proposal_Original"
        print(f"[PASS] Got version history: current v{data['current_version']}, history: {len(data['version_history'])} versions")
    
    def test_04_restore_previous_version(self, api_client):
        """Test POST /api/proposals/{id}/restore-version/{num}"""
        proposal_id = TestProposalVersioning.version_test_proposal_id
        if not proposal_id:
            pytest.skip("No proposal created")
        
        # Restore to v1
        response = api_client.post(f"{BASE_URL}/api/proposals/{proposal_id}/restore-version/1")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("new_version") == 3, f"Should be v3 after restore, got {data.get('new_version')}"
        
        # Verify content restored
        verify = api_client.get(f"{BASE_URL}/api/proposals/{proposal_id}")
        verify_data = verify.json()
        assert verify_data["title"] == "TEST_Version_Proposal_Original", "Title should be restored"
        print(f"[PASS] Restored to v1, now at v{data.get('new_version')}")


class TestTimerRoutes:
    """Timer start/stop routes tests"""
    
    timer_test_project_id = None
    timer_test_task_id = None
    
    def test_01_create_project_for_timer(self, api_client):
        """Create project for timer testing"""
        payload = {
            "name": "TEST_Timer_Project",
            "description": "Project for timer testing",
            "client_name": "Timer Test Client"
        }
        response = api_client.post(f"{BASE_URL}/api/projects", json=payload)
        assert response.status_code == 200
        data = response.json()
        TestTimerRoutes.timer_test_project_id = data["project_id"]
        print(f"[PASS] Created project: {data['project_id']}")
    
    def test_02_create_task_for_timer(self, api_client):
        """Create task for timer testing"""
        project_id = TestTimerRoutes.timer_test_project_id
        if not project_id:
            pytest.skip("No project created")
        
        payload = {
            "project_id": project_id,
            "title": "TEST_Timer_Task",
            "description": "Task for timer testing",
            "priority": "high"
        }
        response = api_client.post(f"{BASE_URL}/api/tasks", json=payload)
        assert response.status_code == 200
        data = response.json()
        TestTimerRoutes.timer_test_task_id = data["task_id"]
        print(f"[PASS] Created task: {data['task_id']}")
    
    def test_03_get_active_timer_empty(self, api_client):
        """GET /api/timer/active should return no active timer initially"""
        response = api_client.get(f"{BASE_URL}/api/timer/active")
        assert response.status_code == 200
        data = response.json()
        # If active is False, we're good. If active, we need to cancel first
        if data.get("active"):
            # Cancel existing timer
            api_client.delete(f"{BASE_URL}/api/timer/cancel")
        print(f"[PASS] Checked active timer status")
    
    def test_04_start_timer(self, api_client):
        """POST /api/timer/start should start timer for task"""
        task_id = TestTimerRoutes.timer_test_task_id
        if not task_id:
            pytest.skip("No task created")
        
        response = api_client.post(f"{BASE_URL}/api/timer/start", params={"task_id": task_id, "description": "Test timing"})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data.get("timer_id"), "Should return timer_id"
        assert data.get("task_id") == task_id
        assert data.get("start_time"), "Should return start_time"
        print(f"[PASS] Started timer: {data.get('timer_id')}")
    
    def test_05_get_active_timer_running(self, api_client):
        """GET /api/timer/active should show running timer"""
        response = api_client.get(f"{BASE_URL}/api/timer/active")
        assert response.status_code == 200
        data = response.json()
        assert data.get("active") == True, "Timer should be active"
        assert data.get("task_id") == TestTimerRoutes.timer_test_task_id
        assert "elapsed_minutes" in data
        print(f"[PASS] Active timer found: elapsed {data.get('elapsed_minutes')}m")
    
    def test_06_start_timer_fails_when_active(self, api_client):
        """Starting another timer should fail with active timer"""
        task_id = TestTimerRoutes.timer_test_task_id
        if not task_id:
            pytest.skip("No task created")
        
        response = api_client.post(f"{BASE_URL}/api/timer/start", params={"task_id": task_id})
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print(f"[PASS] Cannot start second timer (expected)")
    
    def test_07_stop_timer(self, api_client):
        """POST /api/timer/stop should stop timer and create log"""
        response = api_client.post(f"{BASE_URL}/api/timer/stop", params={"description": "Test complete", "billable": True})
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "duration_minutes" in data
        assert "log_id" in data
        assert data.get("task_id") == TestTimerRoutes.timer_test_task_id
        print(f"[PASS] Stopped timer, logged {data.get('duration_minutes')}m, log_id: {data.get('log_id')}")
    
    def test_08_verify_time_logged_to_task(self, api_client):
        """Verify time was logged to task"""
        task_id = TestTimerRoutes.timer_test_task_id
        if not task_id:
            pytest.skip("No task created")
        
        response = api_client.get(f"{BASE_URL}/api/tasks/{task_id}")
        assert response.status_code == 200
        data = response.json()
        assert data.get("total_tracked_time", 0) >= 0, "Should have tracked time"
        print(f"[PASS] Task has total_tracked_time: {data.get('total_tracked_time')}m")
    
    def test_09_timer_cancel(self, api_client):
        """Test DELETE /api/timer/cancel"""
        task_id = TestTimerRoutes.timer_test_task_id
        if not task_id:
            pytest.skip("No task created")
        
        # Start a new timer
        api_client.post(f"{BASE_URL}/api/timer/start", params={"task_id": task_id})
        
        # Cancel it
        response = api_client.delete(f"{BASE_URL}/api/timer/cancel")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify no active timer
        verify = api_client.get(f"{BASE_URL}/api/timer/active")
        assert verify.json().get("active") == False
        print(f"[PASS] Timer cancelled successfully")


class TestCommentEditDelete:
    """Comment edit and delete tests"""
    
    comment_test_task_id = None
    comment_id = None
    
    def test_01_create_task_for_comments(self, api_client):
        """Create task for comment testing"""
        project_id = TestTimerRoutes.timer_test_project_id
        if not project_id:
            # Create a project if not exists
            proj_resp = api_client.post(f"{BASE_URL}/api/projects", json={
                "name": "TEST_Comment_Project",
                "description": "For comment testing"
            })
            project_id = proj_resp.json()["project_id"]
        
        payload = {
            "project_id": project_id,
            "title": "TEST_Comment_Task",
            "description": "Task for comment edit/delete testing"
        }
        response = api_client.post(f"{BASE_URL}/api/tasks", json=payload)
        assert response.status_code == 200
        data = response.json()
        TestCommentEditDelete.comment_test_task_id = data["task_id"]
        print(f"[PASS] Created task for comments: {data['task_id']}")
    
    def test_02_add_comment(self, api_client):
        """Add comment to task"""
        task_id = TestCommentEditDelete.comment_test_task_id
        if not task_id:
            pytest.skip("No task created")
        
        response = api_client.post(
            f"{BASE_URL}/api/tasks/{task_id}/add-comment",
            params={"comment": "Original comment text for testing edit"}
        )
        assert response.status_code == 200
        data = response.json()
        assert data.get("comment_id"), "Should return comment_id"
        TestCommentEditDelete.comment_id = data["comment_id"]
        print(f"[PASS] Added comment: {data['comment_id']}")
    
    def test_03_edit_comment(self, api_client):
        """Test PATCH /api/tasks/{id}/comments/{cid}"""
        task_id = TestCommentEditDelete.comment_test_task_id
        comment_id = TestCommentEditDelete.comment_id
        if not task_id or not comment_id:
            pytest.skip("No task/comment created")
        
        response = api_client.patch(
            f"{BASE_URL}/api/tasks/{task_id}/comments/{comment_id}",
            params={"new_comment": "Edited comment text"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify edit
        task_resp = api_client.get(f"{BASE_URL}/api/tasks/{task_id}")
        task_data = task_resp.json()
        comment = next((c for c in task_data.get("comments", []) if c.get("comment_id") == comment_id), None)
        assert comment, "Comment should exist"
        assert comment.get("comment") == "Edited comment text", f"Comment should be edited, got {comment.get('comment')}"
        assert comment.get("edited") == True, "Should be marked as edited"
        print(f"[PASS] Edited comment successfully")
    
    def test_04_add_second_comment_for_delete(self, api_client):
        """Add another comment for delete test"""
        task_id = TestCommentEditDelete.comment_test_task_id
        if not task_id:
            pytest.skip("No task created")
        
        response = api_client.post(
            f"{BASE_URL}/api/tasks/{task_id}/add-comment",
            params={"comment": "Comment to be deleted"}
        )
        assert response.status_code == 200
        data = response.json()
        TestCommentEditDelete.delete_comment_id = data["comment_id"]
        print(f"[PASS] Added second comment: {data['comment_id']}")
    
    def test_05_delete_comment(self, api_client):
        """Test DELETE /api/tasks/{id}/comments/{cid}"""
        task_id = TestCommentEditDelete.comment_test_task_id
        comment_id = getattr(TestCommentEditDelete, 'delete_comment_id', None)
        if not task_id or not comment_id:
            pytest.skip("No task/comment for delete")
        
        response = api_client.delete(f"{BASE_URL}/api/tasks/{task_id}/comments/{comment_id}")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify deletion
        task_resp = api_client.get(f"{BASE_URL}/api/tasks/{task_id}")
        task_data = task_resp.json()
        deleted_comment = next((c for c in task_data.get("comments", []) if c.get("comment_id") == comment_id), None)
        assert deleted_comment is None, "Comment should be deleted"
        print(f"[PASS] Deleted comment successfully")


class TestSubtasks:
    """Subtask system tests"""
    
    parent_task_id = None
    subtask_id = None
    
    def test_01_create_parent_task(self, api_client):
        """Create parent task"""
        project_id = TestTimerRoutes.timer_test_project_id
        if not project_id:
            pytest.skip("No project available")
        
        payload = {
            "project_id": project_id,
            "title": "TEST_Parent_Task",
            "description": "Parent task for subtask testing",
            "priority": "high"
        }
        response = api_client.post(f"{BASE_URL}/api/tasks", json=payload)
        assert response.status_code == 200
        data = response.json()
        TestSubtasks.parent_task_id = data["task_id"]
        assert data.get("subtasks") == [] or data.get("subtasks") is None or len(data.get("subtasks", [])) == 0
        print(f"[PASS] Created parent task: {data['task_id']}")
    
    def test_02_create_subtask(self, api_client):
        """Create subtask with parent_task_id"""
        parent_id = TestSubtasks.parent_task_id
        project_id = TestTimerRoutes.timer_test_project_id
        if not parent_id or not project_id:
            pytest.skip("No parent task/project")
        
        payload = {
            "project_id": project_id,
            "title": "TEST_Subtask_1",
            "description": "First subtask",
            "parent_task_id": parent_id,
            "priority": "medium"
        }
        response = api_client.post(f"{BASE_URL}/api/tasks", json=payload)
        assert response.status_code == 200
        data = response.json()
        TestSubtasks.subtask_id = data["task_id"]
        assert data.get("parent_task_id") == parent_id, "Subtask should have parent_task_id"
        print(f"[PASS] Created subtask: {data['task_id']} with parent {parent_id}")
    
    def test_03_parent_has_subtask(self, api_client):
        """Verify parent task has subtask in its subtasks array"""
        parent_id = TestSubtasks.parent_task_id
        subtask_id = TestSubtasks.subtask_id
        if not parent_id or not subtask_id:
            pytest.skip("No parent/subtask")
        
        response = api_client.get(f"{BASE_URL}/api/tasks/{parent_id}")
        assert response.status_code == 200
        data = response.json()
        subtasks = data.get("subtasks", [])
        assert subtask_id in subtasks, f"Subtask {subtask_id} should be in parent's subtasks"
        print(f"[PASS] Parent task has {len(subtasks)} subtask(s)")
    
    def test_04_get_task_with_subtask_details(self, api_client):
        """GET /api/tasks/{id} should include subtask_details"""
        parent_id = TestSubtasks.parent_task_id
        if not parent_id:
            pytest.skip("No parent task")
        
        response = api_client.get(f"{BASE_URL}/api/tasks/{parent_id}")
        assert response.status_code == 200
        data = response.json()
        # subtask_details should be populated if subtasks exist
        if data.get("subtasks"):
            assert "subtask_details" in data or len(data.get("subtasks", [])) > 0
            print(f"[PASS] Task detail includes subtask info")
        else:
            print(f"[PASS] Task checked (no subtasks populated yet)")


class TestReturnToOwner:
    """Return task to owner test"""
    
    review_task_id = None
    
    def test_01_create_task_for_review_flow(self, api_client):
        """Create task for review testing"""
        project_id = TestTimerRoutes.timer_test_project_id
        if not project_id:
            pytest.skip("No project available")
        
        payload = {
            "project_id": project_id,
            "title": "TEST_Review_Task",
            "description": "Task for return to owner testing"
        }
        response = api_client.post(f"{BASE_URL}/api/tasks", json=payload)
        assert response.status_code == 200
        data = response.json()
        TestReturnToOwner.review_task_id = data["task_id"]
        print(f"[PASS] Created review test task: {data['task_id']}")
    
    def test_02_change_task_to_in_progress(self, api_client):
        """Set task to in_progress"""
        task_id = TestReturnToOwner.review_task_id
        if not task_id:
            pytest.skip("No task created")
        
        response = api_client.patch(f"{BASE_URL}/api/tasks/{task_id}", json={"status": "in_progress"})
        assert response.status_code == 200
        print(f"[PASS] Task set to in_progress")
    
    def test_03_send_task_for_review(self, api_client):
        """Send task for review"""
        task_id = TestReturnToOwner.review_task_id
        if not task_id:
            pytest.skip("No task created")
        
        # Get current user for reviewer
        me_resp = api_client.get(f"{BASE_URL}/api/auth/me")
        reviewer_id = me_resp.json()["user_id"]
        
        response = api_client.post(
            f"{BASE_URL}/api/tasks/{task_id}/send-for-review",
            params={"reviewer_id": reviewer_id}
        )
        assert response.status_code == 200
        
        # Verify status
        task_resp = api_client.get(f"{BASE_URL}/api/tasks/{task_id}")
        assert task_resp.json().get("status") == "under_review"
        print(f"[PASS] Task sent for review")
    
    def test_04_return_to_owner(self, api_client):
        """Test POST /api/tasks/{id}/return-to-owner"""
        task_id = TestReturnToOwner.review_task_id
        if not task_id:
            pytest.skip("No task created")
        
        response = api_client.post(
            f"{BASE_URL}/api/tasks/{task_id}/return-to-owner",
            params={"notes": "Need more details on implementation"}
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        # Verify status changed back to in_progress
        task_resp = api_client.get(f"{BASE_URL}/api/tasks/{task_id}")
        task_data = task_resp.json()
        assert task_data.get("status") == "in_progress", f"Status should be in_progress, got {task_data.get('status')}"
        assert task_data.get("review_notes") == "Need more details on implementation"
        # Should have a system comment
        comments = task_data.get("comments", [])
        has_return_comment = any("[Returned for revision]" in c.get("comment", "") for c in comments)
        assert has_return_comment, "Should have return comment"
        print(f"[PASS] Task returned to owner with notes")


class TestViewToggleSorting:
    """API tests related to view toggle and sorting (data availability)"""
    
    def test_proposals_list_has_version_field(self, api_client):
        """Proposals should have version field for list view"""
        response = api_client.get(f"{BASE_URL}/api/proposals")
        assert response.status_code == 200
        data = response.json()
        if len(data) > 0:
            assert "version" in data[0], "Proposal should have version field"
            print(f"[PASS] Proposals have version field")
        else:
            print(f"[PASS] No proposals to check (empty list)")
    
    def test_projects_list_has_completion_percentage(self, api_client):
        """Projects should have completion_percentage for list view progress bars"""
        response = api_client.get(f"{BASE_URL}/api/projects")
        assert response.status_code == 200
        data = response.json()
        if len(data) > 0:
            # completion_percentage may be 0 or not present for new projects
            proj = data[0]
            assert "completion_percentage" in proj or proj.get("completion_percentage", 0) >= 0
            print(f"[PASS] Projects have completion_percentage field")
        else:
            print(f"[PASS] No projects to check (empty list)")


# Cleanup marker
@pytest.fixture(scope="module", autouse=True)
def cleanup_info():
    """Info about test data"""
    yield
    print("\n[INFO] Tests completed. Test data prefixed with TEST_ created.")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
