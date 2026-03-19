import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const API_KEY = import.meta.env.VITE_API_KEY || 'dev-api-key-2024';

const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
  },
});

// Pothole endpoints
export const potholeAPI = {
  getAll: (params) => api.get('/potholes', { params }),
  getById: (id) => api.get(`/pothole/${id}`),
  create: (data) => api.post('/pothole', data),
  update: (id, data) => api.patch(`/pothole/${id}`, data),
  delete: (id) => api.delete(`/pothole/${id}`),
};

// Sensor endpoints
export const sensorAPI = {
  getAll: (params) => api.get('/sensors', { params }),
  getTrends: (hours) => api.get('/sensors/trends', { params: { hours } }),
  getDevices: () => api.get('/sensors/devices'),
  create: (data) => api.post('/sensor', data),
};

// Analytics endpoints
export const analyticsAPI = {
  getStats: () => api.get('/analytics'),
};

// Admin endpoints
export const adminAPI = {
  getPotholes: (params) => api.get('/admin/potholes', { params }),
  updatePothole: (id, data) => api.patch(`/admin/pothole/${id}`, data),
  getAlerts: (limit) => api.get('/admin/alerts', { params: { limit } }),
  markAlertsRead: () => api.post('/admin/alerts/read'),
  markAlertRead: (id) => api.post(`/admin/alerts/${id}/read`),
};

// Reports endpoints
export const reportsAPI = {
  getReport: (period) => api.get('/reports', { params: { period } }),
};

// ThingSpeak endpoints
export const thingspeakAPI = {
  getLatest: (results = 10) => api.get('/thingspeak/latest', { params: { results } }),
  getLast: () => api.get('/thingspeak/last'),
};

export default api;
