from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base
from app.core.utils import get_utc_now


class MenuItem(Base):
    __tablename__ = "menu_items"

    id = Column(Integer, primary_key=True, index=True)
    restaurant_id = Column(Integer, ForeignKey("restaurants.id"), nullable=False)

    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)
    price = Column(Float, nullable=False)
    category = Column(String, nullable=True)  # Appetizer, Main Course, Dessert, Beverage, etc.

    image_url = Column(String, nullable=True)
    is_available = Column(Boolean, default=True)
    is_vegetarian = Column(Boolean, default=False)
    is_vegan = Column(Boolean, default=False)

    # Timestamps
    created_at = Column(DateTime, default=get_utc_now)
    updated_at = Column(DateTime, default=get_utc_now, onupdate=get_utc_now)

    # Relationships
    restaurant = relationship("Restaurant", back_populates="menu_items")
    order_items = relationship("OrderItem", back_populates="menu_item")
