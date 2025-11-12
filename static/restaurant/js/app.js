// Configuration
const API_BASE_URL = window.location.origin + '/api';
let authToken = localStorage.getItem('restaurantToken');
let currentRestaurantId = null;
let userRestaurants = [];

// DOM Elements
const loginPage = document.getElementById('loginPage');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const navItems = document.querySelectorAll('.nav-item');
const restaurantSelector = document.getElementById('restaurantSelector');

// Check authentication on page load
document.addEventListener('DOMContentLoaded', () => {
    if (authToken) {
        loadUserInfo();
        showDashboard();
    } else {
        showLoginPage();
    }

    // Setup event listeners
    loginForm.addEventListener('submit', handleLogin);
    logoutBtn.addEventListener('click', handleLogout);
    navItems.forEach(item => {
        item.addEventListener('click', handleNavigation);
    });

    // Restaurant selector
    restaurantSelector.addEventListener('change', (e) => {
        currentRestaurantId = e.target.value || null;
        loadDashboardData();
    });

    // Refresh buttons
    document.getElementById('refreshOrdersBtn').addEventListener('click', loadOrders);
    document.getElementById('refreshReviewsBtn').addEventListener('click', loadReviews);

    // Filter changes
    document.getElementById('orderStatusFilter').addEventListener('change', loadOrders);

    // Menu item modal
    const modal = document.getElementById('menuItemModal');
    const addBtn = document.getElementById('addMenuItemBtn');
    const closeBtn = modal.querySelector('.close');
    const cancelBtn = document.getElementById('cancelMenuItemBtn');

    addBtn.addEventListener('click', () => openMenuItemModal());
    closeBtn.addEventListener('click', () => modal.classList.remove('show'));
    cancelBtn.addEventListener('click', () => modal.classList.remove('show'));

    document.getElementById('menuItemForm').addEventListener('submit', handleMenuItemSubmit);
});

// Authentication
async function handleLogin(e) {
    e.preventDefault();
    const formData = new FormData(loginForm);

    try {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                username: formData.get('email'),
                password: formData.get('password')
            })
        });

        if (!response.ok) {
            throw new Error('Invalid credentials');
        }

        const data = await response.json();
        authToken = data.access_token;
        localStorage.setItem('restaurantToken', authToken);

        // Verify restaurant owner role
        const userInfo = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        }).then(r => r.json());

        if (userInfo.role !== 'restaurant_owner') {
            throw new Error('Access denied. Restaurant owner role required.');
        }

        loginError.textContent = '';
        loginError.classList.remove('show');
        showDashboard();
    } catch (error) {
        loginError.textContent = error.message;
        loginError.classList.add('show');
    }
}

function handleLogout() {
    authToken = null;
    localStorage.removeItem('restaurantToken');
    showLoginPage();
}

async function loadUserInfo() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const user = await response.json();
        document.getElementById('ownerName').textContent = user.full_name;
    } catch (error) {
        console.error('Failed to load user info:', error);
    }
}

// Navigation
function showLoginPage() {
    document.querySelector('.sidebar').style.display = 'none';
    loginPage.classList.add('active');
    document.querySelectorAll('.page:not(#loginPage)').forEach(page => {
        page.classList.remove('active');
    });
}

function showDashboard() {
    document.querySelector('.sidebar').style.display = 'flex';
    loginPage.classList.remove('active');
    showPage('dashboard');
}

function handleNavigation(e) {
    e.preventDefault();
    const page = e.currentTarget.dataset.page;

    navItems.forEach(item => item.classList.remove('active'));
    e.currentTarget.classList.add('active');

    showPage(page);
}

function showPage(pageName) {
    document.querySelectorAll('.page:not(#loginPage)').forEach(page => {
        page.classList.remove('active');
    });

    const page = document.getElementById(`${pageName}Page`);
    if (page) {
        page.classList.add('active');

        // Load data for the page
        switch(pageName) {
            case 'dashboard':
                loadDashboardData();
                break;
            case 'orders':
                loadOrders();
                break;
            case 'menu':
                loadMenuItems();
                break;
            case 'reviews':
                loadReviews();
                break;
            case 'profile':
                loadRestaurantProfile();
                break;
        }
    }
}

// API Calls
async function apiCall(endpoint, options = {}) {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
            ...options.headers
        }
    });

    if (response.status === 401) {
        handleLogout();
        throw new Error('Unauthorized');
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: response.statusText }));
        throw new Error(error.detail || 'API call failed');
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

// Dashboard
async function loadDashboardData() {
    try {
        const stats = await apiCall('/restaurant-dashboard/stats');

        // Update restaurants list
        userRestaurants = stats.restaurants;
        updateRestaurantSelector();

        // Update stats
        document.getElementById('totalOrders').textContent = stats.total_orders;
        document.getElementById('totalRevenue').textContent = `$${stats.total_revenue.toFixed(2)}`;
        document.getElementById('pendingOrders').textContent = stats.pending_orders;
        document.getElementById('averageRating').textContent = stats.average_rating.toFixed(1);

        document.getElementById('activeOrders').textContent = stats.active_orders;
        document.getElementById('completedOrders').textContent = stats.completed_orders;
        document.getElementById('totalMenuItems').textContent = stats.total_menu_items;
        document.getElementById('totalReviews').textContent = stats.total_reviews;

        document.getElementById('orders30d').textContent = stats.last_30_days.orders;
        document.getElementById('revenue30d').textContent = `$${stats.last_30_days.revenue.toFixed(2)}`;

        // Load specific restaurant stats if one is selected
        if (currentRestaurantId) {
            const restaurantStats = await apiCall(`/restaurant-dashboard/restaurants/${currentRestaurantId}/stats`);
            displayTopItems(restaurantStats.top_items);
        } else {
            document.getElementById('topItemsCard').style.display = 'none';
        }
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

function updateRestaurantSelector() {
    restaurantSelector.innerHTML = '<option value="">All Restaurants</option>';
    userRestaurants.forEach(restaurant => {
        const option = document.createElement('option');
        option.value = restaurant.id;
        option.textContent = restaurant.name + (restaurant.is_active ? '' : ' (Inactive)');
        restaurantSelector.appendChild(option);
    });
}

function displayTopItems(items) {
    const table = document.getElementById('topItemsTable');
    const card = document.getElementById('topItemsCard');

    if (!items || items.length === 0) {
        card.style.display = 'none';
        return;
    }

    card.style.display = 'block';
    table.innerHTML = '';

    items.forEach(item => {
        table.innerHTML += `
            <tr>
                <td>${item.name}</td>
                <td>${item.total_sold}</td>
                <td>$${item.revenue.toFixed(2)}</td>
            </tr>
        `;
    });
}

// Orders
async function loadOrders() {
    try {
        const statusFilter = document.getElementById('orderStatusFilter').value;
        let endpoint = '/restaurant-dashboard/orders?limit=50';

        if (statusFilter) {
            endpoint += `&status_filter=${statusFilter}`;
        }

        if (currentRestaurantId) {
            endpoint += `&restaurant_id=${currentRestaurantId}`;
        }

        const orders = await apiCall(endpoint);

        const table = document.getElementById('ordersTable');
        table.innerHTML = '';

        orders.forEach(order => {
            const date = new Date(order.created_at).toLocaleString();
            const itemsCount = order.order_items ? order.order_items.length : 0;

            table.innerHTML += `
                <tr>
                    <td>#${order.id}</td>
                    <td>${order.customer_id}</td>
                    <td><span class="status-badge ${order.status}">${formatStatus(order.status)}</span></td>
                    <td>$${order.total_amount.toFixed(2)}</td>
                    <td>${itemsCount} items</td>
                    <td>${date}</td>
                    <td>
                        ${getOrderActions(order)}
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Failed to load orders:', error);
    }
}

function getOrderActions(order) {
    const actions = [];

    if (order.status === 'pending') {
        actions.push(`<button class="btn btn-success btn-sm" onclick="updateOrderStatus(${order.id}, 'confirmed')">Confirm</button>`);
        actions.push(`<button class="btn btn-danger btn-sm" onclick="updateOrderStatus(${order.id}, 'cancelled')">Cancel</button>`);
    } else if (order.status === 'confirmed') {
        actions.push(`<button class="btn btn-primary btn-sm" onclick="updateOrderStatus(${order.id}, 'preparing')">Start Preparing</button>`);
    } else if (order.status === 'preparing') {
        actions.push(`<button class="btn btn-success btn-sm" onclick="updateOrderStatus(${order.id}, 'ready_for_pickup')">Mark Ready</button>`);
    }

    return actions.join(' ');
}

async function updateOrderStatus(orderId, newStatus) {
    try {
        await apiCall(`/orders/${orderId}`, {
            method: 'PUT',
            body: JSON.stringify({ status: newStatus })
        });
        loadOrders();
        loadDashboardData(); // Refresh stats
    } catch (error) {
        alert('Failed to update order: ' + error.message);
    }
}

// Menu Items
async function loadMenuItems() {
    try {
        let endpoint = '/restaurant-dashboard/menu-items';

        if (currentRestaurantId) {
            endpoint += `?restaurant_id=${currentRestaurantId}`;
        }

        const menuItems = await apiCall(endpoint);

        const table = document.getElementById('menuTable');
        table.innerHTML = '';

        menuItems.forEach(item => {
            const dietary = [];
            if (item.is_vegetarian) dietary.push('🥬 Veg');
            if (item.is_vegan) dietary.push('🌱 Vegan');

            table.innerHTML += `
                <tr>
                    <td>${item.id}</td>
                    <td>${item.name}</td>
                    <td>${item.category || 'N/A'}</td>
                    <td>$${item.price.toFixed(2)}</td>
                    <td><span class="status-badge ${item.is_available ? 'available' : 'unavailable'}">${item.is_available ? 'Available' : 'Unavailable'}</span></td>
                    <td>${dietary.join(' ') || '-'}</td>
                    <td>
                        <button class="btn btn-primary btn-sm" onclick="editMenuItem(${item.id})">Edit</button>
                        <button class="btn btn-danger btn-sm" onclick="deleteMenuItem(${item.id})">Delete</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Failed to load menu items:', error);
    }
}

function openMenuItemModal(itemId = null) {
    const modal = document.getElementById('menuItemModal');
    const form = document.getElementById('menuItemForm');
    const title = document.getElementById('menuItemModalTitle');

    form.reset();
    document.getElementById('menuItemId').value = '';

    // Set restaurant ID
    if (currentRestaurantId) {
        document.getElementById('menuItemRestaurantId').value = currentRestaurantId;
    } else if (userRestaurants.length > 0) {
        document.getElementById('menuItemRestaurantId').value = userRestaurants[0].id;
    }

    if (itemId) {
        title.textContent = 'Edit Menu Item';
        loadMenuItemData(itemId);
    } else {
        title.textContent = 'Add Menu Item';
    }

    modal.classList.add('show');
}

async function loadMenuItemData(itemId) {
    try {
        const item = await apiCall(`/menu-items/${itemId}`);

        document.getElementById('menuItemId').value = item.id;
        document.getElementById('menuItemRestaurantId').value = item.restaurant_id;
        document.getElementById('itemName').value = item.name;
        document.getElementById('itemDescription').value = item.description || '';
        document.getElementById('itemPrice').value = item.price;
        document.getElementById('itemCategory').value = item.category || '';
        document.getElementById('itemImageUrl').value = item.image_url || '';
        document.getElementById('itemAvailable').checked = item.is_available;
        document.getElementById('itemVegetarian').checked = item.is_vegetarian;
        document.getElementById('itemVegan').checked = item.is_vegan;
    } catch (error) {
        console.error('Failed to load menu item:', error);
    }
}

async function handleMenuItemSubmit(e) {
    e.preventDefault();

    const itemId = document.getElementById('menuItemId').value;
    const restaurantId = document.getElementById('menuItemRestaurantId').value;

    const data = {
        restaurant_id: parseInt(restaurantId),
        name: document.getElementById('itemName').value,
        description: document.getElementById('itemDescription').value || null,
        price: parseFloat(document.getElementById('itemPrice').value),
        category: document.getElementById('itemCategory').value || null,
        image_url: document.getElementById('itemImageUrl').value || null,
        is_available: document.getElementById('itemAvailable').checked,
        is_vegetarian: document.getElementById('itemVegetarian').checked,
        is_vegan: document.getElementById('itemVegan').checked
    };

    try {
        if (itemId) {
            // Update existing item
            await apiCall(`/menu-items/${itemId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
        } else {
            // Create new item
            await apiCall('/menu-items/', {
                method: 'POST',
                body: JSON.stringify(data)
            });
        }

        document.getElementById('menuItemModal').classList.remove('show');
        loadMenuItems();
        loadDashboardData(); // Refresh stats
    } catch (error) {
        alert('Failed to save menu item: ' + error.message);
    }
}

async function editMenuItem(itemId) {
    openMenuItemModal(itemId);
}

async function deleteMenuItem(itemId) {
    if (!confirm('Are you sure you want to delete this menu item?')) return;

    try {
        await apiCall(`/menu-items/${itemId}`, { method: 'DELETE' });
        loadMenuItems();
        loadDashboardData(); // Refresh stats
    } catch (error) {
        alert('Failed to delete menu item: ' + error.message);
    }
}

// Reviews
async function loadReviews() {
    try {
        let endpoint = '/restaurant-dashboard/reviews';

        if (currentRestaurantId) {
            endpoint += `?restaurant_id=${currentRestaurantId}`;
        }

        const reviews = await apiCall(endpoint);

        const container = document.getElementById('reviewsList');
        container.innerHTML = '';

        if (reviews.length === 0) {
            container.innerHTML = '<p class="loading">No reviews yet</p>';
            return;
        }

        reviews.forEach(review => {
            const date = new Date(review.created_at).toLocaleDateString();
            const stars = '⭐'.repeat(Math.round(review.rating));

            container.innerHTML += `
                <div class="review-item">
                    <div class="review-header">
                        <span class="review-rating">${stars} ${review.rating.toFixed(1)}</span>
                        <span class="review-date">${date}</span>
                    </div>
                    <div class="review-comment">${review.comment || 'No comment provided'}</div>
                </div>
            `;
        });
    } catch (error) {
        console.error('Failed to load reviews:', error);
    }
}

// Restaurant Profile
async function loadRestaurantProfile() {
    try {
        const restaurants = await apiCall('/restaurants/');

        const container = document.getElementById('restaurantsList');
        container.innerHTML = '';

        if (restaurants.length === 0) {
            container.innerHTML = '<p class="loading">No restaurants found</p>';
            return;
        }

        restaurants.forEach(restaurant => {
            container.innerHTML += `
                <div class="restaurant-card">
                    <div class="restaurant-header">
                        <h3 class="restaurant-name">${restaurant.name}</h3>
                        <span class="status-badge ${restaurant.is_active ? 'available' : 'unavailable'}">
                            ${restaurant.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <div class="restaurant-details">
                        <div class="detail-item">
                            <span class="detail-label">Cuisine</span>
                            <span class="detail-value">${restaurant.cuisine_type || 'N/A'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Rating</span>
                            <span class="detail-value">⭐ ${restaurant.average_rating.toFixed(1)} (${restaurant.total_reviews} reviews)</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Delivery Fee</span>
                            <span class="detail-value">$${restaurant.delivery_fee.toFixed(2)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Minimum Order</span>
                            <span class="detail-value">$${restaurant.minimum_order.toFixed(2)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Delivery Time</span>
                            <span class="detail-value">${restaurant.estimated_delivery_time} mins</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Address</span>
                            <span class="detail-value">${restaurant.address}</span>
                        </div>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error('Failed to load restaurant profile:', error);
    }
}

// Utility Functions
function formatStatus(status) {
    return status
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
