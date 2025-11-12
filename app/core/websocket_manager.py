from fastapi import WebSocket
from typing import Dict, Set
import json
from app.core.logging_config import get_logger

logger = get_logger(__name__)


class ConnectionManager:
    """Manages WebSocket connections for real-time updates"""

    def __init__(self):
        # Store active connections by user_id
        self.active_connections: Dict[int, Set[WebSocket]] = {}
        # Store connections by restaurant_id for restaurant owners
        self.restaurant_connections: Dict[int, Set[WebSocket]] = {}
        # Store driver connections
        self.driver_connections: Set[WebSocket] = set()

    async def connect(self, websocket: WebSocket, user_id: int):
        """Connect a user websocket"""
        await websocket.accept()
        if user_id not in self.active_connections:
            self.active_connections[user_id] = set()
        self.active_connections[user_id].add(websocket)
        logger.info(f"WebSocket connected for user {user_id}")

    async def connect_restaurant(self, websocket: WebSocket, restaurant_id: int):
        """Connect a restaurant owner websocket"""
        await websocket.accept()
        if restaurant_id not in self.restaurant_connections:
            self.restaurant_connections[restaurant_id] = set()
        self.restaurant_connections[restaurant_id].add(websocket)
        logger.info(f"WebSocket connected for restaurant {restaurant_id}")

    async def connect_driver(self, websocket: WebSocket):
        """Connect a delivery driver websocket"""
        await websocket.accept()
        self.driver_connections.add(websocket)
        logger.info("WebSocket connected for driver")

    def disconnect(self, websocket: WebSocket, user_id: int):
        """Disconnect a user websocket"""
        if user_id in self.active_connections:
            self.active_connections[user_id].discard(websocket)
            if not self.active_connections[user_id]:
                del self.active_connections[user_id]
        logger.info(f"WebSocket disconnected for user {user_id}")

    def disconnect_restaurant(self, websocket: WebSocket, restaurant_id: int):
        """Disconnect a restaurant owner websocket"""
        if restaurant_id in self.restaurant_connections:
            self.restaurant_connections[restaurant_id].discard(websocket)
            if not self.restaurant_connections[restaurant_id]:
                del self.restaurant_connections[restaurant_id]
        logger.info(f"WebSocket disconnected for restaurant {restaurant_id}")

    def disconnect_driver(self, websocket: WebSocket):
        """Disconnect a delivery driver websocket"""
        self.driver_connections.discard(websocket)
        logger.info("WebSocket disconnected for driver")

    async def send_personal_message(self, message: dict, user_id: int):
        """Send a message to a specific user"""
        if user_id in self.active_connections:
            disconnected = set()
            for connection in self.active_connections[user_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending message to user {user_id}: {e}")
                    disconnected.add(connection)

            # Clean up disconnected websockets
            for connection in disconnected:
                self.disconnect(connection, user_id)

    async def send_to_restaurant(self, message: dict, restaurant_id: int):
        """Send a message to a specific restaurant"""
        if restaurant_id in self.restaurant_connections:
            disconnected = set()
            for connection in self.restaurant_connections[restaurant_id]:
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending message to restaurant {restaurant_id}: {e}")
                    disconnected.add(connection)

            # Clean up disconnected websockets
            for connection in disconnected:
                self.disconnect_restaurant(connection, restaurant_id)

    async def broadcast_to_drivers(self, message: dict):
        """Broadcast a message to all delivery drivers"""
        disconnected = set()
        for connection in self.driver_connections:
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"Error broadcasting to driver: {e}")
                disconnected.add(connection)

        # Clean up disconnected websockets
        for connection in disconnected:
            self.disconnect_driver(connection)

    async def notify_order_update(self, order_data: dict):
        """Notify relevant parties about an order update"""
        order_id = order_data.get("id")
        customer_id = order_data.get("customer_id")
        restaurant_id = order_data.get("restaurant_id")
        driver_id = order_data.get("driver_id")
        status = order_data.get("status")

        # Notify customer
        if customer_id:
            await self.send_personal_message({
                "type": "order_update",
                "data": order_data
            }, customer_id)

        # Notify restaurant
        if restaurant_id:
            await self.send_to_restaurant({
                "type": "order_update",
                "data": order_data
            }, restaurant_id)

        # Notify driver if assigned
        if driver_id:
            await self.send_personal_message({
                "type": "order_update",
                "data": order_data
            }, driver_id)

        # If order is ready for pickup or confirmed, notify all available drivers
        if status in ["confirmed", "preparing", "ready_for_pickup"] and not driver_id:
            await self.broadcast_to_drivers({
                "type": "order_available",
                "data": order_data
            })

        logger.info(f"Order update notification sent for order {order_id}")


# Global connection manager instance
manager = ConnectionManager()
