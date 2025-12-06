import { Op } from 'sequelize';
import User from '../models/User.js';
import Portfolio from '../models/Portfolio.js';
import { generateDailyReport } from '../services/reportGenerator.js';
import { getLogLevel } from '../services/configService.js';


/**
 * Script para generar reportes diarios automáticamente para todos los portafolios
 * Este script es ejecutado por el scheduler
 */

/**
 * Obtiene el tipo de cambio EUR/USD actual
 * @returns {number} Tipo de cambio EUR/USD
 */
async function getCurrentEURUSD(currentLogLevel) {
    try {
        // Intentar obtener desde el endpoint local de Yahoo
        const response = await fetch('http://localhost:5000/api/yahoo/fx/eurusd');
        if (response.ok) {
            const data = await response.json();
            return parseFloat(data.eurPerUsd) || 0.92;
        }
    } catch (error) {
        console.log('Could not fetch EUR/USD rate, using default');
    }
    return 0.92; // Valor por defecto si falla
}

/**
 * Genera reportes para un usuario específico
 * @param {Object} user - Usuario
 * @param {string} date - Fecha del reporte
 * @param {number} currentEURUSD - Tipo de cambio EUR/USD
 * @returns {Object} Resultado de la generación
 */
async function generateReportsForUser(user, date, currentEURUSD, currentLogLevel) {
    const result = {
        userId: user.id,
        username: user.username,
        portfoliosProcessed: 0,
        errors: []
    };

    try {
        // Obtener todos los portafolios del usuario
        const portfolios = await Portfolio.findAll({
            where: { userId: user.id }
        });

        if (currentLogLevel === 'verbose') {
            console.log(`  💼 Found ${portfolios.length} portfolios for user ${user.username}`);
        }

        if (portfolios.length === 0) {
            if (currentLogLevel === 'verbose') {
                console.log(`  ⚠️ User ${user.username} has no portfolios`);
            }
            return result;
        }

        // Generar reporte para cada portafolio
        for (const portfolio of portfolios) {
            if (currentLogLevel === 'verbose') {
                console.log(`  Processing portfolio ${portfolio.id} (${portfolio.name})...`);
            }
            try {
                const report = await generateDailyReport(user.id, portfolio.id, date, currentEURUSD);
                if (report) {
                    result.portfoliosProcessed++;
                    if (currentLogLevel === 'verbose') {
                        console.log(`    ✅ Report generated for ${portfolio.name}`);
                    }
                } else {
                    if (currentLogLevel === 'verbose') {
                        console.log(`    ⚠️ Skipped ${portfolio.name}: No operations found`);
                    }
                }
            } catch (error) {
                console.error(`    ❌ Error generating report for portfolio ${portfolio.id} (${portfolio.name}):`, error.message);
                result.errors.push({
                    portfolioId: portfolio.id,
                    portfolioName: portfolio.name,
                    error: error.message
                });
            }
        }

        return result;
    } catch (error) {
        console.error(`Error processing user ${user.username}:`, error);
        result.errors.push({
            general: error.message
        });
        return result;
    }
}

/**
 * Función principal: Genera reportes para todos los usuarios
 * @param {string} date - Fecha del reporte (opcional, default: hoy)
 * @returns {Object} Resultado de la generación
 */
export async function generateAllReports(date = null) {
    const currentLogLevel = await getLogLevel();
    const startTime = Date.now();

    // Usar fecha de hoy si no se especifica
    const reportDate = date || new Date().toISOString().split('T')[0];

    if (currentLogLevel === 'verbose') {
        console.log(`\n========================================`);
        console.log(`📊 Generating Portfolio Reports`);
        console.log(`📅 Date: ${reportDate}`);
        console.log(`========================================\n`);
    }

    const summary = {
        date: reportDate,
        startedAt: new Date().toISOString(),
        totalUsers: 0,
        totalPortfolios: 0,
        successfulReports: 0,
        failedReports: 0,
        userResults: [],
        errors: [],
        executionTimeMs: 0
    };

    try {
        // 1. Obtener tipo de cambio EUR/USD actual
        const currentEURUSD = await getCurrentEURUSD(currentLogLevel);
        if (currentLogLevel === 'verbose') {
            console.log(`💱 EUR/USD exchange rate: ${currentEURUSD}`);
        }

        // DEBUG: Listar todos los portafolios para ver qué está pasando
        const allPortfolios = await Portfolio.findAll();
        if (currentLogLevel === 'verbose') {
            console.log(`\n🔍 DEBUG: Total portfolios in DB: ${allPortfolios.length}`);
            allPortfolios.forEach(p => {
                console.log(`   - ID: ${p.id}, Name: ${p.name}, UserId: ${p.userId}`);
            });
            console.log('');
        }

        // 2. Obtener todos los usuarios
        const users = await User.findAll();

        summary.totalUsers = users.length;
        if (currentLogLevel === 'verbose') {
            console.log(`👥 Found ${users.length} users\n`);
        }

        if (users.length === 0) {
            if (currentLogLevel === 'verbose') {
                console.log('No users found');
            }
            summary.executionTimeMs = Date.now() - startTime;
            return summary;
        }

        // 3. Generar reportes para cada usuario
        for (const user of users) {
            if (currentLogLevel === 'verbose') {
            console.log(`Processing user: ${user.username}...`);
        }

            const userResult = await generateReportsForUser(user, reportDate, currentEURUSD, currentLogLevel);
            summary.userResults.push(userResult);

            summary.totalPortfolios += userResult.portfoliosProcessed;
            summary.successfulReports += userResult.portfoliosProcessed;
            summary.failedReports += userResult.errors.length;

            if (userResult.errors.length > 0) {
                summary.errors.push(...userResult.errors);
            }

            if (currentLogLevel === 'verbose') {
            console.log(`  ✅ Processed ${userResult.portfoliosProcessed} portfolios`);
            if (userResult.errors.length > 0) {
                console.log(`  ⚠️  ${userResult.errors.length} errors`);
            }
        }
        }

        // 4. Resumen final
        summary.completedAt = new Date().toISOString();
        summary.executionTimeMs = Date.now() - startTime;

        if (currentLogLevel === 'verbose') {
            console.log(`\n========================================`);
            console.log(`📊 Report Generation Complete`);
            console.log(`========================================`);
            console.log(`✅ Total portfolios: ${summary.totalPortfolios}`);
            console.log(`✅ Successful reports: ${summary.successfulReports}`);
            console.log(`❌ Failed reports: ${summary.failedReports}`);
            console.log(`⏱️  Execution time: ${summary.executionTimeMs}ms`);
            console.log(`========================================\n`);
        }

        return summary;
    } catch (error) {
        console.error('Fatal error during report generation:', error);
        summary.errors.push({
            fatal: error.message,
            stack: error.stack
        });
        summary.executionTimeMs = Date.now() - startTime;
        return summary;
    }
}

/**
 * Ejecutar si se llama directamente desde línea de comandos
 */
if (import.meta.url === `file://${process.argv[1]}`) {
    const date = process.argv[2] || null;

    generateAllReports(date)
        .then(result => {
            if (currentLogLevel === 'verbose') {
        console.log('\nGeneration result:', JSON.stringify(result, null, 2));
    }
            process.exit(result.failedReports > 0 ? 1 : 0);
        })
        .catch(error => {
            console.error('Script execution failed:', error);
            process.exit(1);
        });
}

export default generateAllReports;
