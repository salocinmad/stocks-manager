// Script para completar los cambios faltantes
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const filePath = path.join(__dirname, 'src', 'App.jsx');

let content = fs.readFileSync(filePath, 'utf8');
let changes = 0;

// 1. Agregar positionsAPI al import
if (content.includes("from './services/api.js';") && !content.includes('positionsAPI')) {
    content = content.replace(
        "import { operationsAPI, configAPI } from './services/api.js';",
        "import { operationsAPI, configAPI, positionsAPI } from './services/api.js';"
    );
    console.log('✅ positionsAPI agregado al import');
    changes++;
}

// 2. Agregar import de usePositionOrder
if (!content.includes("import { usePositionOrder }")) {
    content = content.replace(
        "import { logout, verifySession, changePassword, authenticatedFetch } from './services/auth.js';",
        "import { logout, verifySession, changePassword, authenticatedFetch } from './services/auth.js';\nimport { usePositionOrder } from './usePositionOrder.js';"
    );
    console.log('✅ Import de usePositionOrder agregado');
    changes++;
}

// 3. Modificar getActivePositions - pattern más flexible
const getActivePosPattern = /\/\/ Obtener posiciones activas[\s\S]*?const getActivePositions = \(\) => \{[\s\S]*?return Object\.fromEntries\([\s\S]*?\);[\s\S]*?\};/;
const match = content.match(getActivePosPattern);

if (match && !content.includes('sortPositions(activePositions)')) {
    const newFunc = `// Obtener posiciones activas (con acciones > 0)
  const getActivePositions = () => {
    const positions = getPositions();
    const activePositions = Object.fromEntries(
      Object.entries(positions).filter(([company, position]) => position.shares > 0)
    );
    return sortPositions(activePositions);
  };`;

    content = content.replace(match[0], newFunc);
    console.log('✅ getActivePositions modificado para usar sortPositions');
    changes++;
} else if (content.includes('sortPositions(activePositions)')) {
    console.log('⚠️  getActivePositions ya usa sortPositions');
}

// 4. Agregar atributos drag al <tr> - buscar el patrón exacto
const trPattern = /return \(\s*<tr key=\{positionKey\}>/;
if (content.match(trPattern) && !content.includes('draggable="true"')) {
    content = content.replace(
        trPattern,
        `return (
                    <tr 
                      key={positionKey}
                      draggable="true"
                      onDragStart={(e) => handleDragStart(e, positionKey)}
                      onDragEnd={handleDragEnd}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDrop(e, positionKey, Object.keys(activePositions))}
                      className={\`position-row \${draggedPosition === positionKey ? 'dragging' : ''}\`}
                    >`
    );
    console.log('✅ Atributos drag agregados al <tr>');
    changes++;
} else if (content.includes('draggable="true"')) {
    console.log('⚠️  <tr> ya tiene atributos drag');
}

// 5. Agregar CSS - buscar el final del style tag
if (!content.includes('.position-row {')) {
    // Buscar el cierre del style tag
    const styleEnd = '      `}</style>';
    if (content.includes(styleEnd)) {
        const cssCode = `
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

      \`}</style>`;

        content = content.replace(styleEnd, cssCode);
        console.log('✅ Estilos CSS agregados');
        changes++;
    }
} else {
    console.log('⚠️  Estilos CSS ya agregados');
}

// Guardar el archivo
if (changes > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`\n✅ ${changes} cambio(s) aplicado(s) correctamente!`);
} else {
    console.log('\n⚠️  No se aplicaron cambios (ya estaban aplicados)');
}
