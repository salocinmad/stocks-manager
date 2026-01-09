import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import axios from 'axios';

// Helper to decode JWT and check expiration
const isTokenExpired = (token: string): boolean => {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp = payload.exp;
        if (!exp) return false; // No expiration claim

        // exp is in seconds, Date.now() is in milliseconds
        const expirationTime = exp * 1000;
        const now = Date.now();

        // Token expired if current time is past expiration
        return now >= expirationTime;
    } catch (e) {
        console.error('Error decoding token:', e);
        return true; // If can't decode, assume expired
    }
};

// Helper to get time until token expires (in ms)
const getTokenTimeRemaining = (token: string): number => {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        const exp = payload.exp;
        if (!exp) return Infinity;

        const expirationTime = exp * 1000;
        return Math.max(0, expirationTime - Date.now());
    } catch (e) {
        return 0;
    }
};

// Helper to get the correct storage based on rememberMe flag
const getStorage = () => {
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    return rememberMe ? localStorage : sessionStorage;
};

// Helper to clear all auth data
const clearAllAuthData = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('rememberMe');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('user');
};

// Helper to get initial token - checks both storages AND validates expiration
const getInitialToken = (): string | null => {
    const rememberMe = localStorage.getItem('rememberMe') === 'true';
    let token: string | null = null;

    if (rememberMe) {
        token = localStorage.getItem('token');
    } else {
        token = sessionStorage.getItem('token') || localStorage.getItem('token');
    }

    // CRITICAL: Check if token is expired
    if (token && isTokenExpired(token)) {
        console.warn('[Auth] Token found but expired, clearing session...');
        clearAllAuthData();
        return null;
    }

    return token;
};

// Helper to get initial user
const getInitialUser = (): any | null => {
    const token = getInitialToken();
    if (!token) return null; // If no valid token, no user

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
            clearAllAuthData();

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
    appVersion: string;
    isValidating: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Initialize state SYNCHRONOUSLY from storage (with expiration check)
    const [user, setUser] = useState<User | null>(() => getInitialUser());
    const [token, setToken] = useState<string | null>(() => getInitialToken());
    const [rememberMe, setRememberMe] = useState(() => localStorage.getItem('rememberMe') === 'true');
    const [appVersion, setAppVersion] = useState<string>('V...');
    const [isValidating, setIsValidating] = useState(true); // Start as validating

    // Fetch app version
    useEffect(() => {
        api.get('/health')
            .then(res => {
                if (res.data?.version) setAppVersion(res.data.version);
            })
            .catch(err => console.error('Failed to fetch version:', err));
    }, []);

    // CRITICAL: Validate token with backend on mount
    useEffect(() => {
        const validateSession = async () => {
            if (!token) {
                setIsValidating(false);
                return;
            }

            // First check: is token expired locally?
            if (isTokenExpired(token)) {
                console.warn('[Auth] Token expired locally, logging out...');
                clearAllAuthData();
                setToken(null);
                setUser(null);
                setIsValidating(false);

                if (!window.location.hash.includes('/login')) {
                    window.location.href = '/#/login?expired=true';
                }
                return;
            }

            // Second check: validate with backend
            try {
                const res = await api.get('/user/profile');
                if (res.data.success) {
                    const newUser = {
                        ...res.data.user,
                        name: res.data.user.full_name
                    };
                    setUser(newUser);

                    // Update storage
                    const storage = rememberMe ? localStorage : sessionStorage;
                    storage.setItem('user', JSON.stringify(newUser));
                }
            } catch (err: any) {
                // If 401 or network error, the interceptor will handle redirect
                console.error('[Auth] Session validation failed:', err.message);
            } finally {
                setIsValidating(false);
            }
        };

        validateSession();
    }, [token, rememberMe]);

    // Set up automatic logout when token expires
    useEffect(() => {
        if (!token) return;

        const timeRemaining = getTokenTimeRemaining(token);

        if (timeRemaining <= 0) {
            // Already expired
            clearAllAuthData();
            setToken(null);
            setUser(null);
            if (!window.location.hash.includes('/login')) {
                window.location.href = '/#/login?expired=true';
            }
            return;
        }

        // Set timeout to auto-logout when token expires
        console.log(`[Auth] Token expires in ${Math.round(timeRemaining / 1000 / 60)} minutes`);

        const timeoutId = setTimeout(() => {
            console.warn('[Auth] Token expired, logging out automatically...');
            clearAllAuthData();
            setToken(null);
            setUser(null);

            if (!window.location.hash.includes('/login')) {
                window.location.href = '/#/login?expired=true';
            }
        }, timeRemaining);

        return () => clearTimeout(timeoutId);
    }, [token]);

    const login = useCallback((newToken: string, newUser: User, remember: boolean = false) => {
        // Store rememberMe preference in localStorage (always)
        localStorage.setItem('rememberMe', String(remember));
        setRememberMe(remember);

        // Use appropriate storage
        const storage = remember ? localStorage : sessionStorage;
        storage.setItem('token', newToken);
        storage.setItem('user', JSON.stringify(newUser));

        // Clear the other storage
        if (remember) {
            sessionStorage.removeItem('token');
            sessionStorage.removeItem('user');
        } else {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        }

        setToken(newToken);
        setUser(newUser);
        setIsValidating(false);
    }, []);

    const logout = useCallback(() => {
        clearAllAuthData();
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
            isAuthenticated: !!token && !!user,
            isAdmin,
            api,
            rememberMe,
            appVersion,
            isValidating
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
