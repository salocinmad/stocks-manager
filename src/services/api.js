import { authenticatedFetch } from './auth.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

// Helper para obtener el portfolioId actual
const getCurrentPortfolioId = () => {
  const v = localStorage.getItem('currentPortfolioId');
  return v ? parseInt(v, 10) : null;
};

// Helper para hacer requests autenticados
const fetchAPI = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;

  const doFetch = async () => {
    const response = await authenticatedFetch(url, options);
    if (!response.ok) {
      if (response.status === 403 && endpoint.startsWith('/config')) {
        console.warn(`Acceso denegado (403) a ${endpoint}. Ignorando para usuarios no administradores.`);
        return null;
      }
      const errorObj = await response.json().catch(() => ({ error: 'Error desconocido' }));
      throw { status: response.status, error: new Error(errorObj.error || `Error ${response.status}`) };
    }
    return await response.json();
  };

  try {
    return await doFetch();
  } catch (e) {
    const status = e?.status || 0;
    const isPortfolioEndpoint = endpoint.startsWith('/operations') || endpoint.startsWith('/prices') || endpoint.startsWith('/notes') || endpoint.startsWith('/portfolio');
    if ((status === 404 || status === 403) && isPortfolioEndpoint) {
      try {
        const list = await authenticatedFetch(`${API_BASE_URL}/portfolio`).then(r => r.json());
        const items = Array.isArray(list?.items) ? list.items : [];
        const fav = localStorage.getItem('currentUserFavorite');
        const favId = fav ? parseInt(fav, 10) : null;
        const fallback = items.find(p => p.id === favId) || items[0] || null;
        if (fallback) {
          localStorage.setItem('currentPortfolioId', String(fallback.id));
          // Reintentar una vez con el nuevo portfolio
          const withPid = endpoint.includes('?') ? `${endpoint}&portfolioId=${fallback.id}` : `${endpoint}?portfolioId=${fallback.id}`;
          return await authenticatedFetch(`${API_BASE_URL}${withPid}`, options).then(r => r.json());
        }
      } catch { }
    }
    console.error('Error en API:', e?.error || e);
    throw (e?.error || e);
  }
};

// Operaciones
export const operationsAPI = {
  getAll: () => {
    const pid = getCurrentPortfolioId();
    const q = pid ? `?portfolioId=${pid}` : '';
    return fetchAPI(`/operations${q}`);
  },
  getById: (id) => {
    const pid = getCurrentPortfolioId();
    const q = pid ? `?portfolioId=${pid}` : '';
    return fetchAPI(`/operations/${id}${q}`);
  },
  create: (operation) => fetchAPI('/operations', {
    method: 'POST',
    body: JSON.stringify({ ...operation, portfolioId: getCurrentPortfolioId() })
  }),
  update: (id, operation) => fetchAPI(`/operations/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...operation, portfolioId: getCurrentPortfolioId() })
  }),
  delete: (id) => {
    const pid = getCurrentPortfolioId();
    const q = pid ? `?portfolioId=${pid}` : '';
    return fetchAPI(`/operations/${id}${q}`, {
      method: 'DELETE'
    });
  },
  deleteAll: () => {
    const pid = getCurrentPortfolioId();
    const q = pid ? `?portfolioId=${pid}` : '';
    return fetchAPI(`/operations${q}`, { method: 'DELETE' });
  }
};

// Posiciones
export const positionsAPI = {
  getOrder: () => {
    const pid = getCurrentPortfolioId();
    const q = pid ? `?portfolioId=${pid}` : '';
    return fetchAPI(`/positions/order${q}`);
  },
  updateOrder: (order) => fetchAPI('/positions/order', {
    method: 'PUT',
    body: JSON.stringify({ order, portfolioId: getCurrentPortfolioId() })
  }),
  getHistory: (positionKey, days = 30) => {
    const pid = getCurrentPortfolioId();
    const params = [];
    if (pid) params.push(`portfolioId=${pid}`);
    if (days) params.push(`days=${days}`);
    const q = params.length ? `?${params.join('&')}` : '';
    return fetchAPI(`/positions/history/${encodeURIComponent(positionKey)}${q}`);
  }
};

// Precios (caché persistente)
export const pricesAPI = {
  getBulk: (positionKeys) => fetchAPI('/prices/bulk', {
    method: 'POST',
    body: JSON.stringify({ positionKeys, portfolioId: getCurrentPortfolioId() })
  }),
  upsert: (positionKey, data) => fetchAPI(`/prices/${encodeURIComponent(positionKey)}`, {
    method: 'PUT',
    body: JSON.stringify({ ...data, portfolioId: getCurrentPortfolioId() })
  }),
  getMarketHistory: (symbol, days = 365) => fetchAPI(`/prices/market/${encodeURIComponent(symbol)}?days=${days}`)
};

export const notesAPI = {
  get: (positionKey) => {
    const pid = getCurrentPortfolioId();
    const q = pid ? `?portfolioId=${pid}` : '';
    return fetchAPI(`/notes/${encodeURIComponent(positionKey)}${q}`);
  },
  upsert: (positionKey, content) => fetchAPI(`/notes/${encodeURIComponent(positionKey)}`, {
    method: 'PUT',
    body: JSON.stringify({ content, portfolioId: getCurrentPortfolioId() })
  }),
  delete: (positionKey) => {
    const pid = getCurrentPortfolioId();
    const q = pid ? `?portfolioId=${pid}` : '';
    return fetchAPI(`/notes/${encodeURIComponent(positionKey)}${q}`, { method: 'DELETE' });
  }
};

let _timeseriesCache = { ts: 0, key: '', pending: null }

export const portfolioAPI = {
  contribution: ({ date } = {}) => {
    const pid = getCurrentPortfolioId();
    const qp = [];
    if (pid) qp.push(`portfolioId=${pid}`);
    if (date) qp.push(`date=${encodeURIComponent(date)}`);
    const q = qp.length ? `?${qp.join('&')}` : '';
    return fetchAPI(`/portfolio/contribution${q}`);
  },
  timeseries: ({ days } = {}) => {
    const pid = getCurrentPortfolioId();
    const qp = [];
    if (pid) qp.push(`portfolioId=${pid}`);
    if (days) qp.push(`days=${encodeURIComponent(days)}`);
    const q = qp.length ? `?${qp.join('&')}` : '';
    const key = `${pid || 'none'}-${days || 'all'}`;
    const now = Date.now();
    if (_timeseriesCache.pending && _timeseriesCache.key === key && (now - _timeseriesCache.ts) < 1000) {
      return _timeseriesCache.pending;
    }
    const p = fetchAPI(`/portfolio/timeseries${q}`);
    _timeseriesCache = { ts: now, key, pending: p };
    return p;
  },
  list: () => fetchAPI('/portfolio'),
  create: (name) => fetchAPI('/portfolio', { method: 'POST', body: JSON.stringify({ name }) }),
  rename: (id, name) => fetchAPI(`/portfolio/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
  remove: (id) => fetchAPI(`/portfolio/${id}`, { method: 'DELETE' }),
  setFavorite: (id) => fetchAPI(`/portfolio/${id}/favorite`, { method: 'PUT' })
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

// Botones externos personalizables
export const externalButtonsAPI = {
  getAll: () => fetchAPI('/external-buttons'),
  create: (name, baseUrl, imageUrl, displayOrder) => fetchAPI('/external-buttons', {
    method: 'POST',
    body: JSON.stringify({ name, baseUrl, imageUrl, displayOrder })
  }),
  update: (id, data) => fetchAPI(`/external-buttons/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  }),
  delete: (id) => fetchAPI(`/external-buttons/${id}`, {
    method: 'DELETE'
  })
};
