import os
from motor.motor_asyncio import AsyncIOMotorClient

# MongoDB Configuration
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "advantedge360")

# Initialize MongoDB client
client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

# Role-Based Access Control Configuration
ROLES = {
    "admin": {
        "level": 100,
        "can_view_financial": True,
        "can_manage_team": True,
        "can_invite_team": True,
        "can_edit_all": True,
        "can_delete_all": True,
        "description": "Full access to all features"
    },
    "manager": {
        "level": 70,
        "can_view_financial": True,
        "can_manage_team": True,
        "can_invite_team": True,
        "can_edit_all": True,
        "can_delete_all": False,
        "description": "Project management with financial access"
    },
    "team_lead": {
        "level": 50,
        "can_view_financial": False,
        "can_manage_team": True,
        "can_invite_team": False,
        "can_edit_all": False,
        "can_delete_all": False,
        "description": "Team coordination and management"
    },
    "team_member": {
        "level": 10,
        "can_view_financial": False,
        "can_manage_team": False,
        "can_invite_team": False,
        "can_edit_all": False,
        "can_delete_all": False,
        "description": "Own tasks only"
    },
    "finance": {
        "level": 40,
        "can_view_financial": True,
        "can_manage_team": False,
        "can_invite_team": False,
        "can_edit_all": False,
        "can_delete_all": False,
        "description": "Financial data access only"
    }
}
