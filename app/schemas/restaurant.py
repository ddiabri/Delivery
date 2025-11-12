from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class RestaurantBase(BaseModel):
    name: str
    description: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: str
    latitude: float
    longitude: float
    cuisine_type: Optional[str] = None
    image_url: Optional[str] = None
    is_active: bool = True
    delivery_fee: float = 0.0
    minimum_order: float = 0.0
    estimated_delivery_time: int = 30


class RestaurantCreate(RestaurantBase):
    pass


class RestaurantUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    cuisine_type: Optional[str] = None
    image_url: Optional[str] = None
    is_active: Optional[bool] = None
    delivery_fee: Optional[float] = None
    minimum_order: Optional[float] = None
    estimated_delivery_time: Optional[int] = None


class RestaurantResponse(RestaurantBase):
    id: int
    owner_id: int
    average_rating: float
    total_reviews: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True
