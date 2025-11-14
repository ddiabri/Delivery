# On-Demand Mail and Package Delivery Platform

A comprehensive fullstack application for managing on-demand mail and package deliveries. Features real-time driver tracking, live status updates, and a multi-platform interface for customers, drivers, and administrators.

## 🚀 Technology Stack

- **Frontend**: React 19 + Vite + Socket.IO client
- **Backend**: Node.js + Express.js + Socket.IO
- **Database**: PostgreSQL with PostGIS (geospatial queries)
- **Real-time Communication**: Socket.IO (WebSockets)
- **Maps**: Mapbox GL + Google Maps API
- **State Management**: Zustand
- **Authentication**: JWT (JSON Web Tokens)
- **Cloud Platform**: Google Cloud (optional)

## 📋 Project Structure

```
Delivery/
├── backend/                    # Node.js/Express backend
│   ├── src/
│   │   ├── config/            # Database and environment config
│   │   ├── routes/            # API routes
│   │   ├── controllers/       # Business logic
│   │   ├── models/            # Data models
│   │   ├── middleware/        # Custom middleware
│   │   └── utils/             # Utility functions
│   ├── server.js              # Main server file
│   ├── package.json
│   └── .env.example
├── frontend/                   # React frontend
│   ├── src/
│   │   ├── components/        # Reusable components
│   │   ├── pages/             # Page components
│   │   ├── services/          # API and WebSocket services
│   │   ├── context/           # React context providers
│   │   ├── hooks/             # Custom hooks
│   │   ├── utils/             # Utility functions
│   │   └── styles/            # Global styles
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── .env.example
├── .env.example               # Environment variables template
├── .gitignore
└── README.md
```

## 🛠️ Prerequisites

- **Node.js** v18+ and npm v9+
- **PostgreSQL** 12+ (with PostGIS extension)
- **Git** for version control
- **Google Cloud Account** (optional, for cloud deployment)

## 📦 Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Delivery
```

### 2. Set Up Environment Variables

Copy the example environment file and update with your configuration:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=delivery_db

# Server
PORT=3000
NODE_ENV=development
CORS_ORIGIN=http://localhost:5173

# JWT
JWT_SECRET=your-super-secret-key-here
JWT_EXPIRE=7d
```

### 3. Set Up PostgreSQL Database

```bash
# Create database (if not exists)
createdb delivery_db

# The backend will automatically create tables and enable PostGIS extension on first run
```

### 4. Install Backend Dependencies

```bash
cd backend
npm install
cp ../.env .env
```

### 5. Install Frontend Dependencies

```bash
cd frontend
npm install
cp ../.env.example .env.local
```

Update `frontend/.env.local` with your frontend-specific settings:

```env
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
VITE_GOOGLE_MAPS_API_KEY=your-api-key
```

## 🚀 Running the Application

### Development Mode (Terminal 1 - Backend)

```bash
cd backend
npm run dev
```

The backend server will start at `http://localhost:3000`

- API: `http://localhost:3000/api`
- WebSocket: `ws://localhost:3000`
- Health Check: `http://localhost:3000/health`

### Development Mode (Terminal 2 - Frontend)

```bash
cd frontend
npm run dev
```

The frontend will start at `http://localhost:5173`

## 📱 Features

### For Customers
- Request package pickups with location details
- Real-time driver location tracking on map
- Live delivery status updates
- Order history and tracking
- Ratings and reviews

### For Drivers
- View and accept delivery tasks
- Real-time location tracking
- Route optimization
- Delivery management
- Earnings dashboard
- Performance metrics

### For Administrators
- Dashboard with key metrics
- User management (customers, drivers, admins)
- Delivery monitoring and analytics
- System settings and configurations
- Reports and insights

## 🗄️ Database Schema

### Users Table
```sql
- id (UUID)
- email, password_hash, full_name, phone
- role (customer, driver, admin)
- address, location (GEOGRAPHY)
- is_active, created_at, updated_at
```

### Deliveries Table
```sql
- id, customer_id, driver_id
- pickup_address, pickup_location (GEOGRAPHY)
- delivery_address, delivery_location (GEOGRAPHY)
- status, priority, estimated_delivery_time
- created_at, updated_at
```

### Driver Locations Table
```sql
- id, driver_id, location (GEOGRAPHY)
- bearing, speed, accuracy, timestamp
```

### Delivery Reviews Table
```sql
- id, delivery_id, customer_id, driver_id
- rating (1-5), comment, created_at
```

## 🔑 API Endpoints (Core)

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token

### Deliveries
- `POST /api/deliveries` - Create delivery request
- `GET /api/deliveries` - List deliveries
- `GET /api/deliveries/:id` - Get delivery details
- `PUT /api/deliveries/:id/status` - Update delivery status

### Driver Operations
- `GET /api/drivers/deliveries` - Get available deliveries
- `POST /api/drivers/deliveries/:id/accept` - Accept delivery
- `POST /api/drivers/location` - Update driver location

### User Management
- `GET /api/users/profile` - Get user profile
- `PUT /api/users/profile` - Update profile

## 🔄 WebSocket Events

### Client → Server
- `driver:location` - Update driver's real-time location
- `order:status` - Update order status
- `join:order` - Join real-time updates for specific order
- `leave:order` - Leave order room
- `driver:available` - Driver availability status

### Server → Client
- `driver:location:update` - Broadcast driver location
- `order:status:update` - Order status change notification
- `driver:available:update` - Driver availability updates

## 🧪 Testing

### Backend Tests
```bash
cd backend
npm test
npm run test:watch
```

### Frontend Tests
```bash
cd frontend
npm run test
```

## 📊 Database Migrations

The backend automatically creates tables on first run. For manual migrations:

```bash
cd backend
npm run migrate
npm run seed
```

## 🚢 Deployment

### Deploy to Google Cloud

1. **Set up Google Cloud Project**
   ```bash
   gcloud projects create delivery-app
   gcloud config set project delivery-app
   ```

2. **Deploy Backend to Cloud Run**
   ```bash
   cd backend
   gcloud run deploy delivery-backend --source .
   ```

3. **Deploy Frontend to Firebase Hosting**
   ```bash
   cd frontend
   npm run build
   firebase deploy
   ```

4. **Set up Cloud SQL for PostgreSQL**
   ```bash
   gcloud sql instances create delivery-db --database-version POSTGRES_14
   gcloud sql databases create delivery_db --instance=delivery-db
   ```

### Environment Variables on Google Cloud

Set variables using Cloud Secret Manager:
```bash
gcloud secrets create db-password --replication-policy="automatic"
gcloud secrets versions add db-password --data-file=- < password.txt
```

## 🔐 Security Features

- JWT-based authentication with refresh tokens
- Password hashing with bcryptjs
- Role-based access control (RBAC)
- Input validation with Joi
- Rate limiting on API endpoints
- CORS protection
- Helmet.js for security headers
- HTTPS (required in production)

## 📝 Environment Variables

See `.env.example` for all available configuration options:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment (development/production) | development |
| `PORT` | Server port | 3000 |
| `DB_HOST` | Database host | localhost |
| `DB_PORT` | Database port | 5432 |
| `JWT_SECRET` | JWT signing secret | (required) |
| `CORS_ORIGIN` | Allowed CORS origins | * |

## 🐛 Troubleshooting

### PostgreSQL Connection Error
```bash
# Check if PostgreSQL is running
psql -U postgres -c "SELECT 1;"

# Create database if missing
createdb delivery_db

# Connect to database and enable PostGIS
psql delivery_db -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

### Port Already in Use
```bash
# Change PORT in .env or kill existing process
kill -9 $(lsof -t -i :3000)
```

### WebSocket Connection Issues
- Ensure backend is running
- Check CORS settings in `.env`
- Verify firewall allows WebSocket connections

## 📚 Documentation

- [Backend API Documentation](./backend/README.md)
- [Frontend Setup Guide](./frontend/README.md)
- [Database Schema](./docs/DATABASE.md)
- [Deployment Guide](./docs/DEPLOYMENT.md)

## 🤝 Contributing

1. Create a feature branch (`git checkout -b feature/AmazingFeature`)
2. Commit changes (`git commit -m 'Add AmazingFeature'`)
3. Push to branch (`git push origin feature/AmazingFeature`)
4. Open a Pull Request

## 📄 License

MIT License - see LICENSE file for details

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Open an issue on GitHub
3. Contact development team

## 🎯 Roadmap

- [ ] Payment integration (Stripe)
- [ ] Push notifications
- [ ] Advanced analytics dashboard
- [ ] AI-powered route optimization
- [ ] Multi-language support
- [ ] Mobile app (React Native)
- [ ] Scheduled deliveries
- [ ] Batch processing
- [ ] Insurance integration
- [ ] Customs documentation

---

**Last Updated**: November 2024
**Version**: 1.0.0
