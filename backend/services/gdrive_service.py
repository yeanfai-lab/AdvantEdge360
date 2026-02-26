"""
Google Drive Service for file uploads
Uses Service Account with Domain-Wide Delegation
"""
import os
import io
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload, MediaIoBaseDownload
from googleapiclient.errors import HttpError

# Configuration
GDRIVE_FOLDER_ID = os.environ.get("GDRIVE_FOLDER_ID", "18YABaK9mbwAIGaHBEl1mDbV9XldKJ4LL")
GDRIVE_CREDENTIALS_FILE = os.environ.get("GDRIVE_CREDENTIALS_FILE", "/app/backend/gmail_service_account.json")
GDRIVE_ENABLED = os.environ.get("GDRIVE_ENABLED", "false").lower() == "true"
GDRIVE_USER_EMAIL = os.environ.get("GDRIVE_USER_EMAIL", "360@advantedgeadvisory.co.in")

# Google Drive API Scopes
SCOPES = ['https://www.googleapis.com/auth/drive.file']

# Subfolder structure
SUBFOLDERS = {
    "receipts": "Receipts",
    "proposals": "Proposals",
    "attachments": "Attachments",
    "documents": "Documents"
}

# Cache for subfolder IDs
_subfolder_cache = {}


def get_drive_service():
    """Create Google Drive API service with domain-wide delegation"""
    if not GDRIVE_ENABLED:
        return None
    
    if not os.path.exists(GDRIVE_CREDENTIALS_FILE):
        print(f"Google Drive credentials file not found: {GDRIVE_CREDENTIALS_FILE}")
        return None
    
    try:
        credentials = service_account.Credentials.from_service_account_file(
            GDRIVE_CREDENTIALS_FILE,
            scopes=SCOPES
        )
        # Delegate to a user in the domain
        delegated_credentials = credentials.with_subject(GDRIVE_USER_EMAIL)
        
        service = build('drive', 'v3', credentials=delegated_credentials)
        return service
    except Exception as e:
        print(f"Error creating Google Drive service: {e}")
        return None


async def get_or_create_subfolder(service, parent_folder_id: str, folder_name: str) -> str:
    """Get existing subfolder or create it if it doesn't exist"""
    cache_key = f"{parent_folder_id}_{folder_name}"
    
    if cache_key in _subfolder_cache:
        return _subfolder_cache[cache_key]
    
    try:
        # Search for existing folder
        query = f"'{parent_folder_id}' in parents and name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = service.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name)'
        ).execute()
        
        files = results.get('files', [])
        
        if files:
            folder_id = files[0]['id']
            _subfolder_cache[cache_key] = folder_id
            return folder_id
        
        # Create new folder
        file_metadata = {
            'name': folder_name,
            'mimeType': 'application/vnd.google-apps.folder',
            'parents': [parent_folder_id]
        }
        
        folder = service.files().create(
            body=file_metadata,
            fields='id'
        ).execute()
        
        folder_id = folder.get('id')
        _subfolder_cache[cache_key] = folder_id
        return folder_id
        
    except HttpError as e:
        print(f"Error getting/creating subfolder: {e}")
        return parent_folder_id  # Fall back to parent folder


async def upload_file_to_drive(
    file_content: bytes,
    filename: str,
    mime_type: str,
    folder_type: str = "attachments",
    subfolder_name: str = None
) -> dict:
    """
    Upload a file to Google Drive
    
    Args:
        file_content: File bytes
        filename: Name of the file
        mime_type: MIME type (e.g., 'image/jpeg', 'application/pdf')
        folder_type: Type of folder ('receipts', 'proposals', 'attachments', 'documents')
        subfolder_name: Optional subfolder within the type folder (e.g., project name)
    
    Returns:
        dict with 'success', 'file_id', 'web_link', 'download_link' or 'error'
    """
    if not GDRIVE_ENABLED:
        return {
            'success': False,
            'demo_mode': True,
            'error': 'Google Drive not enabled - file stored locally'
        }
    
    service = get_drive_service()
    if not service:
        return {
            'success': False,
            'error': 'Google Drive service not available - check credentials'
        }
    
    try:
        # Get or create the type subfolder
        type_folder_name = SUBFOLDERS.get(folder_type, "Attachments")
        type_folder_id = await get_or_create_subfolder(service, GDRIVE_FOLDER_ID, type_folder_name)
        
        # If there's an additional subfolder (e.g., project name), create it
        target_folder_id = type_folder_id
        if subfolder_name:
            target_folder_id = await get_or_create_subfolder(service, type_folder_id, subfolder_name)
        
        # Upload the file
        file_metadata = {
            'name': filename,
            'parents': [target_folder_id]
        }
        
        media = MediaIoBaseUpload(
            io.BytesIO(file_content),
            mimetype=mime_type,
            resumable=True
        )
        
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, name, webViewLink, webContentLink'
        ).execute()
        
        file_id = file.get('id')
        
        # Make the file viewable by anyone with the link
        service.permissions().create(
            fileId=file_id,
            body={'type': 'anyone', 'role': 'reader'}
        ).execute()
        
        # Get updated links after permission change
        file = service.files().get(
            fileId=file_id,
            fields='id, name, webViewLink, webContentLink'
        ).execute()
        
        return {
            'success': True,
            'file_id': file_id,
            'filename': file.get('name'),
            'web_link': file.get('webViewLink'),
            'download_link': file.get('webContentLink') or f"https://drive.google.com/uc?id={file_id}&export=download",
            'view_link': f"https://drive.google.com/file/d/{file_id}/view"
        }
        
    except HttpError as e:
        return {
            'success': False,
            'error': f'Google Drive API error: {e.reason}'
        }
    except Exception as e:
        return {
            'success': False,
            'error': str(e)
        }


async def delete_file_from_drive(file_id: str) -> dict:
    """Delete a file from Google Drive"""
    if not GDRIVE_ENABLED:
        return {'success': False, 'demo_mode': True}
    
    service = get_drive_service()
    if not service:
        return {'success': False, 'error': 'Google Drive service not available'}
    
    try:
        service.files().delete(fileId=file_id).execute()
        return {'success': True}
    except HttpError as e:
        return {'success': False, 'error': f'Google Drive API error: {e.reason}'}
    except Exception as e:
        return {'success': False, 'error': str(e)}


async def get_file_from_drive(file_id: str) -> dict:
    """Get file metadata and download link from Google Drive"""
    if not GDRIVE_ENABLED:
        return {'success': False, 'demo_mode': True}
    
    service = get_drive_service()
    if not service:
        return {'success': False, 'error': 'Google Drive service not available'}
    
    try:
        file = service.files().get(
            fileId=file_id,
            fields='id, name, mimeType, size, webViewLink, webContentLink'
        ).execute()
        
        return {
            'success': True,
            'file_id': file.get('id'),
            'filename': file.get('name'),
            'mime_type': file.get('mimeType'),
            'size': file.get('size'),
            'web_link': file.get('webViewLink'),
            'download_link': file.get('webContentLink') or f"https://drive.google.com/uc?id={file_id}&export=download"
        }
    except HttpError as e:
        return {'success': False, 'error': f'Google Drive API error: {e.reason}'}
    except Exception as e:
        return {'success': False, 'error': str(e)}


async def list_files_in_folder(folder_type: str = None, subfolder_name: str = None) -> dict:
    """List files in a specific folder"""
    if not GDRIVE_ENABLED:
        return {'success': False, 'demo_mode': True, 'files': []}
    
    service = get_drive_service()
    if not service:
        return {'success': False, 'error': 'Google Drive service not available', 'files': []}
    
    try:
        # Determine target folder
        target_folder_id = GDRIVE_FOLDER_ID
        
        if folder_type:
            type_folder_name = SUBFOLDERS.get(folder_type, "Attachments")
            target_folder_id = await get_or_create_subfolder(service, GDRIVE_FOLDER_ID, type_folder_name)
            
            if subfolder_name:
                target_folder_id = await get_or_create_subfolder(service, target_folder_id, subfolder_name)
        
        # List files
        query = f"'{target_folder_id}' in parents and trashed=false"
        results = service.files().list(
            q=query,
            spaces='drive',
            fields='files(id, name, mimeType, size, createdTime, webViewLink)',
            orderBy='createdTime desc'
        ).execute()
        
        files = results.get('files', [])
        
        return {
            'success': True,
            'files': files,
            'count': len(files)
        }
        
    except HttpError as e:
        return {'success': False, 'error': f'Google Drive API error: {e.reason}', 'files': []}
    except Exception as e:
        return {'success': False, 'error': str(e), 'files': []}
