# Como executar localmente

Dois modos: tudo em containers (Quick Start do [README](../README.md)) ou a API na máquina com a infraestrutura no Docker. Nenhum dos dois exige credenciais AWS: o LocalStack, um emulador local dos serviços AWS, faz o papel do SNS e do SQS.

## Índice

- [Portas locais por contexto](#portas-locais-por-contexto)
- [Variáveis de ambiente](#variáveis-de-ambiente)
- [Chave pública do token de funcionário](#chave-pública-do-token-de-funcionário)
- [Tudo em containers](#tudo-em-containers)
- [API na máquina](#api-na-máquina)

## Portas locais por contexto

Cada contexto (serviço) da solução publica no host a API em `3000 + índice`, o PostgreSQL em `5432 + índice`, o Valkey (o cache em memória compatível com Redis) em `6379 + índice` e o LocalStack em `4566 + índice`. Assim os quatro stacks (work-order, identity, billing e inventory) sobem juntos sem colidir.

| Contexto | Índice | API | PostgreSQL | Valkey | LocalStack |
| --- | --- | --- | --- | --- | --- |
| work-order | 0 | 3000 | 5432 | 6379 | 4566 |
| **identity** | 1 | **3001** | **5433** | **6380** | **4567** |
| billing | 2 | 3002 | 5434 | 6381 | 4568 |
| inventory | 3 | 3003 | 5435 | 6382 | 4569 |

Dentro do container a API escuta sempre em 3000, o PostgreSQL em 5432, o Valkey em 6379 e o LocalStack em 4566; só o lado do host muda.

## Variáveis de ambiente

Veja `app/.env.example`, que lista todas as variáveis que o código lê. As principais:

| Variável | Valor local | Função |
| --- | --- | --- |
| `PORT` | `3001` | Porta da API quando roda na máquina |
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5433/identity_service?schema=public` | PostgreSQL do Identity |
| `STAFF_JWT_PUBLIC_KEY` | (você gera) | Chave pública RS256 do token de funcionário |
| `STAFF_JWT_KEY_ID`, `STAFF_JWT_ISSUER`, `STAFF_JWT_AUDIENCE` | `staff-local`, `oficina-identity`, `oficina-services` | Claims conferidas no token |
| `AWS_ENDPOINT_URL` | `http://localhost:4567` | LocalStack; só existe localmente |
| `MESSAGING_TOPIC_ARN` | `arn:aws:sns:us-east-1:000000000000:oficina-events.fifo` | Tópico de publicação |
| `CACHE_URL` | `redis://:valkey@localhost:6380` | Valkey (`rediss://` no cluster) |
| `CACHE_TTL_SECONDS` | `43200` | TTL (tempo de vida) das entradas do cache, em segundos |
| `ALLOWED_ORIGINS` | `http://localhost:3001` | Origens aceitas pelo CORS, o controle do navegador sobre quais sites podem chamar a API |
| `LOG_LEVEL` | `info` | `fatal` a `trace` ou `silent` |

Não há variável de fila: o serviço só publica.

## Chave pública do token de funcionário

Para validar o token, o serviço precisa apenas da chave pública. Nenhuma chave é versionada. Gere um par de teste, grave a pública no `app/.env` e apague os arquivos (os comandos estão no Quick Start do README):

```bash
# A partir de app/
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out staff.pem
openssl pkey -in staff.pem -pubout -out staff.pub.pem
node -e "console.log('STAFF_JWT_PUBLIC_KEY=' + JSON.stringify(require('node:fs').readFileSync('staff.pub.pem', 'utf8')))" >> .env
rm staff.pem staff.pub.pem
```

Sem a variável, o `docker compose up` falha com a mensagem que aponta para este documento.

## Tudo em containers

```bash
# A partir de app/: subir PostgreSQL, Valkey, LocalStack, migração e API
docker compose up -d --build --wait

# Vivacidade: 200 {"status":"ok"}
curl -i http://localhost:3001/api/health/live

# Prontidão (PostgreSQL acessível): 200 {"status":"ok"}
curl -i http://localhost:3001/api/health/ready

# Swagger em http://localhost:3001/api/docs; o contrato em JSON:
curl -s http://localhost:3001/api/docs-json

# Acompanhar os logs da API
docker compose logs -f api

# Parar e apagar containers e volume
docker compose down -v
```

Containers: `identity-postgres`, `identity-valkey`, `identity-localstack`, `identity-migrate` (roda `prisma migrate deploy` e termina) e `identity-api`. A imagem local é `identity-service:local`. O LocalStack só fica saudável depois que `app/localstack/init-topology.sh` cria o tópico `oficina-events.fifo`, as filas FIFO de cada consumidor da solução (inclusive `notification.fifo`, lida pela Lambda de notificação) e as DLQs, as filas que recebem uma mensagem depois de 5 entregas sem sucesso (`maxReceiveCount` 5).

## API na máquina

Neste modo a API roda com `npm run start:dev` e só a infraestrutura vem do Docker.

```bash
# A partir de app/: instalar dependências no Node 24
npm ci

# Gerar o Prisma Client (lê DATABASE_URL do .env)
npm run prisma:generate

# Subir só a infraestrutura (a migration é aplicada no comando seguinte)
docker compose up -d --wait postgres valkey localstack

# Aplicar a migration no banco local
npm run prisma:migrate:prod

# Iniciar em modo watch (API em http://localhost:3001)
npm run start:dev
```

O `.env` precisa ter `STAFF_JWT_PUBLIC_KEY` (seção anterior).
