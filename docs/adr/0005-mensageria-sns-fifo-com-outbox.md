# ADR 0005: Publicação no SNS FIFO com outbox transacional

## Status

Aceito — 2026-11-05. Herdada da ADR 0005 do Inventory (ADR 0018 do Work Order), adaptada ao Identity, que só publica.

## Contexto

O Identity é dono do próprio PostgreSQL e vai avisar outros componentes por mensagem: os e-mails de conta (senha inicial e código de redefinição de senha) saem como mensagens `notification.email.send` que a Lambda de notificação, a função `oficina-mecanica-lambda-notification`, lê da fila SQS FIFO `notification.fifo` e envia. O SNS não participa da transação do PostgreSQL, então gravar o estado e publicar em seguida é uma dupla escrita: se o processo cair entre as duas, o e-mail se perde ou sai para uma mudança desfeita (por exemplo, um código de redefinição que nunca foi gravado). Na solução, as mensagens de uma mesma ordem de serviço (OS) precisam chegar em ordem; as do Identity não pertencem a nenhuma OS. O Identity não precisa receber nada de outro serviço.

## Decisão

Outbox transacional no PostgreSQL do serviço, relay no próprio processo e publicação no tópico SNS FIFO da solução. Nenhum consumidor de fila.

1. **Outbox.** A mensagem é uma linha da tabela `outbox`, gravada pelo `IOutboxRepository` na mesma transação do Unit of Work que muda o estado. O tipo e o payload vêm de um catálogo tipado em `domain/messaging/` (hoje só `notification.email.send`).
2. **Relay** (`OutboxRelayService`): a cada 500 ms abre uma transação, toma `pg_try_advisory_xact_lock` (só uma réplica publica), lê até 10 linhas por `id`, publica uma a uma e apaga as publicadas na mesma transação. Para na primeira falha, para não furar a ordem.
3. **Tópico e filas.** Um tópico `oficina-events.fifo` para a solução e uma fila por consumidor, com filter policy (o filtro do SNS por atributo) pelo atributo `type`. Quem consome as mensagens do Identity é a fila `notification.fifo`, com a DLQ (dead-letter queue, a fila que guarda as mensagens que falharam 5 vezes) dela; ambas são da Lambda e do `oficina-mecanica-infra-messaging`, não deste serviço.
4. **`MessageGroupId` = `workOrderId`, ou o `messageId` quando a mensagem não tem OS** (`row.workOrderId ?? row.messageId`, no relay). Com OS, a ordem é por OS. Sem OS, que é o caso de todas as mensagens do Identity, cada mensagem forma o próprio grupo: não há ordem a preservar entre e-mails de contas diferentes, e uma mensagem com falha na Lambda não segura as demais. O `MessageDeduplicationId` é o `messageId`.
5. **Envelope** de cinco campos (`messageId`, `type`, `occurredAt`, `workOrderId`, `payload`); correlação e causalidade pelo contexto W3C nos atributos, gravado no outbox.
6. **Sem consumidor.** O serviço não tem fila, DLQ, variável de nome de fila nem dependência de consumo em produção.

## Alternativas consideradas

| Alternativa | Trade-off | Rever se |
| --- | --- | --- |
| Publicar no SNS dentro ou logo depois da transação, com retry em memória | Menos código, mas é a dupla escrita e perde ou inventa e-mails | — |
| Chamar a Lambda ou um serviço de e-mail direto, de forma síncrona | Sem mensageria, mas a requisição do usuário passa a depender da disponibilidade do envio e repete o e-mail em cada retry | — |
| `MessageGroupId` fixo para o serviço inteiro | Ordem total, mas serializa tudo e uma mensagem com falha bloqueia todas | — |
| `MessageGroupId` ausente quando não há OS | Não é aceito pelo SNS FIFO: o grupo é obrigatório | — |
| Grupo constante (por exemplo `no-work-order`) para as mensagens sem OS | Simples, mas junta mensagens independentes num grupo só e uma falha bloqueia as outras | Surgir ordem entre mensagens sem OS |
| `MessageGroupId` = id do usuário | Ordenaria os e-mails de uma mesma conta, mas nenhuma regra exige essa ordem e o relay teria um caso especial só para o Identity | Surgir ordem obrigatória entre e-mails da mesma conta |
| Vários relays com `FOR UPDATE SKIP LOCKED` | Publica em paralelo, mas furaria a ordem do grupo entre réplicas | O volume exigir paralelismo |
| Relay como processo ou Job separado | Isola a carga, mas soma deployment, credenciais e ponto de falha | A carga do relay competir com as requisições |
| Copiar o consumidor SQS dos outros serviços e deixá-lo sem fila | Mantém o código igual ao template, mas exige um caminho "sem fila" que nenhum outro serviço tem, contraria a consulta da fila no boot, que falha rápido, e deixa código morto | O Identity precisar consumir alguma mensagem |

## Consequências

### Positivas

- Nenhuma mudança de estado fica sem aviso, e nenhum aviso sai de estado desfeito.
- Mensagens sem OS não competem entre si: um e-mail com problema não atrasa os outros.
- O trace segue da requisição que gravou a mensagem até a Lambda que envia o e-mail.

### Negativas e limites

- Latência de até cerca de 500 ms entre o commit e a publicação.
- Uma falha persistente na publicação segura todas as mensagens do serviço, porque o relay para no primeiro erro: o evento de log `messaging.outbox.publish_failed` precisa de monitor.
- Entrega pelo menos uma vez: a Lambda pode receber a mesma mensagem mais de uma vez e precisa tratá-la como idempotente.
- Se o Identity um dia precisar consumir, o consumidor terá de ser trazido do template.

## Referências

- [Arquitetura › Mensageria com outbox](../architecture.md#mensageria-com-outbox)
- [AWS — SNS FIFO topics](https://docs.aws.amazon.com/sns/latest/dg/sns-fifo-topics.html)
- [Transactional outbox](https://microservices.io/patterns/data/transactional-outbox.html)
