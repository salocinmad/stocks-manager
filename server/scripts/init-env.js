import { existsSync, writeFileSync, readFileSync, statSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Ruta al archivo .env
// Primero intentamos /app/env/.env (donde está el volumen), luego /app/.env (enlace simbólico)
let envPath = '/app/env/.env';
if (!existsSync(envPath)) {
  envPath = join(__dirname, '..', '.env');
}

// Función para generar una contraseña maestra segura
function generateMasterPassword() {
  // Genera una contraseña aleatoria de 32 caracteres
  const words = [
    'Freedom', 'Mud', 'Garnish', 'Tattle', 'Vivacious', 'Germinate', 'Removal', 'Harmonics', 'Heave',
    'Liberty', 'Stone', 'Season', 'Whisper', 'Energetic', 'Sprout', 'Elimination', 'Melody', 'Lift',
    'Independence', 'Clay', 'Flavor', 'Chatter', 'Dynamic', 'Grow', 'Deletion', 'Rhythm', 'Raise',
    'Autonomy', 'Dirt', 'Spice', 'Talk', 'Active', 'Develop', 'Removal', 'Tune', 'Boost'
  ];

  const selectedWords = [];
  for (let i = 0; i < 9; i++) {
    const randomWord = words[Math.floor(Math.random() * words.length)];
    const randomNumber = Math.floor(Math.random() * 10);
    selectedWords.push(`${randomWord}${randomNumber}`);
  }

  return selectedWords.join('-');
}

// Función para generar un JWT_SECRET seguro
function generateJWTSecret() {
  return crypto.randomBytes(64).toString('hex');
}

// Verificar si el archivo .env ya existe y tiene contenido
if (existsSync(envPath)) {
  try {
    // Verificar si es un directorio
    const stats = statSync(envPath);
    if (stats.isDirectory()) {
      console.log('⚠️  /app/.env es un directorio, eliminándolo...');
      try {
        rmSync(envPath, { recursive: true, force: true });
        console.log('✅ Directorio eliminado correctamente');
      } catch (rmErr) {
        console.error('❌ Error al eliminar el directorio:', rmErr.message);
        console.error('   Por favor, elimina manualmente el volumen backend_env en Portainer');
        process.exit(1);
      }
    } else {
      // Si es un archivo, leer su contenido
      let content = readFileSync(envPath, 'utf8').trim();
      // Si el archivo existe y tiene contenido (más de 10 caracteres)
      if (content.length > 10) {
        // Verificar si el puerto es correcto (migración a 5000)
        if (content.includes('PORT=3001')) {
          console.log('⚠️  Detectado puerto antiguo (3001), actualizando a 5000...');
          content = content.replace('PORT=3001', 'PORT=5000');
          writeFileSync(envPath, content, 'utf8');
          console.log('✅ Puerto actualizado a 5000 en .env existente');
        } else if (!content.includes('PORT=')) {
          // Si no tiene puerto, añadirlo
          content += '\nPORT=5000\n';
          writeFileSync(envPath, content, 'utf8');
          console.log('✅ Puerto 5000 añadido a .env existente');
        }

        console.log('✅ Archivo .env ya existe con contenido, no se generará uno nuevo');
        process.exit(0);
      } else {
        console.log('⚠️  Archivo .env existe pero está vacío, se generará uno nuevo');
      }
    }
  } catch (err) {
    if (err.code === 'EISDIR') {
      console.log('⚠️  /app/.env es un directorio, intentando eliminarlo...');
      try {
        rmSync(envPath, { recursive: true, force: true });
        console.log('✅ Directorio eliminado correctamente');
      } catch (rmErr) {
        console.error('❌ Error al eliminar el directorio:', rmErr.message);
        console.error('   Por favor, elimina manualmente el volumen backend_env en Portainer');
        process.exit(1);
      }
    } else {
      console.log('⚠️  Error leyendo .env existente, se generará uno nuevo');
    }
  }
}

console.log('🔧 Generando archivo .env automáticamente...');

// Generar valores
const masterPassword = generateMasterPassword();
const jwtSecret = generateJWTSecret();

// Contenido del archivo .env
const envContent = `# Archivo de configuración generado automáticamente
# Este archivo fue creado el ${new Date().toISOString()}

# Puerto del servidor
PORT=5000

# Database Configuration
DB_HOST=mariadb
DB_USER=user
DB_PASS=password
DB_NAME=portfolio_manager

# CORS - Origen permitido (frontend en Docker)
CORS_ORIGIN=http://localhost:8080

# JWT Secret (generado automáticamente)
JWT_SECRET=${jwtSecret}

# Contraseña maestra para recuperación de administrador
# ⚠️  IMPORTANTE: Guarda esta contraseña en un lugar seguro
# Si pierdes esta contraseña, no podrás recuperar la cuenta de administrador
MASTER_PASSWORD=${masterPassword}

# Finnhub API Key (Get one at https://finnhub.io/)
FINNHUB_API_KEY=
`;

// Verificación final antes de escribir: asegurarse de que no es un directorio
if (existsSync(envPath)) {
  try {
    const finalStats = statSync(envPath);
    if (finalStats.isDirectory()) {
      console.log('⚠️  Verificación final: /app/.env sigue siendo un directorio, eliminándolo...');
      rmSync(envPath, { recursive: true, force: true });
      console.log('✅ Directorio eliminado en verificación final');
    }
  } catch (finalErr) {
    if (finalErr.code === 'EISDIR') {
      console.log('⚠️  Error EISDIR detectado, intentando eliminar directorio...');
      try {
        rmSync(envPath, { recursive: true, force: true });
        console.log('✅ Directorio eliminado después de error EISDIR');
      } catch (rmErr) {
        console.error('❌ No se pudo eliminar el directorio /app/.env');
        console.error('   Por favor, elimina manualmente el volumen backend_env en Portainer');
        console.error('   Luego reinicia el contenedor backend');
        process.exit(1);
      }
    } else {
      // Si no es EISDIR, puede ser otro error, pero continuamos
      console.log('⚠️  Error en verificación final (no crítico):', finalErr.message);
    }
  }
}

// Escribir el archivo .env
try {
  writeFileSync(envPath, envContent, 'utf8');
  console.log('✅ Archivo .env generado correctamente');
  console.log('');
  console.log('🔐 CONTRASEÑA MAESTRA GENERADA:');
  console.log(`   ${masterPassword}`);
  console.log('');
  console.log('⚠️  IMPORTANTE:');
  console.log('   - Guarda esta contraseña en un lugar seguro');
  console.log('   - La necesitarás para recuperar la contraseña de administrador');
  console.log('   - Puedes acceder a /resetadmin para recuperar la contraseña de admin');
  console.log('');
  console.log('📝 El archivo .env se encuentra en: server/.env');
  process.exit(0);
} catch (error) {
  console.error('❌ Error al generar el archivo .env:', error.message);
  process.exit(1);
}
