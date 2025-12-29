
import nodemailer from 'nodemailer';
import { SettingsService } from './settingsService';

export const EmailService = {
    sendEmail: async (to: string, subject: string, html: string) => {
        const smtpConfig = await SettingsService.getSmtpConfig();

        if (!smtpConfig.host || !smtpConfig.user) {
            console.warn('SMTP settings not configured. Cannot send email.');
            return false;
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

        const mailOptions = {
            from: smtpConfig.from || smtpConfig.user,
            to: to,
            subject: subject,
            html: html
        };

        try {
            await transporter.sendMail(mailOptions);

            return true;
        } catch (error) {
            console.error('Error sending email:', error);
            return false;
        }
    }
};
