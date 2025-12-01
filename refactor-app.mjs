#!/usr/bin/env node

/**
 * Script para refactorizar App.jsx de manera controlada
 * Reemplaza secciones grandes de JSX con componentes extraídos
 */

import fs from 'fs/promises';
import path from 'path';

const APP_FILE = path.join(process.cwd(), 'src', 'App.jsx');

async function main() {
    console.log('🔧 Iniciando refactorización de App.jsx...\n');

    // Leer el archivo
    let content = await fs.readFile(APP_FILE, 'utf-8');
    const originalLength = content.split('\n').length;

    console.log(`📄 Archivo original: ${originalLength} líneas\n`);

    // Paso 1: Reemplazar sección de stats (líneas ~2278-2295)
    console.log('⏳ Paso 1: Reemplazando sección de estadísticas...');
    content = replaceStatsSection(content);

    // Guardar archivo intermedio para verificación
    await fs.writeFile(APP_FILE, content, 'utf-8');
    const newLength = content.split('\n').length;

    console.log(`\n✅ Refactorización completada!`);
    console.log(`📊 Reducción: ${originalLength} → ${newLength} líneas (${originalLength - newLength} líneas menos)`);
    console.log(`\n💡 Revisa el archivo y ejecuta nuevamente si quieres continuar con más reemplazos.`);
}

function replaceStatsSection(content) {
    // Buscar la sección de stats que comienza con {/* Estadísticas */}
    const statsStart = content.indexOf('{/* Estadísticas */}');

    if (statsStart === -1) {
        console.log('⚠️  No se encontró la sección de estadísticas - podría ya estar refactorizada');
        return content;
    }

    // Encontrar el cierre de la sección de stats (</div> después de las 4 stat-item)
    const statsPattern = /<div className="stats">[\s\S]*?<div className="stat-item">[\s\S]*?<\/div>[\s\S]*?<div className="stat-item">[\s\S]*?<\/div>[\s\S]*?<div className="stat-item">[\s\S]*?<\/div>[\s\S]*?<div className="stat-item">[\s\S]*?<\/div>[\s\S]*?<\/div>/;

    const statsMatch = content.substring(statsStart).match(statsPattern);

    if (!statsMatch) {
        console.log('⚠️  No se pudo hacer match del patrón de stats');
        return content;
    }

    const statsEnd = statsStart + statsMatch.index + statsMatch[0].length;

    // Crear el componente de reemplazo
    const replacement = `{/* Estadísticas */}
          <PortfolioSummary
            stats={stats}
            chartData={chartData}
            contributionChartData={contributionChartData}
            contributionColorsMap={contributionColorsMap}
            contributionDate={contributionDate}
            pnlSeries={pnlSeries}
            theme={theme}
            activePositions={activePositions}
            currentEURUSD={currentEURUSD}
            currentEURUSDSource={currentEURUSDSource}
            lastUpdatedAt={lastUpdatedAt}
            loadingPrices={loadingPrices}
            fetchCurrentEURUSD={fetchCurrentEURUSD}
            fetchAllCurrentPrices={fetchAllCurrentPrices}
            operations={operations}
            currentPrices={currentPrices}
            currentPortfolioId={currentPortfolioId}
            formatPrice={formatPrice}
            formatCurrency={formatCurrency}
            openModal={openModal}
            expandedPositions={expandedPositions}
            setExpandedPositions={setExpandedPositions}
            historicalDataCache={historicalDataCache}
            setHistoricalDataCache={setHistoricalDataCache}
            externalButtons={externalButtons}
            handleNoteClick={async (pk) => {
              setNotePositionKey(pk);
              setShowNoteModal(true);
              try {
                setNoteLoading(true);
                const note = await notesAPI.get(pk);
                setNoteContent(note?.content || '');
                setNoteOriginalContent(note?.content || '');
                setNoteEditMode(!note || !note.content || note.content.trim() === '');
              } catch (e) {
                setNoteContent('');
                setNoteOriginalContent('');
                setNoteEditMode(true);
              } finally {
                setNoteLoading(false);
              }
            }}
            notesCache={notesCache}
            handleDragStart={handleDragStart}
            handleDragEnd={handleDragEnd}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            draggedPosition={draggedPosition}
            sortPositions={sortPositions}
            getActivePositions={getActivePositions}
          />`;

    const before = content.substring(0, statsStart);
    const after = content.substring(statsEnd);

    console.log(`✓ Stats section encontrada y reemplazada (líneas ${countLines(content.substring(0, statsStart))} - ${countLines(content.substring(0, statsEnd))})`);

    return before + replacement + after;
}

function countLines(text) {
    return text.split('\n').length;
}

// Ejecutar
main().catch((err) => {
    console.error('❌ Error:', err.message);
    process.exit(1);
});
