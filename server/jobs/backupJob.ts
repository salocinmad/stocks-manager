import { BackupService } from "../services/backupService";
import { SettingsService } from "../services/settingsService";
import nodemailer from 'nodemailer';

export const BackupJob = {
    // Check and Run Backup if needed (called every minute via CRON in index.ts)
    checkAndRun: async () => {
        try {
            const enabled = await SettingsService.get('BACKUP_SCHEDULER_ENABLED');
            if (enabled !== 'true') return;

            const email = await SettingsService.get('BACKUP_EMAIL');
            if (!email) return;

            const frequency = await SettingsService.get('BACKUP_FREQUENCY'); // 'daily', 'weekly', 'monthly'
            const time = await SettingsService.get('BACKUP_TIME'); // '04:00'
            const lastRun = await SettingsService.get('BACKUP_LAST_RUN');
            const dayOfWeek = parseInt(await SettingsService.get('BACKUP_DAY_OF_WEEK') || '1'); // 0=Domingo, 6=Sábado
            const dayOfMonth = parseInt(await SettingsService.get('BACKUP_DAY_OF_MONTH') || '1'); // 1-28

            if (!frequency || !time) return;

            // Check if it's time to run
            const now = new Date();
            const [targetHour, targetMinute] = time.split(':').map(Number);

            // Current Time logic (assuming container UTC or matching server time)
            const targetTimeToday = new Date(now);
            targetTimeToday.setHours(targetHour, targetMinute, 0, 0);

            let shouldRunToday = false;
            if (frequency === 'daily') {
                shouldRunToday = true;
            } else if (frequency === 'weekly') {
                shouldRunToday = now.getDay() === dayOfWeek; // Configurable day of week
            } else if (frequency === 'monthly') {
                shouldRunToday = now.getDate() === dayOfMonth; // Configurable day of month
            }

            if (!shouldRunToday) return;

            // Run if now >= targetTime AND lastRun < targetTime
            const lastRunDate = lastRun ? new Date(lastRun) : new Date(0);

            if (now >= targetTimeToday && lastRunDate < targetTimeToday) {
                console.log(`[BackupJob] Starting scheduled backup (${frequency} at ${time})...`);
                await BackupJob.performBackup(email);

                // Update Last Run
                await SettingsService.set('BACKUP_LAST_RUN', new Date().toISOString());
            }

        } catch (error) {
            console.error('[BackupJob] Error in scheduler check:', error);
        }
    },

    performBackup: async (email: string) => {
        console.log(`[BackupJob] Performing backup for ${email}...`);
        try {
            // Get Password (if any)
            const password = await SettingsService.get('BACKUP_PASSWORD'); // Automatically decrypted by service if encrypted

            // Generate ZIP
            const zipBuffer = await BackupService.generateBackupZip(password || undefined);

            // Check Size Limit (25MB = 25 * 1024 * 1024 bytes)
            const MAX_SIZE_BYTES = 25 * 1024 * 1024;
            const isTooLarge = zipBuffer.length > MAX_SIZE_BYTES;

            // Send Email
            const smtpConfig = await SettingsService.getSmtpConfig();
            if (!smtpConfig.host || !smtpConfig.user || !smtpConfig.password) {
                console.error('[BackupJob] Cannot send backup: SMTP not configured.');
                return;
            }

            const transporter = nodemailer.createTransport({
                host: smtpConfig.host,
                port: parseInt(smtpConfig.port),
                secure: parseInt(smtpConfig.port) === 465,
                auth: {
                    user: smtpConfig.user,
                    pass: smtpConfig.password
                }
            });

            const dateStr = new Date().toISOString().split('T')[0];
            const filename = `stocks-manager-backup-${dateStr}.zip`;

            if (isTooLarge) {
                // Send Notification ONLY
                await transporter.sendMail({
                    from: smtpConfig.from || smtpConfig.user,
                    to: email,
                    subject: `[Stocks Manager] Backup Automático - ${dateStr} (Archivo Grande)`,
                    text: `La copia de seguridad se ha generado correctamente pero excede el límite de tamaño para envío por correo (${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB). Por favor, descarga la copia manualmente desde el panel de administración.`,
                    html: `
                        <h3>Copia de Seguridad Automática</h3>
                        <p>La copia de seguridad se ha generado correctamente.</p>
                        <p><strong>Estado:</strong> <span style="color: orange;">No adjuntada (Tamaño Excedido)</span></p>
                        <p>El archivo ocupa <strong>${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB</strong>, lo cual supera el límite de envío por correo.</p>
                        <p>Por favor, accede al panel de administración para descargarla manualmente.</p>
                    `
                });
                console.log(`[BackupJob] Backup notification sent (File too large: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
            } else {
                // Send Attachment
                await transporter.sendMail({
                    from: smtpConfig.from || smtpConfig.user,
                    to: email,
                    subject: `[Stocks Manager] Backup Automático - ${dateStr}`,
                    text: `Adjunto encontrarás la copia de seguridad automática de tu sistema Stocks Manager realizada el ${dateStr}.${password ? ' El archivo está protegido con contraseña.' : ''}`,
                    html: `
                        <h3>Copia de Seguridad Automática</h3>
                        <p>Adjunto encontrarás la copia de seguridad de tu sistema.</p>
                        <p><strong>Fecha y Hora:</strong> ${new Date().toLocaleString('es-ES', { timeZone: 'Europe/Madrid' })}</p>
                        ${password ? '<p><strong>Nota:</strong> El archivo está protegido con la contraseña configurada.</p>' : ''}
                        <p>Guarda este archivo en un lugar seguro.</p>
                    `,
                    attachments: [
                        {
                            filename: filename,
                            content: zipBuffer
                        }
                    ]
                });
                console.log(`[BackupJob] Backup sent successfully to ${email}`);
            }

        } catch (error) {
            console.error('[BackupJob] Failed to perform backup:', error);
        }
    }
};
