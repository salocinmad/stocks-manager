# Reset de Administrador

Documento de referencia para restablecer el usuario administrador cuando no se puede acceder al panel o se han perdido las credenciales.

## Objetivo
- Restaurar el usuario administrador con credenciales conocidas.
- Evitar accesos no autorizados.
- Proceso simple con tres métodos.

## Endpoints
- Base: `/api/admin`

### 1) `POST /api/admin/resetadmin` (principal)
- Restaura/crea el usuario administrador con credenciales temporales.
- Respuesta esperada:
  - `{ ok: true, username: "admin", password: "<temporal>", rotated: true }`
- Seguridad:
  - Ejecutar desde entorno controlado (p. ej. dentro del contenedor) o protegiendo el endpoint con token/whitelist.

### 2) `GET /api/admin/resetadmin/status`
- Verifica el estado del usuario administrador (existe, bloqueado, último cambio).
- Respuesta esperada:
  - `{ exists: true, lastResetAt: "2025-11-24T06:00:00Z" }`

### 3) `POST /api/admin/resetadmin/rollback`
- Revierte al estado previo si el reseteo temporal no debe mantenerse.
- Respuesta esperada:
  - `{ ok: true }`

## Flujo recomendado
1. Llamar `POST /api/admin/resetadmin` y guardar credenciales temporales.
2. Acceder al panel y cambiar la contraseña del admin inmediatamente.
3. Opcional: ejecutar `POST /api/admin/resetadmin/rollback` para limpiar registros temporales.
4. Validar con `GET /api/admin/resetadmin/status`.

## Observaciones
- Si estos endpoints no están presentes en la instancia, se deben implementar siguiendo esta especificación.
- Ejecutar siempre desde una conexión segura y auditada.

