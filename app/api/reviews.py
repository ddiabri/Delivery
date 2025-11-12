from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_current_active_customer
from app.models.user import User
from app.models.review import Review
from app.models.restaurant import Restaurant
from app.models.order import Order, OrderStatus
from app.schemas.review import ReviewCreate, ReviewUpdate, ReviewResponse

router = APIRouter(prefix="/reviews", tags=["Reviews"])


@router.post("/", response_model=ReviewResponse, status_code=status.HTTP_201_CREATED)
def create_review(
    review_data: ReviewCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_customer)
):
    """Create a new review (Customer only, must have ordered from restaurant)"""
    # Check if restaurant exists
    restaurant = db.query(Restaurant).filter(
        Restaurant.id == review_data.restaurant_id
    ).first()

    if not restaurant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Restaurant not found"
        )

    # Check if user has ordered from this restaurant
    has_ordered = db.query(Order).filter(
        Order.customer_id == current_user.id,
        Order.restaurant_id == review_data.restaurant_id,
        Order.status == OrderStatus.DELIVERED
    ).first()

    if not has_ordered:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You must order from this restaurant before reviewing"
        )

    # Check if user already reviewed this restaurant
    existing_review = db.query(Review).filter(
        Review.user_id == current_user.id,
        Review.restaurant_id == review_data.restaurant_id
    ).first()

    if existing_review:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You have already reviewed this restaurant. Use PUT to update your review."
        )

    # Create review
    new_review = Review(
        user_id=current_user.id,
        restaurant_id=review_data.restaurant_id,
        rating=review_data.rating,
        comment=review_data.comment
    )

    db.add(new_review)

    # Update restaurant average rating
    avg_rating = db.query(func.avg(Review.rating)).filter(
        Review.restaurant_id == review_data.restaurant_id
    ).scalar()

    total_reviews = db.query(func.count(Review.id)).filter(
        Review.restaurant_id == review_data.restaurant_id
    ).scalar()

    restaurant.average_rating = round(avg_rating, 2) if avg_rating else 0.0
    restaurant.total_reviews = total_reviews + 1

    db.commit()
    db.refresh(new_review)

    return new_review


@router.get("/restaurant/{restaurant_id}", response_model=List[ReviewResponse])
def get_restaurant_reviews(
    restaurant_id: int,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Get all reviews for a specific restaurant"""
    reviews = db.query(Review).filter(
        Review.restaurant_id == restaurant_id
    ).order_by(Review.created_at.desc()).offset(skip).limit(limit).all()

    return reviews


@router.get("/{review_id}", response_model=ReviewResponse)
def get_review(review_id: int, db: Session = Depends(get_db)):
    """Get a specific review by ID"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )
    return review


@router.put("/{review_id}", response_model=ReviewResponse)
def update_review(
    review_id: int,
    review_data: ReviewUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_customer)
):
    """Update a review (Owner only)"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )

    # Check if user owns this review
    if review.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to update this review"
        )

    # Update fields
    update_data = review_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(review, field, value)

    db.commit()

    # Recalculate restaurant average rating
    restaurant = db.query(Restaurant).filter(Restaurant.id == review.restaurant_id).first()
    avg_rating = db.query(func.avg(Review.rating)).filter(
        Review.restaurant_id == review.restaurant_id
    ).scalar()

    restaurant.average_rating = round(avg_rating, 2) if avg_rating else 0.0

    db.commit()
    db.refresh(review)

    return review


@router.delete("/{review_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review(
    review_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_active_customer)
):
    """Delete a review (Owner only)"""
    review = db.query(Review).filter(Review.id == review_id).first()
    if not review:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Review not found"
        )

    # Check if user owns this review
    if review.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorized to delete this review"
        )

    restaurant_id = review.restaurant_id
    db.delete(review)
    db.commit()

    # Recalculate restaurant average rating
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
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
