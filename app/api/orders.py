from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.config import settings
from app.core.logging_config import get_logger
from app.core.dependencies import (
    get_current_user,
    get_current_active_customer,
    get_current_active_restaurant_owner,
    get_current_active_driver
)
from app.models.user import User, UserRole
from app.models.order import Order, OrderItem, OrderStatus
from app.models.menu_item import MenuItem
from app.models.restaurant import Restaurant
from app.schemas.order import OrderCreate, OrderUpdate, OrderResponse

logger = get_logger(__name__)
router = APIRouter(prefix="/orders", tags=["Orders"])


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_customer)
):
    """Create a new order (Customer only)"""
    # Verify restaurant exists
    restaurant = db.query(Restaurant).filter(
        Restaurant.id == order_data.restaurant_id,
        Restaurant.is_active == True
    ).first()

    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found or inactive"
        )

    # Calculate order totals
    subtotal = 0.0
    order_items = []

    for item in order_data.items:
        menu_item = db.query(MenuItem).filter(
            MenuItem.id == item.menu_item_id,
            MenuItem.is_available == True
        ).first()

        if not menu_item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Menu item {item.menu_item_id} not found or unavailable"
            )

        if menu_item.restaurant_id != order_data.restaurant_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Menu item {item.menu_item_id} does not belong to this restaurant"
            )

        item_total = menu_item.price * item.quantity
        subtotal += item_total

        order_items.append({
            "menu_item_id": item.menu_item_id,
            "quantity": item.quantity,
            "price": menu_item.price,
            "special_instructions": item.special_instructions
        })

    # Check minimum order
    if subtotal < restaurant.minimum_order:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Minimum order amount is ${restaurant.minimum_order}"
        )

    # Calculate tax and total
    tax = subtotal * settings.TAX_RATE
    total_amount = subtotal + restaurant.delivery_fee + tax

    # Create order
    new_order = Order(
        customer_id=current_user.id,
        restaurant_id=order_data.restaurant_id,
        status=OrderStatus.PENDING,
        subtotal=subtotal,
        delivery_fee=restaurant.delivery_fee,
        tax=tax,
        total_amount=total_amount,
        delivery_address=order_data.delivery_address,
        delivery_latitude=order_data.delivery_latitude,
        delivery_longitude=order_data.delivery_longitude,
        delivery_instructions=order_data.delivery_instructions
    )

    db.add(new_order)
    db.flush()  # Get the order ID

    # Add order items
    for item_data in order_items:
        order_item = OrderItem(order_id=new_order.id, **item_data)
        db.add(order_item)

    db.commit()
    db.refresh(new_order)

    logger.info(
        f"Order created - ID: {new_order.id}, Customer: {current_user.id}, "
        f"Restaurant: {restaurant.id}, Total: ${total_amount:.2f}, Items: {len(order_items)}"
    )
    return new_order


@router.get("/", response_model=List[OrderResponse])
def get_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    status_filter: Optional[OrderStatus] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get orders based on user role"""
    query = db.query(Order)

    # Filter based on user role
    if current_user.role == UserRole.CUSTOMER:
        query = query.filter(Order.customer_id == current_user.id)
    elif current_user.role == UserRole.RESTAURANT_OWNER:
        # Get orders for restaurants owned by this user
        owned_restaurant_ids = db.query(Restaurant.id).filter(
            Restaurant.owner_id == current_user.id
        ).all()
        restaurant_ids = [r[0] for r in owned_restaurant_ids]
        query = query.filter(Order.restaurant_id.in_(restaurant_ids))
    elif current_user.role == UserRole.DELIVERY_DRIVER:
        # Get orders assigned to this driver or available orders
        query = query.filter(
            (Order.driver_id == current_user.id) |
            (Order.driver_id.is_(None) & Order.status.in_([OrderStatus.CONFIRMED, OrderStatus.PREPARING]))
        )

    if status_filter:
        query = query.filter(Order.status == status_filter)

    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    return orders


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific order by ID"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Check authorization
    if current_user.role == UserRole.CUSTOMER and order.customer_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to view this order"
        )
    elif current_user.role == UserRole.RESTAURANT_OWNER:
        restaurant = db.query(Restaurant).filter(Restaurant.id == order.restaurant_id).first()
        if not restaurant or restaurant.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this order"
            )
    elif current_user.role == UserRole.DELIVERY_DRIVER and order.driver_id != current_user.id:
        # Allow if order is not yet assigned
        if order.driver_id is not None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to view this order"
            )

    return order


@router.put("/{order_id}", response_model=OrderResponse)
def update_order_status(
    order_id: int,
    order_update: OrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update order status based on user role"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    # Check authorization and valid status transitions
    if current_user.role == UserRole.RESTAURANT_OWNER:
        restaurant = db.query(Restaurant).filter(Restaurant.id == order.restaurant_id).first()
        if restaurant.owner_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this order"
            )

        # Restaurant owner can update to CONFIRMED, PREPARING, READY_FOR_PICKUP, or CANCELLED
        allowed_statuses = [
            OrderStatus.CONFIRMED,
            OrderStatus.PREPARING,
            OrderStatus.READY_FOR_PICKUP,
            OrderStatus.CANCELLED
        ]
        if order_update.status not in allowed_statuses:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status transition for restaurant owner"
            )

    elif current_user.role == UserRole.DELIVERY_DRIVER:
        # Driver can assign themselves to ready orders and update to OUT_FOR_DELIVERY or DELIVERED
        if order_update.status == OrderStatus.OUT_FOR_DELIVERY:
            if order.driver_id is None:
                order.driver_id = current_user.id
            elif order.driver_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Order already assigned to another driver"
                )
        elif order_update.status == OrderStatus.DELIVERED:
            if order.driver_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Not authorized to update this order"
                )
            order.delivered_at = datetime.now(timezone.utc)
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid status transition for delivery driver"
            )

    elif current_user.role == UserRole.CUSTOMER:
        # Customer can only cancel pending orders
        if order.customer_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to update this order"
            )
        if order_update.status != OrderStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Customers can only cancel orders"
            )
        if order.status not in [OrderStatus.PENDING, OrderStatus.CONFIRMED]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot cancel order in current status"
            )

    # Update order status
    old_status = order.status
    order.status = order_update.status
    if order_update.status == OrderStatus.CONFIRMED and order.confirmed_at is None:
        order.confirmed_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(order)

    logger.info(
        f"Order status updated - ID: {order.id}, "
        f"Status: {old_status} -> {order.status}, User: {current_user.id} ({current_user.role})"
    )
    return order


@router.post("/{order_id}/assign", response_model=OrderResponse)
def assign_driver_to_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_driver)
):
    """Assign current driver to an order"""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )

    if order.driver_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order already has a driver assigned"
        )

    if order.status not in [OrderStatus.CONFIRMED, OrderStatus.PREPARING, OrderStatus.READY_FOR_PICKUP]:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Order is not ready for driver assignment"
        )

    order.driver_id = current_user.id
    db.commit()
    db.refresh(order)

    return order
