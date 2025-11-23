# Instrucciones para Integrar Drag & Drop en App.jsx

## Paso 1: Importar el hook

En la línea 5 de `src/App.jsx`, después de los otros imports, agregar:

```javascript
import { usePositionOrder } from './usePositionOrder.js';
```

## Paso 2: Usar el hook

Después de la línea 44 (después de definir `formData`), agregar:

```javascript
// Hook para reordenamiento de posiciones
const {
  sortPositions,
  handleDragStart,
  handleDragEnd,
  handleDragOver,
  handleDrop,
  draggedPosition
} = usePositionOrder(operations);
```

## Paso 3: Modificar getActivePositions

Buscar la función `getActivePositions` (alrededor de la línea 820) y modificar el return para usar `sortPositions`:

**Antes:**
```javascript
const getActivePositions = () => {
  const positions = getPositions();
  return Object.fromEntries(
    Object.entries(positions).filter(([company, position]) => position.shares > 0)
  );
};
```

**Después:**
```javascript
const getActivePositions = () => {
  const positions = getPositions();
  const activePositions = Object.fromEntries(
    Object.entries(positions).filter(([company, position]) => position.shares > 0)
  );
  return sortPositions(activePositions);
};
```

## Paso 4: Agregar atributos drag & drop a las filas de la tabla

Buscar la tabla de posiciones activas (alrededor de la línea 1570) y modificar el `<tr>` para cada posición:

**Antes:**
```javascript
<tr key={positionKey}>
```

**Después:**
```javascript
<tr 
  key={positionKey}
  draggable="true"
  onDragStart={(e) => handleDragStart(e, positionKey)}
  onDragEnd={handleDragEnd}
  onDragOver={handleDragOver}
  onDrop={(e) => handleDrop(e, positionKey, Object.keys(activePositions))}
  className={`position-row ${draggedPosition === positionKey ? 'dragging' : ''}`}
  style={{ cursor: 'move' }}
>
```

## Paso 5: Agregar estilos CSS

Buscar la sección de estilos `<style>` (al final del archivo, alrededor de la línea 2300) y agregar antes del cierre `</style>`:

```css
/* Drag & Drop para reordenar posiciones */
.position-row {
  transition: background-color 0.2s, opacity 0.2s;
}

.position-row:hover {
  background-color: rgba(99, 102, 241, 0.1);
}

.position-row.dragging {
  opacity: 0.5;
}

.position-row[draggable="true"] {
  cursor: move !important;
}
```

## Notas Importantes

- El hook `usePositionOrder` maneja automáticamente la carga y guardado del orden
- Si no hay orden guardado, las posiciones se ordenarán alfabéticamente
- El orden se guarda automáticamente al soltar una posición en una nueva ubicación
- El orden persiste entre dispositivos (guardado en base de datos)
