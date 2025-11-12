from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional
from datetime import datetime, timedelta
from app.core.database import get_db
from app.core.dependencies import get_current_active_admin
from app.models.user import User, UserRole
from app.models.restaurant import Restaurant
from app.models.order import Order, OrderStatus
from app.models.menu_item import MenuItem
from app.models.review import Review
from app.schemas.user import UserResponse, UserUpdate
from app.schemas.restaurant import RestaurantResponse, RestaurantUpdate
from app.schemas.order import OrderResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


# ==================== STATISTICS ====================

@router.get("/stats/overview")
def get_overview_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """Get overview statistics for the admin dashboard"""

    # Count totals
    total_users = db.query(func.count(User.id)).scalar()
    total_customers = db.query(func.count(User.id)).filter(User.role == UserRole.CUSTOMER).scalar()
    total_restaurants = db.query(func.count(Restaurant.id)).scalar()
    active_restaurants = db.query(func.count(Restaurant.id)).filter(Restaurant.is_active == True).scalar()
    total_orders = db.query(func.count(Order.id)).scalar()
    total_revenue = db.query(func.sum(Order.total_amount)).filter(Order.status == OrderStatus.DELIVERED).scalar() or 0

    # Orders by status
    orders_by_status = {}
    for status in OrderStatus:
        count = db.query(func.count(Order.id)).filter(Order.status == status).scalar()
        orders_by_status[status.value] = count

    # Recent stats (last 30 days)
    thirty_days_ago = datetime.utcnow() - timedelta(days=30)
    new_users_30d = db.query(func.count(User.id)).filter(User.created_at >= thirty_days_ago).scalar()
    new_orders_30d = db.query(func.count(Order.id)).filter(Order.created_at >= thirty_days_ago).scalar()
    revenue_30d = db.query(func.sum(Order.total_amount)).filter(
        and_(Order.status == OrderStatus.DELIVERED, Order.created_at >= thirty_days_ago)
    ).scalar() or 0

    # Top restaurants
    top_restaurants = db.query(
        Restaurant.id,
        Restaurant.name,
        func.count(Order.id).label('order_count'),
        func.sum(Order.total_amount).label('revenue')
    ).join(Order).filter(Order.status == OrderStatus.DELIVERED).group_by(
        Restaurant.id, Restaurant.name
    ).order_by(func.count(Order.id).desc()).limit(5).all()

    return {
        "totals": {
            "users": total_users,
            "customers": total_customers,
            "restaurants": total_restaurants,
            "active_restaurants": active_restaurants,
            "orders": total_orders,
            "revenue": round(total_revenue, 2)
        },
        "orders_by_status": orders_by_status,
        "last_30_days": {
            "new_users": new_users_30d,
            "new_orders": new_orders_30d,
            "revenue": round(revenue_30d, 2)
        },
        "top_restaurants": [
            {
                "id": r.id,
                "name": r.name,
                "order_count": r.order_count,
                "revenue": round(float(r.revenue or 0), 2)
            } for r in top_restaurants
        ]
    }


@router.get("/stats/revenue")
def get_revenue_stats(
    days: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """Get revenue statistics over time"""
    start_date = datetime.utcnow() - timedelta(days=days)

    # Daily revenue
    daily_revenue = db.query(
        func.date(Order.created_at).label('date'),
        func.sum(Order.total_amount).label('revenue'),
        func.count(Order.id).label('order_count')
    ).filter(
        and_(Order.created_at >= start_date, Order.status == OrderStatus.DELIVERED)
    ).group_by(func.date(Order.created_at)).order_by(func.date(Order.created_at)).all()

    return {
        "period_days": days,
        "daily_revenue": [
            {
                "date": str(r.date),
                "revenue": round(float(r.revenue or 0), 2),
                "order_count": r.order_count
            } for r in daily_revenue
        ]
    }


# ==================== USER MANAGEMENT ====================

@router.get("/users", response_model=List[UserResponse])
def get_all_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    role: Optional[UserRole] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """Get all users with optional role filter"""
    query = db.query(User)

    if role:
        query = query.filter(User.role == role)

    users = query.offset(skip).limit(limit).all()
    return users


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user_by_id(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """Get a specific user by ID"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """Update user information"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    update_data = user_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """Delete a user (admin only)"""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )

    # Prevent deleting yourself
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )

    db.delete(user)
    db.commit()
    return None


# ==================== RESTAURANT MANAGEMENT ====================

@router.get("/restaurants", response_model=List[RestaurantResponse])
def get_all_restaurants(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """Get all restaurants with optional filters"""
    query = db.query(Restaurant)

    if is_active is not None:
        query = query.filter(Restaurant.is_active == is_active)

    restaurants = query.offset(skip).limit(limit).all()
    return restaurants


@router.put("/restaurants/{restaurant_id}/toggle-active")
def toggle_restaurant_active(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """Toggle restaurant active status"""
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found"
        )

    restaurant.is_active = not restaurant.is_active
    db.commit()
    db.refresh(restaurant)

    return {
        "id": restaurant.id,
        "name": restaurant.name,
        "is_active": restaurant.is_active
    }


@router.delete("/restaurants/{restaurant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_restaurant_admin(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """Delete a restaurant (admin only)"""
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found"
        )

    db.delete(restaurant)
    db.commit()
    return None


# ==================== ORDER MANAGEMENT ====================

@router.get("/orders", response_model=List[OrderResponse])
def get_all_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    status_filter: Optional[OrderStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """Get all orders with optional status filter"""
    query = db.query(Order)

    if status_filter:
        query = query.filter(Order.status == status_filter)

    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    return orders


@router.get("/orders/{order_id}", response_model=OrderResponse)
def get_order_details(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """Get detailed order information"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    return order


@router.delete("/orders/{order_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """Delete an order (admin only)"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    db.delete(order)
    db.commit()
    return None


# ==================== REVIEW MANAGEMENT ====================

@router.get("/reviews")
def get_all_reviews(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """Get all reviews"""
    reviews = db.query(Review).order_by(Review.created_at.desc()).offset(skip).limit(limit).all()
    return reviews


@router.delete("/reviews/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review_admin(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_admin)
):
    """Delete a review (admin only)"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )

    restaurant_id = review.restaurant_id
    db.delete(review)
    db.commit()

    # Recalculate restaurant rating
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if restaurant:
        avg_rating = db.query(func.avg(Review.rating)).filter(
            Review.restaurant_id == restaurant_id
        ).scalar()
        total_reviews = db.query(func.count(Review.id)).filter(
            Review.restaurant_id == restaurant_id
        ).scalar()

        restaurant.average_rating = round(avg_rating, 2) if avg_rating else 0.0
        restaurant.total_reviews = total_reviews
        db.commit()

    return None
