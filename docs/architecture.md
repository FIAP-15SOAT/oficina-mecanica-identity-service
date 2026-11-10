# Arquitetura

Visão do Identity Service como está no repositório: o serviço dono dos usuários, dos papéis e das credenciais da oficina, e o único emissor do token de funcionário. As decisões estão nas [ADRs](adr/).

<p align="center"><img src="diagrams/identity-service.drawio.png" alt="Identity Service: componentes e integrações. O funcionário chama /api com o token RS256 e o cliente da oficina chama só /api/me com o token da customer-auth; as rotas /internal são o contrato oferecido ao Work Order e à customer-auth, em linha tracejada; os use cases usam os repositórios Prisma (users e outbox no PostgreSQL), o ICache e o IPasswordResetCodeStore sobre o Valkey, o JwtTokenService com bcrypt e o gateway que chama GET /internal/users/:userId/customers no Work Order; o relay publica o outbox no SNS FIFO oficina-events.fifo, que entrega à fila notification.fifo da Lambda de notificação" width="100%"></p>

## Índice

- [Camadas](#camadas)
- [Agregado User](#agregado-user)
- [Emissão e validação dos tokens](#emissão-e-validação-dos-tokens)
- [Redefinição de senha no Valkey](#redefinição-de-senha-no-valkey)
- [Perfil do usuário autenticado](#perfil-do-usuário-autenticado)
- [Rotas internas](#rotas-internas)
- [Componentes copiados do template](#componentes-copiados-do-template)
- [Mensageria com outbox](#mensageria-com-outbox)
- [Cache do dono](#cache-do-dono)
- [Autenticação e Swagger](#autenticação-e-swagger)
- [Exceções por camada](#exceções-por-camada)
- [Diagrama de componentes (C4 nível 3)](#diagrama-de-componentes-c4-nível-3)

## Camadas

Clean Architecture com regra de dependência única: o código aponta só para dentro. A regra é imposta pelas regras `no-restricted-imports` de `app/eslint.config.mjs`, que falham o `npm run lint` quando uma camada interna importa framework, ORM, telemetria ou SDK externo.

| Camada | Pasta (`app/src/`) | Conteúdo | Pode importar |
| --- | --- | --- | --- |
| Domínio | `domain/` | Entidade `User`, value objects `Email` e `Cpf` com o validador de CPF, regra de senha forte, geradores de senha inicial e de código de redefinição, catálogo tipado de mensagens (`messaging/`), exceções de domínio, portas de repositório (`IUserRepository`, `IOutboxRepository`, `IUnitOfWork`) e o enum de papéis (`UserRole`) | Nada de `@nestjs/*`, Prisma (`@generated/*`), `@opentelemetry/*`, `@aws-sdk/*`, `ioredis` nem `bcrypt` |
| Aplicação | `application/` | Use cases de `auth/`, `user/` e `me/`, portas de entrada (`ports/input/`) e de saída (`ICache`, `IHashService`, `ITokenService`, `IPasswordResetCodeStore`, `ILogger`, `IMetrics` e o gateway do Work Order), o montador dos e-mails de conta (`AccountEmailComposer`), as chaves de cache, o principal autenticado, exceções e catálogos de log | Idem |
| Adaptadores de interface | `interface-adapters/` | Clean Controllers e Presenters de `auth/`, `user/` e `me/`, inclusive o Clean Controller das rotas internas | Idem |
| Infraestrutura | `infrastructure/` | Borda HTTP do NestJS, Prisma, mensageria, cache e código de redefinição no Valkey, gateway HTTP do Work Order, `JwtTokenService` e `BcryptHashService`, logging, telemetria, health | Tudo; só `infrastructure/persistence/prisma/` importa o Prisma |

Use cases e Clean Controllers são classes sem `@Injectable`: o módulo Nest os compõe com `useFactory` e o `@Controller` fino de `infrastructure/http/controllers/` só delega ao Clean Controller. A porta de saída para outro serviço é um gateway em `application/ports/output/gateways/work-order/`, com o adaptador em `infrastructure/gateways/work-order/` sobre o `InternalHttpClient`; o use case nunca recebe o formato de resposta do Work Order sem tradução.

## Agregado User

`User` (`domain/entities/user.entity.ts`) guarda nome (3 a 150 caracteres), e-mail (value object `Email`, único, gravado em minúsculas), CPF opcional (value object `Cpf`, único, com dígitos verificadores conferidos), hash da senha, papel, `isActive` e `passwordChangedAt`.

- **Papel nulo para cliente.** Funcionário tem `ADMIN`, `MECHANIC` ou `ATTENDANT`. O usuário de acesso de um cliente da oficina não tem papel: não faz login de funcionário e só entra pelo fluxo da customer-auth.
- **Senha forte.** `User.validatePasswordStrength` exige no mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial; a senha fraca responde 422 com a mensagem da regra.
- **`passwordChangedAt`.** Toda troca de senha passa por `User.changePassword`, que atualiza o campo. O refresh token compara o próprio `iat` (o instante de emissão) com ele e recusa o emitido antes da troca.
- **Ativação.** `activate` e `deactivate` recusam com 422 o usuário que já está no status pedido. O usuário desativado não faz login nem refresh.
- **Senha inicial.** `PasswordGenerator` gera 12 caracteres que atendem à regra de senha forte; o código de redefinição é gerado pelo `ResetCodeGenerator`, com 6 dígitos.

Os use cases de usuário estão em `application/use-cases/user/`: criar (com a senha inicial enviada por e-mail pelo outbox, na mesma transação), listar paginado com filtro por papel e nome, buscar por id (com cache), atualizar, mudar status, excluir e o usuário de acesso do cliente (`EnsureCustomerUserUseCase`).

## Emissão e validação dos tokens

<p align="center"><img src="diagrams/login-sequence.drawio.png" alt="Diagrama de sequência UML do login e do refresh do funcionário: o AuthController (NestJS) valida o corpo (400) e delega ao AuthController (Clean Architecture); o AuthenticateUserUseCase lê o usuário pelo e-mail no PostgreSQL, compara a senha com bcrypt e responde 401 Credenciais inválidas ao usuário inexistente, desativado, com senha errada ou sem papel; senão o JwtTokenService assina o access de 10 minutos e o refresh de 7 dias. No refresh, o RefreshTokenUseCase confere o token, relê o usuário e responde 401 Refresh token inválido ou expirado ao token inválido, ao usuário inexistente, desativado ou sem papel e ao refresh emitido antes da última troca de senha" width="100%"></p>

`POST /api/auth/login` lê o usuário pelo e-mail no PostgreSQL (nunca no cache), exige usuário ativo, senha correta e papel, e devolve o par de tokens com os dados do usuário. Qualquer recusa responde 401 com `Credenciais inválidas`, e o motivo (`unknown_user`, `inactive_user`, `wrong_password` ou `no_internal_role`) vai só para o evento de log `auth.authentication.failed`. `POST /api/auth/refresh` confere o refresh token, relê o usuário e troca o refresh por um par novo.

| Token | Claims e cabeçalho | Validade | Chave |
| --- | --- | --- | --- |
| Access | `sub`, `email`, `name`, `role`, `typ = access`, `iss = oficina-identity`, `aud = oficina-services`; `kid` no cabeçalho | 10 min (`STAFF_JWT_EXPIRATION`) | Assinado com `STAFF_JWT_PRIVATE_KEY`; validado com `STAFF_JWT_PUBLIC_KEY` |
| Refresh | Os mesmos `sub`, `email`, `name` e `role`, `typ = refresh`, `iss` e `aud = oficina-identity`; sem `kid` | 7 dias (`STAFF_JWT_REFRESH_EXPIRATION`) | Assinado e conferido com `STAFF_JWT_REFRESH_PRIVATE_KEY`; só o Identity o lê |

O `JwtTokenService` (`infrastructure/services/jwt-token.service.ts`) usa o `@nestjs/jwt` em RS256. Os outros serviços e as demais rotas do Identity validam o access só pela assinatura e pelos claims, sem consultar o usuário: a desativação e a troca de senha valem na hora para login e refresh, e para o access que já foi emitido só quando ele expira, em até 10 minutos. A janela e as chaves estão em [Segurança](security.md) e a decisão, na [ADR 0007](adr/0007-identity-unico-emissor-do-token-de-funcionario.md).

## Redefinição de senha no Valkey

<p align="center"><img src="diagrams/password-reset-sequence.drawio.png" alt="Diagrama de sequência UML da redefinição de senha. No pedido, o ADMIN chama POST /api/users/:userId/password-resets; o IssuePasswordResetCodeUseCase lê o usuário (404), gera o código de 6 dígitos, grava o hash em identity:reset-code:userId com MULTI, HSET e EXPIRE 600 (503 com o Valkey fora do ar, sem e-mail) e grava notification.email.send com purpose password_reset_code no outbox. Na confirmação, o usuário chama POST /api/auth/password-reset-confirmations; o ConfirmPasswordResetUseCase recusa a senha fraca com 422 antes de qualquer conferência, lê o usuário pelo e-mail, conta a tentativa com um script Lua que só incrementa se a chave existe, responde 401 Código de redefinição inválido ou expirado ao e-mail sem usuário, à chave expirada, à sexta tentativa e ao código errado, grava a senha nova com password_changed_at, apaga a chave (503 se o Valkey falhar depois do commit) e invalida o cache do usuário" width="100%"></p>

O código de redefinição não é cache: é estado que só existe no Valkey. A porta `IPasswordResetCodeStore` fica em `application/ports/output/stores/`, e não em `services/` com as portas genéricas (cache, hash, token, log e métricas), porque guarda o estado de uma funcionalidade. Ela é separada do `ICache` porque o `ICache` engole as falhas do Valkey, e um código que não pode ser gravado nem conferido precisa falhar a requisição. O adaptador `ValkeyPasswordResetCodeStore` (`infrastructure/cache/`) abre o próprio cliente sobre `CACHE_URL` e o fecha no encerramento do processo.

- **Chave** `identity:reset-code:<userId>`: um hash do Valkey com os campos `codeHash` (o código com bcrypt, nunca o código em texto) e `attempts`.
- **Pedido** (`POST /api/users/:userId/password-resets`, só `ADMIN`): `HSET` e `EXPIRE 600` num `MULTI`/`EXEC`, para a chave nunca existir sem prazo; um pedido novo substitui o código pendente. O código é gravado no Valkey antes do e-mail entrar no outbox: se o outbox falhar, a resposta é 500 e o ADMIN pede outro código, em vez de um e-mail com um código que não existe.
- **Confirmação** (`POST /api/auth/password-reset-confirmations`, sem token): a força da senha nova é validada antes de tudo (422, sem gastar tentativa). Depois, um script Lua incrementa `attempts` e devolve o hash só se a chave existir, porque um `HINCRBY` numa chave expirada a recriaria sem prazo. E-mail sem usuário, chave expirada, sexta tentativa (mesmo com o código certo) e código errado respondem 401 com `Código de redefinição inválido ou expirado`. No sucesso, a senha muda, a chave é apagada e o cache do usuário é invalidado.
- **Valkey fora do ar**: o pedido e a confirmação respondem 503 com `Não foi possível processar o código de redefinição agora. Tente novamente em instantes`. Os casos de falha parcial e o reinício do Valkey estão no runbook de [Segurança](security.md#runbook).

A decisão e as alternativas estão na [ADR 0008](adr/0008-codigo-de-reset-no-valkey.md).

## Perfil do usuário autenticado

`GET /api/me` e `PATCH /api/me/password` aceitam o token de funcionário e o token de cliente, emitido pela customer-auth, a função Lambda de login do cliente. O decorator `@CustomerArea('any')` faz o `AuthenticationGuard` global passar a rota ao `AnyAuthGuard`, que tenta a estratégia de funcionário e depois a de cliente, cada uma com a própria chave e os próprios claims. Nenhuma das duas relê o usuário.

`GET /api/me` (`GetUserProfileUseCase`) lê o usuário pelo mesmo cache-aside de `GET /api/users/:id` e os clientes vinculados no Work Order, em `GET /internal/users/:userId/customers`, pelo gateway `IWorkOrderUserCustomersGateway` (prazo de 2 s). A resposta lista em `customers` só os clientes PJ (`COMPANY`), como `{ id, name, type }`. Work Order sem resposta, com erro 5xx ou com um 4xx (que aqui é quebra de contrato, porque o pedido não vem do usuário) responde 503 com `Não foi possível carregar os clientes vinculados agora. Tente novamente em instantes`. Usuário do token que não existe mais responde 404.

`PATCH /api/me/password` exige a senha atual correta (401 `Senha atual incorreta`), uma senha nova diferente da atual (409 `A nova senha não pode ser igual à senha atual`) e forte (422), grava `passwordChangedAt` e invalida o cache do usuário.

## Rotas internas

Rotas sob `/internal`, fora do prefixo `/api`, marcadas com `@Public()` e `@ApiExcludeController()`: não exigem token, não aparecem no Swagger e não são publicadas pelo API Gateway; só respondem pela rede do cluster. São o contrato que o Identity oferece ao Work Order e à customer-auth: hoje nenhum dos dois as chama ainda, e a customer-auth ainda confere a credencial do cliente no banco do Work Order.

| Rota | Consumidor do contrato | O que faz |
| --- | --- | --- |
| `GET /internal/users/:id` | Work Order | Devolve `{ id, name, email, role, isActive }` pelo cache-aside `identity:user:<id>`, ou 404. `role` é `null` para o usuário de cliente |
| `POST /internal/customer-users` | Work Order | Recebe `{ name, email, cpf }`. Reaproveita o usuário dono do CPF (`created = false`) ou cria um usuário sem papel com senha inicial, que vai por e-mail pelo outbox na mesma transação (`created = true`). Responde 409 se o e-mail é de um usuário diferente do dono do CPF. Idempotente pelo CPF |
| `POST /internal/customer-authentications` | customer-auth | Recebe `{ cpf, password }` e confere CPF válido, usuário ativo e senha, ignorando o papel (um funcionário que também é cliente entra por aqui). Devolve `{ userId }`; qualquer recusa responde 401 `Credenciais inválidas` com o mesmo corpo |

As respostas de sucesso estão versionadas como fixtures de contrato em `app/test/contracts/`, conferidas pelos testes E2E ([Testes](testing.md#fixtures-de-contrato)). O vínculo do usuário com o cliente (quem pode ver quais ordens de serviço) é do Work Order: o Identity guarda só o usuário.

## Componentes copiados do template

O esqueleto foi copiado do Inventory, que tem os mesmos componentes transversais do Work Order (o serviço que serve de template), sem domínio e sem o consumidor de fila:

- `infrastructure/config`: `configureApp` (prefixo global `api`, Helmet, que define os cabeçalhos HTTP de segurança, CORS, a lista de origens de navegador aceitas, `SanitizeStringsPipe`, `ValidationPipe` com `whitelist`, `forbidNonWhitelisted` e `transform`, Swagger) e `resolvePort`;
- `infrastructure/http`: filtros de exceção por camada, guard de autenticação deny-by-default (toda rota exige token, salvo as marcadas como públicas), estratégia JWT de funcionário, guard de papéis, interceptors e o middleware que devolve 404 JSON fora dos prefixos `api` e `internal`;
- `infrastructure/logging` e `infrastructure/telemetry`: uma linha JSON por evento no stdout (a saída padrão do processo), pela porta `ILogger` e por catálogos tipados, e o SDK OpenTelemetry carregado só por preload (`node --require ./dist/src/otel.js dist/src/main`);
- `infrastructure/health`: vivacidade e prontidão, com encerramento gracioso;
- `infrastructure/messaging`, `infrastructure/cache` e `infrastructure/clients`: relay do outbox e cliente SNS, adaptador Valkey e cliente HTTP interno `InternalHttpClient`.

O consumidor SQS dos outros serviços não foi copiado: o Identity só publica. Não há variável de nome de fila, nem dependência de consumo em produção; o `@aws-sdk/client-sqs` aparece só nas `devDependencies`, para os testes E2E lerem a fila assinante e conferirem o que foi publicado.

Migration e seed rodam só como passo separado (serviço `migrate` do Compose, Job do Kubernetes no CD), nunca no `CMD` da imagem.

## Mensageria com outbox

Consistência entre serviços só por mensagem com outbox gravado na mesma transação do produtor, por REST interno ou por Saga (sequência de passos entre serviços que desfaz os anteriores quando um falha) orquestrada pelo Work Order. O Identity é só produtor.

```text
caso de uso --(mesma transação)--> estado + linha em `outbox`
OutboxRelayService (500 ms) --> SNS FIFO oficina-events.fifo --> SQS FIFO notification.fifo --> Lambda de notificação
```

- **Tabela `outbox`**: `id` sequencial, `message_id` único, `type`, `work_order_id` (nulo quando a mensagem não pertence a uma ordem de serviço, a OS), `payload`, `trace_context` e `created_at`.
- **Relay** (`OutboxRelayService`): a cada 500 ms abre uma transação, toma `pg_try_advisory_xact_lock` (um lock do PostgreSQL que só uma transação obtém por vez, então só uma réplica publica), lê até 10 linhas por `id`, publica uma a uma e apaga as publicadas na mesma transação. Na primeira falha o lote para, para não furar a ordem, e registra `messaging.outbox.publish_failed`. Nenhuma publicação começa depois de 2 s de lote.
- **`MessageGroupId`**: no `PublishCommand` do relay é `workOrderId ?? messageId`. As mensagens do Identity não pertencem a uma OS, então cada uma forma o próprio grupo e não bloqueia nem é bloqueada por outras. O `MessageDeduplicationId` é o `messageId`, e o atributo `type` alimenta a filter policy (o filtro do SNS que decide quais filas recebem cada tipo).
- **Envelope**: `messageId`, `type`, `occurredAt`, `workOrderId` e `payload`. O contexto de trace no padrão W3C Trace Context (o atributo `traceparent`, que liga o consumidor ao mesmo trace da requisição que gravou a mensagem) vai gravado em `trace_context` na linha do outbox e sai nos atributos da mensagem.
- **Mensagens publicadas**: só `notification.email.send`, com os três e-mails de conta. O `purpose` de cada um, quando é gravado e onde a senha e o código existem estão em [Mensageria](messaging.md).
- **Sem consumidor**: o serviço não lê nenhuma fila e não tem DLQ (dead-letter queue, a fila que guarda mensagens que falharam repetidamente) própria; a DLQ de `notification.fifo` é da Lambda.
- **Topologia local**: no LocalStack, o emulador local dos serviços AWS, `app/localstack/init-topology.sh` é cópia do `oficina-mecanica-infra-messaging` e não é editado aqui. Ele cria o tópico e as filas de todos os consumidores da solução, inclusive `notification.fifo`.

## Cache do dono

A porta `ICache` (`get`, `set` com TTL, o tempo de vida de cada entrada, e `delete(keys[])`) tem o adaptador `ValkeyCacheAdapter` para o Valkey, que no cluster é o Amazon ElastiCache (`ioredis`, `CACHE_URL`, TTL de `CACHE_TTL_SECONDS`, padrão 43200 s). O cache é cache-aside e só do dono: este serviço guarda no próprio Valkey apenas dados que ele mesmo escreve.

- **Chave** `identity:user:<id>` (`application/keys/identity-cache-keys.ts`), com o usuário sem o hash da senha. É lida por `GET /api/users/:id`, `GET /internal/users/:id` e `GET /api/me`.
- **Valor versionado.** O JSON leva `cacheVersion`; um valor que o código atual não consegue ler (corrompido ou gravado por outra versão) conta como falta e é relido do banco.
- **404 não é guardado.** Só o usuário encontrado entra no cache.
- **Invalidação depois do commit.** Atualização, mudança de status, troca de senha, confirmação da redefinição e exclusão apagam a chave do usuário.
- **Login, refresh e redefinição** leem sempre o PostgreSQL, nunca o cache.

Falha do cache nunca derruba a API: a leitura devolve falta e registra `cache.unavailable`; falha na invalidação registra `cache.invalidation_failed` e a chave expira pelo TTL. Os códigos de redefinição ficam no mesmo Valkey, mas pela porta própria descrita acima.

## Autenticação e Swagger

- O guard global (`AuthenticationGuard`) exige o token de funcionário em toda rota, exceto as marcadas com `@Public()` (health checks, login, refresh, confirmação da redefinição e rotas internas) e as marcadas com `@CustomerArea('any')` (`/api/me`), que aceitam também o token de cliente. As rotas de `/api/users` exigem ainda o papel `ADMIN`, pelo `RolesGuard`.
- A validação é local e só pela assinatura: o token de funcionário com `STAFF_JWT_PUBLIC_KEY`, `kid`, `iss`, `aud`, `exp` e `typ`; o token de cliente com `CUSTOMER_JWT_PUBLIC_KEY`, `CUSTOMER_JWT_ISSUER` e `CUSTOMER_JWT_AUDIENCE`. Detalhes em [Segurança](security.md).
- O Swagger (`/api/docs` e `/api/docs-json`) é montado pelo `SwaggerModule.setup` direto no Express, **fora do router do Nest e do guard**: por isso responde sem token. É isso que permite ao DAST (o teste dinâmico de segurança, feito pelo OWASP ZAP contra a API no ar) ler `/api/docs-json` sem credencial. A UI declara o esquema Bearer `access-token` para testar as rotas protegidas.
- Toda chamada interna leva `x-request-id` e `traceparent`.

## Exceções por camada

Cada camada tem a própria hierarquia de exceções e um `APP_FILTER` global que a traduz em status HTTP: domínio (`DomainValidationException` → 422), aplicação (`ResourceNotFoundException` → 404, `ResourceConflictException` → 409, `UnauthorizedAccessException` → 401), infraestrutura (`ServiceIntegrationException` → 503) e o `AllExceptionsFilter` para o resto. O corpo de erro é o mesmo em todos os serviços, `{statusCode, error, message}` com a mensagem em português, e nunca carrega stack, host ou texto do driver.

## Diagrama de componentes (C4 nível 3)

<p align="center"><img src="c4/images/c4-component.png" alt="Diagrama de Componente C4 da API do Identity: o Funcionário e o Cliente da oficina apresentam os tokens ao componente Guards/Segurança, que encaminha às Autenticação e aos Usuários; as Rotas Internas são o contrato oferecido ao Work Order e à customer-auth, em linha tracejada; os componentes usam Tokens e Hash, Cache e Código de Reset sobre o ElastiCache Valkey, Repositories sobre o PostgreSQL e o Gateway do Work Order; a Mensageria publica o outbox no SNS, que entrega notification.email.send à Lambda de notificação" width="100%"></p>

A descrição de cada componente e dos elementos externos está em [`docs/c4/`](c4/README.md). Os níveis 1 e 2 do C4 (contexto e containers da solução) ficam no repositório de specs.
