from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_active_restaurant_owner
from app.models.user import User
from app.models.restaurant import Restaurant
from app.schemas.restaurant import RestaurantCreate, RestaurantUpdate, RestaurantResponse
from geopy.distance import geodesic

router = APIRouter(prefix="/restaurants", tags=["Restaurants"])


@router.post("/", response_model=RestaurantResponse, status_code=status.HTTP_201_CREATED)
def create_restaurant(
    restaurant_data: RestaurantCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_restaurant_owner)
):
    """Create a new restaurant (Restaurant owner only)"""
    new_restaurant = Restaurant(
        **restaurant_data.model_dump(),
        owner_id=current_user.id
    )

    db.add(new_restaurant)
    db.commit()
    db.refresh(new_restaurant)

    return new_restaurant


@router.get("/", response_model=List[RestaurantResponse])
def get_restaurants(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    cuisine_type: Optional[str] = None,
    latitude: Optional[float] = None,
    longitude: Optional[float] = None,
    max_distance_km: Optional[float] = None,
    db: Session = Depends(get_db)
):
    """Get all restaurants with optional filters"""
    query = db.query(Restaurant).filter(Restaurant.is_active == True)

    if cuisine_type:
        query = query.filter(Restaurant.cuisine_type == cuisine_type)

    restaurants = query.offset(skip).limit(limit).all()

    # Filter by distance if location provided
    if latitude is not None and longitude is not None and max_distance_km is not None:
        user_location = (latitude, longitude)
        filtered_restaurants = []

        for restaurant in restaurants:
            restaurant_location = (restaurant.latitude, restaurant.longitude)
            distance = geodesic(user_location, restaurant_location).kilometers

            if distance <= max_distance_km:
                filtered_restaurants.append(restaurant)

        return filtered_restaurants

    return restaurants


@router.get("/{restaurant_id}", response_model=RestaurantResponse)
def get_restaurant(restaurant_id: int, db: Session = Depends(get_db)):
    """Get a specific restaurant by ID"""
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found"
        )
    return restaurant


@router.put("/{restaurant_id}", response_model=RestaurantResponse)
def update_restaurant(
    restaurant_id: int,
    restaurant_data: RestaurantUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_restaurant_owner)
):
    """Update a restaurant (Owner only)"""
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found"
        )

    # Check if user owns this restaurant
    if restaurant.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this restaurant"
        )

    # Update fields
    update_data = restaurant_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(restaurant, field, value)

    db.commit()
    db.refresh(restaurant)

    return restaurant


@router.delete("/{restaurant_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_restaurant(
    restaurant_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_restaurant_owner)
):
    """Delete a restaurant (Owner only)"""
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found"
        )

    # Check if user owns this restaurant
    if restaurant.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this restaurant"
        )

    db.delete(restaurant)
    db.commit()

    return None
