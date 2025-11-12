from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from app.core.database import engine, Base
from app.core.config import settings
from app.core.logging_config import setup_logging, get_logger
from app.api import auth, restaurants, menu_items, orders, reviews, admin, restaurant_dashboard, websocket

# Setup logging
setup_logging()
logger = get_logger(__name__)

# Setup rate limiting
limiter = Limiter(key_func=get_remote_address)

# Create database tables
Base.metadata.create_all(bind=engine)
logger.info("Database tables created/verified")

# Initialize FastAPI app
app = FastAPI(
    title="Food Delivery API",
    description="A comprehensive backend system for food delivery applications",
    version=f"{settings.API_VERSION}.0.0",
    docs_url=f"/api/{settings.API_VERSION}/docs",
    redoc_url=f"/api/{settings.API_VERSION}/redoc",
    openapi_url=f"/api/{settings.API_VERSION}/openapi.json"
)

# Add rate limiter to app state
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Configure CORS with environment-based origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

logger.info(f"CORS configured for environment: {settings.ENVIRONMENT}")
logger.info(f"Allowed origins: {settings.CORS_ORIGINS}")

# Mount static files for admin and restaurant panels
app.mount("/admin", StaticFiles(directory="static/admin", html=True), name="admin")
app.mount("/restaurant", StaticFiles(directory="static/restaurant", html=True), name="restaurant")
logger.info("Static files mounted for admin and restaurant panels")

# Include routers with API versioning
api_prefix = f"/api/{settings.API_VERSION}"
app.include_router(auth.router, prefix=api_prefix)
app.include_router(restaurants.router, prefix=api_prefix)
app.include_router(menu_items.router, prefix=api_prefix)
app.include_router(orders.router, prefix=api_prefix)
app.include_router(reviews.router, prefix=api_prefix)
app.include_router(admin.router, prefix=api_prefix)
app.include_router(restaurant_dashboard.router, prefix=api_prefix)
app.include_router(websocket.router, prefix=api_prefix)
logger.info(f"API routers registered with prefix: {api_prefix}")


@app.on_event("startup")
async def startup_event():
    """Application startup"""
    logger.info(f"🚀 Food Delivery API starting - Environment: {settings.ENVIRONMENT}")
    logger.info(f"📚 API Documentation: /api/{settings.API_VERSION}/docs")
    logger.info("🛡️  Rate limiting enabled")
    logger.info("🔌 WebSocket support enabled for real-time order updates")


@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown"""
    logger.info("🛑 Food Delivery API shutting down")


@app.get("/")
def root():
    """Root endpoint"""
    logger.info("Root endpoint accessed")
    return {
        "message": "Welcome to Food Delivery API",
        "version": f"{settings.API_VERSION}.0.0",
        "environment": settings.ENVIRONMENT,
        "docs": f"/api/{settings.API_VERSION}/docs",
        "redoc": f"/api/{settings.API_VERSION}/redoc"
    }


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "version": f"{settings.API_VERSION}.0.0",
        "environment": settings.ENVIRONMENT
    }
