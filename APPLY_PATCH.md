# Cómo Aplicar el Parche de Drag & Drop

## Opción 1: Usar Git Apply (Recomendado)

```bash
cd i:\Proyectos\test\stocks-manager
git apply drag-drop-integration.patch
```

Si hay conflictos, Git te mostrará dónde están y podrás resolverlos manualmente.

## Opción 2: Aplicar Manualmente

Si `git apply` no funciona, sigue las instrucciones en `DRAG_DROP_INTEGRATION.md` para aplicar los cambios manualmente.

## Verificar los Cambios

Después de aplicar el parche, verifica que:

1. **No hay errores de sintaxis**: Ejecuta `npm run dev` y verifica que no haya errores
2. **El drag & drop funciona**: Arrastra y suelta una fila en la tabla de posiciones
3. **El orden se guarda**: Recarga la página y verifica que el orden se mantiene

## Solución de Problemas

### Error: "patch does not apply"

Esto significa que el archivo ha cambiado desde que se creó el parche. Usa la opción manual (DRAG_DROP_INTEGRATION.md).

### Error de sintaxis después de aplicar

Revierte los cambios con:
```bash
git checkout HEAD -- src/App.jsx
```

Y aplica manualmente usando DRAG_DROP_INTEGRATION.md.

## Probar la Funcionalidad

1. Inicia el servidor: `docker compose up -d`
2. Abre la aplicación en el navegador
3. Ve a "Posiciones Activas"
4. Arrastra una fila y suéltala en otra posición
5. Recarga la página - el orden debería mantenerse
