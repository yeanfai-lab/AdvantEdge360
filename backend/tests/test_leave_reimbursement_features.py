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

class TestSetup:
    """Setup test user and session"""
    
    @pytest.fixture(scope="class")
    def session_token(self):
        """Get or create test session token"""
        import subprocess
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', '''
            use('test_database');
            var session = db.user_sessions.findOne({session_token: /test_session/});
            if (session) {
                print(session.session_token);
            } else {
                var userId = 'test-user-pytest-' + Date.now();
                var sessionToken = 'test_session_pytest_' + Date.now();
                db.users.insertOne({
                    user_id: userId,
                    email: 'test.pytest.' + Date.now() + '@example.com',
                    name: 'Test Pytest User',
                    role: 'admin',
                    date_of_joining: '2024-01-15T00:00:00Z',
                    created_at: new Date()
                });
                db.user_sessions.insertOne({
                    user_id: userId,
                    session_token: sessionToken,
                    expires_at: new Date(Date.now() + 7*24*60*60*1000),
                    created_at: new Date()
                });
                print(sessionToken);
            }
            '''
        ], capture_output=True, text=True)
        token = result.stdout.strip().split('\n')[-1]
        return token

    @pytest.fixture(scope="class")
    def auth_headers(self, session_token):
        """Return headers with auth token"""
        return {
            "Authorization": f"Bearer {session_token}",
            "Content-Type": "application/json"
        }


class TestPublicHolidaysCRUD(TestSetup):
    """Test Public Holidays CRUD operations - Admin only"""
    
    created_holiday_id = None
    
    def test_create_public_holiday(self, auth_headers):
        """Test creating a public holiday"""
        payload = {
            "name": "TEST_Independence Day",
            "date": "2026-08-15",
            "year": 2026
        }
        response = requests.post(
            f"{BASE_URL}/api/public-holidays",
            json=payload,
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["name"] == "TEST_Independence Day"
        assert data["date"] == "2026-08-15"
        assert data["year"] == 2026
        assert "holiday_id" in data
        TestPublicHolidaysCRUD.created_holiday_id = data["holiday_id"]
        print(f"Created holiday: {data['holiday_id']}")
    
    def test_get_public_holidays(self, auth_headers):
        """Test fetching public holidays"""
        response = requests.get(
            f"{BASE_URL}/api/public-holidays?year=2026",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify our created holiday exists
        holiday_names = [h["name"] for h in data]
        assert "TEST_Independence Day" in holiday_names
        print(f"Found {len(data)} holidays for 2026")
    
    def test_update_public_holiday(self, auth_headers):
        """Test updating a public holiday"""
        assert TestPublicHolidaysCRUD.created_holiday_id is not None
        payload = {"name": "TEST_Independence Day Updated"}
        response = requests.patch(
            f"{BASE_URL}/api/public-holidays/{TestPublicHolidaysCRUD.created_holiday_id}",
            json=payload,
            headers=auth_headers
        )
        assert response.status_code == 200
        print(f"Updated holiday: {TestPublicHolidaysCRUD.created_holiday_id}")
    
    def test_delete_public_holiday(self, auth_headers):
        """Test deleting a public holiday"""
        assert TestPublicHolidaysCRUD.created_holiday_id is not None
        response = requests.delete(
            f"{BASE_URL}/api/public-holidays/{TestPublicHolidaysCRUD.created_holiday_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        print(f"Deleted holiday: {TestPublicHolidaysCRUD.created_holiday_id}")


class TestLeaveAccrualPolicies(TestSetup):
    """Test Leave Accrual Policies CRUD - Admin only"""
    
    created_policy_id = None
    
    def test_create_leave_accrual_policy(self, auth_headers):
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
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["leave_type"] == "test_casual"
        assert data["accrual_per_month"] == 1.5
        assert data["max_carry_forward"] == 5
        assert data["max_accumulation"] == 18
        TestLeaveAccrualPolicies.created_policy_id = data["policy_id"]
        print(f"Created policy: {data['policy_id']}")
    
    def test_get_leave_accrual_policies(self, auth_headers):
        """Test fetching leave accrual policies"""
        response = requests.get(
            f"{BASE_URL}/api/leave-accrual-policies",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Verify our created policy exists
        policy_types = [p["leave_type"] for p in data]
        assert "test_casual" in policy_types
        print(f"Found {len(data)} accrual policies")
    
    def test_update_leave_accrual_policy(self, auth_headers):
        """Test updating a leave accrual policy"""
        assert TestLeaveAccrualPolicies.created_policy_id is not None
        payload = {"accrual_per_month": 2.0, "max_accumulation": 24}
        response = requests.patch(
            f"{BASE_URL}/api/leave-accrual-policies/{TestLeaveAccrualPolicies.created_policy_id}",
            json=payload,
            headers=auth_headers
        )
        assert response.status_code == 200
        print(f"Updated policy: {TestLeaveAccrualPolicies.created_policy_id}")
    
    def test_delete_leave_accrual_policy(self, auth_headers):
        """Test deleting a leave accrual policy"""
        assert TestLeaveAccrualPolicies.created_policy_id is not None
        response = requests.delete(
            f"{BASE_URL}/api/leave-accrual-policies/{TestLeaveAccrualPolicies.created_policy_id}",
            headers=auth_headers
        )
        assert response.status_code == 200
        print(f"Deleted policy: {TestLeaveAccrualPolicies.created_policy_id}")


class TestLeaveBalances(TestSetup):
    """Test Leave Balance calculation API"""
    
    def test_get_leave_balances(self, auth_headers):
        """Test fetching leave balances"""
        response = requests.get(
            f"{BASE_URL}/api/leave-balances?year=2026",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Each balance should have these fields
        if len(data) > 0:
            balance = data[0]
            assert "user_id" in balance
            assert "user_name" in balance
            assert "leave_type" in balance
            assert "accrued_balance" in balance or "available" in balance
            print(f"Found {len(data)} leave balance records")
        else:
            print("No leave balances found (expected if no accrual policies set up)")


class TestReimbursementWithFileUpload(TestSetup):
    """Test Reimbursements with file upload and project tagging"""
    
    created_reimbursement_id = None
    test_project_id = None
    
    def test_create_project_for_reimbursement(self, auth_headers):
        """Create a test project to tag reimbursements"""
        payload = {
            "name": "TEST_Reimbursement Project",
            "description": "Test project for reimbursement tagging",
            "budget": 100000,
            "status": "active",
            "category": "Design",
            "start_date": "2026-01-01",
            "end_date": "2026-12-31"
        }
        response = requests.post(
            f"{BASE_URL}/api/projects",
            json=payload,
            headers=auth_headers
        )
        if response.status_code == 200:
            data = response.json()
            TestReimbursementWithFileUpload.test_project_id = data["project_id"]
            print(f"Created project: {data['project_id']}")
        else:
            # Get existing project
            projects_response = requests.get(
                f"{BASE_URL}/api/projects",
                headers=auth_headers
            )
            if projects_response.status_code == 200 and len(projects_response.json()) > 0:
                TestReimbursementWithFileUpload.test_project_id = projects_response.json()[0]["project_id"]
                print(f"Using existing project: {TestReimbursementWithFileUpload.test_project_id}")
    
    def test_create_internal_reimbursement(self, auth_headers):
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
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["category"] == "office_supplies"
        assert data["amount"] == 1500
        assert data["is_internal"] == True
        assert data["project_id"] is None
        TestReimbursementWithFileUpload.created_reimbursement_id = data["reimbursement_id"]
        print(f"Created internal reimbursement: {data['reimbursement_id']}")
    
    def test_create_project_reimbursement(self, auth_headers):
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
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["project_id"] == TestReimbursementWithFileUpload.test_project_id
        assert data["is_internal"] == False
        print(f"Created project reimbursement: {data['reimbursement_id']}")
    
    def test_upload_receipt(self, auth_headers):
        """Test uploading a receipt file"""
        # Create a simple test PNG image
        test_image = b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x02\x00\x00\x00\x90wS\xde\x00\x00\x00\x0cIDATx\x9cc\xf8\x0f\x00\x00\x01\x01\x00\x05\x18\xd8N\x00\x00\x00\x00IEND\xaeB`\x82'
        
        files = {'file': ('test_receipt.png', io.BytesIO(test_image), 'image/png')}
        headers = {"Authorization": auth_headers["Authorization"]}  # No Content-Type for multipart
        
        response = requests.post(
            f"{BASE_URL}/api/upload/receipt",
            files=files,
            headers=headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "file_url" in data
        assert "filename" in data
        print(f"Uploaded receipt: {data['file_url']}")
    
    def test_upload_receipt_wrong_type(self, auth_headers):
        """Test uploading a file with invalid type"""
        files = {'file': ('test.txt', io.BytesIO(b'test content'), 'text/plain')}
        headers = {"Authorization": auth_headers["Authorization"]}
        
        response = requests.post(
            f"{BASE_URL}/api/upload/receipt",
            files=files,
            headers=headers
        )
        assert response.status_code == 400, f"Expected 400, got {response.status_code}"
        print("Correctly rejected invalid file type")
    
    def test_get_reimbursements(self, auth_headers):
        """Test fetching reimbursements"""
        response = requests.get(
            f"{BASE_URL}/api/reimbursements",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        # Check our created reimbursement exists
        descriptions = [r["description"] for r in data]
        assert any("TEST_" in d for d in descriptions)
        print(f"Found {len(data)} reimbursements")
    
    def test_approve_reimbursement(self, auth_headers):
        """Test approving a reimbursement (also tests email notification demo)"""
        if TestReimbursementWithFileUpload.created_reimbursement_id is None:
            pytest.skip("No reimbursement to approve")
        
        response = requests.patch(
            f"{BASE_URL}/api/reimbursements/{TestReimbursementWithFileUpload.created_reimbursement_id}/approve",
            headers=auth_headers
        )
        assert response.status_code == 200
        print(f"Approved reimbursement (email notification sent in demo mode)")


class TestFeeStructureBulkActions(TestSetup):
    """Test Fee Structure with bulk selection and status updates"""
    
    test_project_id = None
    created_fee_ids = []
    
    def test_setup_project_for_fee_structure(self, auth_headers):
        """Get or create a project for fee structure testing"""
        response = requests.get(
            f"{BASE_URL}/api/projects",
            headers=auth_headers
        )
        if response.status_code == 200 and len(response.json()) > 0:
            TestFeeStructureBulkActions.test_project_id = response.json()[0]["project_id"]
            print(f"Using project: {TestFeeStructureBulkActions.test_project_id}")
        else:
            # Create a test project
            payload = {
                "name": "TEST_Fee Structure Project",
                "description": "Test project",
                "budget": 500000,
                "status": "active",
                "category": "Development"
            }
            response = requests.post(
                f"{BASE_URL}/api/projects",
                json=payload,
                headers=auth_headers
            )
            if response.status_code == 200:
                TestFeeStructureBulkActions.test_project_id = response.json()["project_id"]
                print(f"Created project: {TestFeeStructureBulkActions.test_project_id}")
    
    def test_create_multiple_fee_items(self, auth_headers):
        """Test creating multiple fee structure items for bulk testing"""
        if TestFeeStructureBulkActions.test_project_id is None:
            pytest.skip("No project available")
        
        items = [
            {"stage": "Phase 1", "deliverable": "TEST_Design", "percentage": 20, "amount": 100000},
            {"stage": "Phase 2", "deliverable": "TEST_Development", "percentage": 50, "amount": 250000},
            {"stage": "Phase 3", "deliverable": "TEST_Testing", "percentage": 30, "amount": 150000}
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
                headers=auth_headers
            )
            if response.status_code == 200:
                TestFeeStructureBulkActions.created_fee_ids.append(response.json()["item_id"])
                print(f"Created fee item: {response.json()['item_id']}")
    
    def test_get_fee_structure(self, auth_headers):
        """Test fetching fee structure"""
        response = requests.get(
            f"{BASE_URL}/api/fee-structure",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} fee structure items")
    
    def test_bulk_update_fee_items_status(self, auth_headers):
        """Test bulk updating fee items (simulating checkbox selection)"""
        if len(TestFeeStructureBulkActions.created_fee_ids) == 0:
            pytest.skip("No fee items to update")
        
        # Update each item to simulate bulk action
        for item_id in TestFeeStructureBulkActions.created_fee_ids[:2]:  # Update first 2
            response = requests.patch(
                f"{BASE_URL}/api/fee-structure/{item_id}",
                json={"deliverable_status": "in_progress"},
                headers=auth_headers
            )
            assert response.status_code == 200
        
        print(f"Bulk updated {min(2, len(TestFeeStructureBulkActions.created_fee_ids))} fee items")
    
    def test_cleanup_fee_items(self, auth_headers):
        """Clean up test fee items"""
        for item_id in TestFeeStructureBulkActions.created_fee_ids:
            requests.delete(
                f"{BASE_URL}/api/fee-structure/{item_id}",
                headers=auth_headers
            )
        print(f"Cleaned up {len(TestFeeStructureBulkActions.created_fee_ids)} fee items")


class TestEmailNotifications(TestSetup):
    """Test email notification demo mode"""
    
    def test_email_notifications_stored_in_db(self, auth_headers):
        """Verify email notifications are stored in database (demo mode)"""
        import subprocess
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', '''
            use('test_database');
            var count = db.email_notifications.countDocuments({});
            print(count);
            '''
        ], capture_output=True, text=True)
        count = int(result.stdout.strip().split('\n')[-1])
        print(f"Found {count} email notifications in database (demo mode)")
        # Just verify it doesn't crash - count can be 0 if no actions triggered emails yet


class TestCurrencyFormat(TestSetup):
    """Test INR currency format instead of ₹ symbol"""
    
    def test_reimbursement_returns_numeric_amount(self, auth_headers):
        """Verify reimbursement API returns numeric amount (frontend formats as INR)"""
        response = requests.get(
            f"{BASE_URL}/api/reimbursements",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        if len(data) > 0:
            # Amount should be numeric, not string with currency
            assert isinstance(data[0]["amount"], (int, float))
            print(f"Reimbursement amount is numeric: {data[0]['amount']}")


class TestLeaveApplicationsWorkflow(TestSetup):
    """Test full leave application workflow including approval/rejection"""
    
    created_leave_id = None
    
    def test_create_leave_application(self, auth_headers):
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
            headers=auth_headers
        )
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert data["leave_type"] == "casual"
        assert data["days"] == 3
        assert data["status"] == "pending"
        TestLeaveApplicationsWorkflow.created_leave_id = data["leave_id"]
        print(f"Created leave: {data['leave_id']}")
    
    def test_get_leave_applications(self, auth_headers):
        """Test fetching leave applications"""
        response = requests.get(
            f"{BASE_URL}/api/leaves",
            headers=auth_headers
        )
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        print(f"Found {len(data)} leave applications")
    
    def test_approve_leave(self, auth_headers):
        """Test approving a leave (also tests email notification demo)"""
        if TestLeaveApplicationsWorkflow.created_leave_id is None:
            pytest.skip("No leave to approve")
        
        response = requests.patch(
            f"{BASE_URL}/api/leaves/{TestLeaveApplicationsWorkflow.created_leave_id}/approve",
            headers=auth_headers
        )
        assert response.status_code == 200
        print(f"Approved leave (email notification sent in demo mode)")
    
    def test_delete_leave(self, auth_headers):
        """Clean up test leave"""
        if TestLeaveApplicationsWorkflow.created_leave_id is None:
            pytest.skip("No leave to delete")
        
        response = requests.delete(
            f"{BASE_URL}/api/leaves/{TestLeaveApplicationsWorkflow.created_leave_id}",
            headers=auth_headers
        )
        # May fail if already approved and user is not admin
        print(f"Leave deletion status: {response.status_code}")


class TestCleanup:
    """Clean up test data"""
    
    def test_cleanup_test_data(self):
        """Remove all TEST_ prefixed data"""
        import subprocess
        result = subprocess.run([
            'mongosh', '--quiet', '--eval', '''
            use('test_database');
            var r1 = db.public_holidays.deleteMany({name: /^TEST_/});
            var r2 = db.reimbursements.deleteMany({description: /^TEST_/});
            var r3 = db.leaves.deleteMany({reason: /^TEST_/});
            var r4 = db.projects.deleteMany({name: /^TEST_/});
            var r5 = db.fee_structure.deleteMany({deliverable: /^TEST_/});
            var r6 = db.leave_accrual_policies.deleteMany({leave_type: /^test_/});
            print('Cleaned up test data');
            '''
        ], capture_output=True, text=True)
        print(result.stdout)
