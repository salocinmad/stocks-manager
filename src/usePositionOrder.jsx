// Hook personalizado para manejar el reordenamiento de posiciones
import { useState, useEffect } from 'react';
import { positionsAPI } from './services/api.js';

export const usePositionOrder = (operations) => {
    const [positionOrder, setPositionOrder] = useState([]);
    const [draggedPosition, setDraggedPosition] = useState(null);

    // Cargar orden desde API al iniciar
    useEffect(() => {
        const loadOrder = async () => {
            try {
                const response = await positionsAPI.getOrder();
                if (response.order && Array.isArray(response.order)) {
                    setPositionOrder(response.order);
                }
            } catch (error) {
                console.error('Error loading position order:', error);
                // Si falla, usar orden vacío (se ordenará alfabéticamente por defecto)
                setPositionOrder([]);
            }
        };

        loadOrder();
    }, []);

    // Guardar orden en API
    const savePositionOrder = async (newOrder) => {
        try {
            await positionsAPI.updateOrder(newOrder);
            setPositionOrder(newOrder);
        } catch (error) {
            console.error('Error saving position order:', error);
            alert('Error al guardar el orden de posiciones');
        }
    };

    // Asegurar que una clave de posición exista en el array de orden; si falta, agregarla
    const ensurePositionInOrder = (positionKey) => {
        if (!positionOrder.includes(positionKey)) {
            const newOrder = [...positionOrder, positionKey];
            // Guardar el orden actualizado (persistir en backend)
            savePositionOrder(newOrder);
        }
    };

    // Ordenar posiciones según el orden guardado
    const sortPositions = (positions) => {
        const positionEntries = Object.entries(positions);

        // Si no hay orden guardado, ordenar alfabéticamente
        if (positionOrder.length === 0) {
            return Object.fromEntries(
                positionEntries.sort((a, b) => a[0].localeCompare(b[0]))
            );
        }

        // Ordenar según positionOrder
        const sorted = positionEntries.sort((a, b) => {
            const indexA = positionOrder.indexOf(a[0]);
            const indexB = positionOrder.indexOf(b[0]);

            // Si ambos están en el orden, usar ese orden
            if (indexA !== -1 && indexB !== -1) {
                return indexA - indexB;
            }
            // Si solo A está en el orden, A va primero
            if (indexA !== -1) return -1;
            // Si solo B está en el orden, B va primero
            if (indexB !== -1) return 1;
            // Si ninguno está en el orden, ordenar alfabéticamente
            return a[0].localeCompare(b[0]);
        });

        return Object.fromEntries(sorted);
    };

    // Handlers para drag & drop
    const handleDragStart = (e, positionKey) => {
        setDraggedPosition(positionKey);
        e.dataTransfer.effectAllowed = 'move';
        e.currentTarget.style.opacity = '0.5';
    };

    const handleDragEnd = (e) => {
        e.currentTarget.style.opacity = '1';
        setDraggedPosition(null);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = async (e, targetPositionKey, allPositionKeys) => {
        e.preventDefault();

        if (!draggedPosition || draggedPosition === targetPositionKey) {
            return;
        }

        // Crear nuevo orden
        // Empezamos con el orden guardado (si existe) y nos aseguramos de que incluya todas las claves
        const baseOrder = positionOrder.length > 0 ? [...positionOrder] : [];
        // Añadir cualquier clave que falte (nuevas posiciones) al final del array
        const completeOrder = Array.from(new Set([...baseOrder, ...allPositionKeys]));

        const draggedIndex = completeOrder.indexOf(draggedPosition);
        const targetIndex = completeOrder.indexOf(targetPositionKey);

        // Si alguna posición no está en el orden (debería estar ahora), abortamos
        if (draggedIndex === -1 || targetIndex === -1) {
            console.error('Position not found in order');
            return;
        }

        // Reordenar
        const newOrder = [...completeOrder];
        newOrder.splice(draggedIndex, 1);
        newOrder.splice(targetIndex, 0, draggedPosition);

        // Guardar nuevo orden
        await savePositionOrder(newOrder);
    };

    return {
        sortPositions,
        handleDragStart,
        handleDragEnd,
        handleDragOver,
        handleDrop,
        draggedPosition,
        ensurePositionInOrder
    };
};
