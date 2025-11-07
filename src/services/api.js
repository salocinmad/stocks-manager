import { authenticatedFetch } from './auth.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Helper para hacer requests autenticados
const fetchAPI = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  
  try {
    const response = await authenticatedFetch(url, options);
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Error desconocido' }));
      throw new Error(error.error || `Error ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error en API:', error);
    throw error;
  }
};

// Operaciones
export const operationsAPI = {
  getAll: () => fetchAPI('/operations'),
  getById: (id) => fetchAPI(`/operations/${id}`),
  create: (operation) => fetchAPI('/operations', {
    method: 'POST',
    body: JSON.stringify(operation)
  }),
  update: (id, operation) => fetchAPI(`/operations/${id}`, {
    method: 'PUT',
    body: JSON.stringify(operation)
  }),
  delete: (id) => fetchAPI(`/operations/${id}`, {
    method: 'DELETE'
  }),
  deleteAll: () => fetchAPI('/operations', {
    method: 'DELETE'
  })
};

// Configuración
export const configAPI = {
  getAll: () => fetchAPI('/config'),
  get: (key) => fetchAPI(`/config/${key}`),
  set: (key, value) => fetchAPI(`/config/${key}`, {
    method: 'POST',
    body: JSON.stringify({ value })
  }),
  delete: (key) => fetchAPI(`/config/${key}`, {
    method: 'DELETE'
  })
};

// Health check
export const healthCheck = () => fetchAPI('/health');

