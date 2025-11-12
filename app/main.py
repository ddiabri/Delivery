from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.database import engine, Base
from app.api import auth, restaurants, menu_items, orders, reviews, admin, restaurant_dashboard

# Create database tables
Base.metadata.create_all(bind=engine)

# Initialize FastAPI app
app = FastAPI(
    title="Food Delivery API",
    description="A comprehensive backend system for food delivery applications",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for admin and restaurant panels
app.mount("/admin", StaticFiles(directory="static/admin", html=True), name="admin")
app.mount("/restaurant", StaticFiles(directory="static/restaurant", html=True), name="restaurant")

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(restaurants.router, prefix="/api")
app.include_router(menu_items.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(reviews.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(restaurant_dashboard.router, prefix="/api")


@app.get("/")
def root():
    """Root endpoint"""
    return {
        "message": "Welcome to Food Delivery API",
        "version": "1.0.0",
        "docs": "/docs",
        "redoc": "/redoc"
    }


@app.get("/health")
def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
