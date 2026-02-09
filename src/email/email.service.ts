// src/email/email.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { Transporter } from 'nodemailer';

export interface EmailTemplate {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: Transporter;

  constructor(private configService: ConfigService) {
    this.createTransporter();
  }

  private createTransporter() {
    const emailConfig = {
      host: this.configService.get<string>('SMTP_HOST'),
      port: this.configService.get<number>('SMTP_PORT', 587),
      secure: this.configService.get<boolean>('SMTP_SECURE', false), // true para 465, false para otros puertos
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
      // Configuraciones adicionales para mejorar la entrega
      pool: true,
      maxConnections: 5,
      maxMessages: 10,
      rateLimit: 5, // máximo 5 emails por segundo
    };

    this.transporter = nodemailer.createTransport(emailConfig);

    // Verificar la configuración al inicializar
    this.verifyConnection();
  }

  private async verifyConnection() {
    try {
      await this.transporter.verify();
      this.logger.log('✅ Conexión SMTP establecida correctamente');
    } catch (error) {
      this.logger.error('❌ Error al conectar con el servidor SMTP:','erorr :', error.message);
    }
  }

  async sendEmail(emailTemplate: EmailTemplate): Promise<boolean> {
    try {
      const mailOptions = {
        from: {
          name: this.configService.get<string>('EMAIL_FROM_NAME', 'Sistema de Autenticación'),
          address: this.configService.get<string>('EMAIL_FROM_ADDRESS', this.configService.get<string>('SMTP_USER')),
        },
        to: emailTemplate.to,
        subject: emailTemplate.subject,
        html: emailTemplate.html,
        text: emailTemplate.text,
        // Configuraciones adicionales de seguridad
        headers: {
          'X-Priority': '1',
          'X-MSMail-Priority': 'High',
          'Importance': 'high'
        }
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      this.logger.log(`✅ Email enviado exitosamente a ${emailTemplate.to}. MessageId: ${info.messageId}`);
      return true;

    } catch (error) {
      this.logger.error(`❌ Error al enviar email a ${emailTemplate.to}:`, error.message);
      return false;
    }
  }

  async sendPasswordResetToken(email: string, token: string, expiresAt: Date): Promise<boolean> {
    const userName = email.split('@')[0]; // Extraer nombre del email
    const expirationTime = this.formatExpirationTime(expiresAt);

    const emailTemplate: EmailTemplate = {
      to: email,
      subject: '🔐 Código de verificación para cambio de contraseña',
      html: this.generatePasswordResetHTML(userName, token, expirationTime),
      text: this.generatePasswordResetText(userName, token, expirationTime)
    };

    return this.sendEmail(emailTemplate);
  }

  private generatePasswordResetHTML(userName: string, token: string, expirationTime: string): string {
    return `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Código de Verificación</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f4f4f4;
          }
          .container {
            background-color: #ffffff;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            border-bottom: 3px solid #007bff;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 {
            color: #007bff;
            margin: 0;
            font-size: 24px;
          }
          .token-container {
            background: linear-gradient(135deg, #007bff, #0056b3);
            color: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            margin: 25px 0;
          }
          .token {
            font-size: 32px;
            font-weight: bold;
            letter-spacing: 8px;
            margin: 10px 0;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
          }
          .warning {
            background-color: #fff3cd;
            border: 1px solid #ffeaa7;
            color: #856404;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
          .footer {
            margin-top: 30px;
            text-align: center;
            color: #6c757d;
            font-size: 12px;
            border-top: 1px solid #dee2e6;
            padding-top: 20px;
          }
          .security-tip {
            background-color: #d1ecf1;
            border: 1px solid #bee5eb;
            color: #0c5460;
            padding: 15px;
            border-radius: 5px;
            margin: 20px 0;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Verificación de Identidad</h1>
          </div>
          
          <p>Hola <strong>${userName}</strong>,</p>
          
          <p>Has solicitado cambiar tu contraseña. Para continuar con el proceso, utiliza el siguiente código de verificación:</p>
          
          <div class="token-container">
            <div>Tu código de verificación es:</div>
            <div class="token">${token}</div>
          </div>
          
          <div class="warning">
            <strong>⏰ Tiempo límite:</strong> Este código expira el <strong>${expirationTime}</strong>.<br>
            <strong>🚫 Un solo uso:</strong> El código solo puede ser utilizado una vez.
          </div>
          
          <div class="security-tip">
            <strong>🛡️ Consejos de seguridad:</strong>
            <ul>
              <li>Nunca compartas este código con nadie</li>
              <li>Si no solicitaste este cambio, ignora este email</li>
              <li>El código tiene un límite de 3 intentos</li>
            </ul>
          </div>
          
          <p>Si tienes problemas o no solicitaste este cambio, contacta a nuestro equipo de soporte.</p>
          
          <div class="footer">
            <p>Este es un mensaje automático, no responder a este email.</p>
            <p>© ${new Date().getFullYear()} Sistema de Autenticación. Todos los derechos reservados.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generatePasswordResetText(userName: string, token: string, expirationTime: string): string {
    return `
      Código de Verificación - Cambio de Contraseña
      
      Hola ${userName},
      
      Has solicitado cambiar tu contraseña. Para continuar, utiliza este código:
      
      CÓDIGO: ${token}
      
      IMPORTANTE:
      - Este código expira el ${expirationTime}
      - Solo puede ser usado una vez
      - Máximo 3 intentos permitidos
      
      SEGURIDAD:
      - Nunca compartas este código
      - Si no solicitaste este cambio, ignora este email
      
      © ${new Date().getFullYear()} Sistema de Autenticación
    `;
  }

  private formatExpirationTime(expiresAt: Date): string {
    return expiresAt.toLocaleString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'America/Bogota' // Ajusta según tu zona horaria
    });
  }

  // Método para cerrar la conexión cuando sea necesario
  async close(): Promise<void> {
    if (this.transporter) {
      this.transporter.close();
      this.logger.log('🔌 Conexión SMTP cerrada');
    }
  }
}