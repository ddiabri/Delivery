from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_active_restaurant_owner
from app.models.user import User
from app.models.menu_item import MenuItem
from app.models.restaurant import Restaurant
from app.schemas.menu_item import MenuItemCreate, MenuItemUpdate, MenuItemResponse

router = APIRouter(prefix="/menu-items", tags=["Menu Items"])


@router.post("/", response_model=MenuItemResponse, status_code=status.HTTP_201_CREATED)
def create_menu_item(
    menu_item_data: MenuItemCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_restaurant_owner)
):
    """Create a new menu item (Restaurant owner only)"""
    # Check if restaurant exists and user owns it
    restaurant = db.query(Restaurant).filter(
        Restaurant.id == menu_item_data.restaurant_id
    ).first()

    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found"
        )

    if restaurant.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to add menu items to this restaurant"
        )

    new_menu_item = MenuItem(**menu_item_data.model_dump())

    db.add(new_menu_item)
    db.commit()
    db.refresh(new_menu_item)

    return new_menu_item


@router.get("/restaurant/{restaurant_id}", response_model=List[MenuItemResponse])
def get_menu_items_by_restaurant(
    restaurant_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    category: Optional[str] = None,
    is_vegetarian: Optional[bool] = None,
    is_vegan: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    """Get all menu items for a specific restaurant"""
    query = db.query(MenuItem).filter(
        MenuItem.restaurant_id == restaurant_id,
        MenuItem.is_available == True
    )

    if category:
        query = query.filter(MenuItem.category == category)
    if is_vegetarian is not None:
        query = query.filter(MenuItem.is_vegetarian == is_vegetarian)
    if is_vegan is not None:
        query = query.filter(MenuItem.is_vegan == is_vegan)

    menu_items = query.offset(skip).limit(limit).all()
    return menu_items


@router.get("/{menu_item_id}", response_model=MenuItemResponse)
def get_menu_item(menu_item_id: int, db: Session = Depends(get_db)):
    """Get a specific menu item by ID"""
    menu_item = db.query(MenuItem).filter(MenuItem.id == menu_item_id).first()
    if not menu_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found"
        )
    return menu_item


@router.put("/{menu_item_id}", response_model=MenuItemResponse)
def update_menu_item(
    menu_item_id: int,
    menu_item_data: MenuItemUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_restaurant_owner)
):
    """Update a menu item (Restaurant owner only)"""
    menu_item = db.query(MenuItem).filter(MenuItem.id == menu_item_id).first()
    if not menu_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found"
        )

    # Check if user owns the restaurant
    restaurant = db.query(Restaurant).filter(
        Restaurant.id == menu_item.restaurant_id
    ).first()

    if restaurant.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this menu item"
        )

    # Update fields
    update_data = menu_item_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(menu_item, field, value)

    db.commit()
    db.refresh(menu_item)

    return menu_item


@router.delete("/{menu_item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_menu_item(
    menu_item_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_restaurant_owner)
):
    """Delete a menu item (Restaurant owner only)"""
    menu_item = db.query(MenuItem).filter(MenuItem.id == menu_item_id).first()
    if not menu_item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Menu item not found"
        )

    # Check if user owns the restaurant
    restaurant = db.query(Restaurant).filter(
        Restaurant.id == menu_item.restaurant_id
    ).first()

    if restaurant.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this menu item"
        )

    db.delete(menu_item)
    db.commit()

    return None
