const API_BASE_URL = '/api';

// Guardar token en localStorage
export const setToken = (token) => {
  localStorage.setItem('authToken', token);
};

// Obtener token de localStorage
export const getToken = () => {
  return localStorage.getItem('authToken');
};

// Eliminar token
export const removeToken = () => {
  localStorage.removeItem('authToken');
};

// Iniciar sesión
export const login = async (username, password, twoFactorToken = null) => {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password, twoFactorToken }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al iniciar sesión');
  }

  const data = await response.json();

  if (data.requiresTwoFactor) {
    return { requiresTwoFactor: true };
  }

  setToken(data.token);
  try {
    if (data?.user?.favoritePortfolioId) {
      localStorage.setItem('currentPortfolioId', String(data.user.favoritePortfolioId));
      localStorage.setItem('currentUserFavorite', String(data.user.favoritePortfolioId));
    }
  } catch { }
  return data.user;
};

// Cerrar sesión
export const logout = () => {
  removeToken();
};

// Verificar sesión actual
export const verifySession = async () => {
  const token = getToken();
  if (!token) {
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      removeToken();
      return null;
    }

    const data = await response.json();
    return data.user;
  } catch (error) {
    removeToken();
    return null;
  }
};

// Cambiar contraseña del usuario actual
export const changePassword = async (currentPassword, newPassword) => {
  const token = getToken();
  if (!token) {
    throw new Error('No hay sesión activa');
  }

  const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al cambiar contraseña');
  }

  return response.json();
};

// Hacer peticiones autenticadas
export const authenticatedFetch = async (url, options = {}) => {
  const token = getToken();
  const headers = { ...options.headers };

  // Solo establecer Content-Type para cuerpos que no sean FormData
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!isFormData) {
    headers['Content-Type'] = headers['Content-Type'] || 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    // Token inválido o expirado
    removeToken();
    window.location.href = '/login';
    throw new Error('Sesión expirada');
  }

  return response;
};

