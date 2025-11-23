// Script para agregar solo los estilos CSS
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const cssPath = path.join(__dirname, 'src', 'index.css');

let content = fs.readFileSync(cssPath, 'utf8');

// Solo agregar si no existen
if (!content.includes('.position-row')) {
    const cssStyles = `
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

.light .position-row:hover {
  background-color: rgba(59, 130, 246, 0.05);
}
`;

    content += cssStyles;
    fs.writeFileSync(cssPath, content, 'utf8');
    console.log('✅ Estilos CSS agregados a index.css');
} else {
    console.log('⚠️  Estilos CSS ya existen');
}
