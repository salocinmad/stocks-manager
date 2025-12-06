-- Script de hardening de seguridad para MariaDB
-- Se ejecuta automáticamente en la inicialización

-- Eliminar usuarios anónimos
DELETE FROM mysql.user WHERE User='';

-- Eliminar acceso remoto a root (solo permitir localhost)
DELETE FROM mysql.user WHERE User='root' AND Host NOT IN ('localhost', '127.0.0.1', '::1');

-- Eliminar base de datos de test
DROP DATABASE IF EXISTS test;
DELETE FROM mysql.db WHERE Db='test' OR Db='test\\_%';

-- Actualizar privilegios
FLUSH PRIVILEGES;

-- Log de confirmación
SELECT 'MariaDB hardening completado exitosamente' AS status;
