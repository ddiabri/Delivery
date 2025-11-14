import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import '../styles/adminUsers.css';

export default function AdminUsersPage() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    total: 0,
  });
  const [deactivatingId, setDeactivatingId] = useState(null);

  useEffect(() => {
    fetchUsers();
  }, [roleFilter, searchQuery, pagination.offset]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getAllUsers({
        role: roleFilter || undefined,
        search: searchQuery || undefined,
        limit: pagination.limit,
        offset: pagination.offset,
      });

      setUsers(response.data.data || []);
      setPagination({
        ...pagination,
        total: response.data.pagination?.total || 0,
      });
      setError('');
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateUser = async (userId) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) {
      return;
    }

    setDeactivatingId(userId);
    try {
      await adminAPI.deactivateUser(userId);
      // Refresh users list
      fetchUsers();
      setError('');
    } catch (err) {
      setError('Failed to deactivate user');
    } finally {
      setDeactivatingId(null);
    }
  };

  const handleRoleFilterChange = (e) => {
    setRoleFilter(e.target.value);
    setPagination({ ...pagination, offset: 0 });
  };

  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setPagination({ ...pagination, offset: 0 });
  };

  const hasMore = pagination.offset + pagination.limit < pagination.total;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const getRoleColor = (role) => {
    const colors = {
      customer: '#667eea',
      driver: '#764ba2',
      admin: '#f44336',
    };
    return colors[role] || '#999';
  };

  return (
    <div className="admin-users-page">
      <header className="admin-header">
        <div className="header-content">
          <button
            className="btn-back"
            onClick={() => navigate('/admin')}
          >
            ← Back
          </button>
          <div>
            <h1>User Management</h1>
            <p>View and manage platform users</p>
          </div>
        </div>
      </header>

      <div className="admin-container">
        {error && <div className="error-message">{error}</div>}

        {/* Filters */}
        <section className="filters-section">
          <div className="filter-group">
            <label>Role</label>
            <select value={roleFilter} onChange={handleRoleFilterChange}>
              <option value="">All Roles</option>
              <option value="customer">Customer</option>
              <option value="driver">Driver</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Search</label>
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={handleSearchChange}
            />
          </div>

          <div className="filter-stats">
            <span>Total: {pagination.total}</span>
            <span>Page {currentPage} of {totalPages}</span>
          </div>
        </section>

        {/* Users Table */}
        <section className="users-section">
          {loading ? (
            <div className="loading">Loading users...</div>
          ) : users.length === 0 ? (
            <div className="empty-state">
              <p>No users found</p>
            </div>
          ) : (
            <>
              <div className="users-table-wrapper">
                <table className="users-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Role</th>
                      <th>Phone</th>
                      <th>Status</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="name-cell">
                          <div className="user-avatar">
                            {user.full_name.charAt(0).toUpperCase()}
                          </div>
                          {user.full_name}
                        </td>
                        <td>{user.email}</td>
                        <td>
                          <span
                            className="role-badge"
                            style={{ backgroundColor: getRoleColor(user.role) }}
                          >
                            {user.role}
                          </span>
                        </td>
                        <td>{user.phone || '-'}</td>
                        <td>
                          <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>{new Date(user.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="actions">
                            {user.is_active && (
                              <button
                                className="btn-action btn-deactivate"
                                onClick={() => handleDeactivateUser(user.id)}
                                disabled={deactivatingId === user.id}
                                title="Deactivate user"
                              >
                                {deactivatingId === user.id ? '...' : '✕'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="pagination">
                <button
                  className="btn-pagination"
                  onClick={() =>
                    setPagination({
                      ...pagination,
                      offset: Math.max(0, pagination.offset - pagination.limit),
                    })
                  }
                  disabled={pagination.offset === 0}
                >
                  ← Previous
                </button>

                <span className="page-info">
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  className="btn-pagination"
                  onClick={() =>
                    setPagination({
                      ...pagination,
                      offset: pagination.offset + pagination.limit,
                    })
                  }
                  disabled={!hasMore}
                >
                  Next →
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
