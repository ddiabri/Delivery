# Setup Guide - Delivery App

A quick guide to get the application up and running locally.

## 🚀 Quick Start

### Step 1: Clone and Navigate
```bash
cd Delivery
```

### Step 2: Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend (in a new terminal):**
```bash
cd frontend
npm install
```

### Step 3: Configure Environment Variables

Create `.env` file in the root directory:
```bash
cp .env.example .env
```

Edit `.env` with your PostgreSQL credentials:
```env
# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_secure_password
DB_NAME=delivery_db

# Server Configuration
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:5173

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRE=7d
REFRESH_TOKEN_SECRET=your-refresh-token-secret-change-this-in-production
```

### Step 4: Set Up Database

```bash
# Create database
createdb delivery_db

# The backend will automatically:
# - Enable PostGIS extension
# - Create all necessary tables on first run
# - Set up indexes for performance
```

### Step 5: Frontend Environment

Create `frontend/.env.local`:
```bash
cd frontend
cp ../.env.example .env.local
```

Edit `frontend/.env.local`:
```env
VITE_API_URL=http://localhost:3000
VITE_SOCKET_URL=http://localhost:3000
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

### Step 6: Run the Application

**Terminal 1 - Backend Server:**
```bash
cd backend
npm run dev
```

Expected output:
```
🚀 Delivery App Backend Server
   Running on: http://localhost:3000
   Environment: development
   WebSocket: ws://localhost:3000

✅ Server is ready to accept connections
```

**Terminal 2 - Frontend Dev Server:**
```bash
cd frontend
npm run dev
```

Expected output:
```
  VITE v4.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  press h to show help
```

### Step 7: Verify Setup

1. **Backend Health Check:**
   ```bash
   curl http://localhost:3000/health
   ```
   Expected response: `{"status":"ok",...}`

2. **Access Frontend:**
   Open http://localhost:5173 in your browser

3. **Check WebSocket Connection:**
   Browser console should show: "Socket.IO connected"

## 🗄️ Database Setup

The backend automatically initializes the database on first run. It will:

1. Create the `users` table with user roles (customer, driver, admin)
2. Create the `deliveries` table with pickup/delivery locations (PostGIS GEOGRAPHY)
3. Create the `driver_locations` table for real-time tracking
4. Create the `delivery_reviews` table for ratings
5. Set up indexes for optimal query performance
6. Enable required extensions (PostGIS, UUID)

### Manual Database Commands

```bash
# Connect to database
psql delivery_db

# Check if PostGIS is enabled
SELECT postgis_version();

# View tables
\dt

# Check if tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```

## ✨ Key Features Ready to Build

- ✅ Authentication system (JWT)
- ✅ WebSocket real-time updates
- ✅ Database schema with PostGIS
- ✅ API structure
- ✅ Frontend build setup
- ⏳ Next: Implement features (auth routes, delivery management, driver tracking, etc.)

## 📝 Next Steps

1. **Implement Authentication Endpoints:**
   - `POST /api/auth/register`
   - `POST /api/auth/login`
   - `GET /api/auth/me`

2. **Build Delivery Management:**
   - Create delivery request routes
   - Implement status tracking
   - Add driver assignment logic

3. **Real-time Driver Tracking:**
   - Implement driver location updates via WebSocket
   - Create map components for frontend
   - Build real-time status notifications

4. **User Dashboards:**
   - Customer: Track deliveries, request pickups
   - Driver: View available deliveries, manage routes
   - Admin: Manage users, monitor system

## 🐛 Troubleshooting

### PostgreSQL Connection Issues
```bash
# Check if PostgreSQL is running
psql -U postgres -c "SELECT 1;"

# If connection refused, start PostgreSQL
# macOS (Homebrew):
brew services start postgresql

# Linux (Ubuntu/Debian):
sudo service postgresql start

# Windows (use Services app or):
net start postgresql-x64-14
```

### Port Already in Use
```bash
# Kill process on port 3000
kill -9 $(lsof -t -i :3000)

# Or use a different port
PORT=3001 npm run dev
```

### Module Not Found Errors
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### WebSocket Connection Failed
1. Ensure backend is running (`http://localhost:3000`)
2. Check CORS_ORIGIN in `.env` includes frontend URL
3. Verify firewall allows WebSocket connections
4. Check browser console for specific errors

## 📚 Additional Resources

- [Main README](./README.md) - Full project documentation
- [Backend Package.json](./backend/package.json) - Dependencies list
- [Frontend Package.json](./frontend/package.json) - Dependencies list
- [Environment Variables](.//.env.example) - All configuration options

## 💡 Development Tips

### VS Code Extensions Recommended
- ES7+ React/Redux/React-Native snippets
- Prettier - Code formatter
- Thunder Client (for API testing)
- Thunder Client extension (REST client)

### Debug Mode
```bash
# Enable debug logging
DEBUG=* npm run dev

# Node.js inspector
node --inspect backend/server.js
```

### Hot Reload
- Backend: Nodemon automatically restarts on file changes
- Frontend: Vite provides instant module refresh

---

**Setup Complete!** 🎉 You're ready to start building the delivery platform.
