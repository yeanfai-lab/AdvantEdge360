"""
Backend tests for Phase 2: Team Management Features
- Leave Applications CRUD + Approval
- Reimbursements CRUD + Approval/Mark Paid
- Performance Reviews CRUD + Submit/Acknowledge Workflow
- Onboarding Forms CRUD + Submit/Approve
- Team Requests Pending Summary API
"""
import pytest
import requests
import os
from datetime import datetime, timedelta

# Use environment variable for base URL
BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://business-ops-demo.preview.emergentagent.com').rstrip('/')

# Test credentials created for Phase 2 testing
ADMIN_TOKEN = "test_phase2_session_1772032728013"
ADMIN_USER_ID = "test_phase2_user_1772032728013"
MEMBER_TOKEN = "test_phase2_member_session_1772032728013"
MEMBER_USER_ID = "test_phase2_member_1772032728013"


@pytest.fixture(scope="module")
def admin_headers():
    """Headers for admin user"""
    return {
        "Authorization": f"Bearer {ADMIN_TOKEN}",
        "Content-Type": "application/json"
    }


@pytest.fixture(scope="module")
def member_headers():
    """Headers for team member user"""
    return {
        "Authorization": f"Bearer {MEMBER_TOKEN}",
        "Content-Type": "application/json"
    }


# ==================== LEAVE APPLICATIONS ====================

class TestLeaveApplications:
    """Tests for /api/leaves endpoints"""
    
    created_leave_id = None
    
    def test_create_leave_application(self, admin_headers):
        """POST /api/leaves - Create new leave application"""
        start_date = (datetime.now() + timedelta(days=7)).strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=9)).strftime("%Y-%m-%d")
        
        payload = {
            "leave_type": "casual",
            "start_date": start_date,
            "end_date": end_date,
            "reason": "Test leave - family function"
        }
        
        response = requests.post(f"{BASE_URL}/api/leaves", json=payload, headers=admin_headers)
        
        assert response.status_code == 200, f"Failed to create leave: {response.text}"
        data = response.json()
        
        assert "leave_id" in data
        assert data["leave_type"] == "casual"
        assert data["status"] == "pending"
        assert data["days"] == 3  # 3 days including both start and end
        assert data["reason"] == "Test leave - family function"
        
        TestLeaveApplications.created_leave_id = data["leave_id"]
        print(f"✓ Created leave application: {data['leave_id']}")
    
    def test_get_leaves_list_admin(self, admin_headers):
        """GET /api/leaves - Admin can see all leaves"""
        response = requests.get(f"{BASE_URL}/api/leaves", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        # Should contain our created leave
        if TestLeaveApplications.created_leave_id:
            leave_ids = [l["leave_id"] for l in data]
            assert TestLeaveApplications.created_leave_id in leave_ids
        print(f"✓ Got {len(data)} leaves (admin view)")
    
    def test_create_leave_sick_type(self, member_headers):
        """POST /api/leaves - Create sick leave"""
        start_date = (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d")
        
        payload = {
            "leave_type": "sick",
            "start_date": start_date,
            "end_date": start_date,  # Single day
            "reason": "Feeling unwell"
        }
        
        response = requests.post(f"{BASE_URL}/api/leaves", json=payload, headers=member_headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert data["leave_type"] == "sick"
        assert data["days"] == 1
        print(f"✓ Created sick leave: {data['leave_id']}")
    
    def test_create_leave_wfh_type(self, admin_headers):
        """POST /api/leaves - Create WFH request"""
        start_date = (datetime.now() + timedelta(days=21)).strftime("%Y-%m-%d")
        end_date = (datetime.now() + timedelta(days=22)).strftime("%Y-%m-%d")
        
        payload = {
            "leave_type": "wfh",
            "start_date": start_date,
            "end_date": end_date,
            "reason": "Internet installation at home"
        }
        
        response = requests.post(f"{BASE_URL}/api/leaves", json=payload, headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["leave_type"] == "wfh"
        print(f"✓ Created WFH request: {data['leave_id']}")
    
    def test_approve_leave(self, admin_headers):
        """PATCH /api/leaves/{id}/approve - Supervisor approves leave"""
        if not TestLeaveApplications.created_leave_id:
            pytest.skip("No leave to approve")
        
        response = requests.patch(
            f"{BASE_URL}/api/leaves/{TestLeaveApplications.created_leave_id}/approve",
            params={"comments": "Approved for family event"},
            headers=admin_headers
        )
        
        assert response.status_code == 200
        
        # Verify status changed
        get_resp = requests.get(f"{BASE_URL}/api/leaves", headers=admin_headers)
        leaves = get_resp.json()
        our_leave = next((l for l in leaves if l["leave_id"] == TestLeaveApplications.created_leave_id), None)
        
        assert our_leave is not None
        assert our_leave["status"] == "approved"
        print(f"✓ Leave approved successfully")
    
    def test_reject_leave(self, admin_headers, member_headers):
        """PATCH /api/leaves/{id}/reject - Supervisor rejects leave"""
        # Create a new leave to reject
        start_date = (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d")
        
        create_resp = requests.post(f"{BASE_URL}/api/leaves", json={
            "leave_type": "earned",
            "start_date": start_date,
            "end_date": start_date,
            "reason": "Test leave to be rejected"
        }, headers=member_headers)
        
        assert create_resp.status_code == 200
        leave_id = create_resp.json()["leave_id"]
        
        # Admin rejects it
        reject_resp = requests.patch(
            f"{BASE_URL}/api/leaves/{leave_id}/reject",
            params={"comments": "Not enough advance notice"},
            headers=admin_headers
        )
        
        assert reject_resp.status_code == 200
        
        # Verify
        get_resp = requests.get(f"{BASE_URL}/api/leaves", headers=admin_headers)
        leaves = get_resp.json()
        rejected_leave = next((l for l in leaves if l["leave_id"] == leave_id), None)
        
        assert rejected_leave["status"] == "rejected"
        assert rejected_leave["approver_comments"] == "Not enough advance notice"
        print(f"✓ Leave rejected successfully")
    
    def test_delete_pending_leave(self, member_headers):
        """DELETE /api/leaves/{id} - Owner can delete pending leave"""
        # Create a leave to delete
        start_date = (datetime.now() + timedelta(days=45)).strftime("%Y-%m-%d")
        
        create_resp = requests.post(f"{BASE_URL}/api/leaves", json={
            "leave_type": "unpaid",
            "start_date": start_date,
            "end_date": start_date,
            "reason": "Test leave to be deleted"
        }, headers=member_headers)
        
        assert create_resp.status_code == 200
        leave_id = create_resp.json()["leave_id"]
        
        # Delete it
        delete_resp = requests.delete(f"{BASE_URL}/api/leaves/{leave_id}", headers=member_headers)
        assert delete_resp.status_code == 200
        
        # Verify it's gone
        get_resp = requests.get(f"{BASE_URL}/api/leaves", headers=member_headers)
        leaves = get_resp.json()
        leave_ids = [l["leave_id"] for l in leaves]
        
        assert leave_id not in leave_ids
        print(f"✓ Pending leave deleted successfully")
    
    def test_cannot_delete_others_leave(self, member_headers, admin_headers):
        """Team member cannot delete other's leave"""
        # Create leave as admin
        start_date = (datetime.now() + timedelta(days=50)).strftime("%Y-%m-%d")
        
        create_resp = requests.post(f"{BASE_URL}/api/leaves", json={
            "leave_type": "casual",
            "start_date": start_date,
            "end_date": start_date,
            "reason": "Admin's leave"
        }, headers=admin_headers)
        
        leave_id = create_resp.json()["leave_id"]
        
        # Try to delete as member
        delete_resp = requests.delete(f"{BASE_URL}/api/leaves/{leave_id}", headers=member_headers)
        assert delete_resp.status_code == 403
        print(f"✓ Correctly blocked member from deleting other's leave")


# ==================== REIMBURSEMENTS ====================

class TestReimbursements:
    """Tests for /api/reimbursements endpoints"""
    
    created_reimbursement_id = None
    
    def test_create_reimbursement_travel(self, member_headers):
        """POST /api/reimbursements - Create travel reimbursement"""
        payload = {
            "category": "travel",
            "amount": 1500.50,
            "description": "Flight tickets for client meeting",
            "date": datetime.now().strftime("%Y-%m-%d"),
            "project_id": None
        }
        
        response = requests.post(f"{BASE_URL}/api/reimbursements", json=payload, headers=member_headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "reimbursement_id" in data
        assert data["category"] == "travel"
        assert data["amount"] == 1500.50
        assert data["status"] == "pending"
        
        TestReimbursements.created_reimbursement_id = data["reimbursement_id"]
        print(f"✓ Created travel reimbursement: {data['reimbursement_id']}")
    
    def test_create_reimbursement_equipment(self, admin_headers):
        """POST /api/reimbursements - Create equipment reimbursement"""
        payload = {
            "category": "equipment",
            "amount": 250.00,
            "description": "Keyboard and mouse for home office",
            "date": datetime.now().strftime("%Y-%m-%d")
        }
        
        response = requests.post(f"{BASE_URL}/api/reimbursements", json=payload, headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        assert data["category"] == "equipment"
        print(f"✓ Created equipment reimbursement: {data['reimbursement_id']}")
    
    def test_get_reimbursements_list(self, admin_headers):
        """GET /api/reimbursements - Get all reimbursements"""
        response = requests.get(f"{BASE_URL}/api/reimbursements", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} reimbursements")
    
    def test_approve_reimbursement(self, admin_headers):
        """PATCH /api/reimbursements/{id}/approve - Approve reimbursement"""
        if not TestReimbursements.created_reimbursement_id:
            pytest.skip("No reimbursement to approve")
        
        response = requests.patch(
            f"{BASE_URL}/api/reimbursements/{TestReimbursements.created_reimbursement_id}/approve",
            params={"comments": "Approved - attach receipts to finance"},
            headers=admin_headers
        )
        
        assert response.status_code == 200
        
        # Verify status
        get_resp = requests.get(f"{BASE_URL}/api/reimbursements", headers=admin_headers)
        reimbursements = get_resp.json()
        our_r = next((r for r in reimbursements if r["reimbursement_id"] == TestReimbursements.created_reimbursement_id), None)
        
        assert our_r["status"] == "approved"
        print(f"✓ Reimbursement approved")
    
    def test_mark_reimbursement_paid(self, admin_headers):
        """PATCH /api/reimbursements/{id}/mark-paid - Mark as paid (admin/finance only)"""
        if not TestReimbursements.created_reimbursement_id:
            pytest.skip("No reimbursement to mark paid")
        
        response = requests.patch(
            f"{BASE_URL}/api/reimbursements/{TestReimbursements.created_reimbursement_id}/mark-paid",
            headers=admin_headers
        )
        
        assert response.status_code == 200
        
        # Verify status
        get_resp = requests.get(f"{BASE_URL}/api/reimbursements", headers=admin_headers)
        reimbursements = get_resp.json()
        our_r = next((r for r in reimbursements if r["reimbursement_id"] == TestReimbursements.created_reimbursement_id), None)
        
        assert our_r["status"] == "paid"
        print(f"✓ Reimbursement marked as paid")
    
    def test_reject_reimbursement(self, admin_headers, member_headers):
        """PATCH /api/reimbursements/{id}/reject - Reject reimbursement"""
        # Create a new one to reject
        create_resp = requests.post(f"{BASE_URL}/api/reimbursements", json={
            "category": "client_entertainment",
            "amount": 5000.00,
            "description": "Client dinner - no receipt",
            "date": datetime.now().strftime("%Y-%m-%d")
        }, headers=member_headers)
        
        reimbursement_id = create_resp.json()["reimbursement_id"]
        
        # Reject it
        reject_resp = requests.patch(
            f"{BASE_URL}/api/reimbursements/{reimbursement_id}/reject",
            params={"comments": "Receipt required for amounts over $500"},
            headers=admin_headers
        )
        
        assert reject_resp.status_code == 200
        
        # Verify
        get_resp = requests.get(f"{BASE_URL}/api/reimbursements", headers=admin_headers)
        reimbursements = get_resp.json()
        rejected = next((r for r in reimbursements if r["reimbursement_id"] == reimbursement_id), None)
        
        assert rejected["status"] == "rejected"
        print(f"✓ Reimbursement rejected")
    
    def test_delete_pending_reimbursement(self, member_headers):
        """DELETE /api/reimbursements/{id} - Delete pending reimbursement"""
        # Create one to delete
        create_resp = requests.post(f"{BASE_URL}/api/reimbursements", json={
            "category": "office_supplies",
            "amount": 50.00,
            "description": "Notebooks - to be deleted",
            "date": datetime.now().strftime("%Y-%m-%d")
        }, headers=member_headers)
        
        reimbursement_id = create_resp.json()["reimbursement_id"]
        
        # Delete it
        delete_resp = requests.delete(f"{BASE_URL}/api/reimbursements/{reimbursement_id}", headers=member_headers)
        assert delete_resp.status_code == 200
        print(f"✓ Pending reimbursement deleted")


# ==================== PERFORMANCE REVIEWS ====================

class TestPerformanceReviews:
    """Tests for /api/performance-reviews endpoints"""
    
    created_review_id = None
    
    def test_create_performance_review(self, admin_headers):
        """POST /api/performance-reviews - Create review (supervisor only)"""
        payload = {
            "user_id": MEMBER_USER_ID,  # Reviewing the team member
            "review_period": "Q1 2025",
            "overall_rating": 4,
            "strengths": "Excellent technical skills and problem solving",
            "areas_for_improvement": "Could improve communication with stakeholders",
            "goals": "Lead a small project in Q2",
            "comments": "Great first quarter performance"
        }
        
        response = requests.post(f"{BASE_URL}/api/performance-reviews", json=payload, headers=admin_headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "review_id" in data
        assert data["user_id"] == MEMBER_USER_ID
        assert data["overall_rating"] == 4
        assert data["status"] == "draft"
        
        TestPerformanceReviews.created_review_id = data["review_id"]
        print(f"✓ Created performance review: {data['review_id']}")
    
    def test_team_member_cannot_create_review(self, member_headers):
        """POST /api/performance-reviews - Team member blocked"""
        payload = {
            "user_id": ADMIN_USER_ID,
            "review_period": "Q1 2025",
            "overall_rating": 5,
            "strengths": "Test",
            "areas_for_improvement": "Test",
            "goals": "Test",
            "comments": "Test"
        }
        
        response = requests.post(f"{BASE_URL}/api/performance-reviews", json=payload, headers=member_headers)
        assert response.status_code == 403
        print(f"✓ Team member correctly blocked from creating reviews")
    
    def test_get_performance_reviews(self, admin_headers):
        """GET /api/performance-reviews - Get all reviews"""
        response = requests.get(f"{BASE_URL}/api/performance-reviews", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        print(f"✓ Got {len(data)} performance reviews")
    
    def test_submit_performance_review(self, admin_headers):
        """PATCH /api/performance-reviews/{id}/submit - Submit review"""
        if not TestPerformanceReviews.created_review_id:
            pytest.skip("No review to submit")
        
        response = requests.patch(
            f"{BASE_URL}/api/performance-reviews/{TestPerformanceReviews.created_review_id}/submit",
            headers=admin_headers
        )
        
        assert response.status_code == 200
        
        # Verify status
        get_resp = requests.get(f"{BASE_URL}/api/performance-reviews", headers=admin_headers)
        reviews = get_resp.json()
        our_review = next((r for r in reviews if r["review_id"] == TestPerformanceReviews.created_review_id), None)
        
        assert our_review["status"] == "submitted"
        print(f"✓ Performance review submitted")
    
    def test_acknowledge_performance_review(self, member_headers):
        """PATCH /api/performance-reviews/{id}/acknowledge - Reviewed person acknowledges"""
        if not TestPerformanceReviews.created_review_id:
            pytest.skip("No review to acknowledge")
        
        response = requests.patch(
            f"{BASE_URL}/api/performance-reviews/{TestPerformanceReviews.created_review_id}/acknowledge",
            headers=member_headers  # The reviewed person acknowledges
        )
        
        assert response.status_code == 200
        
        # Verify status
        get_resp = requests.get(f"{BASE_URL}/api/performance-reviews", headers=member_headers)
        reviews = get_resp.json()
        our_review = next((r for r in reviews if r["review_id"] == TestPerformanceReviews.created_review_id), None)
        
        assert our_review["status"] == "acknowledged"
        print(f"✓ Performance review acknowledged by team member")
    
    def test_delete_performance_review_admin_only(self, admin_headers, member_headers):
        """DELETE /api/performance-reviews/{id} - Only admin can delete"""
        # Create another review to delete
        create_resp = requests.post(f"{BASE_URL}/api/performance-reviews", json={
            "user_id": MEMBER_USER_ID,
            "review_period": "Annual 2024",
            "overall_rating": 3,
            "strengths": "Test strengths",
            "areas_for_improvement": "Test areas",
            "goals": "Test goals",
            "comments": "To be deleted"
        }, headers=admin_headers)
        
        review_id = create_resp.json()["review_id"]
        
        # Member tries to delete - should fail
        member_delete = requests.delete(f"{BASE_URL}/api/performance-reviews/{review_id}", headers=member_headers)
        assert member_delete.status_code == 403
        
        # Admin deletes - should work
        admin_delete = requests.delete(f"{BASE_URL}/api/performance-reviews/{review_id}", headers=admin_headers)
        assert admin_delete.status_code == 200
        print(f"✓ Only admin can delete reviews - verified")


# ==================== ONBOARDING FORMS ====================

class TestOnboardingForms:
    """Tests for /api/onboarding endpoints"""
    
    created_form_id = None
    
    def test_create_onboarding_form(self, member_headers):
        """POST /api/onboarding - Create onboarding form"""
        payload = {
            "full_name": "John Test Member",
            "date_of_birth": "1990-05-15",
            "phone": "+1234567890",
            "address": "123 Test Street, Test City",
            "emergency_contact_name": "Jane Member",
            "emergency_contact_phone": "+0987654321",
            "emergency_contact_relation": "Spouse",
            "bank_name": "Test Bank",
            "account_number": "1234567890",
            "ifsc_code": "TEST0001234",
            "education": [
                {"degree": "B.Tech", "institution": "Test University", "year": "2012", "grade": "A"},
                {"degree": "M.Tech", "institution": "Test Institute", "year": "2014", "grade": "A+"}
            ],
            "work_experience": [
                {"company": "Previous Corp", "role": "Junior Dev", "duration": "2 years", "responsibilities": "Coding and testing"}
            ]
        }
        
        response = requests.post(f"{BASE_URL}/api/onboarding", json=payload, headers=member_headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "form_id" in data
        assert data["full_name"] == "John Test Member"
        assert data["status"] == "pending"
        assert len(data["education"]) == 2
        assert len(data["work_experience"]) == 1
        
        TestOnboardingForms.created_form_id = data["form_id"]
        print(f"✓ Created onboarding form: {data['form_id']}")
    
    def test_get_my_onboarding_form(self, member_headers):
        """GET /api/onboarding/my - Get own onboarding form"""
        response = requests.get(f"{BASE_URL}/api/onboarding/my", headers=member_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert data is not None
        assert data["form_id"] == TestOnboardingForms.created_form_id
        print(f"✓ Got own onboarding form")
    
    def test_update_onboarding_form(self, member_headers):
        """PATCH /api/onboarding/{form_id} - Update form"""
        if not TestOnboardingForms.created_form_id:
            pytest.skip("No form to update")
        
        updates = {
            "phone": "+1111222333",
            "education": [
                {"degree": "B.Tech", "institution": "Test University", "year": "2012", "grade": "A"},
                {"degree": "M.Tech", "institution": "Test Institute", "year": "2014", "grade": "A+"},
                {"degree": "MBA", "institution": "Business School", "year": "2020", "grade": "B+"}
            ]
        }
        
        response = requests.patch(
            f"{BASE_URL}/api/onboarding/{TestOnboardingForms.created_form_id}",
            json=updates,
            headers=member_headers
        )
        
        assert response.status_code == 200
        
        # Verify updates
        get_resp = requests.get(f"{BASE_URL}/api/onboarding/my", headers=member_headers)
        data = get_resp.json()
        
        assert data["phone"] == "+1111222333"
        assert len(data["education"]) == 3
        print(f"✓ Onboarding form updated with new education")
    
    def test_submit_onboarding_form(self, member_headers):
        """PATCH /api/onboarding/{form_id}/submit - Submit for approval"""
        if not TestOnboardingForms.created_form_id:
            pytest.skip("No form to submit")
        
        response = requests.patch(
            f"{BASE_URL}/api/onboarding/{TestOnboardingForms.created_form_id}/submit",
            headers=member_headers
        )
        
        assert response.status_code == 200
        
        # Verify status
        get_resp = requests.get(f"{BASE_URL}/api/onboarding/my", headers=member_headers)
        data = get_resp.json()
        
        assert data["status"] == "submitted"
        print(f"✓ Onboarding form submitted")
    
    def test_get_all_onboarding_forms_approvers(self, admin_headers):
        """GET /api/onboarding - Approvers can see all forms"""
        response = requests.get(f"{BASE_URL}/api/onboarding", headers=admin_headers)
        
        assert response.status_code == 200
        data = response.json()
        
        assert isinstance(data, list)
        # Should include the submitted form
        form_ids = [f["form_id"] for f in data]
        if TestOnboardingForms.created_form_id:
            assert TestOnboardingForms.created_form_id in form_ids
        print(f"✓ Admin can see {len(data)} onboarding forms")
    
    def test_approve_onboarding_form(self, admin_headers):
        """PATCH /api/onboarding/{form_id}/approve - Approve form"""
        if not TestOnboardingForms.created_form_id:
            pytest.skip("No form to approve")
        
        response = requests.patch(
            f"{BASE_URL}/api/onboarding/{TestOnboardingForms.created_form_id}/approve",
            headers=admin_headers
        )
        
        assert response.status_code == 200
        
        # Verify status
        get_resp = requests.get(f"{BASE_URL}/api/onboarding", headers=admin_headers)
        forms = get_resp.json()
        our_form = next((f for f in forms if f["form_id"] == TestOnboardingForms.created_form_id), None)
        
        assert our_form["status"] == "approved"
        print(f"✓ Onboarding form approved")


# ==================== TEAM REQUESTS PENDING ====================

class TestTeamRequestsPending:
    """Tests for /api/team-requests/pending endpoint"""
    
    def test_get_pending_team_requests_admin(self, admin_headers):
        """GET /api/team-requests/pending - Returns summary of pending requests"""
        response = requests.get(f"{BASE_URL}/api/team-requests/pending", headers=admin_headers)
        
        assert response.status_code == 200, f"Failed: {response.text}"
        data = response.json()
        
        assert "leaves" in data
        assert "reimbursements" in data
        assert "onboarding" in data
        assert "total_pending" in data
        
        assert isinstance(data["leaves"], list)
        assert isinstance(data["reimbursements"], list)
        assert isinstance(data["onboarding"], list)
        assert isinstance(data["total_pending"], int)
        
        print(f"✓ Team requests pending: {data['total_pending']} total")
        print(f"  - Leaves: {len(data['leaves'])}")
        print(f"  - Reimbursements: {len(data['reimbursements'])}")
        print(f"  - Onboarding: {len(data['onboarding'])}")
    
    def test_team_member_cannot_access_pending_requests(self, member_headers):
        """GET /api/team-requests/pending - Team member blocked"""
        response = requests.get(f"{BASE_URL}/api/team-requests/pending", headers=member_headers)
        
        assert response.status_code == 403
        print(f"✓ Team member correctly blocked from team requests")


# ==================== LEAVE TYPE VARIATIONS ====================

class TestLeaveTypeVariations:
    """Test all leave types work correctly"""
    
    def test_all_leave_types(self, admin_headers):
        """Test creating leaves with all types"""
        leave_types = ["casual", "sick", "earned", "unpaid", "wfh"]
        
        for i, leave_type in enumerate(leave_types):
            start_date = (datetime.now() + timedelta(days=60 + i*5)).strftime("%Y-%m-%d")
            
            response = requests.post(f"{BASE_URL}/api/leaves", json={
                "leave_type": leave_type,
                "start_date": start_date,
                "end_date": start_date,
                "reason": f"Testing {leave_type} leave type"
            }, headers=admin_headers)
            
            assert response.status_code == 200, f"Failed for {leave_type}: {response.text}"
            assert response.json()["leave_type"] == leave_type
        
        print(f"✓ All 5 leave types working: {', '.join(leave_types)}")


# ==================== REIMBURSEMENT CATEGORY VARIATIONS ====================

class TestReimbursementCategories:
    """Test all reimbursement categories work correctly"""
    
    def test_all_reimbursement_categories(self, admin_headers):
        """Test creating reimbursements with all categories"""
        categories = ["travel", "equipment", "office_supplies", "client_entertainment", "other"]
        
        for category in categories:
            response = requests.post(f"{BASE_URL}/api/reimbursements", json={
                "category": category,
                "amount": 100.00,
                "description": f"Testing {category} category",
                "date": datetime.now().strftime("%Y-%m-%d")
            }, headers=admin_headers)
            
            assert response.status_code == 200, f"Failed for {category}: {response.text}"
            assert response.json()["category"] == category
        
        print(f"✓ All 5 reimbursement categories working: {', '.join(categories)}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
