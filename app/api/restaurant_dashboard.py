from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from typing import List, Optional
from datetime import datetime, timedelta, timezone
from app.core.database import get_db
from app.core.dependencies import get_current_active_restaurant_owner
from app.models.user import User
from app.models.restaurant import Restaurant
from app.models.menu_item import MenuItem
from app.models.order import Order, OrderStatus, OrderItem
from app.models.review import Review
from app.schemas.menu_item import MenuItemResponse
from app.schemas.order import OrderResponse

router = APIRouter(prefix="/restaurant-dashboard", tags=["Restaurant Dashboard"])


@router.get("/stats")
def get_restaurant_stats(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_restaurant_owner)
):
    """Get statistics for restaurant owner's restaurants"""

    # Get all restaurants owned by this user
    restaurants = db.query(Restaurant).filter(Restaurant.owner_id == current_user.id).all()
    restaurant_ids = [r.id for r in restaurants]

    if not restaurant_ids:
        return {
            "restaurants": [],
            "total_orders": 0,
            "total_revenue": 0,
            "pending_orders": 0,
            "active_orders": 0,
            "completed_orders": 0,
            "total_menu_items": 0,
            "average_rating": 0,
            "total_reviews": 0
        }

    # Order statistics
    total_orders = db.query(func.count(Order.id)).filter(
        Order.restaurant_id.in_(restaurant_ids)
    ).scalar()

    total_revenue = db.query(func.sum(Order.total_amount)).filter(
        and_(Order.restaurant_id.in_(restaurant_ids), Order.status == OrderStatus.DELIVERED)
    ).scalar() or 0

    pending_orders = db.query(func.count(Order.id)).filter(
        and_(Order.restaurant_id.in_(restaurant_ids), Order.status == OrderStatus.PENDING)
    ).scalar()

    active_orders = db.query(func.count(Order.id)).filter(
        and_(
            Order.restaurant_id.in_(restaurant_ids),
            Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP])
        )
    ).scalar()

    completed_orders = db.query(func.count(Order.id)).filter(
        and_(Order.restaurant_id.in_(restaurant_ids), Order.status == OrderStatus.DELIVERED)
    ).scalar()

    # Menu items count
    total_menu_items = db.query(func.count(MenuItem.id)).filter(
        MenuItem.restaurant_id.in_(restaurant_ids)
    ).scalar()

    # Average rating across all restaurants
    avg_rating = db.query(func.avg(Restaurant.average_rating)).filter(
        Restaurant.id.in_(restaurant_ids)
    ).scalar() or 0

    total_reviews = db.query(func.sum(Restaurant.total_reviews)).filter(
        Restaurant.id.in_(restaurant_ids)
    ).scalar() or 0

    # Recent revenue (last 30 days)
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    revenue_30d = db.query(func.sum(Order.total_amount)).filter(
        and_(
            Order.restaurant_id.in_(restaurant_ids),
            Order.status == OrderStatus.DELIVERED,
            Order.created_at >= thirty_days_ago
        )
    ).scalar() or 0

    orders_30d = db.query(func.count(Order.id)).filter(
        and_(
            Order.restaurant_id.in_(restaurant_ids),
            Order.created_at >= thirty_days_ago
        )
    ).scalar()

    return {
        "restaurants": [{"id": r.id, "name": r.name, "is_active": r.is_active} for r in restaurants],
        "total_orders": total_orders,
        "total_revenue": round(float(total_revenue), 2),
        "pending_orders": pending_orders,
        "active_orders": active_orders,
        "completed_orders": completed_orders,
        "total_menu_items": total_menu_items,
        "average_rating": round(float(avg_rating), 2),
        "total_reviews": total_reviews,
        "last_30_days": {
            "revenue": round(float(revenue_30d), 2),
            "orders": orders_30d
        }
    }


@router.get("/restaurants/{restaurant_id}/stats")
def get_single_restaurant_stats(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_restaurant_owner)
):
    """Get statistics for a specific restaurant"""

    # Verify ownership
    restaurant = db.query(Restaurant).filter(
        Restaurant.id == restaurant_id,
        Restaurant.owner_id == current_user.id
    ).first()

    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found or you don't have permission"
        )

    # Order statistics
    total_orders = db.query(func.count(Order.id)).filter(
        Order.restaurant_id == restaurant_id
    ).scalar()

    total_revenue = db.query(func.sum(Order.total_amount)).filter(
        and_(Order.restaurant_id == restaurant_id, Order.status == OrderStatus.DELIVERED)
    ).scalar() or 0

    # Orders by status
    orders_by_status = {}
    for status_enum in OrderStatus:
        count = db.query(func.count(Order.id)).filter(
            and_(Order.restaurant_id == restaurant_id, Order.status == status_enum)
        ).scalar()
        orders_by_status[status_enum.value] = count

    # Daily revenue (last 7 days)
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    daily_revenue = db.query(
        func.date(Order.created_at).label('date'),
        func.sum(Order.total_amount).label('revenue'),
        func.count(Order.id).label('order_count')
    ).filter(
        and_(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= seven_days_ago,
            Order.status == OrderStatus.DELIVERED
        )
    ).group_by(func.date(Order.created_at)).order_by(func.date(Order.created_at)).all()

    # Top selling items
    top_items = db.query(
        MenuItem.id,
        MenuItem.name,
        func.sum(OrderItem.quantity).label('total_sold'),
        func.sum(OrderItem.quantity * OrderItem.price).label('revenue')
    ).join(OrderItem).join(Order).filter(
        and_(
            MenuItem.restaurant_id == restaurant_id,
            Order.status == OrderStatus.DELIVERED
        )
    ).group_by(MenuItem.id, MenuItem.name).order_by(
        func.sum(OrderItem.quantity).desc()
    ).limit(5).all()

    return {
        "restaurant": {
            "id": restaurant.id,
            "name": restaurant.name,
            "is_active": restaurant.is_active,
            "average_rating": restaurant.average_rating,
            "total_reviews": restaurant.total_reviews
        },
        "total_orders": total_orders,
        "total_revenue": round(float(total_revenue), 2),
        "orders_by_status": orders_by_status,
        "daily_revenue": [
            {
                "date": str(r.date),
                "revenue": round(float(r.revenue or 0), 2),
                "order_count": r.order_count
            } for r in daily_revenue
        ],
        "top_items": [
            {
                "id": item.id,
                "name": item.name,
                "total_sold": item.total_sold,
                "revenue": round(float(item.revenue or 0), 2)
            } for item in top_items
        ]
    }


@router.get("/orders", response_model=List[OrderResponse])
def get_restaurant_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    status_filter: Optional[OrderStatus] = None,
    restaurant_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_restaurant_owner)
):
    """Get orders for restaurant owner's restaurants"""

    # Get restaurant IDs owned by this user
    restaurant_query = db.query(Restaurant.id).filter(Restaurant.owner_id == current_user.id)

    if restaurant_id:
        # Verify ownership of specific restaurant
        restaurant = db.query(Restaurant).filter(
            Restaurant.id == restaurant_id,
            Restaurant.owner_id == current_user.id
        ).first()

        if not restaurant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Restaurant not found or you don't have permission"
            )

        restaurant_ids = [restaurant_id]
    else:
        restaurant_ids = [r[0] for r in restaurant_query.all()]

    if not restaurant_ids:
        return []

    # Get orders
    query = db.query(Order).filter(Order.restaurant_id.in_(restaurant_ids))

    if status_filter:
        query = query.filter(Order.status == status_filter)

    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    return orders


@router.get("/menu-items", response_model=List[MenuItemResponse])
def get_restaurant_menu_items(
    restaurant_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_restaurant_owner)
):
    """Get menu items for restaurant owner's restaurants"""

    # Get restaurant IDs owned by this user
    if restaurant_id:
        # Verify ownership
        restaurant = db.query(Restaurant).filter(
            Restaurant.id == restaurant_id,
            Restaurant.owner_id == current_user.id
        ).first()

        if not restaurant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Restaurant not found or you don't have permission"
            )

        restaurant_ids = [restaurant_id]
    else:
        restaurant_ids = [r.id for r in db.query(Restaurant).filter(
            Restaurant.owner_id == current_user.id
        ).all()]

    if not restaurant_ids:
        return []

    menu_items = db.query(MenuItem).filter(
        MenuItem.restaurant_id.in_(restaurant_ids)
    ).all()

    return menu_items


@router.get("/reviews")
def get_restaurant_reviews(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    restaurant_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_restaurant_owner)
):
    """Get reviews for restaurant owner's restaurants"""

    # Get restaurant IDs owned by this user
    if restaurant_id:
        # Verify ownership
        restaurant = db.query(Restaurant).filter(
            Restaurant.id == restaurant_id,
            Restaurant.owner_id == current_user.id
        ).first()

        if not restaurant:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Restaurant not found or you don't have permission"
            )

        restaurant_ids = [restaurant_id]
    else:
        restaurant_ids = [r.id for r in db.query(Restaurant).filter(
            Restaurant.owner_id == current_user.id
        ).all()]

    if not restaurant_ids:
        return []

    reviews = db.query(Review).filter(
        Review.restaurant_id.in_(restaurant_ids)
    ).order_by(Review.created_at.desc()).offset(skip).limit(limit).all()

    return reviews
