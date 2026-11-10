import { AccountEmailComposer } from '@application/notifications/account-email.composer';
import { OutboxMessage } from '@domain/messaging/message-catalog';

describe('AccountEmailComposer', () => {
  const toEmail = 'ana@example.com';
  const toName = 'Ana <b>&</b>';

  const cases: Array<{
    label: string;
    purpose: string;
    subject: string;
    secret: string;
    build: () => OutboxMessage;
  }> = [
    {
      label: 'staffInitialPassword',
      purpose: 'staff_initial_password',
      subject: 'Sua conta na Oficina Mecânica foi criada',
      secret: 'Senha inicial: S3nha!',
      build: () =>
        AccountEmailComposer.staffInitialPassword({ toEmail, toName, password: 'S3nha!' }),
    },
    {
      label: 'customerInitialPassword',
      purpose: 'customer_initial_password',
      subject: 'Seu acesso à Oficina Mecânica foi criado',
      secret: 'Senha inicial: S3nha!',
      build: () =>
        AccountEmailComposer.customerInitialPassword({ toEmail, toName, password: 'S3nha!' }),
    },
    {
      label: 'passwordResetCode',
      purpose: 'password_reset_code',
      subject: 'Código para redefinição de senha',
      secret: 'Código: 123456',
      build: () => AccountEmailComposer.passwordResetCode({ toEmail, toName, code: '123456' }),
    },
  ];

  it.each(cases)('should set purpose to $purpose for $label', ({ build, purpose }) => {
    const message = build();

    expect(message.type).toBe('notification.email.send');
    expect(message.workOrderId).toBeNull();
    expect(message.payload.purpose).toBe(purpose);
  });

  it.each(cases)('should address the e-mail to the user for $label', ({ build, subject }) => {
    const message = build();

    expect(message.payload.to).toEqual([toEmail]);
    expect(message.payload.subject).toBe(subject);
  });

  it.each(cases)(
    'should escape the name in the html and keep it in the text for $label',
    ({ build, secret }) => {
      const message = build();

      expect(message.payload.html).toContain('Ana &lt;b&gt;&amp;&lt;/b&gt;');
      expect(message.payload.html).not.toContain('<b>');
      expect(message.payload.text).toContain('Olá Ana <b>&</b>,');
      expect(message.payload.text).toContain(secret);
    },
  );

  it('should escape quotes in the html', () => {
    const message = AccountEmailComposer.passwordResetCode({
      toEmail,
      toName: `"A" 'B'`,
      code: '123456',
    });

    expect(message.payload.html).toContain('&quot;A&quot; &#39;B&#39;');
  });
});
