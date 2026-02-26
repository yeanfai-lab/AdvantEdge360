"""
Gmail Service for sending emails via Google Workspace
Uses Service Account with Domain-Wide Delegation
"""
import os
import base64
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# Configuration
GMAIL_SENDER_EMAIL = os.environ.get("GMAIL_SENDER_EMAIL", "360@advantedgeadvisory.co.in")
GMAIL_CREDENTIALS_FILE = os.environ.get("GMAIL_CREDENTIALS_FILE", "/app/backend/gmail_service_account.json")
GMAIL_ENABLED = os.environ.get("GMAIL_ENABLED", "false").lower() == "true"

# Gmail API Scopes
SCOPES = ['https://www.googleapis.com/auth/gmail.send']


def get_gmail_service():
    """Create Gmail API service with domain-wide delegation"""
    if not GMAIL_ENABLED:
        return None
    
    if not os.path.exists(GMAIL_CREDENTIALS_FILE):
        print(f"Gmail credentials file not found: {GMAIL_CREDENTIALS_FILE}")
        return None
    
    try:
        credentials = service_account.Credentials.from_service_account_file(
            GMAIL_CREDENTIALS_FILE,
            scopes=SCOPES
        )
        # Delegate to the sender email (must be in Google Workspace domain)
        delegated_credentials = credentials.with_subject(GMAIL_SENDER_EMAIL)
        
        service = build('gmail', 'v1', credentials=delegated_credentials)
        return service
    except Exception as e:
        print(f"Error creating Gmail service: {e}")
        return None


def create_message(to: str, subject: str, body_text: str, body_html: str = None):
    """Create an email message"""
    if body_html:
        message = MIMEMultipart('alternative')
        message.attach(MIMEText(body_text, 'plain'))
        message.attach(MIMEText(body_html, 'html'))
    else:
        message = MIMEText(body_text, 'plain')
    
    message['to'] = to
    message['from'] = GMAIL_SENDER_EMAIL
    message['subject'] = subject
    
    # Encode the message
    raw = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
    return {'raw': raw}


async def send_email(to: str, subject: str, body_text: str, body_html: str = None) -> dict:
    """
    Send an email via Gmail API
    
    Returns:
        dict with 'success', 'message_id' or 'error'
    """
    if not GMAIL_ENABLED:
        return {
            'success': False,
            'demo_mode': True,
            'error': 'Gmail not enabled - email stored but not sent'
        }
    
    service = get_gmail_service()
    if not service:
        return {
            'success': False,
            'error': 'Gmail service not available - check credentials'
        }
    
    try:
        message = create_message(to, subject, body_text, body_html)
        result = service.users().messages().send(userId='me', body=message).execute()
        
        return {
            'success': True,
            'message_id': result.get('id'),
            'thread_id': result.get('threadId')
        }
    except HttpError as e:
        return {
            'success': False,
            'error': f'Gmail API error: {e.reason}'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


# Email Templates

def get_invitation_email(invitee_name: str, inviter_name: str, role: str, app_url: str, token: str) -> tuple:
    """Generate invitation email content"""
    subject = f"You're invited to join AdvantEdge 360"
    
    body_text = f"""Hi {invitee_name},

{inviter_name} has invited you to join AdvantEdge 360 as a {role.replace('_', ' ').title()}.

Click the link below to accept your invitation and set up your account:
{app_url}?invite={token}

This invitation expires in 7 days.

Best regards,
AdvantEdge Advisory Team
"""

    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0d9488; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">AdvantEdge 360</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
            <h2 style="color: #1f2937;">Hi {invitee_name},</h2>
            <p style="color: #4b5563; font-size: 16px;">
                <strong>{inviter_name}</strong> has invited you to join <strong>AdvantEdge 360</strong> 
                as a <strong>{role.replace('_', ' ').title()}</strong>.
            </p>
            <div style="text-align: center; margin: 30px 0;">
                <a href="{app_url}?invite={token}" 
                   style="background: #0d9488; color: white; padding: 12px 30px; 
                          text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Accept Invitation
                </a>
            </div>
            <p style="color: #6b7280; font-size: 14px;">
                This invitation expires in 7 days.
            </p>
        </div>
        <div style="background: #1f2937; padding: 15px; text-align: center;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                AdvantEdge Advisory | Integrated Business Operations Platform
            </p>
        </div>
    </div>
    """
    
    return subject, body_text, body_html


def get_leave_status_email(employee_name: str, leave_type: str, start_date: str, end_date: str, 
                           status: str, approver_name: str = None, rejection_reason: str = None) -> tuple:
    """Generate leave status update email"""
    status_text = status.title()
    subject = f"Leave Application {status_text}"
    
    body_text = f"""Hi {employee_name},

Your {leave_type} leave application for {start_date} to {end_date} has been {status}.

"""
    if status == "approved" and approver_name:
        body_text += f"Approved by: {approver_name}\n"
    elif status == "rejected":
        body_text += f"Rejected by: {approver_name}\n" if approver_name else ""
        if rejection_reason:
            body_text += f"Reason: {rejection_reason}\n"

    body_text += "\nBest regards,\nAdvantEdge Advisory Team"
    
    status_color = "#10b981" if status == "approved" else "#ef4444"
    
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0d9488; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">AdvantEdge 360</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
            <h2 style="color: #1f2937;">Hi {employee_name},</h2>
            <p style="color: #4b5563; font-size: 16px;">
                Your <strong>{leave_type}</strong> leave application has been 
                <span style="color: {status_color}; font-weight: bold;">{status_text}</span>.
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Leave Type:</strong> {leave_type}</p>
                <p style="margin: 5px 0;"><strong>Period:</strong> {start_date} to {end_date}</p>
                {f'<p style="margin: 5px 0;"><strong>Approved by:</strong> {approver_name}</p>' if approver_name else ''}
                {f'<p style="margin: 5px 0; color: #ef4444;"><strong>Reason:</strong> {rejection_reason}</p>' if rejection_reason else ''}
            </div>
        </div>
        <div style="background: #1f2937; padding: 15px; text-align: center;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                AdvantEdge Advisory | Integrated Business Operations Platform
            </p>
        </div>
    </div>
    """
    
    return subject, body_text, body_html


def get_reimbursement_status_email(employee_name: str, amount: float, category: str,
                                    status: str, approver_name: str = None, 
                                    rejection_reason: str = None) -> tuple:
    """Generate reimbursement status update email"""
    status_text = status.title()
    subject = f"Reimbursement Request {status_text}"
    
    body_text = f"""Hi {employee_name},

Your reimbursement request for INR {amount:,.2f} ({category}) has been {status}.

"""
    if approver_name:
        body_text += f"Processed by: {approver_name}\n"
    if rejection_reason:
        body_text += f"Reason: {rejection_reason}\n"

    body_text += "\nBest regards,\nAdvantEdge Advisory Team"
    
    status_colors = {
        "approved": "#10b981",
        "rejected": "#ef4444",
        "paid": "#3b82f6"
    }
    status_color = status_colors.get(status, "#6b7280")
    
    body_html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: #0d9488; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">AdvantEdge 360</h1>
        </div>
        <div style="padding: 30px; background: #f9fafb;">
            <h2 style="color: #1f2937;">Hi {employee_name},</h2>
            <p style="color: #4b5563; font-size: 16px;">
                Your reimbursement request has been 
                <span style="color: {status_color}; font-weight: bold;">{status_text}</span>.
            </p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <p style="margin: 5px 0;"><strong>Amount:</strong> INR {amount:,.2f}</p>
                <p style="margin: 5px 0;"><strong>Category:</strong> {category}</p>
                {f'<p style="margin: 5px 0;"><strong>Processed by:</strong> {approver_name}</p>' if approver_name else ''}
                {f'<p style="margin: 5px 0; color: #ef4444;"><strong>Reason:</strong> {rejection_reason}</p>' if rejection_reason else ''}
            </div>
        </div>
        <div style="background: #1f2937; padding: 15px; text-align: center;">
            <p style="color: #9ca3af; margin: 0; font-size: 12px;">
                AdvantEdge Advisory | Integrated Business Operations Platform
            </p>
        </div>
    </div>
    """
    
    return subject, body_text, body_html
