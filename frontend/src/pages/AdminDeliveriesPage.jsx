import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { adminAPI } from '../services/api';
import '../styles/adminDeliveries.css';

export default function AdminDeliveriesPage() {
  const navigate = useNavigate();
  const [deliveries, setDeliveries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [pagination, setPagination] = useState({
    limit: 20,
    offset: 0,
    total: 0,
  });
  const [cancelingId, setCancelingId] = useState(null);

  useEffect(() => {
    fetchDeliveries();
  }, [statusFilter, priorityFilter, pagination.offset]);

  const fetchDeliveries = async () => {
    setLoading(true);
    try {
      const response = await adminAPI.getAllDeliveries({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
        limit: pagination.limit,
        offset: pagination.offset,
      });

      setDeliveries(response.data.data || []);
      setPagination({
        ...pagination,
        total: response.data.pagination?.total || 0,
      });
      setError('');
    } catch (err) {
      console.error('Failed to fetch deliveries:', err);
      setError('Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelDelivery = async (deliveryId) => {
    if (!window.confirm('Are you sure you want to cancel this delivery?')) {
      return;
    }

    setCancelingId(deliveryId);
    try {
      await adminAPI.cancelDelivery(deliveryId, { reason: 'Cancelled by admin' });
      fetchDeliveries();
      setError('');
    } catch (err) {
      setError('Failed to cancel delivery');
    } finally {
      setCancelingId(null);
    }
  };

  const handleStatusFilterChange = (e) => {
    setStatusFilter(e.target.value);
    setPagination({ ...pagination, offset: 0 });
  };

  const handlePriorityFilterChange = (e) => {
    setPriorityFilter(e.target.value);
    setPagination({ ...pagination, offset: 0 });
  };

  const hasMore = pagination.offset + pagination.limit < pagination.total;
  const currentPage = Math.floor(pagination.offset / pagination.limit) + 1;
  const totalPages = Math.ceil(pagination.total / pagination.limit);

  const getStatusColor = (status) => {
    const colors = {
      PENDING: '#ffc107',
      ACCEPTED: '#2196f3',
      PICKED_UP: '#2196f3',
      IN_TRANSIT: '#4caf50',
      DELIVERED: '#4caf50',
      CANCELLED: '#f44336',
    };
    return colors[status] || '#999';
  };

  const getPriorityColor = (priority) => {
    const colors = {
      LOW: '#4caf50',
      NORMAL: '#2196f3',
      HIGH: '#ff9800',
      URGENT: '#f44336',
    };
    return colors[priority] || '#999';
  };

  return (
    <div className="admin-deliveries-page">
      <header className="admin-header">
        <div className="header-content">
          <button
            className="btn-back"
            onClick={() => navigate('/admin')}
          >
            ← Back
          </button>
          <div>
            <h1>Delivery Management</h1>
            <p>View and manage all deliveries</p>
          </div>
        </div>
      </header>

      <div className="admin-container">
        {error && <div className="error-message">{error}</div>}

        {/* Filters */}
        <section className="filters-section">
          <div className="filter-group">
            <label>Status</label>
            <select value={statusFilter} onChange={handleStatusFilterChange}>
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="ACCEPTED">Accepted</option>
              <option value="PICKED_UP">Picked Up</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="DELIVERED">Delivered</option>
              <option value="CANCELLED">Cancelled</option>
            </select>
          </div>

          <div className="filter-group">
            <label>Priority</label>
            <select value={priorityFilter} onChange={handlePriorityFilterChange}>
              <option value="">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>

          <div className="filter-stats">
            <span>Total: {pagination.total}</span>
            <span>Page {currentPage} of {totalPages}</span>
          </div>
        </section>

        {/* Deliveries Table */}
        <section className="deliveries-section">
          {loading ? (
            <div className="loading">Loading deliveries...</div>
          ) : deliveries.length === 0 ? (
            <div className="empty-state">
              <p>No deliveries found</p>
            </div>
          ) : (
            <>
              <div className="deliveries-table-wrapper">
                <table className="deliveries-table">
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>Customer</th>
                      <th>Driver</th>
                      <th>Pickup → Delivery</th>
                      <th>Status</th>
                      <th>Priority</th>
                      <th>Created</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deliveries.map((delivery) => (
                      <tr key={delivery.id}>
                        <td className="id-cell">
                          <code>{delivery.id.substring(0, 8)}</code>
                        </td>
                        <td className="name-cell">{delivery.customer_name}</td>
                        <td className="name-cell">{delivery.driver_name || '-'}</td>
                        <td className="address-cell">
                          <div className="address-info">
                            <small>📍 {delivery.pickup_address.substring(0, 30)}...</small>
                            <small className="arrow">→</small>
                            <small>📍 {delivery.delivery_address.substring(0, 30)}...</small>
                          </div>
                        </td>
                        <td>
                          <span
                            className="status-badge"
                            style={{ backgroundColor: getStatusColor(delivery.status) }}
                          >
                            {delivery.status}
                          </span>
                        </td>
                        <td>
                          <span
                            className="priority-badge"
                            style={{ backgroundColor: getPriorityColor(delivery.priority) }}
                          >
                            {delivery.priority}
                          </span>
                        </td>
                        <td>{new Date(delivery.created_at).toLocaleDateString()}</td>
                        <td>
                          <div className="actions">
                            <button
                              className="btn-view"
                              onClick={() => navigate(`/delivery/${delivery.id}`)}
                              title="View details"
                            >
                              👁
                            </button>
                            {!['DELIVERED', 'CANCELLED'].includes(delivery.status) && (
                              <button
                                className="btn-cancel"
                                onClick={() => handleCancelDelivery(delivery.id)}
                                disabled={cancelingId === delivery.id}
                                title="Cancel delivery"
                              >
                                {cancelingId === delivery.id ? '...' : '✕'}
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
