# Routes module initialization
from fastapi import APIRouter

# Create main API router
api_router = APIRouter(prefix="/api")

# Import and include all route modules
from .auth import router as auth_router
from .proposals import router as proposals_router
from .projects import router as projects_router
from .tasks import router as tasks_router
from .clients import router as clients_router
from .team import router as team_router
from .time_tracking import router as time_tracking_router
from .finance import router as finance_router
from .dashboard import router as dashboard_router
from .reports import router as reports_router

api_router.include_router(auth_router, tags=["Authentication"])
api_router.include_router(proposals_router, tags=["Proposals"])
api_router.include_router(projects_router, tags=["Projects"])
api_router.include_router(tasks_router, tags=["Tasks"])
api_router.include_router(clients_router, tags=["Clients"])
api_router.include_router(team_router, tags=["Team"])
api_router.include_router(time_tracking_router, tags=["Time Tracking"])
api_router.include_router(finance_router, tags=["Finance"])
api_router.include_router(dashboard_router, tags=["Dashboard"])
api_router.include_router(reports_router, tags=["Reports"])
