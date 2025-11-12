from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Query, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.websocket_manager import manager
from app.core.security import decode_access_token
from app.models.user import User, UserRole
from app.models.restaurant import Restaurant
from app.core.logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(tags=["WebSocket"])


async def get_current_user_ws(
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_db)
) -> User:
    """Get current user from WebSocket token"""
    try:
        payload = decode_access_token(token)
        email = payload.get("sub")
        if email is None:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return None

        user = db.query(User).filter(User.email == email).first()
        if user is None or not user.is_active:
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return None

        return user
    except Exception as e:
        logger.error(f"WebSocket authentication error: {e}")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return None


@router.websocket("/ws/orders")
async def websocket_orders(
    websocket: WebSocket,
    token: str = Query(...),
    db: Session = Depends(get_db)
):
    """WebSocket endpoint for order updates"""
    user = await get_current_user_ws(websocket, token, db)
    if not user:
        return

    try:
        if user.role == UserRole.CUSTOMER:
            # Customer connection
            await manager.connect(websocket, user.id)
            logger.info(f"Customer {user.id} connected to order updates")

            try:
                while True:
                    # Keep connection alive and listen for messages
                    data = await websocket.receive_text()
                    # Echo back for heartbeat
                    await websocket.send_json({"type": "pong", "data": data})
            except WebSocketDisconnect:
                manager.disconnect(websocket, user.id)
                logger.info(f"Customer {user.id} disconnected from order updates")

        elif user.role == UserRole.RESTAURANT_OWNER:
            # Restaurant owner connection
            # Get all restaurants owned by this user
            owned_restaurants = db.query(Restaurant).filter(
                Restaurant.owner_id == user.id
            ).all()

            if not owned_restaurants:
                await websocket.close(code=status.WS_1003_UNSUPPORTED_DATA)
                return

            # Connect to all owned restaurants
            for restaurant in owned_restaurants:
                await manager.connect_restaurant(websocket, restaurant.id)

            logger.info(f"Restaurant owner {user.id} connected to order updates")

            try:
                while True:
                    # Keep connection alive
                    data = await websocket.receive_text()
                    await websocket.send_json({"type": "pong", "data": data})
            except WebSocketDisconnect:
                for restaurant in owned_restaurants:
                    manager.disconnect_restaurant(websocket, restaurant.id)
                logger.info(f"Restaurant owner {user.id} disconnected from order updates")

        elif user.role == UserRole.DELIVERY_DRIVER:
            # Delivery driver connection
            await manager.connect_driver(websocket)
            logger.info(f"Driver {user.id} connected to order updates")

            try:
                while True:
                    # Keep connection alive
                    data = await websocket.receive_text()
                    await websocket.send_json({"type": "pong", "data": data})
            except WebSocketDisconnect:
                manager.disconnect_driver(websocket)
                logger.info(f"Driver {user.id} disconnected from order updates")

        else:
            await websocket.close(code=status.WS_1003_UNSUPPORTED_DATA)

    except Exception as e:
        logger.error(f"WebSocket error for user {user.id}: {e}")
        await websocket.close(code=status.WS_1011_INTERNAL_ERROR)
