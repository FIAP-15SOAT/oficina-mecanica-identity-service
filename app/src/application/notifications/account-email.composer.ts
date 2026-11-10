import { OutboxMessage } from '@domain/messaging/message-catalog';

type InitialPasswordInput = { toEmail: string; toName: string; password: string };
type ResetCodeInput = { toEmail: string; toName: string; code: string };

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

// The name is user-typed and goes into HTML; escape it so it cannot inject markup
function escapeHtml(value: string): string {
  return value.replaceAll(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

function emailMessage(
  toEmail: string,
  purpose: string,
  subject: string,
  text: string,
  html: string,
): OutboxMessage {
  return {
    type: 'notification.email.send',
    workOrderId: null,
    payload: { to: [toEmail], subject, text, html, purpose },
  };
}

export class AccountEmailComposer {
  static staffInitialPassword(input: InitialPasswordInput): OutboxMessage {
    const name = escapeHtml(input.toName);

    return emailMessage(
      input.toEmail,
      'staff_initial_password',
      'Sua conta na Oficina Mecânica foi criada',
      `Olá ${input.toName},\n\n` +
        `Sua conta de funcionário foi criada.\n` +
        `Senha inicial: ${input.password}\n\n` +
        `Recomendamos trocar a senha após o primeiro acesso.\n\n` +
        `Atenciosamente,\nEquipe da Oficina Mecânica`,
      `<p>Olá <strong>${name}</strong>,</p>` +
        `<p>Sua conta de funcionário foi criada.</p>` +
        `<p><strong>Senha inicial:</strong> ${escapeHtml(input.password)}</p>` +
        `<p>Recomendamos trocar a senha após o primeiro acesso.</p>` +
        `<p>Atenciosamente,<br/>Equipe da Oficina Mecânica</p>`,
    );
  }

  static customerInitialPassword(input: InitialPasswordInput): OutboxMessage {
    const name = escapeHtml(input.toName);

    return emailMessage(
      input.toEmail,
      'customer_initial_password',
      'Seu acesso à Oficina Mecânica foi criado',
      `Olá ${input.toName},\n\n` +
        `Uma conta foi criada para você acessar a Oficina Mecânica.\n` +
        `Senha inicial: ${input.password}\n\n` +
        `Recomendamos trocar a senha após o primeiro acesso.\n\n` +
        `Atenciosamente,\nEquipe da Oficina Mecânica`,
      `<p>Olá <strong>${name}</strong>,</p>` +
        `<p>Uma conta foi criada para você acessar a Oficina Mecânica.</p>` +
        `<p><strong>Senha inicial:</strong> ${escapeHtml(input.password)}</p>` +
        `<p>Recomendamos trocar a senha após o primeiro acesso.</p>` +
        `<p>Atenciosamente,<br/>Equipe da Oficina Mecânica</p>`,
    );
  }

  static passwordResetCode(input: ResetCodeInput): OutboxMessage {
    const name = escapeHtml(input.toName);

    return emailMessage(
      input.toEmail,
      'password_reset_code',
      'Código para redefinição de senha',
      `Olá ${input.toName},\n\n` +
        `Use o código abaixo para redefinir sua senha. Ele expira em 10 minutos.\n\n` +
        `Código: ${input.code}\n\n` +
        `Se você não solicitou este código, ignore este e-mail.`,
      `<p>Olá <strong>${name}</strong>,</p>` +
        `<p>Use o código abaixo para redefinir sua senha. Ele expira em 10 minutos.</p>` +
        `<p style="font-size: 24px; font-weight: bold;">${escapeHtml(input.code)}</p>` +
        `<p>Se você não solicitou este código, ignore este e-mail.</p>`,
    );
  }
}
