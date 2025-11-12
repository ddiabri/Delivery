// Configuration
const API_BASE_URL = window.location.origin + '/api';
let authToken = localStorage.getItem('adminToken');

// DOM Elements
const loginPage = document.getElementById('loginPage');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const navItems = document.querySelectorAll('.nav-item');

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

    // Refresh buttons
    document.getElementById('refreshUsersBtn').addEventListener('click', loadUsers);
    document.getElementById('refreshRestaurantsBtn').addEventListener('click', loadRestaurants);
    document.getElementById('refreshOrdersBtn').addEventListener('click', loadOrders);
    document.getElementById('refreshReviewsBtn').addEventListener('click', loadReviews);

    // Filter changes
    document.getElementById('userRoleFilter').addEventListener('change', loadUsers);
    document.getElementById('restaurantStatusFilter').addEventListener('change', loadRestaurants);
    document.getElementById('orderStatusFilter').addEventListener('change', loadOrders);
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
        localStorage.setItem('adminToken', authToken);

        // Verify admin role
        const userInfo = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        }).then(r => r.json());

        if (userInfo.role !== 'admin') {
            throw new Error('Access denied. Admin role required.');
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
    localStorage.removeItem('adminToken');
    showLoginPage();
}

async function loadUserInfo() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        const user = await response.json();
        document.getElementById('adminName').textContent = user.full_name;
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
    loadDashboardData();
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
            case 'users':
                loadUsers();
                break;
            case 'restaurants':
                loadRestaurants();
                break;
            case 'orders':
                loadOrders();
                break;
            case 'reviews':
                loadReviews();
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
        throw new Error(`API call failed: ${response.statusText}`);
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

// Dashboard
async function loadDashboardData() {
    try {
        const stats = await apiCall('/admin/stats/overview');

        // Update totals
        document.getElementById('totalUsers').textContent = stats.totals.users;
        document.getElementById('totalRestaurants').textContent = stats.totals.restaurants;
        document.getElementById('totalOrders').textContent = stats.totals.orders;
        document.getElementById('totalRevenue').textContent = `$${stats.totals.revenue.toFixed(2)}`;

        // Update 30 day stats
        document.getElementById('newUsers30d').textContent = stats.last_30_days.new_users;
        document.getElementById('newOrders30d').textContent = stats.last_30_days.new_orders;
        document.getElementById('revenue30d').textContent = `$${stats.last_30_days.revenue.toFixed(2)}`;

        // Orders by status
        const statusContainer = document.getElementById('ordersByStatus');
        statusContainer.innerHTML = '';
        Object.entries(stats.orders_by_status).forEach(([status, count]) => {
            statusContainer.innerHTML += `
                <div class="status-item">
                    <span>${formatStatus(status)}</span>
                    <strong>${count}</strong>
                </div>
            `;
        });

        // Top restaurants
        const topRestaurantsTable = document.getElementById('topRestaurants');
        topRestaurantsTable.innerHTML = '';
        stats.top_restaurants.forEach(restaurant => {
            topRestaurantsTable.innerHTML += `
                <tr>
                    <td>${restaurant.name}</td>
                    <td>${restaurant.order_count}</td>
                    <td>$${restaurant.revenue.toFixed(2)}</td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Failed to load dashboard data:', error);
    }
}

// Users
async function loadUsers() {
    try {
        const roleFilter = document.getElementById('userRoleFilter').value;
        const endpoint = roleFilter ? `/admin/users?role=${roleFilter}` : '/admin/users';
        const users = await apiCall(endpoint);

        const table = document.getElementById('usersTable');
        table.innerHTML = '';

        users.forEach(user => {
            table.innerHTML += `
                <tr>
                    <td>${user.id}</td>
                    <td>${user.full_name}</td>
                    <td>${user.email}</td>
                    <td><span class="status-badge">${user.role}</span></td>
                    <td>${user.phone || 'N/A'}</td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="deleteUser(${user.id})">Delete</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Failed to load users:', error);
    }
}

async function deleteUser(userId) {
    if (!confirm('Are you sure you want to delete this user?')) return;

    try {
        await apiCall(`/admin/users/${userId}`, { method: 'DELETE' });
        loadUsers();
    } catch (error) {
        alert('Failed to delete user: ' + error.message);
    }
}

// Restaurants
async function loadRestaurants() {
    try {
        const statusFilter = document.getElementById('restaurantStatusFilter').value;
        const endpoint = statusFilter ? `/admin/restaurants?is_active=${statusFilter}` : '/admin/restaurants';
        const restaurants = await apiCall(endpoint);

        const table = document.getElementById('restaurantsTable');
        table.innerHTML = '';

        restaurants.forEach(restaurant => {
            table.innerHTML += `
                <tr>
                    <td>${restaurant.id}</td>
                    <td>${restaurant.name}</td>
                    <td>${restaurant.cuisine_type || 'N/A'}</td>
                    <td>⭐ ${restaurant.average_rating.toFixed(1)} (${restaurant.total_reviews})</td>
                    <td><span class="status-badge ${restaurant.is_active ? 'active' : 'inactive'}">${restaurant.is_active ? 'Active' : 'Inactive'}</span></td>
                    <td>
                        <button class="btn btn-${restaurant.is_active ? 'warning' : 'success'} btn-sm" onclick="toggleRestaurant(${restaurant.id})">
                            ${restaurant.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                        <button class="btn btn-danger btn-sm" onclick="deleteRestaurant(${restaurant.id})">Delete</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Failed to load restaurants:', error);
    }
}

async function toggleRestaurant(restaurantId) {
    try {
        await apiCall(`/admin/restaurants/${restaurantId}/toggle-active`, { method: 'PUT' });
        loadRestaurants();
    } catch (error) {
        alert('Failed to toggle restaurant status: ' + error.message);
    }
}

async function deleteRestaurant(restaurantId) {
    if (!confirm('Are you sure you want to delete this restaurant?')) return;

    try {
        await apiCall(`/admin/restaurants/${restaurantId}`, { method: 'DELETE' });
        loadRestaurants();
    } catch (error) {
        alert('Failed to delete restaurant: ' + error.message);
    }
}

// Orders
async function loadOrders() {
    try {
        const statusFilter = document.getElementById('orderStatusFilter').value;
        const endpoint = statusFilter ? `/admin/orders?status_filter=${statusFilter}` : '/admin/orders';
        const orders = await apiCall(endpoint);

        const table = document.getElementById('ordersTable');
        table.innerHTML = '';

        orders.forEach(order => {
            const date = new Date(order.created_at).toLocaleDateString();
            table.innerHTML += `
                <tr>
                    <td>#${order.id}</td>
                    <td>${order.customer_id}</td>
                    <td>${order.restaurant_id}</td>
                    <td><span class="status-badge ${order.status}">${formatStatus(order.status)}</span></td>
                    <td>$${order.total_amount.toFixed(2)}</td>
                    <td>${date}</td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="deleteOrder(${order.id})">Delete</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Failed to load orders:', error);
    }
}

async function deleteOrder(orderId) {
    if (!confirm('Are you sure you want to delete this order?')) return;

    try {
        await apiCall(`/admin/orders/${orderId}`, { method: 'DELETE' });
        loadOrders();
    } catch (error) {
        alert('Failed to delete order: ' + error.message);
    }
}

// Reviews
async function loadReviews() {
    try {
        const reviews = await apiCall('/admin/reviews');

        const table = document.getElementById('reviewsTable');
        table.innerHTML = '';

        reviews.forEach(review => {
            const date = new Date(review.created_at).toLocaleDateString();
            table.innerHTML += `
                <tr>
                    <td>${review.id}</td>
                    <td>${review.user_id}</td>
                    <td>${review.restaurant_id}</td>
                    <td>⭐ ${review.rating.toFixed(1)}</td>
                    <td>${review.comment ? review.comment.substring(0, 50) + '...' : 'No comment'}</td>
                    <td>${date}</td>
                    <td>
                        <button class="btn btn-danger btn-sm" onclick="deleteReview(${review.id})">Delete</button>
                    </td>
                </tr>
            `;
        });
    } catch (error) {
        console.error('Failed to load reviews:', error);
    }
}

async function deleteReview(reviewId) {
    if (!confirm('Are you sure you want to delete this review?')) return;

    try {
        await apiCall(`/admin/reviews/${reviewId}`, { method: 'DELETE' });
        loadReviews();
    } catch (error) {
        alert('Failed to delete review: ' + error.message);
    }
}

// Utility Functions
function formatStatus(status) {
    return status
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}
