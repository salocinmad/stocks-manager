/**
 * Logger Service - Centralized Logging with Configurable Levels
 * 
 * Features:
 * - 4 Log Levels: PRODUCTION, STANDARD, VERBOSE, DEBUG
 * - Console output with colors
 * - File persistence with timestamps (rotated daily)
 * - Downloadable via API with date filtering
 * 
 * Levels:
 * 0 = PRODUCTION  - Only errors and job summaries
 * 1 = STANDARD    - + Warnings, start/end of operations
 * 2 = VERBOSE     - + Progress details
 * 3 = DEBUG       - Everything (current behavior)
 */

import { SettingsService } from '../services/settingsService';
import { existsSync, mkdirSync, appendFileSync, readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

export enum LogLevel {
    PRODUCTION = 0,
    STANDARD = 1,
    VERBOSE = 2,
    DEBUG = 3
}

// Log file configuration
const LOGS_DIR = join(process.cwd(), 'logs');
const MAX_LOG_FILES = 30; // Keep 30 days of logs

// Ensure logs directory exists
if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
}

// Cache for log level (refreshed every 60 seconds)
let cachedLogLevel: LogLevel = LogLevel.STANDARD;
let lastCacheRefresh: number = 0;
const CACHE_TTL_MS = 60000; // 60 seconds

async function refreshLogLevel(): Promise<void> {
    try {
        const levelStr = await SettingsService.get('LOG_LEVEL');
        const level = parseInt(levelStr || '1', 10);
        cachedLogLevel = Math.min(Math.max(level, 0), 3) as LogLevel;
        lastCacheRefresh = Date.now();
    } catch (e) {
        // On error, keep current level
    }
}

function shouldLog(requiredLevel: LogLevel): boolean {
    // Refresh cache if expired (non-blocking)
    if (Date.now() - lastCacheRefresh > CACHE_TTL_MS) {
        refreshLogLevel();
    }
    return cachedLogLevel >= requiredLevel;
}

// Get current date string for file naming (YYYY-MM-DD) - Madrid timezone
function getDateString(): string {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Madrid' });
}

// Full timestamp for log entries (ISO format in Madrid time)
function timestamp(): string {
    return new Date().toLocaleString('sv-SE', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    }).replace(' ', 'T');
}

// Short timestamp for console (HH:MM:SS in Madrid time)
function shortTimestamp(): string {
    return new Date().toLocaleTimeString('en-GB', {
        timeZone: 'Europe/Madrid',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Color codes for terminal
const COLORS = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    gray: '\x1b[90m',
    bold: '\x1b[1m',
};

// Write to log file
function writeToFile(level: string, prefix: string, ...args: any[]): void {
    try {
        const logFile = join(LOGS_DIR, `app-${getDateString()}.log`);
        const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
        const logLine = `${timestamp()} [${level.padEnd(7)}] ${prefix} ${message}\n`;
        appendFileSync(logFile, logLine);
    } catch (e) {
        // Silently fail file writes to not interrupt app
    }
}

// Cleanup old log files
function cleanupOldLogs(): void {
    try {
        const files = readdirSync(LOGS_DIR)
            .filter(f => f.startsWith('app-') && f.endsWith('.log'))
            .sort()
            .reverse();

        // Keep only MAX_LOG_FILES
        files.slice(MAX_LOG_FILES).forEach(f => {
            try {
                require('fs').unlinkSync(join(LOGS_DIR, f));
            } catch (e) { }
        });
    } catch (e) { }
}

// Run cleanup on startup
cleanupOldLogs();

/**
 * Centralized Logger
 * 
 * Usage:
 *   log.summary('[Job]', 'Completed: 45 items');  // Level 0+ (always in production)
 *   log.info('[Job]', 'Starting...');             // Level 1+ (standard)
 *   log.verbose('[Job]', 'Processing item 3');   // Level 2+ (verbose)
 *   log.debug('[Job]', 'Raw data:', data);       // Level 3 (debug only)
 *   log.warn('[Job]', 'Rate limit reached');     // Level 1+ (standard)
 *   log.error('[Job]', 'Critical error:', err);  // Always shown
 */
export const log = {
    /**
     * Summary logs - Always shown (used for job completion summaries)
     */
    summary: (prefix: string, ...args: any[]) => {
        writeToFile('SUMMARY', prefix, ...args);
        if (shouldLog(LogLevel.PRODUCTION)) {
            console.log(`${COLORS.green}${shortTimestamp()}${COLORS.reset} ${COLORS.bold}${prefix}${COLORS.reset}`, ...args);
        }
    },

    /**
     * Info logs - Level 1+ (standard operations)
     */
    info: (prefix: string, ...args: any[]) => {
        writeToFile('INFO', prefix, ...args);
        if (shouldLog(LogLevel.STANDARD)) {
            console.log(`${COLORS.cyan}${shortTimestamp()}${COLORS.reset} ${prefix}`, ...args);
        }
    },

    /**
     * Verbose logs - Level 2+ (detailed progress)
     */
    verbose: (prefix: string, ...args: any[]) => {
        writeToFile('VERBOSE', prefix, ...args);
        if (shouldLog(LogLevel.VERBOSE)) {
            console.log(`${COLORS.gray}${shortTimestamp()}${COLORS.reset} ${prefix}`, ...args);
        }
    },

    /**
     * Debug logs - Level 3 only (everything)
     */
    debug: (prefix: string, ...args: any[]) => {
        writeToFile('DEBUG', prefix, ...args);
        if (shouldLog(LogLevel.DEBUG)) {
            console.log(`${COLORS.magenta}${shortTimestamp()}${COLORS.reset} ${COLORS.gray}${prefix}${COLORS.reset}`, ...args);
        }
    },

    /**
     * Warning logs - Level 1+ (always in standard mode)
     */
    warn: (prefix: string, ...args: any[]) => {
        writeToFile('WARN', prefix, ...args);
        if (shouldLog(LogLevel.STANDARD)) {
            console.warn(`${COLORS.yellow}${shortTimestamp()} ⚠️ ${prefix}${COLORS.reset}`, ...args);
        }
    },

    /**
     * Error logs - Always shown and always persisted
     */
    error: (prefix: string, ...args: any[]) => {
        writeToFile('ERROR', prefix, ...args);
        console.error(`${COLORS.red}${shortTimestamp()} ❌ ${prefix}${COLORS.reset}`, ...args);
    },

    /**
     * Force refresh of log level cache
     */
    refreshLevel: async () => {
        await refreshLogLevel();
    },

    /**
     * Get current log level
     */
    getLevel: () => cachedLogLevel,

    /**
     * Get level name
     */
    getLevelName: () => {
        switch (cachedLogLevel) {
            case LogLevel.PRODUCTION: return 'PRODUCTION';
            case LogLevel.STANDARD: return 'STANDARD';
            case LogLevel.VERBOSE: return 'VERBOSE';
            case LogLevel.DEBUG: return 'DEBUG';
            default: return 'UNKNOWN';
        }
    },

    /**
     * Get available log files with dates
     */
    getAvailableLogDates: (): { date: string; size: number }[] => {
        try {
            return readdirSync(LOGS_DIR)
                .filter(f => f.startsWith('app-') && f.endsWith('.log'))
                .map(f => {
                    const date = f.replace('app-', '').replace('.log', '');
                    const stats = statSync(join(LOGS_DIR, f));
                    return { date, size: stats.size };
                })
                .sort((a, b) => b.date.localeCompare(a.date));
        } catch (e) {
            return [];
        }
    },

    /**
     * Get logs for a specific date range
     */
    getLogsForDateRange: (startDate: string, endDate: string, levelFilter?: string): string => {
        try {
            const files = readdirSync(LOGS_DIR)
                .filter(f => f.startsWith('app-') && f.endsWith('.log'))
                .filter(f => {
                    const date = f.replace('app-', '').replace('.log', '');
                    return date >= startDate && date <= endDate;
                })
                .sort();

            let logs = '';
            for (const file of files) {
                const content = readFileSync(join(LOGS_DIR, file), 'utf-8');
                if (levelFilter && levelFilter !== 'ALL') {
                    // Filter by level
                    logs += content.split('\n')
                        .filter(line => line.includes(`[${levelFilter}`))
                        .join('\n') + '\n';
                } else {
                    logs += content;
                }
            }
            return logs;
        } catch (e) {
            return '';
        }
    },

    /**
     * Delete logs for a specific date range (manual cleanup)
     */
    deleteLogsForDateRange: (startDate: string, endDate: string): { deleted: number; freed: number } => {
        try {
            const { unlinkSync } = require('fs');
            const files = readdirSync(LOGS_DIR)
                .filter(f => f.startsWith('app-') && f.endsWith('.log'))
                .filter(f => {
                    const date = f.replace('app-', '').replace('.log', '');
                    return date >= startDate && date <= endDate;
                });

            let deleted = 0;
            let freed = 0;

            for (const file of files) {
                const filePath = join(LOGS_DIR, file);
                const stats = statSync(filePath);
                freed += stats.size;
                unlinkSync(filePath);
                deleted++;
            }

            return { deleted, freed };
        } catch (e) {
            return { deleted: 0, freed: 0 };
        }
    },

    /**
     * Get total logs size
     */
    getTotalLogsSize: (): { files: number; bytes: number } => {
        try {
            const files = readdirSync(LOGS_DIR)
                .filter(f => f.startsWith('app-') && f.endsWith('.log'));

            let totalBytes = 0;
            for (const file of files) {
                const stats = statSync(join(LOGS_DIR, file));
                totalBytes += stats.size;
            }

            return { files: files.length, bytes: totalBytes };
        } catch (e) {
            return { files: 0, bytes: 0 };
        }
    }
};

// Initialize on first import
refreshLogLevel();
