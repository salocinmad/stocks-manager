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

// Posiciones
export const positionsAPI = {
  getOrder: () => fetchAPI('/positions/order'),
  updateOrder: (order) => fetchAPI('/positions/order', {
    method: 'PUT',
    body: JSON.stringify({ order })
  })
};

// Precios (caché persistente)
export const pricesAPI = {
  getBulk: (positionKeys) => fetchAPI('/prices/bulk', {
    method: 'POST',
    body: JSON.stringify({ positionKeys })
  }),
  upsert: (positionKey, data) => fetchAPI(`/prices/${encodeURIComponent(positionKey)}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  })
};

export const notesAPI = {
  get: (positionKey) => fetchAPI(`/notes/${encodeURIComponent(positionKey)}`),
  upsert: (positionKey, content) => fetchAPI(`/notes/${encodeURIComponent(positionKey)}`, {
    method: 'PUT',
    body: JSON.stringify({ content })
  }),
  delete: (positionKey) => fetchAPI(`/notes/${encodeURIComponent(positionKey)}`, {
    method: 'DELETE'
  })
};

export const portfolioAPI = {
  contribution: ({ date } = {}) => fetchAPI(`/portfolio/contribution${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  timeseries: ({ days } = {}) => fetchAPI(`/portfolio/timeseries${days ? `?days=${encodeURIComponent(days)}` : ''}`)
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

// Helper para hacer requests autenticados que devuelven una imagen (Blob)
const fetchImageAPI = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  try {
    const response = await authenticatedFetch(url, options);
    if (!response.ok) {
      // Si no es OK, intentar leer como JSON para errores, si no, lanzar error genérico
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { message: errorText || `Error ${response.status}` };
      }
      throw new Error(errorData.message || `Error ${response.status}`);
    }
    return response; // Devolver la respuesta completa para que el consumidor pueda obtener el blob o el tipo de contenido
  } catch (error) {
    console.error('Error en API de imagen:', error);
    throw error;
  }
};

// Imágenes de perfil
export const profilePicturesAPI = {
  get: () => fetchImageAPI('/profile-pictures'),
  upload: (file) => {
    const formData = new FormData();
    formData.append('profilePicture', file);
    return authenticatedFetch(`${API_BASE_URL}/profile-pictures`, {
      method: 'POST',
      body: formData,
      // No Content-Type header needed for FormData, browser sets it
    }).then(response => {
      if (!response.ok) {
        return response.json().then(error => { throw new Error(error.message || `Error ${response.status}`); });
      }
      return response.json();
    });
  },
  delete: () => fetchAPI('/profile-pictures', {
    method: 'DELETE'
  })
};

