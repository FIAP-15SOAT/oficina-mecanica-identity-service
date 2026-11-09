<div align="center">

# 🔐 Identity Service

**Usuários, papéis, credenciais e emissão do token de funcionário da oficina mecânica.**

![Node](https://img.shields.io/badge/Node.js-24-339933?logo=node.js&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-12-E0234E?logo=nestjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?logo=prisma&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-18-4169E1?logo=postgresql&logoColor=white)
[![Cobertura](https://sonarcloud.io/api/project_badges/measure?project=FIAP-15SOAT_oficina-mecanica-identity-service&metric=coverage)](https://sonarcloud.io/summary/new_code?id=FIAP-15SOAT_oficina-mecanica-identity-service)
[![Quality Gate](https://sonarcloud.io/api/project_badges/measure?project=FIAP-15SOAT_oficina-mecanica-identity-service&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=FIAP-15SOAT_oficina-mecanica-identity-service)

</div>

## 📋 Sobre

Projeto acadêmico da pós-graduação em Arquitetura de Software da FIAP (turma 15SOAT). A solução da oficina mecânica é formada pelos serviços Work Order, Identity, Billing e Inventory, cada um dono do próprio banco e do próprio cache, que conversam por REST interno e por mensagens SNS/SQS FIFO publicadas a partir de um outbox transacional (a tabela onde a mensagem é gravada na mesma transação do dado).

Este repositório é o **Identity**, dono da identidade da solução: os usuários, os papéis e as credenciais de funcionários e clientes. O que ele faz:

- **Usuários e papéis**: cadastro, consulta, atualização, ativação, desativação e exclusão de usuários pelo `ADMIN`. Funcionário tem um dos papéis `ADMIN`, `MECHANIC` ou `ATTENDANT`; o usuário de acesso de um cliente da oficina não tem papel.
- **Login e refresh do funcionário**: emite o par de tokens JWT (JSON Web Token) assinado em RS256, o algoritmo de chave assimétrica: o access token, de 10 minutos, e o refresh token, de 7 dias. O Identity guarda as chaves privadas; os outros serviços validam o access com a chave pública, sem consultar o Identity.
- **Redefinição de senha por código**: o `ADMIN` pede um código de 6 dígitos para um usuário, que chega por e-mail e vale 10 minutos e 5 tentativas; o código fica no Valkey (banco em memória compatível com Redis), não no PostgreSQL.
- **Perfil do usuário autenticado**: `GET /api/me` e `PATCH /api/me/password`, com o token de funcionário ou com o token de cliente que a customer-auth, a função Lambda de login do cliente, emite. O perfil traz as empresas (clientes PJ) a que o usuário tem acesso, lidas no Work Order.
- **Rotas internas**: o usuário por id, a criação idempotente do usuário de acesso de um cliente e a conferência de CPF e senha do cliente, na rede do cluster. São o contrato oferecido ao Work Order e à customer-auth; hoje nenhum dos dois as chama ainda, e a customer-auth ainda confere a credencial do cliente no banco do Work Order.
- **E-mails de conta**: a senha inicial do funcionário, a senha inicial do cliente e o código de redefinição, publicados como mensagens `notification.email.send` no tópico SNS FIFO `oficina-events.fifo`; a Lambda de notificação, a função `oficina-mecanica-lambda-notification`, lê essas mensagens da fila SQS FIFO `notification.fifo` e envia o e-mail. O Identity não fala SMTP.

A base é a mesma dos outros serviços NestJS da solução: Clean Architecture com regras de importação por camada no ESLint, logs JSON estruturados, OpenTelemetry, health checks, outbox e relay (a rotina que lê o outbox e publica no SNS), cache Valkey e cliente HTTP interno. O serviço só publica mensagens e não consome nenhuma fila. A imagem é publicada no Amazon ECR e implantada no Amazon EKS, no namespace `identity`, pelo próprio CD.

O Identity é o único cliente do próprio PostgreSQL e do próprio Valkey: nenhum outro serviço lê nem escreve neles.

## 🧰 Stack

- **Runtime**: Node.js 24 + TypeScript 6
- **Framework**: NestJS 12
- **ORM**: Prisma 7 (driver `@prisma/adapter-pg`, client gerado em `app/prisma/generated/`)
- **Banco de dados**: PostgreSQL 18 (tabelas `users` e `outbox`)
- **Mensageria**: publicação no Amazon SNS FIFO (`@aws-sdk/client-sns`) com outbox transacional; LocalStack 4.14.0 (emulador local dos serviços AWS) em desenvolvimento
- **Cache e códigos de redefinição**: Valkey 9.1 (no cluster, o Amazon ElastiCache, o serviço de cache gerenciado da AWS) via `ioredis`; o usuário por id no padrão cache-aside (lê do cache e, na falta, do banco, gravando o resultado no cache) e os códigos de redefinição de senha com tempo de vida e contador de tentativas
- **Autenticação**: emissão do par de tokens RS256 com `@nestjs/jwt`; validação local do token de funcionário e do token de cliente com `passport-jwt`; senhas e códigos com `bcrypt`
- **Observabilidade**: logs JSON no stdout (`pino` + `nestjs-pino`) e traces e métricas pelo OpenTelemetry
- **Documentação da API**: Swagger/OpenAPI (`@nestjs/swagger`)
- **Testes**: Jest 30 (unitários com mocks tipados e E2E com Testcontainers, biblioteca que sobe containers Docker descartáveis para os testes: PostgreSQL 18, Valkey 9.1 e LocalStack 4.14.0)
- **Qualidade e segurança**: SonarQube Cloud (SAST, a análise estática do código) e OWASP ZAP (DAST, o teste dinâmico de segurança contra a API no ar)
- **Containerização**: Docker (multi-stage `node:24-alpine`) + Docker Compose
- **Linting**: ESLint 10 + Prettier 3

## ✅ Pré-requisitos

- Node.js 24.9 ou superior e npm (o `npm ci` deve rodar no Node 24: veja [Testes](docs/testing.md#node-24))
- Docker com Docker Compose
- OpenSSL, para gerar os pares de chaves RS256 locais
- Git

## 🚀 Quick Start

Toda a aplicação vive em `app/`, sem `package.json` na raiz do repositório: rode os comandos dentro dela. Nenhum passo exige credenciais AWS: a mensageria local roda no LocalStack.

```bash
# Clonar o repositório e entrar na pasta da aplicação
git clone https://github.com/FIAP-15SOAT/oficina-mecanica-identity-service.git
cd oficina-mecanica-identity-service/app

# Copiar as variáveis de ambiente
cp .env.example .env

# Gerar três pares RS256 descartáveis: access e refresh do funcionário e o do token de cliente
for key in staff refresh customer; do
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$key.pem"
  openssl pkey -in "$key.pem" -pubout -out "$key.pub.pem"
done

# Gravar no .env, cada uma numa linha, as chaves que o serviço lê
node -e "
const read = (file) => JSON.stringify(require('node:fs').readFileSync(file, 'utf8'));
console.log('STAFF_JWT_PUBLIC_KEY=' + read('staff.pub.pem'));
console.log('STAFF_JWT_PRIVATE_KEY=' + read('staff.pem'));
console.log('STAFF_JWT_REFRESH_PRIVATE_KEY=' + read('refresh.pem'));
console.log('CUSTOMER_JWT_PUBLIC_KEY=' + read('customer.pub.pem'));
" >> .env

# Apagar os arquivos de chave (nenhuma chave fica no disco nem no repositório)
rm staff.pem staff.pub.pem refresh.pem refresh.pub.pem customer.pem customer.pub.pem

# Subir PostgreSQL, Valkey, LocalStack, a migração com o seed e a API, esperando ficarem saudáveis
docker compose up -d --build --wait

# Conferir a prontidão: 200 {"status":"ok"}
curl -i http://localhost:3001/api/health/ready

# Fazer login com um ADMIN semeado
curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"guilhermedarochasalvador@gmail.com","password":"Tech@2026"}'

# Parar e remover os containers e o volume do banco local
docker compose down -v
```

Depois do `up`, a API responde em `http://localhost:3001` e o Swagger em [`http://localhost:3001/api/docs`](http://localhost:3001/api/docs). `GET /api/me` lê os clientes vinculados no Work Order: sem ele no ar, responde 503. Para usar a rota sem o Work Order, suba o stack com o arquivo `app/docker-compose.dast.yml`, que põe no lugar dele um stub que responde com a fixture de contrato ([Como executar localmente › Work Order](docs/local-setup.md#work-order)). O passo a passo completo, com as portas dos demais serviços e o token de cliente, está em [Como executar localmente](docs/local-setup.md).

## ⚙️ Comandos

Rode a partir de `app/`.

| Comando | Descrição |
| --- | --- |
| `npm run start` | Inicia sem watch |
| `npm run start:dev` | Inicia em modo watch, com os logs formatados pelo `pino-pretty` |
| `npm run start:debug` | Inicia em modo watch com o inspetor do Node |
| `npm run build` | Compila o projeto |
| `npm run start:prod` | Inicia o build com o preload de telemetria (`node --require ./dist/src/otel.js dist/src/main`) |
| `npm run format` | Formata `src/`, `test/` e `prisma/` com o Prettier |
| `npm run lint` | Linting com auto-fix (gere antes o Prisma Client) |
| `npm run test` | Testes unitários |
| `npm run test:watch` | Testes unitários em modo watch |
| `npm run test:cov` | Testes unitários com cobertura (falha abaixo de 100%) |
| `npm run test:debug` | Testes unitários com o inspetor do Node, em série |
| `npm run test:e2e` | Testes E2E com Testcontainers |
| `npm run test:e2e:cov` | Testes E2E com cobertura |
| `npm run test:smoke` | Confere que o preload de telemetria emite sinais (exige `npm run build`) |
| `npm run prisma:generate` | Gera o Prisma Client |
| `npm run prisma:migrate` | Cria e aplica migrations (dev) |
| `npm run prisma:migrate:prod` | Aplica migrations (`migrate deploy`) |
| `npm run prisma:seed` | Cria os usuários semeados que ainda não existem (`prisma db seed`) |
| `npm run prisma:studio` | Abre o Prisma Studio, a interface web do Prisma para navegar no banco |

## 🏛️ Arquitetura

Clean Architecture com quatro camadas e dependências apontando só para dentro. `domain/`, `application/` e `interface-adapters/` não importam NestJS, Prisma, OpenTelemetry, AWS SDK, `ioredis` nem `bcrypt`, e as regras de importação do ESLint falham o lint na violação. A infraestrutura comum (logging, telemetria, health, mensageria, cache, cliente interno e guards de autenticação) é a mesma dos outros serviços NestJS da solução.

➡️ Detalhes em **[Arquitetura](docs/architecture.md)**.

## 🔌 Rotas

| Grupo | Rotas | Acesso |
|---|---|---|
| Autenticação | `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/password-reset-confirmations` | Sem token |
| Usuários | `POST`, `GET /api/users`; `GET`, `PUT`, `PATCH`, `DELETE /api/users/:id`; `POST /api/users/:userId/password-resets` | Token de funcionário `ADMIN` |
| Minha conta | `GET /api/me`, `PATCH /api/me/password` | Token de funcionário ou de cliente |
| Internas (contrato para o Work Order) | `GET /internal/users/:id`, `POST /internal/customer-users` | Rede do cluster, sem token e fora do Swagger |
| Internas (contrato para a customer-auth) | `POST /internal/customer-authentications` | Rede do cluster, sem token e fora do Swagger |
| Saúde e documentação | `GET /api/health/live`, `GET /api/health/ready`, `/api/docs` e `/api/docs-json` | Sem token |

No cluster, o Identity responde no listener 8081 do NLB interno (o Network Load Balancer que liga o API Gateway aos serviços). Hoje o API Gateway publica do Identity só `GET /health/identity` e `GET /docs/identity`; as rotas `/api/auth`, `/api/users` e `/api/me` do gateway ainda vão ao Work Order.

➡️ Status, corpos, erros e perfil dos tokens em **[API](docs/api.md)**; chaves e janelas de revogação em **[Segurança](docs/security.md)**.

## 📧 E-mails de conta

O Identity monta o assunto, o texto e o HTML (com o nome escapado) de cada e-mail e grava a mensagem `notification.email.send` no outbox. O campo `purpose` diz qual é o e-mail:

| `purpose` | Quando | Conteúdo |
| --- | --- | --- |
| `staff_initial_password` | `POST /api/users`, na mesma transação da criação | Senha inicial gerada (12 caracteres) |
| `customer_initial_password` | `POST /internal/customer-users`, quando cria o usuário, na mesma transação | Senha inicial gerada |
| `password_reset_code` | `POST /api/users/:userId/password-resets` | Código de 6 dígitos, que expira em 10 minutos |

A senha e o código só existem em texto na linha do outbox, até o relay publicá-la e apagá-la, e na mensagem; nunca aparecem em log. Detalhes em **[Mensageria](docs/messaging.md)**.

## 🌱 Usuários semeados

O seed (`app/prisma/seed.ts`) roda depois da migração, no serviço `migrate` do Compose e no Job de migração do Kubernetes. Ele cria pelo id, só quando não existem e sem alterar registros existentes, seis usuários com a senha `Tech@2026`, com os mesmos UUIDs que os outros serviços da solução usam:

| Usuário | E-mail | Papel | CPF |
| --- | --- | --- | --- |
| Guilherme da Rocha Salvador | `guilhermedarochasalvador@gmail.com` | `ADMIN` | — |
| Lucas Almeida da Silva | `lucas.almeida-silva@hotmail.com` | `ADMIN` | — |
| Ramoon Lincoln Barros Camacho | `ramooncamacho@hotmail.com` | `ADMIN` | — |
| Renan Santana Camacho | `camacho.renan@gmail.com` | `ADMIN` | — |
| João da Silva | `joao.silva@email.com` | Sem papel (usuário de cliente) | `12345678909` |
| Maria Souza | `maria.souza@email.com` | Sem papel (usuário de cliente) | `98765432100` |

Os ids estão em [Banco de dados](docs/database.md#usuários-semeados).

## 🌐 Ecossistema de repositórios

Todos na organização [FIAP-15SOAT](https://github.com/FIAP-15SOAT):

| Repositório | Papel |
| --- | --- |
| [`oficina-mecanica-work-order-service`](https://github.com/FIAP-15SOAT/oficina-mecanica-work-order-service) | Serviço Work Order |
| [`oficina-mecanica-identity-service`](https://github.com/FIAP-15SOAT/oficina-mecanica-identity-service) | Este serviço |
| [`oficina-mecanica-billing-service`](https://github.com/FIAP-15SOAT/oficina-mecanica-billing-service) | Serviço Billing |
| [`oficina-mecanica-inventory-service`](https://github.com/FIAP-15SOAT/oficina-mecanica-inventory-service) | Serviço Inventory |
| [`oficina-mecanica-lambda-customer-auth`](https://github.com/FIAP-15SOAT/oficina-mecanica-lambda-customer-auth) | Lambda de login do cliente |
| [`oficina-mecanica-lambda-notification`](https://github.com/FIAP-15SOAT/oficina-mecanica-lambda-notification) | Lambda de envio de e-mail |
| [`oficina-mecanica-infra-base`](https://github.com/FIAP-15SOAT/oficina-mecanica-infra-base) | Rede e scripts de ambiente |
| [`oficina-mecanica-infra-k8s`](https://github.com/FIAP-15SOAT/oficina-mecanica-infra-k8s) | EKS, namespaces, ECR e NLB |
| [`oficina-mecanica-infra-messaging`](https://github.com/FIAP-15SOAT/oficina-mecanica-infra-messaging) | SNS e SQS FIFO |
| [`oficina-mecanica-infra-database-identity`](https://github.com/FIAP-15SOAT/oficina-mecanica-infra-database-identity) | RDS e ElastiCache deste serviço |
| [`oficina-mecanica-api-gateway`](https://github.com/FIAP-15SOAT/oficina-mecanica-api-gateway) | API Gateway |
| [`oficina-mecanica-custom-monitoring`](https://github.com/FIAP-15SOAT/oficina-mecanica-custom-monitoring) | Dashboards e monitores do Datadog |
| [`oficina-mecanica-specs`](https://github.com/FIAP-15SOAT/oficina-mecanica-specs) | Arquitetura e changes OpenSpec |

## 📁 Estrutura do repositório

```text
oficina-mecanica-identity-service/
├── app/
│   ├── src/
│   │   ├── domain/                 # User, value objects Email e Cpf, regras de senha, geradores de senha e código, catálogo de mensagens e portas de repositório
│   │   ├── application/            # use cases (auth, user, me), portas de entrada e de saída, montador dos e-mails de conta, chaves de cache e catálogos de log
│   │   ├── interface-adapters/     # Clean Controllers e Presenters (auth, user, me)
│   │   ├── infrastructure/         # http, persistence/prisma, messaging, cache, gateways, services (JWT e bcrypt), clients, logging, telemetry, health, config
│   │   ├── app.module.ts
│   │   ├── main.ts
│   │   └── otel.ts                 # preload do OpenTelemetry
│   ├── prisma/                     # schema, migrations (users e outbox) e seed dos usuários
│   ├── localstack/                 # init-topology.sh (tópico, filas e DLQs da solução)
│   ├── test/                       # unit/ (espelha src/), e2e/, smoke/, helpers/ e contracts/ (fixtures dos contratos internos)
│   ├── docker-compose.yml
│   ├── docker-compose.dast.yml     # troca o Work Order por um stub, no DAST e localmente
│   ├── Dockerfile
│   └── sonar-project.properties
├── k8s/                            # manifests aplicados pelo CD
├── collections/                    # collection e environment do Postman
├── docs/
│   ├── adr/                        # decisões arquiteturais
│   ├── c4/                         # C4 nível 3 (componentes)
│   └── diagrams/                   # diagrama do serviço, sequências de login e de redefinição de senha e pipelines
├── .github/
│   ├── actions/setup-ci/           # ação composta: Node 24, npm ci e Prisma Client
│   └── workflows/                  # CI, CD, SAST e DAST
├── .zap/                           # regras do OWASP ZAP e stub do Work Order do DAST
└── README.md
```

## 📚 Documentação

| Documento | Conteúdo |
| --- | --- |
| [Arquitetura](docs/architecture.md) | Camadas, agregado `User`, emissão dos tokens, redefinição de senha no Valkey, rotas internas, mensageria com outbox, cache, diagramas e C4 nível 3 |
| [API](docs/api.md) | Rotas públicas e internas, corpos, status, mensagens de erro e perfil dos tokens |
| [Segurança](docs/security.md) | Chaves RS256, validação dos tokens, janelas de revogação aceitas, recusa única na credencial do cliente e runbook |
| [Mensageria](docs/messaging.md) | `notification.email.send`, o `purpose` de cada e-mail e onde a senha e o código existem |
| [Banco de dados](docs/database.md) | Tabela `users`, outbox, usuários semeados e chaves do Valkey |
| [Como executar localmente](docs/local-setup.md) | Setup, os três pares de chaves, variáveis de ambiente, seed e tabela de portas locais por contexto |
| [Testes](docs/testing.md) | Unitários, E2E com Testcontainers, fixtures de contrato, Postman e Newman |
| [CI/CD](docs/ci-cd.md) | Workflows de CI, CD, SAST e DAST |
| [Modelo C4](docs/c4/README.md) | Componentes do serviço |
| [Collection Postman](collections/identity-collection.json) e [environment](collections/identity-environment.json) | Health, Swagger, login e refresh, usuários, redefinição de senha, `/api/me` e rotas internas |
| Swagger | `http://localhost:3001/api/docs` (local) e `http://localhost:3001/api/docs-json` |
| [SonarQube Cloud](https://sonarcloud.io/project/overview?id=FIAP-15SOAT_oficina-mecanica-identity-service) | Projeto `FIAP-15SOAT_oficina-mecanica-identity-service` |

### Decisões de arquitetura (ADRs)

- [0001 Clean Architecture em camadas](docs/adr/0001-clean-architecture-em-camadas.md)
- [0002 Pipelines de CI, CD, SAST e DAST, com rollback e DAST pelo login](docs/adr/0002-pipelines-ci-cd-sast-dast-com-rollback.md)
- [0003 Testes E2E com Testcontainers, Valkey e LocalStack](docs/adr/0003-testcontainers-e2e-com-valkey-e-localstack.md)
- [0004 Credencial do banco materializada no CD](docs/adr/0004-materializacao-da-credencial-do-banco-no-cd.md)
- [0005 Publicação no SNS FIFO com outbox transacional](docs/adr/0005-mensageria-sns-fifo-com-outbox.md)
- [0006 Cache do dono no ElastiCache](docs/adr/0006-cache-do-dono-no-elasticache.md)
- [0007 Identity como único emissor do token de funcionário](docs/adr/0007-identity-unico-emissor-do-token-de-funcionario.md)
- [0008 Código de redefinição de senha no Valkey](docs/adr/0008-codigo-de-reset-no-valkey.md)

## 👥 Autores

- [Guilherme da Rocha Salvador](https://github.com/guilhermesalvador404)
- [Lucas Almeida da Silva](https://github.com/lucas-almeida-silva)
- [Ramoon Lincoln Barros Camacho](https://github.com/ramooncamacho)
- [Renan Santana Camacho](https://github.com/renancamacho)

## 📄 Licença

Projeto acadêmico (FIAP, 15SOAT), para fins educacionais. Sem licença aberta declarada (`UNLICENSED`).
