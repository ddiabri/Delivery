# Quick Testing Guide

Fast-track to testing the delivery platform with sample workflows.

## ⚡ 5-Minute Setup

### Prerequisites
- Node.js 18+
- PostgreSQL running locally
- Git bash or terminal

### Step 1: Start Backend (Terminal 1)
```bash
cd backend
npm run dev
```

Expected output:
```
✅ Database connection successful
✅ PostGIS extension enabled
✅ Users table created
...
🚀 Delivery App Backend Server
   Running on: http://localhost:3000
```

### Step 2: Start Frontend (Terminal 2)
```bash
cd frontend
npm run dev
```

Expected output:
```
VITE v5.x.x  ready in xxx ms

➜  Local:   http://localhost:5173/
```

### Step 3: Open Browser
```
http://localhost:5173/
```

## 👥 Create Test Accounts

### Account 1: Customer
```
Email: customer@test.com
Password: TestPass123
Role: Customer
Full Name: John Customer
Phone: +1234567890
```

### Account 2: Driver
```
Email: driver@test.com
Password: TestPass123
Role: Driver
Full Name: Jane Driver
Phone: +9876543210
```

### Register Steps
1. Click "Create Account"
2. Fill in details above
3. Select role from dropdown
4. Click "Create Account"
5. Redirected to dashboard

## 🧪 Test Workflow #1: Request Delivery

### Time: ~2 minutes

**Browser 1: Customer Account**

1. Dashboard → Click "+ New Request"
2. **Step 1: Pickup Location**
   - Address: `123 Main Street, New York, NY`
   - Click "Use Current Location" (or enter manually)
     - Latitude: `40.7128`
     - Longitude: `-74.0060`
   - Click "Confirm Location"

3. **Step 2: Delivery Location**
   - Address: `456 Park Avenue, New York, NY`
   - Manual coordinates:
     - Latitude: `40.7580`
     - Longitude: `-73.9855`
   - Click "Confirm Location"

4. **Step 3: Package Details**
   - Description: `Important documents - confidential`
   - Weight: `2.5` kg
   - Priority: `NORMAL` (yellow)
   - Instructions: `Signature required`
   - Click "✓ Create Delivery"

5. **Result:** Redirected to dashboard
   - New delivery appears in list
   - Status: PENDING
   - Shows pickup and delivery addresses

## 🎯 Test Workflow #2: Accept & Track Delivery

### Time: ~3 minutes

**Browser 1: Keep Customer Logged In**

**Browser 2: Driver Account (Open in new window)**

1. Login as Driver (driver@test.com / TestPass123)
2. Dashboard → Click "+ Find Deliveries"
3. **Available Deliveries Page Should Show:**
   - The delivery you just created
   - Distance: Should show ~5km
   - Priority badge (NORMAL - yellow)
   - Pickup and delivery addresses
   - Customer phone number

4. Click "✓ Accept" button
   - Should show "Accepting..." then redirect

5. **After Accepting:**
   - Delivery removed from available list
   - Auto-redirected to delivery detail page

6. **On Delivery Detail Page:**
   - Status timeline shows: ✓ Accepted (highlighted in purple)
   - Driver name and phone visible to customer
   - "Mark as PICKED_UP" button available

7. **In Browser 1 (Customer):**
   - Refresh dashboard
   - Delivery now shows assigned driver
   - Status: ACCEPTED

## 📍 Test Workflow #3: Update Delivery Status

### Time: ~2 minutes

**Browser 2: Driver (Still on Delivery Detail)**

1. Click "✓ Mark as PICKED_UP"
   - Button shows loading state
   - Status updates to PICKED_UP
   - Timeline shows PICKED_UP as active

2. Click "✓ Mark as IN_TRANSIT"
   - Status updates to IN_TRANSIT
   - Timeline shows IN_TRANSIT as active
   - Driver location section appears (shows coordinates)

3. Click "✓ Mark as DELIVERED"
   - Status updates to DELIVERED
   - All timeline steps completed (green)
   - Button changes to "Delivery Completed" badge

**Browser 1 (Customer):**
- Refresh page to see real-time updates
- Timeline progresses as driver updates status

## 🗺️ Test Location Picker

### Time: ~1 minute

1. Customer → Request Delivery
2. **Step 1: Use Different Methods**

   **Method A: Get Current Location**
   - Click "📍 Use Current Location"
   - Browser requests permission
   - Click "Allow"
   - Coordinates auto-fill
   - Info badge shows "✓ Location set from GPS"

   **Method B: Manual Entry**
   - Enter Address: `789 Broadway, New York, NY`
   - Enter Latitude: `40.7489`
   - Enter Longitude: `-73.9680`
   - Click "✓ Confirm Location"

## 🔍 Test Filters & Sorting

### Time: ~2 minutes

**Create Multiple Test Deliveries** (as customer):
1. Create delivery 1: Priority URGENT
2. Create delivery 2: Priority HIGH
3. Create delivery 3: Priority NORMAL
4. Create delivery 4: Priority LOW

**Driver: Available Deliveries Page**

1. **Test Priority Filter:**
   - Default: All Priorities (shows 4 deliveries)
   - Select "URGENT" → shows 1 delivery
   - Select "HIGH" → shows 1 delivery
   - Select "ALL" → shows 4 deliveries

2. **Test Sorting:**
   - "Distance (Nearest First)" → sorts by distance
   - "Priority (Highest First)" → sorts URGENT first

## ❌ Test Error Handling

### Time: ~2 minutes

**Invalid Inputs:**

1. Request Delivery → Step 3
   - Leave description empty
   - Click "✓ Create Delivery"
   - Should show error: "Please describe the package"

2. Request Delivery → Step 1
   - Enter Latitude: `100` (out of range)
   - Should reject or show warning

3. Request Delivery → Step 1
   - Enter far distance (e.g., 5000km away)
   - Should show: "Delivery distance exceeds maximum"

## 📊 Check Backend Database (Optional)

```bash
# Connect to PostgreSQL
psql -U postgres -d delivery_db

# View users
SELECT id, email, role, full_name FROM users;

# View deliveries
SELECT id, customer_id, driver_id, status, priority FROM deliveries;

# View driver locations
SELECT driver_id, ST_AsText(location), timestamp FROM driver_locations;
```

## 🔄 Real-Time Testing (Advanced)

### Test WebSocket Updates

1. **Browser 1: Customer on Dashboard**
2. **Browser 2: Driver Accept Delivery**
3. Watch Browser 1:
   - Status updates without page refresh
   - Should show "ACCEPTED" almost immediately

4. **Browser 2: Driver Updates Status**
   - Change from ACCEPTED → PICKED_UP
5. **Browser 1: Watch Status Change**
   - Timeline updates in real-time
   - Last updated time changes

## 🐛 Troubleshooting

### Backend Won't Start
```bash
# Check database connection
psql -U postgres -c "SELECT 1;"

# Create database if missing
createdb delivery_db

# Check port 3000 is free
lsof -i :3000
```

### Frontend Won't Load
```bash
# Clear browser cache
# In browser DevTools: Application → Clear Site Data

# Or clear npm cache
npm cache clean --force
cd frontend
npm install
```

### Database Tables Not Created
```bash
# Manually create tables by accessing through backend
# Backend creates them on first run
# Check logs for: "✅ Deliveries table created"

# Or manually:
psql -d delivery_db << EOF
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
EOF
```

### Geolocation Not Working
- Check browser permissions (location)
- Restart browser
- Test with manual coordinates instead
- Use HTTPS in production (browsers require it for geolocation)

### WebSocket Not Connecting
- Check backend is running
- Check VITE_SOCKET_URL is correct
- Open DevTools Network tab
- Look for WebSocket connection in Network tab

## ✅ Checklist: Features to Test

### Authentication
- [ ] Register as customer
- [ ] Register as driver
- [ ] Login/logout
- [ ] Protected routes redirect to login
- [ ] Wrong password shows error

### Delivery Requests
- [ ] Create delivery with all details
- [ ] Get current location works
- [ ] Manual coordinates work
- [ ] Distance calculation works
- [ ] Can't exceed max distance
- [ ] Form validation works
- [ ] Success redirects to dashboard

### Available Deliveries
- [ ] Driver sees nearby deliveries
- [ ] Priority filter works
- [ ] Sort options work
- [ ] Accept button works
- [ ] Delivery removed after accept
- [ ] Redirected to detail page

### Delivery Tracking
- [ ] See delivery details
- [ ] Driver info visible to customer
- [ ] Customer info visible to driver
- [ ] Timeline shows progress
- [ ] Status update buttons work
- [ ] Timestamps update
- [ ] Real-time updates work

### Dashboard
- [ ] Shows correct deliveries by role
- [ ] Stats cards show correct counts
- [ ] Can click to view details
- [ ] Logout works
- [ ] New request button takes to correct page

### UI/UX
- [ ] All buttons are clickable
- [ ] Forms show error messages
- [ ] Loading states display
- [ ] Mobile responsive
- [ ] Tablet responsive
- [ ] No console errors
- [ ] No network errors

## 🎯 Expected Timings

| Test | Duration | Pass/Fail |
|------|----------|-----------|
| Register accounts | 2 min | ☐ |
| Create delivery | 2 min | ☐ |
| Accept delivery | 1 min | ☐ |
| Update statuses | 2 min | ☐ |
| Test filters | 2 min | ☐ |
| Test errors | 2 min | ☐ |
| **Total** | **~11 min** | ☐ |

---

**Pro Tips:**
- Open DevTools (F12) to watch console for errors
- Network tab shows API calls and WebSocket
- Use two browser windows side-by-side for better testing
- Test on mobile using browser DevTools device emulation
- Check database after each action to verify persistence

**Enjoy Testing! 🚀**
