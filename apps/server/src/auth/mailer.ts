import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';

import type { Config } from '../config.js';
import type { Logger } from '../infra/logger.js';

export interface Mailer {
  sendPasswordReset(to: string, resetUrl: string): Promise<void>;
}

export function createMailer(config: Config, logger: Logger): Mailer {
  let transporter: Transporter | null = null;
  if (config.smtpUrl !== undefined && config.smtpUrl !== '') {
    transporter = createTransport(config.smtpUrl);
  }

  return {
    async sendPasswordReset(to, resetUrl) {
      if (transporter === null) {
        logger.warn(
          { to, resetUrl },
          'SMTP no configurado: enlace de restablecimiento escrito en los logs',
        );
        return;
      }
      await transporter.sendMail({
        from: config.mailFrom,
        to,
        subject: 'Restablece tu contraseña de Flota Táctica',
        text: [
          'Abre este enlace para elegir una nueva contraseña:',
          '',
          resetUrl,
          '',
          'El enlace caduca pronto. Si no lo has solicitado, ignora este mensaje.',
        ].join('\n'),
      });
    },
  };
}
