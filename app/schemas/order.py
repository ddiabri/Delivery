from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from app.models.order import OrderStatus


class OrderItemCreate(BaseModel):
    menu_item_id: int
    quantity: int
    special_instructions: Optional[str] = None


class OrderItemResponse(BaseModel):
    id: int
    menu_item_id: int
    quantity: int
    price: float
    special_instructions: Optional[str] = None

    class Config:
        from_attributes = True


class OrderCreate(BaseModel):
    restaurant_id: int
    items: List[OrderItemCreate]
    delivery_address: str
    delivery_latitude: Optional[float] = None
    delivery_longitude: Optional[float] = None
    delivery_instructions: Optional[str] = None


class OrderUpdate(BaseModel):
    status: Optional[OrderStatus] = None


class OrderResponse(BaseModel):
    id: int
    customer_id: int
    restaurant_id: int
    driver_id: Optional[int] = None
    status: OrderStatus
    subtotal: float
    delivery_fee: float
    tax: float
    total_amount: float
    delivery_address: str
    delivery_latitude: Optional[float] = None
    delivery_longitude: Optional[float] = None
    delivery_instructions: Optional[str] = None
    created_at: datetime
    confirmed_at: Optional[datetime] = None
    delivered_at: Optional[datetime] = None
    updated_at: datetime
    order_items: List[OrderItemResponse] = []

    class Config:
        from_attributes = True
