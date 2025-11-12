from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.core.database import Base


class Restaurant(Base):
    __tablename__ = "restaurants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False, index=True)
    description = Column(Text, nullable=True)

    # Contact & Location
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    address = Column(String, nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)

    # Business details
    cuisine_type = Column(String, nullable=True)  # Italian, Chinese, Indian, etc.
    image_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    average_rating = Column(Float, default=0.0)
    total_reviews = Column(Integer, default=0)

    # Delivery settings
    delivery_fee = Column(Float, default=0.0)
    minimum_order = Column(Float, default=0.0)
    estimated_delivery_time = Column(Integer, default=30)  # in minutes

    # Owner
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    owner = relationship("User", back_populates="owned_restaurants", foreign_keys=[owner_id])
    menu_items = relationship("MenuItem", back_populates="restaurant", cascade="all, delete-orphan")
    orders = relationship("Order", back_populates="restaurant")
    reviews = relationship("Review", back_populates="restaurant")
