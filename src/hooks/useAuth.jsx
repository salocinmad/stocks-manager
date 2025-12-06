import { useState, useEffect } from 'react';
import { verifySession, changePassword as authChangePassword } from '../services/auth.js';
import { profilePicturesAPI } from '../services/api.js';

/**
 * Hook personalizado para manejar la autenticación del usuario
 * 
 * @returns {Object} Estado y funciones de autenticación
 */
export const useAuth = () => {
    const [currentUser, setCurrentUser] = useState(null);
    const [profilePictureUrl, setProfilePictureUrl] = useState(null);
    const DEFAULT_PROFILE_PICTURE_URL = '/defaultpic.jpg';

    /**
     * Obtener la inicial del usuario para mostrar en el avatar
     */
    const getUserInitial = () => {
        if (currentUser) {
            if (currentUser.isAdmin) return 'A';
            return currentUser.username ? currentUser.username.charAt(0).toUpperCase() : '';
        }
        return '';
    };

    /**
     * Cargar la imagen de perfil del usuario desde el servidor
     */
    const fetchProfilePicture = async () => {
        console.log('useAuth: fetchProfilePicture called. Current profilePictureUrl (before fetch):', profilePictureUrl);
        if (!currentUser) {
            setProfilePictureUrl(null);
            console.log('useAuth: No currentUser, setting profilePictureUrl to null.');
            return;
        }
        try {
            const response = await profilePicturesAPI.get();
            if (response.status === 404) {
                setProfilePictureUrl(DEFAULT_PROFILE_PICTURE_URL);
                console.log('useAuth: Profile picture not found (404), setting to default. New profilePictureUrl:', DEFAULT_PROFILE_PICTURE_URL);
                return;
            }
            const blob = await response.blob();
            const imageUrl = URL.createObjectURL(blob);
            setProfilePictureUrl(imageUrl);
            console.log('useAuth: Profile picture fetched successfully. New profilePictureUrl:', imageUrl);
        } catch (error) {
            console.error('Error al cargar la imagen de perfil:', error);
            setProfilePictureUrl(DEFAULT_PROFILE_PICTURE_URL);
            console.log('useAuth: Error fetching profile picture, setting to default. New profilePictureUrl:', DEFAULT_PROFILE_PICTURE_URL);
        }
    };

    /**
     * Refrescar los datos del usuario actual
     */
    const refreshUser = async () => {
        const user = await verifySession();
        if (user) {
            setCurrentUser(user);
            if (user.favoritePortfolioId) {
                localStorage.setItem('currentUserFavorite', String(user.favoritePortfolioId));
            }
        }
        return user;
    };

    /**
     * Cambiar la contraseña del usuario actual
     * 
     * @param {string} currentPassword - Contraseña actual
     * @param {string} newPassword - Nueva contraseña
     * @param {string} confirmNewPassword - Confirmación de nueva contraseña
     * @throws {Error} Si hay algún error en la validación o el cambio
     */
    const handleChangePassword = async (currentPassword, newPassword, confirmNewPassword) => {
        if (!currentPassword || !newPassword || !confirmNewPassword) {
            throw new Error('Por favor, completa todos los campos');
        }

        if (newPassword.length < 6) {
            throw new Error('La nueva contraseña debe tener al menos 6 caracteres');
        }

        if (newPassword !== confirmNewPassword) {
            throw new Error('Las contraseñas no coinciden');
        }

        try {
            await authChangePassword(currentPassword, newPassword);
            return { success: true };
        } catch (error) {
            throw error;
        }
    };

    /**
     * Verificar la contraseña del usuario actual
     * Útil para operaciones sensibles que requieren confirmación
     * 
     * @param {string} username - Nombre de usuario
     * @param {string} password - Contraseña a verificar
     * @returns {Promise<boolean>} True si la contraseña es correcta
     */
    const verifyPassword = async (username, password) => {
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password }),
            });

            return response.ok;
        } catch (error) {
            console.error('Error verificando contraseña:', error);
            return false;
        }
    };

    // Cargar usuario inicial al montar el componente
    useEffect(() => {
        const loadUser = async () => {
            const user = await verifySession();
            if (user) {
                setCurrentUser(user);
                if (user.favoritePortfolioId) {
                    localStorage.setItem('currentUserFavorite', String(user.favoritePortfolioId));
                }
            }
        };
        loadUser();
    }, []);

    // Cargar imagen de perfil cuando cambia el usuario
    useEffect(() => {
        fetchProfilePicture();
    }, [currentUser]);

    return {
        // Estado
        currentUser,
        setCurrentUser,
        profilePictureUrl,
        setProfilePictureUrl,

        // Funciones
        refreshUser,
        fetchProfilePicture,
        getUserInitial,
        handleChangePassword,
        verifyPassword,

        // Constantes
        DEFAULT_PROFILE_PICTURE_URL
    };
};
