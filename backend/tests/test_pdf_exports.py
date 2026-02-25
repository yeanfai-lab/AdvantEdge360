"""
PDF Export API Tests for AdvantEdge360
Tests PDF export endpoints for reports functionality
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
SESSION_TOKEN = "test_session_1772016383968"

@pytest.fixture
def api_client():
    """Requests session with auth header"""
    session = requests.Session()
    session.headers.update({
        "Content-Type": "application/json",
        "Authorization": f"Bearer {SESSION_TOKEN}"
    })
    return session


class TestHealthAndAuth:
    """Basic health and authentication tests"""
    
    def test_auth_me(self, api_client):
        """Verify user authentication works"""
        response = api_client.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code == 200
        data = response.json()
        assert "user_id" in data
        assert "email" in data
        print(f"✓ Auth working for user: {data['email']}")


class TestPDFExportEndpoints:
    """Test PDF export endpoints - verify they return valid PDF responses"""
    
    def test_export_projects_pdf(self, api_client):
        """Test /api/reports/export/projects/pdf returns PDF"""
        response = api_client.get(f"{BASE_URL}/api/reports/export/projects/pdf")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        # Verify content type is PDF
        content_type = response.headers.get('Content-Type', '')
        assert 'application/pdf' in content_type, f"Expected PDF content type, got {content_type}"
        
        # Verify Content-Disposition header
        content_disposition = response.headers.get('Content-Disposition', '')
        assert 'projects_report.pdf' in content_disposition
        
        # Verify PDF magic bytes (PDF starts with %PDF-)
        assert response.content[:4] == b'%PDF', "Response is not a valid PDF (missing PDF header)"
        print(f"✓ Projects PDF export: {len(response.content)} bytes")
    
    def test_export_tasks_pdf(self, api_client):
        """Test /api/reports/export/tasks/pdf returns PDF"""
        response = api_client.get(f"{BASE_URL}/api/reports/export/tasks/pdf")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        content_type = response.headers.get('Content-Type', '')
        assert 'application/pdf' in content_type, f"Expected PDF content type, got {content_type}"
        
        content_disposition = response.headers.get('Content-Disposition', '')
        assert 'tasks_report.pdf' in content_disposition
        
        assert response.content[:4] == b'%PDF', "Response is not a valid PDF"
        print(f"✓ Tasks PDF export: {len(response.content)} bytes")
    
    def test_export_time_logs_pdf(self, api_client):
        """Test /api/reports/export/time-logs/pdf returns PDF"""
        response = api_client.get(f"{BASE_URL}/api/reports/export/time-logs/pdf")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        content_type = response.headers.get('Content-Type', '')
        assert 'application/pdf' in content_type, f"Expected PDF content type, got {content_type}"
        
        content_disposition = response.headers.get('Content-Disposition', '')
        assert 'time_logs_report.pdf' in content_disposition
        
        assert response.content[:4] == b'%PDF', "Response is not a valid PDF"
        print(f"✓ Time Logs PDF export: {len(response.content)} bytes")
    
    def test_export_team_productivity_pdf(self, api_client):
        """Test /api/reports/export/team-productivity/pdf returns PDF"""
        response = api_client.get(f"{BASE_URL}/api/reports/export/team-productivity/pdf")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        content_type = response.headers.get('Content-Type', '')
        assert 'application/pdf' in content_type, f"Expected PDF content type, got {content_type}"
        
        content_disposition = response.headers.get('Content-Disposition', '')
        assert 'team_productivity_report.pdf' in content_disposition
        
        assert response.content[:4] == b'%PDF', "Response is not a valid PDF"
        print(f"✓ Team Productivity PDF export: {len(response.content)} bytes")
    
    def test_export_overview_pdf(self, api_client):
        """Test /api/reports/export/overview/pdf returns PDF"""
        response = api_client.get(f"{BASE_URL}/api/reports/export/overview/pdf")
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        content_type = response.headers.get('Content-Type', '')
        assert 'application/pdf' in content_type, f"Expected PDF content type, got {content_type}"
        
        content_disposition = response.headers.get('Content-Disposition', '')
        assert 'overview_report.pdf' in content_disposition
        
        assert response.content[:4] == b'%PDF', "Response is not a valid PDF"
        print(f"✓ Overview PDF export: {len(response.content)} bytes")


class TestCSVExportEndpoints:
    """Test CSV export endpoints for comparison"""
    
    def test_export_projects_csv(self, api_client):
        """Test /api/reports/export/projects returns CSV"""
        response = api_client.get(f"{BASE_URL}/api/reports/export/projects")
        assert response.status_code == 200
        
        content_disposition = response.headers.get('Content-Disposition', '')
        assert 'projects_export.csv' in content_disposition
        print(f"✓ Projects CSV export: {len(response.content)} bytes")
    
    def test_export_tasks_csv(self, api_client):
        """Test /api/reports/export/tasks returns CSV"""
        response = api_client.get(f"{BASE_URL}/api/reports/export/tasks")
        assert response.status_code == 200
        
        content_disposition = response.headers.get('Content-Disposition', '')
        assert 'tasks_export.csv' in content_disposition
        print(f"✓ Tasks CSV export: {len(response.content)} bytes")
    
    def test_export_time_logs_csv(self, api_client):
        """Test /api/reports/export/time-logs returns CSV"""
        response = api_client.get(f"{BASE_URL}/api/reports/export/time-logs")
        assert response.status_code == 200
        
        content_disposition = response.headers.get('Content-Disposition', '')
        assert 'time_logs_export.csv' in content_disposition
        print(f"✓ Time Logs CSV export: {len(response.content)} bytes")
    
    def test_export_team_productivity_csv(self, api_client):
        """Test /api/reports/export/team-productivity returns CSV"""
        response = api_client.get(f"{BASE_URL}/api/reports/export/team-productivity")
        assert response.status_code == 200
        
        content_disposition = response.headers.get('Content-Disposition', '')
        assert 'team_productivity_export.csv' in content_disposition
        print(f"✓ Team Productivity CSV export: {len(response.content)} bytes")


class TestReportsEndpoints:
    """Test base reports endpoints"""
    
    def test_reports_overview(self, api_client):
        """Test /api/reports/overview endpoint"""
        response = api_client.get(f"{BASE_URL}/api/reports/overview")
        assert response.status_code == 200
        
        data = response.json()
        assert "projects" in data
        assert "tasks" in data
        assert "time" in data
        assert "team" in data
        print(f"✓ Reports overview: projects={data['projects']['total']}, tasks={data['tasks']['total']}")
    
    def test_reports_project_performance(self, api_client):
        """Test /api/reports/project-performance endpoint"""
        response = api_client.get(f"{BASE_URL}/api/reports/project-performance")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Project performance: {len(data)} projects")
    
    def test_reports_team_productivity(self, api_client):
        """Test /api/reports/team-productivity endpoint"""
        response = api_client.get(f"{BASE_URL}/api/reports/team-productivity")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        print(f"✓ Team productivity: {len(data)} members")
