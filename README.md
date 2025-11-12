# Food Delivery Backend API

A comprehensive backend system for food delivery applications built with FastAPI, PostgreSQL, and SQLAlchemy.

## Features

- **User Management**: Support for multiple user roles (Customer, Restaurant Owner, Delivery Driver, Admin)
- **Restaurant Management**: CRUD operations for restaurants with location-based filtering
- **Menu Management**: Complete menu item management with categories and dietary options
- **Order Management**: Full order lifecycle from placement to delivery
- **Delivery Tracking**: Order status tracking and driver assignment
- **Review System**: Customer reviews and ratings for restaurants
- **Admin Panel**: Web-based admin interface with dashboard and management tools
- **JWT Authentication**: Secure authentication with JWT tokens
- **Role-Based Access Control**: Different permissions for different user types
- **Location-Based Services**: Distance calculation for restaurant search

## Tech Stack

- **Framework**: FastAPI
- **Database**: PostgreSQL
- **ORM**: SQLAlchemy
- **Authentication**: JWT (JSON Web Tokens)
- **Password Hashing**: bcrypt
- **Geolocation**: geopy

## Installation

### Prerequisites

- Python 3.8+
- PostgreSQL 12+

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd Delivery
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials and secret key
```

5. Create the database:
```bash
createdb delivery_db
```

6. Run database migrations (optional, tables auto-create on startup):
```bash
alembic upgrade head
```

7. Start the server:
```bash
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

## Admin Panel

Access the admin panel at `http://localhost:8000/admin`

### Admin Panel Features

- **Dashboard**: Overview statistics including total users, restaurants, orders, and revenue
- **User Management**: View, filter, and manage all users by role
- **Restaurant Management**: Activate/deactivate and delete restaurants
- **Order Management**: View all orders with status filtering and management
- **Review Management**: Monitor and moderate customer reviews
- **Analytics**: Revenue tracking, order statistics, and top-performing restaurants

### Admin Login

To access the admin panel, you need an account with the `admin` role:

1. Register a new user through the API
2. Update their role to `admin` in the database:
```sql
UPDATE users SET role = 'admin' WHERE email = 'your-admin@example.com';
```
3. Login to the admin panel at `http://localhost:8000/admin`

## API Documentation

Once the server is running, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Database Schema

### Users
- id, email, hashed_password, full_name, phone, role
- address, latitude, longitude
- created_at, updated_at

### Restaurants
- id, name, description, phone, email
- address, latitude, longitude
- cuisine_type, image_url, is_active
- average_rating, total_reviews
- delivery_fee, minimum_order, estimated_delivery_time
- owner_id (FK to Users)

### Menu Items
- id, restaurant_id (FK), name, description, price
- category, image_url, is_available
- is_vegetarian, is_vegan

### Orders
- id, customer_id (FK), restaurant_id (FK), driver_id (FK)
- status, subtotal, delivery_fee, tax, total_amount
- delivery_address, delivery_latitude, delivery_longitude
- delivery_instructions
- created_at, confirmed_at, delivered_at

### Order Items
- id, order_id (FK), menu_item_id (FK)
- quantity, price, special_instructions

### Reviews
- id, user_id (FK), restaurant_id (FK)
- rating, comment
- created_at, updated_at

## User Roles

### Customer
- Register and login
- Browse restaurants and menus
- Place orders
- Track order status
- Leave reviews

### Restaurant Owner
- Manage restaurant information
- Add/edit/delete menu items
- View and update order status
- Confirm/prepare orders

### Delivery Driver
- View available orders
- Assign themselves to orders
- Update delivery status
- Mark orders as delivered

### Admin
- Full system access (can be extended)

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user info

### Restaurants
- `POST /api/restaurants/` - Create restaurant (Owner only)
- `GET /api/restaurants/` - List restaurants (with filters)
- `GET /api/restaurants/{id}` - Get restaurant details
- `PUT /api/restaurants/{id}` - Update restaurant (Owner only)
- `DELETE /api/restaurants/{id}` - Delete restaurant (Owner only)

### Menu Items
- `POST /api/menu-items/` - Create menu item (Owner only)
- `GET /api/menu-items/restaurant/{id}` - Get restaurant menu
- `GET /api/menu-items/{id}` - Get menu item details
- `PUT /api/menu-items/{id}` - Update menu item (Owner only)
- `DELETE /api/menu-items/{id}` - Delete menu item (Owner only)

### Orders
- `POST /api/orders/` - Create order (Customer only)
- `GET /api/orders/` - List orders (filtered by role)
- `GET /api/orders/{id}` - Get order details
- `PUT /api/orders/{id}` - Update order status
- `POST /api/orders/{id}/assign` - Assign driver to order

### Reviews
- `POST /api/reviews/` - Create review (Customer only)
- `GET /api/reviews/restaurant/{id}` - Get restaurant reviews
- `GET /api/reviews/{id}` - Get review details
- `PUT /api/reviews/{id}` - Update review (Owner only)
- `DELETE /api/reviews/{id}` - Delete review (Owner only)

## Example Usage

### 1. Register a Customer
```bash
curl -X POST "http://localhost:8000/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "customer@example.com",
    "password": "password123",
    "full_name": "John Doe",
    "phone": "1234567890",
    "role": "customer",
    "address": "123 Main St"
  }'
```

### 2. Login
```bash
curl -X POST "http://localhost:8000/api/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=customer@example.com&password=password123"
```

### 3. Create Restaurant (as Restaurant Owner)
```bash
curl -X POST "http://localhost:8000/api/restaurants/" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Pizza Palace",
    "description": "Best pizza in town",
    "address": "456 Food St",
    "latitude": 40.7128,
    "longitude": -74.0060,
    "cuisine_type": "Italian",
    "delivery_fee": 3.99,
    "minimum_order": 15.00
  }'
```

### 4. Place an Order
```bash
curl -X POST "http://localhost:8000/api/orders/" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "restaurant_id": 1,
    "items": [
      {
        "menu_item_id": 1,
        "quantity": 2,
        "special_instructions": "Extra cheese"
      }
    ],
    "delivery_address": "123 Main St",
    "delivery_latitude": 40.7128,
    "delivery_longitude": -74.0060
  }'
```

## Order Flow

1. **Customer** places order → Status: `PENDING`
2. **Restaurant Owner** confirms → Status: `CONFIRMED`
3. **Restaurant Owner** prepares → Status: `PREPARING`
4. **Restaurant Owner** marks ready → Status: `READY_FOR_PICKUP`
5. **Driver** assigns to order → Status: `OUT_FOR_DELIVERY`
6. **Driver** delivers → Status: `DELIVERED`

## Security Features

- Password hashing with bcrypt
- JWT token-based authentication
- Role-based access control (RBAC)
- Input validation with Pydantic
- SQL injection prevention through SQLAlchemy ORM

## Configuration

Edit `.env` file to configure:
- `DATABASE_URL`: PostgreSQL connection string
- `SECRET_KEY`: JWT secret key (use a strong random string)
- `ALGORITHM`: JWT algorithm (default: HS256)
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Token expiration time

## Development

### Run tests (to be implemented)
```bash
pytest
```

### Database migrations
```bash
# Generate migration
alembic revision --autogenerate -m "Description"

# Apply migration
alembic upgrade head

# Rollback
alembic downgrade -1
```

## Production Deployment

1. Set environment variables securely
2. Use a production WSGI server (e.g., Gunicorn)
3. Set up PostgreSQL with proper credentials
4. Configure CORS for specific origins
5. Use HTTPS
6. Set up proper logging and monitoring

### Example with Gunicorn
```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

## Future Enhancements

- Real-time order tracking with WebSockets
- Payment gateway integration (Stripe, PayPal)
- Push notifications
- Advanced search and filtering
- Analytics dashboard
- Scheduled orders
- Promo codes and discounts
- Multi-restaurant orders
- Chat system between users
- Image upload for restaurants and menu items

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

MIT License

## Support

For issues and questions, please open an issue on the repository.
