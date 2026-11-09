# Mensageria

O Identity só publica mensagens: os e-mails de conta, como `notification.email.send`, no tópico SNS FIFO `oficina-events.fifo`. Quem os entrega é a Lambda de notificação, a função `oficina-mecanica-lambda-notification`, que lê a fila SQS FIFO `notification.fifo`, assinante do tópico, e envia o e-mail. O Identity não fala SMTP e não consome nenhuma fila. A topologia (tópico, filas, DLQs e filter policies) vem do repositório `oficina-mecanica-infra-messaging`; a mecânica do outbox (a tabela onde a mensagem é gravada na mesma transação do dado) e do relay (a rotina que publica as linhas do outbox e as apaga) está em [Arquitetura](architecture.md#mensageria-com-outbox). O tipo e o payload vêm do catálogo tipado e fechado de `app/src/domain/messaging/`.

## Índice

- [Envelope e chaves](#envelope-e-chaves)
- [`notification.email.send`](#notificationemailsend)
- [E-mails de conta](#e-mails-de-conta)
- [Senha e código em trânsito](#senha-e-código-em-trânsito)

## Envelope e chaves

Toda mensagem tem `messageId` (UUID), `type`, `occurredAt`, `workOrderId` e `payload`; o contexto W3C de trace (`traceparent`) vai nos atributos da mensagem, gravado na linha do outbox junto com ela.

| Atributo SNS | Valor | Efeito |
| --- | --- | --- |
| `MessageGroupId` | `messageId` (as mensagens do Identity não pertencem a uma ordem de serviço, então `workOrderId` é `null`) | Cada mensagem forma o próprio grupo FIFO: um e-mail com falha na Lambda não segura os outros |
| `MessageDeduplicationId` | `messageId` | O SNS descarta a mesma mensagem publicada de novo pelo relay dentro da janela de deduplicação |
| `type` | `notification.email.send` | A filter policy do tópico entrega o tipo só à fila `notification.fifo` |

## `notification.email.send`

Payload: `{ to, subject, text, html, purpose }`.

| Campo | Conteúdo |
| --- | --- |
| `to` | Lista com o e-mail do usuário |
| `subject` | Assunto em português |
| `text` | Corpo em texto puro |
| `html` | Corpo em HTML, com o nome do usuário escapado (o nome é digitado por quem cadastra e não pode injetar marcação) |
| `purpose` | Rótulo do e-mail em snake_case, que a Lambda registra no log no lugar do assunto |

Os textos ficam no `AccountEmailComposer` (`app/src/application/notifications/account-email.composer.ts`), um método por e-mail, e o `purpose` de cada um é um literal conferido nos testes unitários.

## E-mails de conta

| `purpose` | Quem grava | Quando e em que transação | Conteúdo |
| --- | --- | --- | --- |
| `staff_initial_password` | `CreateUserUseCase` | `POST /api/users`, na mesma transação que cria o funcionário | Senha inicial de 12 caracteres e a recomendação de trocá-la no primeiro acesso |
| `customer_initial_password` | `EnsureCustomerUserUseCase` | `POST /internal/customer-users`, só quando cria o usuário, na mesma transação | Senha inicial de 12 caracteres e a recomendação de trocá-la no primeiro acesso |
| `password_reset_code` | `IssuePasswordResetCodeUseCase` | `POST /api/users/:userId/password-resets`, depois de gravar o código no Valkey | Código de 6 dígitos, que expira em 10 minutos |

- **Senhas iniciais na mesma transação.** Se a criação do usuário é desfeita, o e-mail também é; se ela confirma, o e-mail sai, mesmo que o processo caia logo depois.
- **Código depois do Valkey.** O código é gravado no Valkey antes do outbox: se o outbox falhar, a requisição responde 500 e nenhum e-mail sai com um código que ninguém consegue confirmar. O `ADMIN` pede outro código, que substitui o anterior.
- **Repetição do usuário de acesso.** `POST /internal/customer-users` é idempotente pelo CPF: a segunda chamada para o mesmo CPF devolve `created = false` e não grava outro e-mail.

## Senha e código em trânsito

A senha inicial e o código de redefinição são a única informação sensível em texto que sai do Identity, e só por esse caminho:

1. na linha da tabela `outbox` do PostgreSQL do Identity, até o relay publicá-la e apagá-la na mesma transação;
2. na mensagem, no SNS e na fila `notification.fifo`, com criptografia em repouso e retenção de 1 dia, até a Lambda enviar o e-mail.

Nunca aparecem em log: o catálogo de log não tem campo para senha, código nem corpo de e-mail, e os eventos de negócio levam só ids (por exemplo `user.password_reset.issued`, com o id de quem pediu e o do usuário). No banco e no Valkey, a senha e o código ficam só como hash bcrypt.
