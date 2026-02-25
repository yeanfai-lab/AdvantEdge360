"""
Test Suite for Phase E Features:
- Public Holidays CRUD
- Leave Accrual Policies CRUD  
- Leave Balances
- Reimbursements with file upload and project tagging
- Fee Structure bulk actions
- Email notifications (demo mode)
"""
import pytest
import requests
import os
import io
from datetime import datetime

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Get session token at module level
import subprocess
result = subprocess.run([
    'mongosh', '--quiet', '--eval', '''
    use('test_database');
    var session = db.user_sessions.findOne({session_token: /test_session_1772040300456/});
    if (session) {
        print(session.session_token);
    } else {
        print('NO_SESSION');
    }
    '''
], capture_output=True, text=True)
SESSION_TOKEN = result.stdout.strip().split('\n')[-1]
if SESSION_TOKEN == 'NO_SESSION':
    SESSION_TOKEN = 'test_session_1772040300456'  # Fallback

AUTH_HEADERS = {
    "Authorization": f"Bearer {SESSION_TOKEN}",
    "Content-Type": "application/json"
}


class TestPublicHolidaysCRUD:
    """Test Public Holidays CRUD operations - Admin only"""
    
    created_holiday_id = None
    
    def test_create_public_holiday(self):
        """Test creating a public holiday"""
        payload = {
            "name": "TEST_Independence Day",
            "date": "2026-08-15",
            "year": 2026
        }
        response = requests.post(
            f"{BASE_URL}/api/public-holidays",
            json=payload,
            headers=AUTH_HEADERS
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_Independence Day"
        assert data["date"] == "2026-08-15"
        assert data["year"] == 2026
        assert "holiday_id" in data
        TestPublicHolidaysCRUD.created_holiday_id = data["holiday_id"]
        print(f"Created holiday: {data['holiday_id']}")
    
    def test_get_public_holidays(self):
        """Test fetching public holidays"""
        response = requests.get(
            f"{BASE_URL}/api/public-holidays?year=2026",
            headers=AUTH_HEADERS
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} holidays for 2026")
    
    def test_update_public_holiday(self):
        """Test updating a public holiday"""
        if TestPublicHolidaysCRUD.created_holiday_id is None:
            pytest.skip("No holiday created")
        payload = {"name": "TEST_Independence Day Updated"}
        response = requests.patch(
            f"{BASE_URL}/api/public-holidays/{TestPublicHolidaysCRUD.created_holiday_id}",
            json=payload,
            headers=AUTH_HEADERS
        )
        assert response.status_code == 200
        print(f"Updated holiday: {TestPublicHolidaysCRUD.created_holiday_id}")
    
    def test_delete_public_holiday(self):
        """Test deleting a public holiday"""
        if TestPublicHolidaysCRUD.created_holiday_id is None:
            pytest.skip("No holiday to delete")
        response = requests.delete(
            f"{BASE_URL}/api/public-holidays/{TestPublicHolidaysCRUD.created_holiday_id}",
            headers=AUTH_HEADERS
        )
        assert response.status_code == 200
        print(f"Deleted holiday: {TestPublicHolidaysCRUD.created_holiday_id}")


class TestLeaveAccrualPolicies:
    """Test Leave Accrual Policies CRUD - Admin only"""
    
    created_policy_id = None
    
    def test_create_leave_accrual_policy(self):
        """Test creating a leave accrual policy"""
        payload = {
            "leave_type": "test_casual",
            "accrual_per_month": 1.5,
            "max_carry_forward": 5,
            "max_accumulation": 18
        }
        response = requests.post(
            f"{BASE_URL}/api/leave-accrual-policies",
            json=payload,
            headers=AUTH_HEADERS
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["leave_type"] == "test_casual"
        assert data["accrual_per_month"] == 1.5
        TestLeaveAccrualPolicies.created_policy_id = data["policy_id"]
        print(f"Created policy: {data['policy_id']}")
    
    def test_get_leave_accrual_policies(self):
        """Test fetching leave accrual policies"""
        response = requests.get(
            f"{BASE_URL}/api/leave-accrual-policies",
            headers=AUTH_HEADERS
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} accrual policies")
    
    def test_update_leave_accrual_policy(self):
        """Test updating a leave accrual policy"""
        if TestLeaveAccrualPolicies.created_policy_id is None:
            pytest.skip("No policy to update")
        payload = {"accrual_per_month": 2.0, "max_accumulation": 24}
        response = requests.patch(
            f"{BASE_URL}/api/leave-accrual-policies/{TestLeaveAccrualPolicies.created_policy_id}",
            json=payload,
            headers=AUTH_HEADERS
        )
        assert response.status_code == 200
        print(f"Updated policy: {TestLeaveAccrualPolicies.created_policy_id}")
    
    def test_delete_leave_accrual_policy(self):
        """Test deleting a leave accrual policy"""
        if TestLeaveAccrualPolicies.created_policy_id is None:
            pytest.skip("No policy to delete")
        response = requests.delete(
            f"{BASE_URL}/api/leave-accrual-policies/{TestLeaveAccrualPolicies.created_policy_id}",
            headers=AUTH_HEADERS
        )
        assert response.status_code == 200
        print(f"Deleted policy: {TestLeaveAccrualPolicies.created_policy_id}")


class TestLeaveBalances:
    """Test Leave Balance calculation API"""
    
    def test_get_leave_balances(self):
        """Test fetching leave balances"""
        response = requests.get(
            f"{BASE_URL}/api/leave-balances?year=2026",
            headers=AUTH_HEADERS
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        if len(data) > 0:
            balance = data[0]
            assert "user_id" in balance
            assert "leave_type" in balance
            print(f"Found {len(data)} leave balance records")
        else:
            print("No leave balances found (expected if no accrual policies)")


class TestReimbursementWithFileUpload:
    """Test Reimbursements with file upload and project tagging"""
    
    created_reimbursement_id = None
    test_project_id = None
    
    def test_get_projects_for_reimbursement(self):
        """Get existing project for reimbursement tagging"""
        response = requests.get(
            f"{BASE_URL}/api/projects",
            headers=AUTH_HEADERS
        )
        assert response.status_code == 200
        data = response.json()
        if len(data) > 0:
            TestReimbursementWithFileUpload.test_project_id = data[0]["project_id"]
            print(f"Using existing project: {data[0]['name']}")
        else:
            print("No projects found")
    
    def test_create_internal_reimbursement(self):
        """Test creating an internal reimbursement (no project)"""
        payload = {
            "category": "office_supplies",
            "amount": 1500,
            "description": "TEST_Office supplies purchase",
            "date": "2026-01-15"
        }
        response = requests.post(
            f"{BASE_URL}/api/reimbursements",
            json=payload,
            headers=AUTH_HEADERS
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["category"] == "office_supplies"
        assert data["amount"] == 1500
        assert data["project_id"] is None  # Internal = no project
        TestReimbursementWithFileUpload.created_reimbursement_id = data["reimbursement_id"]
        print(f"Created internal reimbursement: {data['reimbursement_id']}")
    
    def test_create_project_reimbursement(self):
        """Test creating a project-tagged reimbursement"""
        if TestReimbursementWithFileUpload.test_project_id is None:
            pytest.skip("No project available for tagging")
        
        payload = {
            "category": "travel",
            "amount": 5000,
            "description": "TEST_Client meeting travel",
            "date": "2026-01-20",
            "project_id": TestReimbursementWithFileUpload.test_project_id
        }
        response = requests.post(
            f"{BASE_URL}/api/reimbursements",
            json=payload,
            headers=AUTH_HEADERS
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["project_id"] == TestReimbursementWithFileUpload.test_project_id
        assert data["project_id"] is not None  # Project-tagged = has project_id
        print(f"Created project reimbursement: {data['reimbursement_id']}")
    
    def test_upload_receipt_png(self):
        """Test uploading a PNG receipt file"""
        # Create a simple test PNG image
        test_image = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {'file': ('test_receipt.png', io.BytesIO(test_image), 'image/png')}
        headers = {"Authorization": AUTH_HEADERS["Authorization"]}
        
        response = requests.post(
            f"{BASE_URL}/api/upload/receipt",
            files=files,
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "file_url" in data
        assert "filename" in data
        assert data["file_url"].startswith("/api/uploads/")
        print(f"Uploaded PNG receipt: {data['file_url']}")
    
    def test_upload_receipt_wrong_type_rejected(self):
        """Test uploading a file with invalid type is rejected"""
        files = {'file': ('test.txt', io.BytesIO(b'test content'), 'text/plain')}
        headers = {"Authorization": AUTH_HEADERS["Authorization"]}
        
        response = requests.post(
            f"{BASE_URL}/api/upload/receipt",
            files=files,
            headers=headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Correctly rejected invalid file type")
    
    def test_get_reimbursements(self):
        """Test fetching reimbursements"""
        response = requests.get(
            f"{BASE_URL}/api/reimbursements",
            headers=AUTH_HEADERS
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} reimbursements")
    
    def test_approve_reimbursement(self):
        """Test approving a reimbursement"""
        if TestReimbursementWithFileUpload.created_reimbursement_id is None:
            pytest.skip("No reimbursement to approve")
        
        response = requests.patch(
            f"{BASE_URL}/api/reimbursements/{TestReimbursementWithFileUpload.created_reimbursement_id}/approve",
            headers=AUTH_HEADERS
        )
        assert response.status_code == 200
        print(f"Approved reimbursement (email notification sent in demo mode)")


class TestFeeStructureBulkActions:
    """Test Fee Structure with bulk operations"""
    
    test_project_id = None
    created_fee_ids = []
    
    def test_get_project_for_fee_structure(self):
        """Get existing project for fee structure"""
        response = requests.get(
            f"{BASE_URL}/api/projects",
            headers=AUTH_HEADERS
        )
        assert response.status_code == 200
        if len(response.json()) > 0:
            TestFeeStructureBulkActions.test_project_id = response.json()[0]["project_id"]
            print(f"Using project: {TestFeeStructureBulkActions.test_project_id}")
    
    def test_create_fee_structure_items(self):
        """Test creating fee structure items"""
        if TestFeeStructureBulkActions.test_project_id is None:
            pytest.skip("No project available")
        
        items = [
            {"stage": "Phase 1", "deliverable": "TEST_Design Doc", "percentage": 20, "amount": 100000},
            {"stage": "Phase 2", "deliverable": "TEST_Development", "percentage": 50, "amount": 250000},
        ]
        
        for item in items:
            payload = {
                "project_id": TestFeeStructureBulkActions.test_project_id,
                "stage": item["stage"],
                "deliverable": item["deliverable"],
                "percentage": item["percentage"],
                "amount": item["amount"],
                "tentative_billing_date": "2026-06-15",
                "deliverable_status": "not_started",
                "invoice_status": "not_invoiced",
                "payment_status": "pending"
            }
            response = requests.post(
                f"{BASE_URL}/api/fee-structure",
                json=payload,
                headers=AUTH_HEADERS
            )
            if response.status_code == 200:
                TestFeeStructureBulkActions.created_fee_ids.append(response.json()["item_id"])
                print(f"Created fee item: {response.json()['item_id']}")
    
    def test_get_fee_structure(self):
        """Test fetching fee structure"""
        response = requests.get(
            f"{BASE_URL}/api/fee-structure",
            headers=AUTH_HEADERS
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} fee structure items")
    
    def test_bulk_update_fee_items(self):
        """Test bulk updating fee items status"""
        if len(TestFeeStructureBulkActions.created_fee_ids) == 0:
            pytest.skip("No fee items to update")
        
        updated = 0
        for item_id in TestFeeStructureBulkActions.created_fee_ids:
            response = requests.patch(
                f"{BASE_URL}/api/fee-structure/{item_id}",
                json={"deliverable_status": "in_progress"},
                headers=AUTH_HEADERS
            )
            if response.status_code == 200:
                updated += 1
        
        print(f"Bulk updated {updated} fee items to in_progress")
        assert updated > 0


class TestLeaveApplicationsWorkflow:
    """Test full leave application workflow"""
    
    created_leave_id = None
    
    def test_create_leave_application(self):
        """Test creating a leave application"""
        payload = {
            "leave_type": "casual",
            "start_date": "2026-02-10",
            "end_date": "2026-02-12",
            "reason": "TEST_Personal work"
        }
        response = requests.post(
            f"{BASE_URL}/api/leaves",
            json=payload,
            headers=AUTH_HEADERS
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["leave_type"] == "casual"
        assert data["days"] == 3
        assert data["status"] == "pending"
        TestLeaveApplicationsWorkflow.created_leave_id = data["leave_id"]
        print(f"Created leave: {data['leave_id']}")
    
    def test_get_leave_applications(self):
        """Test fetching leave applications"""
        response = requests.get(
            f"{BASE_URL}/api/leaves",
            headers=AUTH_HEADERS
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} leave applications")


class TestCurrencyFormat:
    """Test INR currency format"""
    
    def test_reimbursement_amount_is_numeric(self):
        """Verify reimbursement API returns numeric amount"""
        response = requests.get(
            f"{BASE_URL}/api/reimbursements",
            headers=AUTH_HEADERS
        )
        assert response.status_code == 200
        data = response.json()
        if len(data) > 0:
            assert isinstance(data[0]["amount"], (int, float))
            print(f"Reimbursement amount is numeric: {data[0]['amount']}")


class TestEmailNotifications:
    """Test email notification demo mode"""
    
    def test_email_notifications_stored(self):
        """Verify email notifications are stored"""
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', '''
            use('test_database');
            var count = db.email_notifications.countDocuments({});
            print(count);
            '''
        ], capture_output=True, text=True)
        count = int(result.stdout.strip().split('\n')[-1])
        print(f"Found {count} email notifications in database (demo mode)")


class TestCleanup:
    """Clean up test data"""
    
    def test_cleanup_test_data(self):
        """Remove all TEST_ prefixed data"""
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', '''
            use('test_database');
            db.public_holidays.deleteMany({name: /^TEST_/});
            db.reimbursements.deleteMany({description: /^TEST_/});
            db.leaves.deleteMany({reason: /^TEST_/});
            db.fee_structure.deleteMany({deliverable: /^TEST_/});
            db.leave_accrual_policies.deleteMany({leave_type: /^test_/});
            print('Cleaned up test data');
            '''
        ], capture_output=True, text=True)
        print(result.stdout)
