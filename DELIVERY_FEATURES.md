# Delivery Features Documentation

Comprehensive guide for the delivery request, available deliveries, and delivery tracking features.

## 🎯 Overview

This implementation adds three main features to the delivery platform:

1. **Request Delivery Page** - Customers create new delivery requests
2. **Available Deliveries Page** - Drivers browse and accept nearby deliveries
3. **Delivery Detail/Tracking Page** - Real-time tracking and status management

## 📱 Customer Workflow: Request Delivery

### Route: `/request-delivery` (Protected - Customer Only)

### Page: RequestDeliveryPage

A multi-step form for customers to create delivery requests.

#### Step 1: Pickup Location
- Address input field
- Manual latitude/longitude entry
- "Get Current Location" button using browser geolocation API
- Location confirmation

**LocationPicker Component:**
```jsx
<LocationPicker
  onLocationSelect={handlePickupLocation}
  label="Where are we picking up from?"
/>
```

#### Step 2: Delivery Location
- Same location picker interface as Step 1
- "Back to Pickup" button to return to previous step
- Location confirmation

#### Step 3: Package Details
- Package description (required textarea)
- Package weight in kg (optional)
- Priority level dropdown:
  - 🟢 LOW (Standard)
  - 🟡 NORMAL (Regular) - Default
  - 🟠 HIGH (Faster)
  - 🔴 URGENT (Fastest)
- Special instructions (optional textarea)
- Location summary showing pickup and delivery addresses
- Submit button

### Features

**Progress Bar:**
- Visual indicator of current step (1/2/3)
- Completed steps highlighted in purple gradient
- Step labels and progress lines

**Validation:**
- Pickup address required
- Delivery address required
- Package description required (non-empty)
- Coordinates validation (latitude -90 to 90, longitude -180 to 180)
- Distance calculation using geolib
- Maximum delivery distance check (default 50km)

**User Experience:**
- Smooth step transitions with animations
- Back button on each step
- Error messages on validation failure
- Loading state during submission
- Success redirect to dashboard

### API Integration

```javascript
POST /api/deliveries
{
  "pickup_address": "123 Main St",
  "pickup_latitude": 40.7128,
  "pickup_longitude": -74.0060,
  "delivery_address": "456 Park Ave",
  "delivery_latitude": 40.7580,
  "delivery_longitude": -73.9855,
  "package_description": "Important documents",
  "package_weight": 2.5,
  "priority": "NORMAL",
  "special_instructions": "Handle with care"
}
```

## 🚗 Driver Workflow: Accept Deliveries

### Route: `/available-deliveries` (Protected - Driver Only)

### Page: AvailableDeliveriesPage

Displays available nearby deliveries for drivers to accept.

### Features

**Location-Based Discovery:**
- Automatic geolocation detection on page load
- Distance calculation for each delivery
- Sorts by proximity by default
- Maximum search radius: 50km (configurable)

**Filtering & Sorting:**
- Filter by Priority:
  - All Priorities (default)
  - 🔴 URGENT
  - 🟠 HIGH
  - 🟡 NORMAL
  - 🟢 LOW
- Sort options:
  - Distance (Nearest First) - default
  - Priority (Highest First)

**Delivery Cards:**
- Pickup address and location
- Distance from driver in km
- Delivery address
- Package details
- Package weight (if available)
- Special instructions (if available)
- Priority badge with color coding
- Customer phone number
- "Accept" button

**Real-Time Updates:**
- Refresh button to check for new deliveries
- Auto-removal of accepted deliveries from list
- Real-time location updates via WebSocket

### Responsive Design

**Desktop:**
- Grid layout with 3 columns
- Wide filter section

**Tablet:**
- Grid layout with 2 columns
- Flexible filters

**Mobile:**
- Single column layout
- Stacked filters
- Full-width accept button

### Accept Flow

1. Driver clicks "Accept" button
2. Delivery status updated to ACCEPTED in database
3. Driver ID assigned to delivery
4. WebSocket event broadcasts status change
5. Delivery removed from available list
6. Driver navigated to delivery detail page

### API Integration

```javascript
GET /api/drivers/available
Query Params:
  - latitude (required): driver's current latitude
  - longitude (required): driver's current longitude
  - limit (optional): max results (default 50)
  - priority (optional): filter by priority

PUT /api/deliveries/{deliveryId}/status
Body:
  - status: "ACCEPTED"
```

## 🗺️ Delivery Tracking & Status Management

### Route: `/delivery/:id` (Protected - Customer & Driver)

### Page: DeliveryDetailPage

Real-time delivery tracking and status management.

### Timeline Visualization

Visual progression through delivery stages:
```
⏳ Requested → ✓ Accepted → 📦 Picked Up → 🚗 In Transit → ✓✓ Delivered
```

- Current step highlighted with animation
- Completed steps in green
- Future steps grayed out
- Timeline responsive on mobile

### Left Column: Delivery Information

#### Locations Section
- Pickup address
- Pickup coordinates
- Delivery address
- Delivery coordinates
- Visual divider showing direction

#### Package Details Section
- Package description
- Package weight (if provided)
- Priority level (color-coded badge)
- Special instructions (if provided)

#### Contact Information Section
- **For Drivers:** Customer name and phone
- **For Customers:** Driver name and phone (if accepted)
- Waiting message for customers (if no driver assigned yet)

### Right Column: Status & Actions

#### Status Card
- Large status icon (⏳/✓/📦/🚗/✓✓)
- Current status in large text
- Last update timestamp
- Gradient purple background

#### Driver Location (Customer View Only)
- Shows when delivery is in transit
- Latitude and longitude coordinates
- Current speed (if available)
- Real-time updates via WebSocket

#### Timing Information
- Request time
- Estimated delivery time
- Actual delivery time (after delivered)

#### Action Button (Driver Only)
- Visible only to assigned driver
- Updates status to next stage:
  - PENDING → "Mark as ACCEPTED"
  - ACCEPTED → "Mark as PICKED_UP"
  - PICKED_UP → "Mark as IN_TRANSIT"
  - IN_TRANSIT → "Mark as DELIVERED"
- Disabled after completion
- Shows loading state during update

### Status Workflow

```
Customer Creates Request
  ↓
Status: PENDING
  ↓
Driver Accepts
  ↓
Status: ACCEPTED
  ↓
Driver Marks as Picked Up
  ↓
Status: PICKED_UP
  ↓
Driver Marks as In Transit
  ↓
Status: IN_TRANSIT
  ↓
Driver Marks as Delivered
  ↓
Status: DELIVERED ✓ (Completed)
```

### Real-Time Features

**WebSocket Integration:**
- Listen for `delivery:status:changed` events
- Update status and timestamp in real-time
- Listen for `driver:location:update` events
- Display current driver location for customers

**Room-Based Tracking:**
- Join delivery room: `socket.emit('join:delivery', deliveryId)`
- Receive targeted updates for specific delivery
- Leave room when navigating away

### API Integration

```javascript
GET /api/deliveries/{deliveryId}
Response includes:
  - delivery details
  - customer and driver info
  - all timestamps
  - location coordinates

PUT /api/deliveries/{deliveryId}/status
Body:
  - status: next status value

Emit WebSocket:
socket.emit('delivery:status:update', {
  deliveryId,
  status,
  driverId
})

Listen WebSocket:
socket.on('delivery:status:changed', (data) => {
  // Update UI with new status
})
```

## 🎨 Styling & Responsive Design

### Color Scheme

**Gradients:**
- Primary: Purple to Blue (`#667eea` to `#764ba2`)
- Background: Light gray (`#f5f6fa`)

**Priority Colors:**
- Urgent: Red (`#c62828`)
- High: Orange (`#e65100`)
- Normal: Purple (`#7b1fa2`)
- Low: Blue (`#1976d2`)

**Status Colors:**
- Pending: Yellow (`#ffc107`)
- Accepted: Blue (`#2196f3`)
- In Transit: Green (`#4caf50`)
- Delivered: Green (`#4caf50`)
- Cancelled: Red (`#f44336`)

### Breakpoints

- **Desktop:** 1000px+ (full layout)
- **Tablet:** 768px - 999px (adjusted grid)
- **Mobile:** < 768px (single column)
- **Small Mobile:** < 480px (minimal layout)

## 🔌 Location Picker Component

Reusable component for selecting delivery locations.

### Props

```jsx
<LocationPicker
  onLocationSelect={(location) => {
    // {address, latitude, longitude}
  }}
  label="Select Location"
/>
```

### Features

- Address input (required)
- Latitude input (number, optional manual entry)
- Longitude input (number, optional manual entry)
- Get Current Location button
  - Uses browser Geolocation API
  - Requests user permission
  - Auto-fills coordinates
  - Shows location info badge
- Confirm Location button
- Error messages for validation

## 📊 Data Flow

### Creating a Delivery

```
Customer fills form
  ↓
Validates inputs
  ↓
Calculates distance (pickup to delivery)
  ↓
Checks max distance limit
  ↓
POST /api/deliveries
  ↓
Backend creates delivery with PENDING status
  ↓
WebSocket broadcasts to drivers
  ↓
Delivery appears in available list
```

### Accepting a Delivery

```
Driver clicks Accept
  ↓
PUT /api/deliveries/{id}/status (ACCEPTED)
  ↓
Backend updates delivery, assigns driver
  ↓
WebSocket broadcasts status change
  ↓
Customer notified of acceptance
  ↓
Driver navigated to delivery detail
```

### Updating Status

```
Driver clicks "Mark as [STATUS]"
  ↓
PUT /api/deliveries/{id}/status
  ↓
Backend updates status
  ↓
WebSocket broadcasts to delivery room
  ↓
All parties notified of update
  ↓
UI updates timestamp and timeline
```

## 🧪 Testing the Features

### Test Scenario 1: Create and Track Delivery

1. Open application in two browsers
2. Login as customer in browser 1
3. Login as driver in browser 2
4. Customer: Click "Request Delivery"
5. Customer: Fill in pickup location (use current location)
6. Customer: Fill in delivery location
7. Customer: Fill in package details
8. Customer: Submit
9. Driver: Go to "Available Deliveries"
10. Driver: Should see newly created delivery
11. Driver: Click "Accept"
12. Customer: Refresh dashboard
13. Delivery should show driver assigned
14. Driver: Open delivery detail
15. Driver: Click "Mark as PICKED_UP", "Mark as IN_TRANSIT", "Mark as DELIVERED"
16. Customer: See real-time status updates
17. Delivery timeline should progress through all stages

### Test Scenario 2: Location Functionality

1. Customer: Open Request Delivery
2. Customer: Click "Get Current Location"
3. Browser should request location permission
4. Location coordinates should auto-fill
5. Verify coordinates are in valid range
6. Submit with valid locations

### Test Scenario 3: Filtering & Sorting

1. Driver: Open Available Deliveries
2. Driver: Create multiple deliveries from customer account
3. Driver: Filter by different priority levels
4. Driver: Sort by distance vs priority
5. Verify list updates correctly

### Test Scenario 4: Error Handling

1. Test with invalid coordinates
2. Test with too far delivery distance
3. Test with missing required fields
4. Test with network error (turn off backend)
5. Verify error messages display

## 📈 Performance Considerations

- Location picker uses browser geolocation (minimal latency)
- Available deliveries loaded on page load
- Pagination/limit prevents loading too many results (default 50)
- Real-time updates via WebSocket for efficiency
- Responsive images and lazy loading
- CSS animations use GPU acceleration (transform, opacity)

## 🔒 Security

- All routes protected with authentication
- Role-based access control (customer/driver)
- User can only update own deliveries
- Driver authorization checked before status updates
- Location data validated on backend
- XSS protection through React
- CSRF protection via same-origin requests

## 🐛 Known Issues & Future Improvements

- [ ] Add map component for visual location selection
- [ ] Add delivery cost calculation
- [ ] Add estimated delivery time calculation
- [ ] Add batch delivery operations
- [ ] Add delivery photo capture
- [ ] Add customer ratings/reviews
- [ ] Add delivery history page
- [ ] Add support for multiple delivery recipients
- [ ] Add delivery notifications/alerts
- [ ] Add geofencing for automatic status updates

---

**Last Updated:** November 2024
**Version:** 1.1.0
