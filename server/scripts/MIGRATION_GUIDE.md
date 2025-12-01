# Guía de Migración de Datos

## Ejecutar Migración (desde host)

La migración de datos debe ejecutarse **dentro del contenedor Docker**.

### Opción 1: Script Maestro (Recomendado)
```bash
# Windows PowerShell
docker compose exec server node scripts/migrateToGlobal.js

# O si tienes acceso a bash dentro del contenedor
docker compose exec server bash
cd /app
node scripts/migrateToGlobal.js
```

### Opción 2: Scripts Individuales
```bash
# 1. Migrar precios actuales (PriceCache → GlobalCurrentPrices)
docker compose exec server node scripts/migration/migratePriceCache.js

# 2. Migrar históricos (DailyPrice → GlobalStockPrices)
docker compose exec server node scripts/migration/migrateDailyPrice.js

# 3. Migrar alertas (Operations.targetPrice → UserStockAlerts)
docker compose exec server node scripts/migration/migrateAlerts.js
```

---

## Resetear Contraseña de Administrador

Si olvidaste la contraseña del administrador, puedes resetearla con este script:

```bash
# Desde Windows PowerShell (host)
docker compose exec server node scripts/resetAdminPassword.js <nueva-contraseña> [username]

# Ejemplos:
docker compose exec server node scripts/resetAdminPassword.js MiNuevaClave123
docker compose exec server node scripts/resetAdminPassword.js MiNuevaClave123 admin
```

**Requisitos**:
- La contraseña debe tener al menos 6 caracteres
- El usuario debe existir en la base de datos
- Por defecto se usa el usuario `admin` si no se especifica

**Salida esperada**:
```
🔗 Conectando a MariaDB...
✅ Conectado a MariaDB correctamente

✅ Contraseña actualizada correctamente
   Usuario: admin
   Es administrador: Sí
   Nueva contraseña: MiNuevaClave123

⚠️  IMPORTANTE: Guarda esta contraseña en un lugar seguro
```

---

## Verificación Post-Migración

### 1. Conectar a MariaDB
```bash
docker compose exec mariadb mysql -u root -p portfolio_manager
```

### 2. Contar Registros Migrados
```sql
-- Ver símbolos únicos migrados
SELECT COUNT(*) as total FROM GlobalCurrentPrices;

-- Ver históricos migrados
SELECT COUNT(*) as total FROM GlobalStockPrices;

-- Ver alertas migradas
SELECT COUNT(*) as total FROM UserStockAlerts;

-- Ver distribución por fuente
SELECT source, COUNT(*) as count
FROM GlobalCurrentPrices
GROUP BY source;

-- Ver símbolos con más histórico
SELECT symbol, COUNT(*) as days
FROM GlobalStockPrices
GROUP BY symbol
ORDER BY days DESC
LIMIT 10;
```

### 3. Verificar Datos Específicos
```sql
-- Ver precios actuales de símbolos específicos
SELECT * FROM GlobalCurrentPrices 
WHERE symbol IN ('AAPL', 'MSFT', 'AMP.MC')
ORDER BY symbol;

-- Ver histórico reciente de un símbolo
SELECT * FROM GlobalStockPrices
WHERE symbol = 'AAPL'
ORDER BY date DESC
LIMIT 10;
```

---

## Output Esperado del Script

```
🔄 MIGRACIÓN A TABLAS GLOBALES
============================================================

1️⃣  Migrando PriceCache → GlobalCurrentPrices...
📦 Encontrados X registros en PriceCache
🔢 Y símbolos únicos encontrados
✅ AAPL: 236.40 (finnhub)
✅ MSFT: 378.90 (yahoo)
...
✅ Migrados Y símbolos a GlobalCurrentPrices

2️⃣  Migrando DailyPrice → GlobalStockPrices...
📦 Encontrados X registros en DailyPrice
🔢 Y registros únicos (símbolo+fecha)
✅ Migrados: 100...
✅ Migrados: 200...
...
✅ Migrados Y registros históricos

3️⃣  Migrando targetPrice → UserStockAlerts...
📦 Encontradas X operaciones con targetPrice
📦 Encontrados Y registros con notificaciones
🔢 Z alertas únicas encontradas
✅ AAPL (user 1): targetPrice=250 (combined)
...
✅ Migradas Z alertas

============================================================
✅ MIGRACIÓN COMPLETADA
   - GlobalCurrentPrices: Y
   - GlobalStockPrices: Z
   - UserStockAlerts: W
============================================================
```

---

## Troubleshooting

### Error: Cannot find module
**Solución**: Asegurarse de ejecutar DENTRO del contenedor
```bash
docker compose exec server bash
cd /app
node scripts/migrateToGlobal.js
```

### Error: Duplicate entry
**Significa**: Ya existen datos migrados (normal si re-ejecutas)
**Acción**: El script usa `findOrCreate` y salta duplicados automáticamente

### Error: Database connection
**Solución**: Verificar que MariaDB esté corriendo
```bash
docker compose ps
docker compose logs mariadb
```

### Migración Parcial
Si solo algunos registros migran, es normal:
- Algunos registros de PriceCache pueden no tener símbolo válido
- DailyPrice sin símbolo se salta
- Es esperado que no TODO migre al 100%

---

## Rollback

Si algo sale mal, las tablas viejas están intactas:
```sql
-- Las tablas legacy NO se modifican
SELECT COUNT(*) FROM PriceCache;   -- Siguen ahí
SELECT COUNT(*) FROM DailyPrice;    -- Siguen ahí

-- Si quieres borrar tablas nuevas y re-migrar:
TRUNCATE TABLE GlobalCurrentPrices;
TRUNCATE TABLE GlobalStockPrices;
TRUNCATE TABLE UserStockAlerts;

-- Luego re-ejecutar migración
```

---

## Próximo Paso Después de Migración

Una vez migrado, verificar que el scheduler esté poblando GlobalCurrentPrices:

```bash
# Ver logs del scheduler
docker compose logs -f server | grep -i "actualiz"

# Deberías ver:
# 🔄 Actualizando precios de acciones EN USO...
# ✅ AAPL: 236.40 (finnhub+yahoo)
```

**La migración es OPCIONAL** - el sistema funciona sin ella usando tablas legacy.
