#!/usr/bin/env python3

import requests
import sys
from datetime import datetime
import uuid
import subprocess
import json

class AdvantEdge360APITester:
    def __init__(self, base_url="https://workflow-central-59.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.user_id = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log_result(self, test_name, passed, message="", response_data=None):
        """Log test result"""
        self.tests_run += 1
        if passed:
            self.tests_passed += 1
        
        result = {
            "test": test_name,
            "passed": passed,
            "message": message,
            "response_data": response_data
        }
        self.test_results.append(result)
        
        status = "✅" if passed else "❌"
        print(f"{status} {test_name}: {message}")
        
        return passed, response_data

    def setup_test_user(self):
        """Create test user and session in MongoDB"""
        print("\n🔧 Setting up test user...")
        
        timestamp = str(int(datetime.now().timestamp()))
        user_id = f"test-user-{timestamp}"
        session_token = f"test_session_{timestamp}"
        email = f"test.user.{timestamp}@example.com"
        
        mongosh_cmd = f'''
        use('test_database');
        var userId = '{user_id}';
        var sessionToken = '{session_token}';
        var email = '{email}';
        db.users.insertOne({{
          user_id: userId,
          email: email,
          name: 'Test User',
          picture: 'https://via.placeholder.com/150',
          role: 'admin',
          skills: ['testing', 'automation'],
          created_at: new Date()
        }});
        db.user_sessions.insertOne({{
          user_id: userId,
          session_token: sessionToken,
          expires_at: new Date(Date.now() + 7*24*60*60*1000),
          created_at: new Date()
        }});
        print('SUCCESS: User and session created');
        '''
        
        try:
            result = subprocess.run(['mongosh', '--eval', mongosh_cmd], 
                                  capture_output=True, text=True, timeout=30)
            if "SUCCESS: User and session created" in result.stdout:
                self.token = session_token
                self.user_id = user_id
                return self.log_result("Setup Test User", True, f"Created user: {user_id}")
            else:
                return self.log_result("Setup Test User", False, f"MongoDB error: {result.stderr}")
        except Exception as e:
            return self.log_result("Setup Test User", False, f"Error: {str(e)}")

    def test_api_call(self, method, endpoint, data=None, expected_status=200):
        """Make API call and test response"""
        url = f"{self.base_url}/api/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

            success = response.status_code == expected_status
            response_data = response.json() if response.headers.get('content-type', '').startswith('application/json') else response.text
            
            return success, response_data, response.status_code
        except Exception as e:
            return False, str(e), 0

    # Authentication Tests
    def test_auth_me(self):
        """Test /api/auth/me endpoint"""
        success, data, status = self.test_api_call('GET', 'auth/me')
        if success and 'user_id' in data:
            return self.log_result("Auth Me", True, f"User authenticated: {data.get('name')}")
        else:
            return self.log_result("Auth Me", False, f"Status: {status}, Data: {data}")

    def test_auth_logout(self):
        """Test logout functionality"""
        success, data, status = self.test_api_call('POST', 'auth/logout')
        return self.log_result("Auth Logout", success, f"Status: {status}")

    # Project Tests
    def test_create_project(self):
        """Test project creation"""
        project_data = {
            "name": "Test Project",
            "description": "A test project for AdvantEdge360",
            "client_name": "Test Client",
            "budget": 10000.00,
            "start_date": "2024-01-01",
            "end_date": "2024-12-31"
        }
        
        success, data, status = self.test_api_call('POST', 'projects', project_data, 200)
        if success and 'project_id' in data:
            self.test_project_id = data['project_id']
            return self.log_result("Create Project", True, f"Created project: {data['project_id']}")
        else:
            return self.log_result("Create Project", False, f"Status: {status}, Data: {data}")

    def test_get_projects(self):
        """Test get projects"""
        success, data, status = self.test_api_call('GET', 'projects')
        if success and isinstance(data, list):
            return self.log_result("Get Projects", True, f"Retrieved {len(data)} projects")
        else:
            return self.log_result("Get Projects", False, f"Status: {status}, Data: {data}")

    def test_get_project_details(self):
        """Test get project by ID"""
        if hasattr(self, 'test_project_id'):
            success, data, status = self.test_api_call('GET', f'projects/{self.test_project_id}')
            if success and data.get('project_id') == self.test_project_id:
                return self.log_result("Get Project Details", True, f"Retrieved project details")
            else:
                return self.log_result("Get Project Details", False, f"Status: {status}")
        else:
            return self.log_result("Get Project Details", False, "No test project ID available")

    # Proposal Tests
    def test_create_proposal(self):
        """Test proposal creation"""
        proposal_data = {
            "title": "Test Proposal",
            "client_name": "Test Client Corp",
            "description": "A comprehensive business solution proposal",
            "amount": 25000.00
        }
        
        success, data, status = self.test_api_call('POST', 'proposals', proposal_data, 200)
        if success and 'proposal_id' in data:
            self.test_proposal_id = data['proposal_id']
            return self.log_result("Create Proposal", True, f"Created proposal: {data['proposal_id']}")
        else:
            return self.log_result("Create Proposal", False, f"Status: {status}, Data: {data}")

    def test_get_proposals(self):
        """Test get proposals"""
        success, data, status = self.test_api_call('GET', 'proposals')
        if success and isinstance(data, list):
            return self.log_result("Get Proposals", True, f"Retrieved {len(data)} proposals")
        else:
            return self.log_result("Get Proposals", False, f"Status: {status}, Data: {data}")

    def test_approve_proposal(self):
        """Test proposal approval"""
        if hasattr(self, 'test_proposal_id'):
            success, data, status = self.test_api_call('POST', f'proposals/{self.test_proposal_id}/approve')
            return self.log_result("Approve Proposal", success, f"Status: {status}")
        else:
            return self.log_result("Approve Proposal", False, "No test proposal ID available")

    def test_convert_proposal(self):
        """Test proposal to project conversion"""
        if hasattr(self, 'test_proposal_id'):
            success, data, status = self.test_api_call('POST', f'proposals/{self.test_proposal_id}/convert')
            if success and 'project_id' in data:
                self.converted_project_id = data['project_id']
                return self.log_result("Convert Proposal", True, f"Converted to project: {data['project_id']}")
            else:
                return self.log_result("Convert Proposal", False, f"Status: {status}, Data: {data}")
        else:
            return self.log_result("Convert Proposal", False, "No test proposal ID available")

    # Task Tests
    def test_create_task(self):
        """Test task creation"""
        project_id = getattr(self, 'test_project_id', None) or getattr(self, 'converted_project_id', None)
        if not project_id:
            return self.log_result("Create Task", False, "No project available for task")
            
        task_data = {
            "project_id": project_id,
            "title": "Test Task",
            "description": "A test task for the project",
            "priority": "high",
            "assigned_to": self.user_id,
            "due_date": "2024-12-31"
        }
        
        success, data, status = self.test_api_call('POST', 'tasks', task_data, 200)
        if success and 'task_id' in data:
            self.test_task_id = data['task_id']
            return self.log_result("Create Task", True, f"Created task: {data['task_id']}")
        else:
            return self.log_result("Create Task", False, f"Status: {status}, Data: {data}")

    def test_get_tasks(self):
        """Test get tasks"""
        success, data, status = self.test_api_call('GET', 'tasks')
        if success and isinstance(data, list):
            return self.log_result("Get Tasks", True, f"Retrieved {len(data)} tasks")
        else:
            return self.log_result("Get Tasks", False, f"Status: {status}, Data: {data}")

    def test_update_task_status(self):
        """Test task status update"""
        if hasattr(self, 'test_task_id'):
            success, data, status = self.test_api_call('PATCH', f'tasks/{self.test_task_id}', 
                                                     {"status": "in-progress"})
            return self.log_result("Update Task Status", success, f"Status: {status}")
        else:
            return self.log_result("Update Task Status", False, "No test task ID available")

    # Time Tracking Tests
    def test_create_time_log(self):
        """Test time log creation"""
        if hasattr(self, 'test_task_id'):
            timelog_data = {
                "task_id": self.test_task_id,
                "duration_minutes": 120,
                "description": "Worked on test implementation",
                "date": datetime.now().strftime('%Y-%m-%d'),
                "billable": True
            }
            
            success, data, status = self.test_api_call('POST', 'time-logs', timelog_data, 200)
            if success and 'log_id' in data:
                return self.log_result("Create Time Log", True, f"Created time log: {data['log_id']}")
            else:
                return self.log_result("Create Time Log", False, f"Status: {status}, Data: {data}")
        else:
            return self.log_result("Create Time Log", False, "No test task ID available")

    def test_get_time_logs(self):
        """Test get time logs"""
        success, data, status = self.test_api_call('GET', 'time-logs')
        if success and isinstance(data, list):
            return self.log_result("Get Time Logs", True, f"Retrieved {len(data)} time logs")
        else:
            return self.log_result("Get Time Logs", False, f"Status: {status}, Data: {data}")

    # Team Tests
    def test_get_team(self):
        """Test get team members"""
        success, data, status = self.test_api_call('GET', 'team')
        if success and isinstance(data, list) and len(data) > 0:
            return self.log_result("Get Team", True, f"Retrieved {len(data)} team members")
        else:
            return self.log_result("Get Team", False, f"Status: {status}, Data: {data}")

    def cleanup_test_data(self):
        """Clean up test data from MongoDB"""
        print("\n🧹 Cleaning up test data...")
        
        mongosh_cmd = '''
        use('test_database');
        db.users.deleteMany({email: /test\\.user\\./});
        db.user_sessions.deleteMany({session_token: /test_session/});
        db.projects.deleteMany({name: "Test Project"});
        db.proposals.deleteMany({title: "Test Proposal"});
        db.tasks.deleteMany({title: "Test Task"});
        db.time_logs.deleteMany({description: "Worked on test implementation"});
        print('Cleanup completed');
        '''
        
        try:
            subprocess.run(['mongosh', '--eval', mongosh_cmd], 
                         capture_output=True, text=True, timeout=30)
            print("✅ Test data cleaned up")
        except Exception as e:
            print(f"❌ Cleanup error: {str(e)}")

    def run_all_tests(self):
        """Run all tests"""
        print("🚀 Starting AdvantEdge360 Backend API Tests")
        print(f"🔗 Testing API: {self.base_url}")
        
        # Setup
        if not self.setup_test_user():
            print("❌ Failed to setup test user - stopping tests")
            return 1

        # Authentication Tests
        self.test_auth_me()
        
        # Core Feature Tests
        self.test_create_project()
        self.test_get_projects()
        self.test_get_project_details()
        
        self.test_create_proposal()
        self.test_get_proposals()
        self.test_approve_proposal()
        self.test_convert_proposal()
        
        self.test_create_task()
        self.test_get_tasks()
        self.test_update_task_status()
        
        self.test_create_time_log()
        self.test_get_time_logs()
        
        self.test_get_team()
        
        # Cleanup
        self.cleanup_test_data()
        
        # Results
        print(f"\n📊 Test Results: {self.tests_passed}/{self.tests_run} passed")
        
        # Print failed tests
        failed_tests = [r for r in self.test_results if not r['passed']]
        if failed_tests:
            print("\n❌ Failed Tests:")
            for test in failed_tests:
                print(f"   - {test['test']}: {test['message']}")
        
        return 0 if self.tests_passed == self.tests_run else 1

def main():
    tester = AdvantEdge360APITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())