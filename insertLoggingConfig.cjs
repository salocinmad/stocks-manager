const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'Admin.jsx');

const loggingConfigButton = `
            <button
              className="button"
              onClick={handleToggleLogLevel}
              style={{ justifyContent: 'center' }}
            >
              {logLevelEnabled ? '✅ Logging Detallado' : '❌ Logging Minimal'}
            </button>`;

fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) {
        console.error('Error al leer el archivo:', err);
        return;
    }

    const lines = data.split(/\r?\n/);
    let insertIndex = -1;
    let foundSchedulerButton = false;

    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes('⚙️ Scheduler')) {
            foundSchedulerButton = true;
        }
        if (foundSchedulerButton && lines[i].includes('</button>')) {
            insertIndex = i + 1;
            break;
        }
    }

    if (insertIndex !== -1) {
        lines.splice(insertIndex, 0, loggingConfigButton);
        const newData = lines.join('\n');

        fs.writeFile(filePath, newData, 'utf8', (err) => {
            if (err) {
                console.error('Error al escribir el archivo:', err);
            } else {
                console.log('Bloque de configuración de logging insertado correctamente.');
            }
        });
    } else {
        console.error('No se encontró el botón de "Scheduler" o su etiqueta de cierre.');
    }
});
