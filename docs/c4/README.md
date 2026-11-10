# 🧩 Modelo C4 — Identity Service

Este diretório documenta a API do Identity com o [modelo C4](https://c4model.com), uma forma de descrever a arquitetura em níveis de zoom (contexto, containers, componentes e código). Aqui fica o nível de Componente: as peças internas do container **API do Identity** e como elas se ligam ao banco, ao cache, à mensageria, ao Work Order, à customer-auth (a função Lambda de login do cliente) e à Lambda de notificação, a função `oficina-mecanica-lambda-notification`, que envia os e-mails publicados pelo serviço.

## Índice

- [Convenções](#convenções)
- [Nível 3 — Componente da API do Identity](#nível-3--componente-da-api-do-identity)
- [Documentação relacionada](#documentação-relacionada)

## Convenções

- **Tipo explícito em todo elemento.** Cada elemento declara o tipo entre colchetes (`[Pessoa]`, `[Sistema Externo]`, `[Container Externo: tecnologia]`, `[Componente: tecnologia]`).
- **Ícone de componente.** Cada componente leva o ícone UML clássico (dois retângulos), na paleta azul dos demais elementos.
- **Tecnologia só ao cruzar fronteira.** As setas entre componentes do mesmo container não levam tecnologia; ela aparece nas relações com o funcionário, o cliente, o Work Order, a customer-auth, o Kubernetes, o banco, o cache e a mensageria.
- **Contrato em linha tracejada.** Uma relação tracejada é um contrato que o Identity oferece e que o consumidor ainda não chama; a legenda do diagrama a identifica.
- **Imagem com o fonte.** A imagem é gerada pelo PlantUML, ferramenta que desenha diagramas a partir de texto, com a biblioteca [C4-PlantUML](https://github.com/plantuml-stdlib/C4-PlantUML) v2.14.0, e o fonte do diagrama fica embutido no próprio PNG.

## Nível 3 — Componente da API do Identity

<p align="center"><img src="images/c4-component.png" alt="Diagrama de Componente C4 da API do Identity: o Funcionário faz login e apresenta o token de funcionário, e o Cliente da oficina apresenta o token da customer-auth, ao componente Guards/Segurança, que encaminha /api/auth à Autenticação e /api/users e /api/me aos Usuários; as Rotas Internas são o contrato oferecido ao Work Order e à customer-auth, em relações tracejadas; a Autenticação e os Usuários usam Tokens e Hash, Cache e Código de Reset (sobre o ElastiCache Valkey) e Repositories (sobre o PostgreSQL); os Usuários leem os clientes vinculados pelo Gateway do Work Order; a Mensageria lê o outbox pelos Repositories e publica no SNS, que entrega notification.email.send à Lambda de notificação; o Kubernetes consulta o Health" width="100%"></p>

Destaques do fluxo:

- o **Funcionário** faz login na **Autenticação** e apresenta o access token ao **Guards / Segurança**, que o valida pela chave pública, sem consultar o banco; o **Cliente da oficina** apresenta o token emitido pela customer-auth, aceito só em `/api/me`;
- as **Rotas Internas** são o contrato que o Identity oferece, sem token e pela rede do cluster, ao **Work Order** e à **customer-auth**, e usam os casos de uso de usuário e de credencial; hoje nenhum dos dois as chama ainda, e a customer-auth ainda confere a credencial do cliente no banco do Work Order (as relações tracejadas do diagrama são esse contrato);
- a **Autenticação** e os **Usuários** gravam os usuários e os e-mails de conta na mesma transação pelos **Repositories**, guardam o código de redefinição e o cache do usuário no **Cache e Código de Reset**, e os **Usuários** leem no Work Order, pelo **Gateway do Work Order**, os clientes vinculados que `GET /api/me` mostra;
- a **Mensageria** publica no tópico as linhas do outbox (a tabela onde a mensagem é gravada na mesma transação do dado), e a fila `notification.fifo` as entrega à **Lambda de notificação**; o serviço não consome nenhuma fila;
- o **Kubernetes** consulta o **Health**, e a prontidão depende só do PostgreSQL.

| Componente | Tecnologia | Responsabilidade |
|---|---|---|
| **Guards / Segurança** | NestJS Guards | `AuthenticationGuard` global que nega por padrão (exige o token de funcionário em toda rota, salvo as marcadas com `@Public()`), `JwtStrategy` RS256 pela chave pública, `AnyAuthGuard` com a `CustomerJwtStrategy` em `/api/me` e `RolesGuard` (controle de acesso por papel) |
| **Rotas Internas** | NestJS Controller | `GET /internal/users/:id`, `POST /internal/customer-users` e `POST /internal/customer-authentications`, `@Public()`, fora do prefixo `api` e do Swagger |
| **Health** | NestJS Module | `GET /api/health/live` sem I/O e `GET /api/health/ready` com `SELECT 1`, consumidas pelas probes (verificações periódicas) do Kubernetes |
| **Autenticação** | Clean Controllers · Use Cases | Login e refresh de funcionário, pedido e confirmação do código de redefinição e conferência da credencial do cliente |
| **Usuários** | Clean Controllers · Use Cases | Cadastro e gestão de usuários pelo `ADMIN`, usuário de acesso do cliente, perfil `/api/me` e troca da própria senha; monta os e-mails de conta |
| **Tokens e Hash** | @nestjs/jwt · bcrypt | `JwtTokenService`, que assina o access e o refresh RS256 com as chaves privadas e confere o refresh, e `BcryptHashService`, para senhas e códigos |
| **Gateway do Work Order** | @nestjs/axios | `IWorkOrderUserCustomersGateway` sobre o `InternalHttpClient`, com prazo de 2 s, `x-request-id` e `traceparent`; Work Order sem resposta, com erro 5xx ou com um 4xx (quebra de contrato) vira 503 |
| **Cache e Código de Reset** | NestJS Module · ioredis | `ICache` cache-aside de `identity:user:<id>`, que falha aberto (com o cache fora do ar, a leitura vai ao banco), e `IPasswordResetCodeStore`, com prazo de 600 s e contador atômico de tentativas, que falha com 503 |
| **Repositories** | Prisma | Usuários, Unit of Work (a transação que agrupa as escritas de um caso de uso) e outbox gravado na mesma transação da mudança de estado |
| **Mensageria** | NestJS Module · AWS SDK | Relay do outbox (rotina que lê o outbox e publica) para o SNS FIFO, sob um advisory lock do PostgreSQL que deixa só uma réplica publicar por vez |

| Elemento externo | Tipo | Papel |
|---|---|---|
| **Funcionário** | Pessoa | Administrador, mecânico ou atendente, que faz login no Identity |
| **Cliente da oficina** | Pessoa | Usuário de acesso de um cliente, com o token emitido pela customer-auth |
| **Work Order** | Sistema externo | Serviço das ordens de serviço e dono dos clientes e dos vínculos de acesso; responde `GET /internal/users/:userId/customers`; as rotas internas de usuário são um contrato oferecido a ele, que hoje ainda não as chama |
| **customer-auth** | Sistema externo | Função Lambda de login do cliente, que emite o token de cliente; `POST /internal/customer-authentications` é o contrato oferecido a ela, que hoje ainda confere a credencial no banco do Work Order |
| **Kubernetes** | Sistema externo | Executa as probes de inicialização, vivacidade e prontidão do pod |
| **Lambda de notificação** | Sistema externo | A função `oficina-mecanica-lambda-notification`, que lê `notification.fifo` e envia os e-mails |
| **Banco de Dados** | Container externo | Amazon RDS PostgreSQL 18 do Identity, com as tabelas `users` e `outbox` |
| **Cache Distribuído** | Container externo | Amazon ElastiCache Valkey 9.1 do Identity (Valkey é o banco em memória compatível com Redis), com o cache de usuário e os códigos de redefinição |
| **Mensageria AWS** | Container externo | Tópico SNS FIFO `oficina-events.fifo` e a fila SQS FIFO `notification.fifo`, assinante do tópico, que pertence à Lambda de notificação |

## Documentação relacionada

- [Arquitetura](../architecture.md)
- [ADR 0005 — Publicação no SNS FIFO com outbox transacional](../adr/0005-mensageria-sns-fifo-com-outbox.md)
- [ADR 0006 — Cache do dono no ElastiCache](../adr/0006-cache-do-dono-no-elasticache.md)
- [ADR 0007 — Identity como único emissor do token de funcionário](../adr/0007-identity-unico-emissor-do-token-de-funcionario.md)
- [ADR 0008 — Código de redefinição de senha no Valkey](../adr/0008-codigo-de-reset-no-valkey.md)
