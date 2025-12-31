import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';

// Helper to get the correct storage based on rememberMe flag
const getStorage = () => {
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    return rememberMe ? localStorage : sessionStorage;
};

// Helper to get initial token - checks both storages
const getInitialToken = (): string | null => {
    // First check if rememberMe is set
    const rememberMe = localStorage.getItem('rememberMe') === 'true';

    if (rememberMe) {
        return localStorage.getItem('token');
    } else {
        // If not rememberMe, try sessionStorage first, then localStorage as fallback
        return sessionStorage.getItem('token') || localStorage.getItem('token');
    }
};

// Helper to get initial user
const getInitialUser = (): any | null => {
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    const storage = rememberMe ? localStorage : sessionStorage;
    const userStr = storage.getItem('user') || localStorage.getItem('user');

    if (userStr) {
        try {
            return JSON.parse(userStr);
        } catch (e) {
            console.error('Error parsing stored user:', e);
        }
    }
    return null;
};

const api = axios.create({
    baseURL: '/api'
});

// Interceptor to add Token
api.interceptors.request.use(config => {
    // Try to get token from the appropriate storage
    const token = getInitialToken();
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// Interceptor to handle 401 errors - auto redirect to login
api.interceptors.response.use(
    response => response,
    error => {
        if (error.response?.status === 401) {
            // Token expired or invalid - clear storage and redirect
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('rememberMe');
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');

            // Redirect to login with expired flag
            if (!window.location.hash.includes('/login')) {
                window.location.href = '/#/login?expired=true';
            }
        }
        return Promise.reject(error);
    }
);

interface User {
    id: string;
    email: string;
    name: string;
    role?: 'admin' | 'user';
    avatar_url?: string;
    currency?: string;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (token: string, user: User, rememberMe?: boolean) => void;
    logout: () => void;
    isAuthenticated: boolean;
    isAdmin: boolean;
    api: typeof api;
    rememberMe: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Initialize state SYNCHRONOUSLY from storage
    const [user, setUser] = useState<User | null>(() => getInitialUser());
    const [token, setToken] = useState<string | null>(() => getInitialToken());
    const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('rememberMe') === 'true');

    // Refresh user data on mount to ensure sync with DB (e.g. after restore)
    React.useEffect(() => {
        if (token) {
            api.get('/user/profile')
                .then(res => {
                    if (res.data.success) {
                        const newUser = {
                            ...res.data.user,
                            name: res.data.user.full_name // Ensure mapping
                        };
                        // Update state
                        setUser(newUser);
                        // Update storage silently
                        const storage = rememberMe ? localStorage : sessionStorage;
                        storage.setItem('user', JSON.stringify(newUser));
                    }
                })
                .catch(err => {
                    console.error('Error refreshing user profile:', err);
                });
        }
    }, [token, rememberMe]);

    const login = useCallback((newToken: string, newUser: User, remember: boolean = false) => {
        // Store rememberMe preference in localStorage (always)
        localStorage.setItem('rememberMe', String(remember));
        setRememberMe(remember);

        // Use appropriate storage
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem('token', newToken);
        storage.setItem('user', JSON.stringify(newUser));

        // Clear the other storage (but keep rememberMe in localStorage)
        if (remember) {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
        } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            // Keep rememberMe in localStorage even when using sessionStorage
        }

        setToken(newToken);
        setUser(newUser);
    }, []);

    const logout = useCallback(() => {
        // Clear both storages
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('rememberMe');
        sessionStorage.removeItem('token');
        sessionStorage.removeItem('user');

        setToken(null);
        setUser(null);
        setRememberMe(false);
    }, []);

    const isAdmin = user?.role === 'admin';

    return (
        <AuthContext.Provider value={{
            user,
            token,
            login,
            logout,
            isAuthenticated: !!token,
            isAdmin,
            api,
            rememberMe
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within AuthProvider');
    return context;
};
