import { useState, useEffect } from 'react';

/**
 * Hook para detectar el tipo de dispositivo basado en el ancho de pantalla.
 * Escucha cambios de tamaño en tiempo real.
 * 
 * Breakpoints:
 * - Móvil: ≤768px
 * - Tablet: 769-1024px
 * - Desktop: >1024px
 */
const useDeviceType = () => {
    // Función simple para obtener el ancho
    const getWidth = () => {
        if (typeof window === 'undefined') return 1200;
        return window.innerWidth;
    };

    const [width, setWidth] = useState(getWidth);

    useEffect(() => {
        // Solo ejecutar en el navegador
        if (typeof window === 'undefined') return;

        // Forzar actualización inicial
        setWidth(window.innerWidth);

        const handleResize = () => {
            setWidth(window.innerWidth);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // Calcular los valores en cada render basado en el width actual
    return {
        isMobile: width <= 768,
        isTablet: width > 768 && width <= 1024,
        isDesktop: width > 1024,
        screenWidth: width
    };
};

export default useDeviceType;
