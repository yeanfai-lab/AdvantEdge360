"""
Test Finance Module - Phase D
Tests Fee Structure CRUD, Team Salary CRUD, Cash Flow Expense CRUD
All new endpoints introduced for Finance redesign
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "test_session_1772037108627"

class TestFeeStructureCRUD:
    """Fee Structure endpoint tests - Project deliverables with stages, amounts, and statuses"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SESSION_TOKEN}"
        }
        # First get a project to use
        response = requests.get(f"{BASE_URL}/api/projects", headers=self.headers)
        if response.status_code == 200 and len(response.json()) > 0:
            self.project_id = response.json()[0]['project_id']
        else:
            # Create a test project
            create_res = requests.post(f"{BASE_URL}/api/projects", 
                headers=self.headers,
                json={"name": "TEST_FinanceProject", "description": "Test project for finance testing"}
            )
            if create_res.status_code in [200, 201]:
                self.project_id = create_res.json().get('project_id')
            else:
                self.project_id = None
    
    def test_get_fee_structure_empty(self):
        """Test GET /api/fee-structure returns list"""
        response = requests.get(f"{BASE_URL}/api/fee-structure", headers=self.headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"Fee structure GET: {response.status_code} - {len(response.json())} items")
    
    def test_create_fee_structure_item(self):
        """Test POST /api/fee-structure creates a new deliverable"""
        if not self.project_id:
            pytest.skip("No project available for testing")
        
        payload = {
            "project_id": self.project_id,
            "stage": "Design",
            "deliverable": "TEST_Wireframes",
            "percentage": 20.0,
            "amount": 100000,
            "tentative_billing_date": "2026-02-15",
            "deliverable_status": "not_started",
            "invoice_status": "not_invoiced",
            "payment_status": "pending"
        }
        response = requests.post(f"{BASE_URL}/api/fee-structure", headers=self.headers, json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "item_id" in data
        assert data["stage"] == "Design"
        assert data["deliverable"] == "TEST_Wireframes"
        assert data["percentage"] == 20.0
        assert data["amount"] == 100000
        assert data["deliverable_status"] == "not_started"
        print(f"Fee structure CREATE: {response.status_code} - item_id: {data.get('item_id')}")
        
        # Verify by GET with project filter
        get_response = requests.get(f"{BASE_URL}/api/fee-structure?project_id={self.project_id}", headers=self.headers)
        assert get_response.status_code == 200
        items = get_response.json()
        assert any(i['deliverable'] == 'TEST_Wireframes' for i in items), "Created item not found in GET response"
    
    def test_update_fee_structure_item(self):
        """Test PATCH /api/fee-structure/{item_id} updates an item"""
        if not self.project_id:
            pytest.skip("No project available for testing")
        
        # Create an item first
        create_payload = {
            "project_id": self.project_id,
            "stage": "Development",
            "deliverable": "TEST_MVP Build",
            "percentage": 30.0,
            "amount": 150000,
            "deliverable_status": "not_started",
            "invoice_status": "not_invoiced",
            "payment_status": "pending"
        }
        create_response = requests.post(f"{BASE_URL}/api/fee-structure", headers=self.headers, json=create_payload)
        assert create_response.status_code == 200
        item_id = create_response.json()['item_id']
        
        # Update it
        update_payload = {
            "deliverable_status": "in_progress",
            "invoice_status": "invoiced"
        }
        update_response = requests.patch(f"{BASE_URL}/api/fee-structure/{item_id}", headers=self.headers, json=update_payload)
        assert update_response.status_code == 200
        print(f"Fee structure UPDATE: {update_response.status_code}")
    
    def test_delete_fee_structure_item(self):
        """Test DELETE /api/fee-structure/{item_id} removes an item"""
        if not self.project_id:
            pytest.skip("No project available for testing")
        
        # Create an item to delete
        create_payload = {
            "project_id": self.project_id,
            "stage": "Testing",
            "deliverable": "TEST_ToDelete",
            "percentage": 10.0,
            "amount": 50000,
            "deliverable_status": "not_started",
            "invoice_status": "not_invoiced",
            "payment_status": "pending"
        }
        create_response = requests.post(f"{BASE_URL}/api/fee-structure", headers=self.headers, json=create_payload)
        assert create_response.status_code == 200
        item_id = create_response.json()['item_id']
        
        # Delete it
        delete_response = requests.delete(f"{BASE_URL}/api/fee-structure/{item_id}", headers=self.headers)
        assert delete_response.status_code == 200
        print(f"Fee structure DELETE: {delete_response.status_code}")
        
        # Verify it's gone - try to get fee structure and ensure item not there
        get_response = requests.get(f"{BASE_URL}/api/fee-structure?project_id={self.project_id}", headers=self.headers)
        items = get_response.json()
        assert not any(i.get('item_id') == item_id for i in items), "Deleted item still exists"


class TestTeamSalaryCRUD:
    """Team Salary endpoint tests - Monthly salary, hourly rate, daily rate"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SESSION_TOKEN}"
        }
        # Get a team member to use
        response = requests.get(f"{BASE_URL}/api/team", headers=self.headers)
        if response.status_code == 200 and len(response.json()) > 0:
            self.user_id = response.json()[0]['user_id']
        else:
            self.user_id = "test-user-1772037108627"  # Use our test user
    
    def test_get_team_salaries(self):
        """Test GET /api/team-salaries returns list"""
        response = requests.get(f"{BASE_URL}/api/team-salaries", headers=self.headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"Team salaries GET: {response.status_code} - {len(response.json())} records")
    
    def test_create_team_salary(self):
        """Test POST /api/team-salaries creates/updates salary info"""
        if not self.user_id:
            pytest.skip("No user available for testing")
        
        payload = {
            "user_id": self.user_id,
            "monthly_salary": 80000,
            "hourly_rate": 500,
            "daily_rate": 4000
        }
        response = requests.post(f"{BASE_URL}/api/team-salaries", headers=self.headers, json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "salary_id" in data
        assert data["monthly_salary"] == 80000
        assert data["hourly_rate"] == 500
        assert data["daily_rate"] == 4000
        print(f"Team salary CREATE: {response.status_code} - salary_id: {data.get('salary_id')}")
    
    def test_update_team_salary(self):
        """Test PATCH /api/team-salaries/{salary_id} updates salary"""
        # First get existing salaries
        get_response = requests.get(f"{BASE_URL}/api/team-salaries", headers=self.headers)
        assert get_response.status_code == 200
        salaries = get_response.json()
        
        if len(salaries) == 0:
            # Create one first
            create_payload = {
                "user_id": self.user_id,
                "monthly_salary": 70000,
                "hourly_rate": 450,
                "daily_rate": 3500
            }
            create_response = requests.post(f"{BASE_URL}/api/team-salaries", headers=self.headers, json=create_payload)
            assert create_response.status_code == 200
            salary_id = create_response.json()['salary_id']
        else:
            salary_id = salaries[0]['salary_id']
        
        # Update
        update_payload = {"hourly_rate": 600}
        update_response = requests.patch(f"{BASE_URL}/api/team-salaries/{salary_id}", headers=self.headers, json=update_payload)
        assert update_response.status_code == 200
        print(f"Team salary UPDATE: {update_response.status_code}")


class TestCashFlowExpensesCRUD:
    """Cash Flow Expense endpoint tests - Monthly expense tracking"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SESSION_TOKEN}"
        }
    
    def test_get_cashflow_expenses(self):
        """Test GET /api/cashflow-expenses returns list"""
        response = requests.get(f"{BASE_URL}/api/cashflow-expenses", headers=self.headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"Cashflow expenses GET: {response.status_code} - {len(response.json())} items")
    
    def test_create_cashflow_expense(self):
        """Test POST /api/cashflow-expenses creates a new expense"""
        payload = {
            "expense_head": "TEST_Salaries",
            "sub_head": "Engineering Team",
            "month_year": "2026-01",
            "amount": 500000
        }
        response = requests.post(f"{BASE_URL}/api/cashflow-expenses", headers=self.headers, json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "expense_id" in data
        assert data["expense_head"] == "TEST_Salaries"
        assert data["month_year"] == "2026-01"
        assert data["amount"] == 500000
        print(f"Cashflow expense CREATE: {response.status_code} - expense_id: {data.get('expense_id')}")
    
    def test_update_cashflow_expense(self):
        """Test PATCH /api/cashflow-expenses/{expense_id} updates an expense"""
        # Create one first
        create_payload = {
            "expense_head": "TEST_Rent",
            "month_year": "2026-02",
            "amount": 100000
        }
        create_response = requests.post(f"{BASE_URL}/api/cashflow-expenses", headers=self.headers, json=create_payload)
        assert create_response.status_code == 200
        expense_id = create_response.json()['expense_id']
        
        # Update
        update_payload = {"amount": 120000}
        update_response = requests.patch(f"{BASE_URL}/api/cashflow-expenses/{expense_id}", headers=self.headers, json=update_payload)
        assert update_response.status_code == 200
        print(f"Cashflow expense UPDATE: {update_response.status_code}")
    
    def test_delete_cashflow_expense(self):
        """Test DELETE /api/cashflow-expenses/{expense_id} removes an expense"""
        # Create one to delete
        create_payload = {
            "expense_head": "TEST_ToDelete",
            "month_year": "2026-03",
            "amount": 10000
        }
        create_response = requests.post(f"{BASE_URL}/api/cashflow-expenses", headers=self.headers, json=create_payload)
        assert create_response.status_code == 200
        expense_id = create_response.json()['expense_id']
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/cashflow-expenses/{expense_id}", headers=self.headers)
        assert delete_response.status_code == 200
        print(f"Cashflow expense DELETE: {delete_response.status_code}")


class TestLeavesAndReimbursements:
    """Test Leave and Reimbursement endpoints work on separate pages"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SESSION_TOKEN}"
        }
    
    def test_get_leaves(self):
        """Test GET /api/leaves returns list"""
        response = requests.get(f"{BASE_URL}/api/leaves", headers=self.headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"Leaves GET: {response.status_code} - {len(response.json())} items")
    
    def test_get_reimbursements(self):
        """Test GET /api/reimbursements returns list"""
        response = requests.get(f"{BASE_URL}/api/reimbursements", headers=self.headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"Reimbursements GET: {response.status_code} - {len(response.json())} items")
    
    def test_create_leave_application(self):
        """Test POST /api/leaves creates a leave request"""
        payload = {
            "leave_type": "casual",
            "start_date": "2026-02-10",
            "end_date": "2026-02-12",
            "reason": "TEST_Personal work"
        }
        response = requests.post(f"{BASE_URL}/api/leaves", headers=self.headers, json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "leave_id" in data
        assert data["leave_type"] == "casual"
        assert data["status"] == "pending"
        print(f"Leave CREATE: {response.status_code} - leave_id: {data.get('leave_id')}")
    
    def test_create_reimbursement(self):
        """Test POST /api/reimbursements creates a reimbursement request"""
        payload = {
            "category": "travel",
            "amount": 5000,
            "description": "TEST_Travel expense",
            "date": "2026-01-15"
        }
        response = requests.post(f"{BASE_URL}/api/reimbursements", headers=self.headers, json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "reimbursement_id" in data
        assert data["category"] == "travel"
        assert data["amount"] == 5000
        print(f"Reimbursement CREATE: {response.status_code} - reimbursement_id: {data.get('reimbursement_id')}")


class TestClientsCompanyEndpoints:
    """Test Client Company CRUD with GST/PAN/Business Address fields"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SESSION_TOKEN}"
        }
    
    def test_get_companies(self):
        """Test GET /api/companies returns list"""
        response = requests.get(f"{BASE_URL}/api/companies", headers=self.headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"Companies GET: {response.status_code} - {len(response.json())} companies")
    
    def test_create_company_with_gst_pan(self):
        """Test POST /api/companies with GST/PAN/Business Address fields"""
        payload = {
            "name": "TEST_TechCorp Ltd",
            "industry": "Technology",
            "website": "https://test-techcorp.com",
            "phone": "+91 9876543210",
            "business_address": "123 Tech Park, Bangalore 560001",
            "gst_number": "29AABCT1234A1Z5",
            "pan_number": "AABCT1234A"
        }
        response = requests.post(f"{BASE_URL}/api/companies", headers=self.headers, json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "company_id" in data
        assert data["name"] == "TEST_TechCorp Ltd"
        assert data.get("gst_number") == "29AABCT1234A1Z5"
        assert data.get("pan_number") == "AABCT1234A"
        assert data.get("business_address") == "123 Tech Park, Bangalore 560001"
        print(f"Company CREATE with GST/PAN: {response.status_code} - company_id: {data.get('company_id')}")
    
    def test_update_company(self):
        """Test PATCH /api/companies/{company_id} updates company"""
        # Create a company first
        create_payload = {
            "name": "TEST_UpdateCorp",
            "industry": "Finance"
        }
        create_response = requests.post(f"{BASE_URL}/api/companies", headers=self.headers, json=create_payload)
        assert create_response.status_code == 200
        company_id = create_response.json()['company_id']
        
        # Update with GST/PAN
        update_payload = {
            "gst_number": "22AAAAA1111A1Z5",
            "pan_number": "AAAAA1111A",
            "business_address": "Updated Address, Mumbai"
        }
        update_response = requests.patch(f"{BASE_URL}/api/companies/{company_id}", headers=self.headers, json=update_payload)
        assert update_response.status_code == 200
        print(f"Company UPDATE: {update_response.status_code}")
    
    def test_delete_company(self):
        """Test DELETE /api/companies/{company_id} removes company"""
        # Create a company to delete
        create_payload = {
            "name": "TEST_DeleteCorp",
            "industry": "Retail"
        }
        create_response = requests.post(f"{BASE_URL}/api/companies", headers=self.headers, json=create_payload)
        assert create_response.status_code == 200
        company_id = create_response.json()['company_id']
        
        # Delete
        delete_response = requests.delete(f"{BASE_URL}/api/companies/{company_id}", headers=self.headers)
        assert delete_response.status_code == 200
        print(f"Company DELETE: {delete_response.status_code}")
    
    def test_create_client_contact_with_gst_pan(self):
        """Test POST /api/clients with GST/PAN/Business Address fields"""
        payload = {
            "name": "TEST_John Doe",
            "email": "test.john@example.com",
            "phone": "+91 9876543210",
            "position": "CEO",
            "business_address": "456 Business Center, Delhi",
            "gst_number": "07AAAAA2222A1Z5",
            "pan_number": "AAAAA2222A"
        }
        response = requests.post(f"{BASE_URL}/api/clients", headers=self.headers, json=payload)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        
        data = response.json()
        assert "client_id" in data
        assert data["name"] == "TEST_John Doe"
        print(f"Client CREATE with GST/PAN: {response.status_code} - client_id: {data.get('client_id')}")


class TestDashboardEndpoints:
    """Test Dashboard endpoints for pending requests and task details"""
    
    @pytest.fixture(autouse=True)
    def setup(self):
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {SESSION_TOKEN}"
        }
    
    def test_get_my_tasks(self):
        """Test GET /api/dashboard/my-tasks returns tasks"""
        response = requests.get(f"{BASE_URL}/api/dashboard/my-tasks", headers=self.headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"My tasks GET: {response.status_code} - {len(response.json())} tasks")
    
    def test_get_team_tasks(self):
        """Test GET /api/dashboard/team-tasks returns team tasks"""
        response = requests.get(f"{BASE_URL}/api/dashboard/team-tasks", headers=self.headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print(f"Team tasks GET: {response.status_code} - {len(response.json())} member records")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
