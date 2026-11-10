# Como executar localmente

Dois modos: tudo em containers (Quick Start do [README](../README.md)) ou a API na máquina com a infraestrutura no Docker. Nenhum dos dois exige credenciais AWS: o LocalStack, um emulador local dos serviços AWS, faz o papel do SNS e do SQS.

## Índice

- [Portas locais por contexto](#portas-locais-por-contexto)
- [Work Order](#work-order)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Chaves RS256 locais](#chaves-rs256-locais)
- [Token de cliente local](#token-de-cliente-local)
- [Tudo em containers](#tudo-em-containers)
- [API na máquina](#api-na-máquina)

## Portas locais por contexto

Cada contexto (serviço) da solução publica no host a API em `3000 + índice`, o PostgreSQL em `5432 + índice`, o Valkey (o banco em memória compatível com Redis) em `6379 + índice` e o LocalStack em `4566 + índice`. Assim os quatro stacks (work-order, identity, billing e inventory) sobem juntos sem colidir.

| Contexto | Índice | API | PostgreSQL | Valkey | LocalStack |
| --- | --- | --- | --- | --- | --- |
| work-order | 0 | 3000 | 5432 | 6379 | 4566 |
| **identity** | 1 | **3001** | **5433** | **6380** | **4567** |
| billing | 2 | 3002 | 5434 | 6381 | 4568 |
| inventory | 3 | 3003 | 5435 | 6382 | 4569 |

Dentro do container a API escuta sempre em 3000, o PostgreSQL em 5432, o Valkey em 6379 e o LocalStack em 4566; só o lado do host muda.

## Work Order

`GET /api/me` lê os clientes vinculados ao usuário em `GET /internal/users/:userId/customers`, no Work Order. No Compose, a API do Identity procura o Work Order no stack dele, publicado no host (`WORK_ORDER_SERVICE_URL=http://host.docker.internal:3000`). Sem o Work Order no ar, ou numa versão dele que ainda não responde essa rota, `GET /api/me` responde 503; as demais rotas não dependem dele.

Para usar `GET /api/me` sem o Work Order, suba o stack com o arquivo adicional `app/docker-compose.dast.yml`. Ele acrescenta o serviço `internal-stubs`, um servidor Node (`.zap/internal-services-stub.mjs`) que responde `GET /internal/users/:userId/customers` com a fixture de contrato `app/test/contracts/work-order/internal-user-customers.json` (um cliente PF e um PJ, para qualquer usuário), e aponta a API para ele. É o mesmo arranjo do DAST:

```bash
# A partir de app/
docker compose -f docker-compose.yml -f docker-compose.dast.yml up -d --build --wait
```

## Variáveis de ambiente

Veja `app/.env.example`, que lista todas as variáveis que o código lê. As principais:

| Variável | Valor local | Função |
| --- | --- | --- |
| `PORT` | `3001` | Porta da API quando roda na máquina |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/identity_service?schema=public` | PostgreSQL do Identity |
| `STAFF_JWT_PRIVATE_KEY` | (você gera) | Chave privada RS256 que assina o access token |
| `STAFF_JWT_REFRESH_PRIVATE_KEY` | (você gera) | Chave privada RS256 que assina e confere o refresh token |
| `STAFF_JWT_PUBLIC_KEY` | (você gera) | Chave pública do access token, com a qual o serviço valida o token de funcionário |
| `STAFF_JWT_KEY_ID`, `STAFF_JWT_ISSUER`, `STAFF_JWT_AUDIENCE` | `staff-local`, `oficina-identity`, `oficina-services` | `kid`, emissor e audiência do access token |
| `STAFF_JWT_EXPIRATION`, `STAFF_JWT_REFRESH_EXPIRATION` | `10m`, `7d` | Validade do access e do refresh |
| `CUSTOMER_JWT_PUBLIC_KEY` | (você gera) | Chave pública do token de cliente, que a customer-auth, a função Lambda de login do cliente, assina |
| `CUSTOMER_JWT_ISSUER`, `CUSTOMER_JWT_AUDIENCE` | `oficina-customer-auth`, `oficina-api` | Emissor e audiência do token de cliente |
| `WORK_ORDER_SERVICE_URL` | `http://localhost:3000` (na máquina) ou `http://host.docker.internal:3000` (no Compose) | Rotas internas do Work Order |
| `BCRYPT_SALT_ROUNDS` | `12` | Custo do hash bcrypt de senhas e códigos |
| `AWS_ENDPOINT_URL` | `http://localhost:4567` | LocalStack; só existe localmente |
| `MESSAGING_TOPIC_ARN` | `arn:aws:sns:us-east-1:000000000000:oficina-events.fifo` | Tópico de publicação |
| `CACHE_URL` | `redis://:valkey@localhost:6380` | Valkey do cache e dos códigos de redefinição (`rediss://` no cluster) |
| `CACHE_TTL_SECONDS` | `43200` | TTL (tempo de vida) das entradas do cache, em segundos |
| `ALLOWED_ORIGINS` | `http://localhost:3001` | Origens aceitas pelo CORS, o controle do navegador sobre quais sites podem chamar a API |
| `LOG_LEVEL` | `info` | `fatal` a `trace` ou `silent` |

Não há variável de fila: o serviço só publica.

## Chaves RS256 locais

O serviço precisa de três pares RS256 descartáveis, gerados na sua máquina e nunca versionados (`*.pem` está no `.gitignore`):

- **access do funcionário**: a privada assina o access token e a pública o valida;
- **refresh do funcionário**: só a privada é usada, para assinar e conferir o refresh token;
- **token de cliente**: só a pública vai ao serviço; a privada só serve para assinar um token de cliente de teste ([abaixo](#token-de-cliente-local)).

As privadas precisam estar em PKCS#8 (`-----BEGIN PRIVATE KEY-----`), o formato que o `openssl genpkey` gera. Grave no `app/.env`, cada uma numa linha, as quatro chaves que o serviço lê (`STAFF_JWT_PUBLIC_KEY`, `STAFF_JWT_PRIVATE_KEY`, `STAFF_JWT_REFRESH_PRIVATE_KEY` e `CUSTOMER_JWT_PUBLIC_KEY`) e apague os arquivos:

```bash
# A partir de app/: gerar os três pares
for key in staff refresh customer; do
  openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$key.pem"
  openssl pkey -in "$key.pem" -pubout -out "$key.pub.pem"
done

# Gravar no .env as chaves que o serviço lê, com as quebras de linha escapadas
node -e "
const read = (file) => JSON.stringify(require('node:fs').readFileSync(file, 'utf8'));
console.log('STAFF_JWT_PUBLIC_KEY=' + read('staff.pub.pem'));
console.log('STAFF_JWT_PRIVATE_KEY=' + read('staff.pem'));
console.log('STAFF_JWT_REFRESH_PRIVATE_KEY=' + read('refresh.pem'));
console.log('CUSTOMER_JWT_PUBLIC_KEY=' + read('customer.pub.pem'));
" >> .env

# Apagar os arquivos; customer.pem só serve para assinar um token de cliente de teste:
# mova-o para fora do repositório se for usá-lo, ou apague-o também
rm staff.pem staff.pub.pem refresh.pem refresh.pub.pem customer.pub.pem
```

Sem alguma dessas quatro variáveis, o `docker compose up` falha com a mensagem que aponta para este documento.

## Token de cliente local

O token de cliente é emitido pela customer-auth, fora deste repositório. Para chamar `GET /api/me` como cliente localmente, assine um token com a privada do par de cliente, com o id de um usuário de cliente semeado (aqui, João da Silva) e o emissor e a audiência que o serviço espera:

```bash
# A partir da pasta onde está customer.pem (fora do repositório)
node -e "
const { createSign } = require('node:crypto');
const part = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const input = part({ alg: 'RS256', typ: 'JWT' }) + '.' + part({ sub: '212ca9d7-fa8f-4111-9746-d431da68b063', iss: 'oficina-customer-auth', aud: 'oficina-api', iat: now, exp: now + 3600 });
console.log(input + '.' + createSign('RSA-SHA256').update(input).sign(require('node:fs').readFileSync('customer.pem'), 'base64url'));
"
```

Use o resultado em `Authorization: Bearer <token>`; ele vale 60 minutos e só é aceito em `/api/me`. Apague `customer.pem` quando terminar.

## Tudo em containers

```bash
# A partir de app/: subir PostgreSQL, Valkey, LocalStack, migração com seed e API
docker compose up -d --build --wait

# Vivacidade: 200 {"status":"ok"}
curl -i http://localhost:3001/api/health/live

# Prontidão (PostgreSQL acessível): 200 {"status":"ok"}
curl -i http://localhost:3001/api/health/ready

# Login com um ADMIN semeado (senha Tech@2026)
curl -s -X POST http://localhost:3001/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"guilhermedarochasalvador@gmail.com","password":"Tech@2026"}'

# Swagger em http://localhost:3001/api/docs; o contrato em JSON:
curl -s http://localhost:3001/api/docs-json

# Acompanhar os logs da API
docker compose logs -f api

# Parar e apagar containers e volume
docker compose down -v
```

Containers: `identity-postgres`, `identity-valkey`, `identity-localstack`, `identity-migrate` (roda `prisma migrate deploy` e depois `prisma db seed`, que cria os seis usuários semeados, e termina) e `identity-api`. A imagem local é `identity-service:local`. O LocalStack só fica saudável depois que `app/localstack/init-topology.sh` cria o tópico `oficina-events.fifo`, as filas FIFO de cada consumidor da solução (inclusive `notification.fifo`, lida pela Lambda de notificação) e as DLQs, as filas que recebem uma mensagem depois de 5 entregas sem sucesso (`maxReceiveCount` 5).

Os e-mails de conta não são enviados localmente: a mensagem `notification.email.send` é publicada no LocalStack e fica na fila `notification.fifo`, porque a Lambda de notificação não roda neste stack. Os usuários semeados e as senhas estão em [Banco de dados](database.md#usuários-semeados).

## API na máquina

Neste modo a API roda com `npm run start:dev` e só a infraestrutura vem do Docker.

```bash
# A partir de app/: instalar dependências no Node 24
npm ci

# Gerar o Prisma Client (lê DATABASE_URL do .env)
npm run prisma:generate

# Subir só a infraestrutura (a migração é aplicada nos comandos seguintes)
docker compose up -d --wait postgres valkey localstack

# Aplicar a migration e criar os usuários semeados
npm run prisma:migrate:prod
npm run prisma:seed

# Iniciar em modo watch (API em http://localhost:3001)
npm run start:dev
```

O `.env` precisa das quatro chaves (`STAFF_JWT_PUBLIC_KEY`, `STAFF_JWT_PRIVATE_KEY`, `STAFF_JWT_REFRESH_PRIVATE_KEY` e `CUSTOMER_JWT_PUBLIC_KEY`) da seção [Chaves RS256 locais](#chaves-rs256-locais). Na máquina, `WORK_ORDER_SERVICE_URL` aponta para `http://localhost:3000`, a API do stack do Work Order.
