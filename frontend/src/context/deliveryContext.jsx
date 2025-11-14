import React, { createContext, useContext, useState, useCallback } from 'react';
import { deliveryAPI, getSocket } from '../services/api';

const DeliveryContext = createContext(null);

export const DeliveryProvider = ({ children }) => {
  const [deliveries, setDeliveries] = useState([]);
  const [currentDelivery, setCurrentDelivery] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const socket = getSocket();

  // Listen for real-time delivery updates
  React.useEffect(() => {
    socket?.on('delivery:status:changed', (data) => {
      setDeliveries((prev) =>
        prev.map((d) =>
          d.id === data.deliveryId
            ? { ...d, status: data.status, updated_at: data.timestamp }
            : d
        )
      );

      if (currentDelivery?.id === data.deliveryId) {
        setCurrentDelivery((prev) => ({
          ...prev,
          status: data.status,
          updated_at: data.timestamp,
        }));
      }
    });

    return () => {
      socket?.off('delivery:status:changed');
    };
  }, [socket, currentDelivery?.id]);

  const createDelivery = useCallback(async (data) => {
    try {
      setError(null);
      setLoading(true);
      const response = await deliveryAPI.createDelivery(data);
      const newDelivery = response.data.delivery;

      setDeliveries((prev) => [newDelivery, ...prev]);
      return newDelivery;
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to create delivery';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDeliveries = useCallback(async (filters = {}) => {
    try {
      setError(null);
      setLoading(true);
      const response = await deliveryAPI.getDeliveries(filters);
      setDeliveries(response.data.data);
      return response.data;
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to fetch deliveries';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDeliveryById = useCallback(async (id) => {
    try {
      setError(null);
      setLoading(true);
      const response = await deliveryAPI.getDeliveryById(id);
      setCurrentDelivery(response.data.delivery);

      // Join delivery room for real-time updates
      socket?.emit('join:delivery', id);

      return response.data.delivery;
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to fetch delivery';
      setError(errorMsg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [socket]);

  const updateDeliveryStatus = useCallback(async (id, status) => {
    try {
      setError(null);
      const response = await deliveryAPI.updateDeliveryStatus(id, status);
      const updated = response.data.delivery;

      setDeliveries((prev) =>
        prev.map((d) => (d.id === id ? { ...d, status: updated.status } : d))
      );

      if (currentDelivery?.id === id) {
        setCurrentDelivery((prev) => ({ ...prev, status: updated.status }));
      }

      return updated;
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Failed to update delivery';
      setError(errorMsg);
      throw err;
    }
  }, [currentDelivery?.id]);

  const leaveDelivery = useCallback((id) => {
    socket?.emit('leave:delivery', id);
    setCurrentDelivery(null);
  }, [socket]);

  const value = {
    deliveries,
    currentDelivery,
    loading,
    error,
    createDelivery,
    fetchDeliveries,
    fetchDeliveryById,
    updateDeliveryStatus,
    leaveDelivery,
  };

  return (
    <DeliveryContext.Provider value={value}>{children}</DeliveryContext.Provider>
  );
};

export const useDelivery = () => {
  const context = useContext(DeliveryContext);
  if (!context) {
    throw new Error('useDelivery must be used within DeliveryProvider');
  }
  return context;
};
