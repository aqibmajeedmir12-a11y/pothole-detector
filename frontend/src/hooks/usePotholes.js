import { useState, useEffect, useCallback } from 'react';
import { potholeAPI } from '../services/api';

export function usePotholes(filters = {}) {
  const [potholes, setPotholes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPotholes = useCallback(async () => {
    try {
      setLoading(true);
      const response = await potholeAPI.getAll(filters);
      setPotholes(response.data.data || []);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching potholes:', err);
    } finally {
      setLoading(false);
    }
  }, [JSON.stringify(filters)]);

  useEffect(() => {
    fetchPotholes();
  }, [fetchPotholes]);

  const addPothole = useCallback((pothole) => {
    setPotholes(prev => [pothole, ...prev]);
  }, []);

  const updatePothole = useCallback((updated) => {
    setPotholes(prev => prev.map(p => p.id === updated.id ? updated : p));
  }, []);

  return { potholes, loading, error, refetch: fetchPotholes, addPothole, updatePothole };
}
