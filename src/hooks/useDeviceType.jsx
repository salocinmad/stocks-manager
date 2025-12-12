import { useState, useEffect } from 'react';

/**
 * Hook para detectar el tipo de dispositivo basado en el ancho de pantalla.
 * Escucha cambios de tamaño en tiempo real.
 * 
 * Breakpoints:
 * - Móvil: ≤768px
 * - Tablet: 769-1024px
 * - Desktop: >1024px
 * 
 * @returns {{ isMobile: boolean, isTablet: boolean, isDesktop: boolean, screenWidth: number }}
 */
const useDeviceType = () => {
    const [screenWidth, setScreenWidth] = useState(
        typeof window !== 'undefined' ? window.innerWidth : 1200
    );

    useEffect(() => {
        // Verificar que estamos en el navegador
        if (typeof window === 'undefined') return;

        const handleResize = () => {
            setScreenWidth(window.innerWidth);
        };

        // Usar matchMedia para mejor rendimiento si está disponible
        const mediaQueryMobile = window.matchMedia('(max-width: 768px)');
        const mediaQueryTablet = window.matchMedia('(min-width: 769px) and (max-width: 1024px)');

        // Handler para matchMedia
        const handleMediaChange = () => {
            setScreenWidth(window.innerWidth);
        };

        // Añadir listeners
        mediaQueryMobile.addEventListener('change', handleMediaChange);
        mediaQueryTablet.addEventListener('change', handleMediaChange);
        window.addEventListener('resize', handleResize);

        // Cleanup
        return () => {
            mediaQueryMobile.removeEventListener('change', handleMediaChange);
            mediaQueryTablet.removeEventListener('change', handleMediaChange);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    return {
        isMobile: screenWidth <= 768,
        isTablet: screenWidth > 768 && screenWidth <= 1024,
        isDesktop: screenWidth > 1024,
        screenWidth
    };
};

export default useDeviceType;
