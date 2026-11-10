# Banco de dados

PostgreSQL 18, só deste serviço, definido em [`app/prisma/schema.prisma`](../app/prisma/schema.prisma) e versionado em [`app/prisma/migrations/`](../app/prisma/migrations/). O Valkey do serviço (o banco em memória compatível com Redis, no cluster o Amazon ElastiCache) guarda o cache de usuário e os códigos de redefinição de senha. Nenhum outro serviço lê nem escreve em nenhum dos dois.

## Índice

- [Tabelas](#tabelas)
- [Regras garantidas pelo banco e pelo acesso](#regras-garantidas-pelo-banco-e-pelo-acesso)
- [Usuários semeados](#usuários-semeados)
- [Chaves do Valkey](#chaves-do-valkey)

## Tabelas

| Tabela | Conteúdo | Chaves e índices |
| --- | --- | --- |
| `users` | Usuário: `name` (até 150), `email` (até 150, em minúsculas), `cpf` (11 dígitos, opcional), `password_hash` (bcrypt), `role`, `is_active`, `password_changed_at`, `created_at`, `updated_at` | PK `id` (UUID); únicos em `email` e em `cpf` |
| `outbox` | Mensagens a publicar, gravadas na mesma transação do dado e apagadas pelo relay (a rotina que as publica no SNS) depois de publicadas: `message_id`, `type`, `work_order_id`, `payload`, `trace_context`, `created_at` | PK `id` (`BIGSERIAL`); único em `message_id`; ver [Mensageria](messaging.md) |

Enum: `UserRole` (`ADMIN`, `MECHANIC`, `ATTENDANT`). `role` nulo é o usuário de acesso de um cliente da oficina.

## Regras garantidas pelo banco e pelo acesso

- **E-mail e CPF únicos.** Os índices únicos garantem um usuário por e-mail e por CPF; o cadastro confere antes e responde 409 ao e-mail repetido, e o usuário de acesso do cliente reaproveita o dono do CPF.
- **`password_changed_at`.** Gravado na criação e em toda troca de senha (`PATCH /api/me/password` e confirmação da redefinição). O refresh token emitido antes dele é recusado.
- **Sem vínculo com clientes.** Quais clientes um usuário pode acessar é dado do Work Order: o Identity não tem tabela de vínculos nem copia clientes, e lê os vínculos no Work Order a cada `GET /api/me`.
- **Sem tabela de códigos de redefinição.** Os códigos ficam só no Valkey ([abaixo](#chaves-do-valkey)).
- **Outbox na mesma transação.** A criação de funcionário e a do usuário de acesso do cliente gravam o usuário e o e-mail da senha inicial na mesma transação, pelo Unit of Work.

## Usuários semeados

O seed (`app/prisma/seed.ts` e `app/prisma/seeds/`) roda depois do `prisma migrate deploy`: no serviço `migrate` do Compose (`npx prisma migrate deploy && npx prisma db seed`) e no Job de migração do Kubernetes, num `sh -c` com `set -e`, para uma migration com falha não deixar o seed rodar e o Job terminar com sucesso. Ele cria os usuários pelo id com `createMany` e `skipDuplicates`: um usuário que já existe (pelo id, e-mail ou CPF) não é alterado nem faz o seed falhar, então rodar de novo não muda nada. Todos começam ativos, com a senha `Tech@2026`.

Os UUIDs são os mesmos que os outros serviços da solução usam para esses usuários (`app/prisma/seeds/seed-ids.ts`): trocar um quebra as referências entre serviços.

| Id | Nome | E-mail | Papel | CPF |
| --- | --- | --- | --- | --- |
| `1c905c27-4c5e-4d85-a53d-914ed8b87bbe` | Guilherme da Rocha Salvador | `guilhermedarochasalvador@gmail.com` | `ADMIN` | — |
| `9e5ba067-a8a2-4c7c-b597-72db4d7a3d8e` | Lucas Almeida da Silva | `lucas.almeida-silva@hotmail.com` | `ADMIN` | — |
| `2e9e5d67-b47f-48d9-ae4f-8ec95ec2be9f` | Ramoon Lincoln Barros Camacho | `ramooncamacho@hotmail.com` | `ADMIN` | — |
| `f0903c59-e803-4b4d-a9a4-850e5bec1eb9` | Renan Santana Camacho | `camacho.renan@gmail.com` | `ADMIN` | — |
| `212ca9d7-fa8f-4111-9746-d431da68b063` | João da Silva | `joao.silva@email.com` | Sem papel | `12345678909` |
| `6aa85b42-72dd-4ca2-bc94-a1080cfc5a3b` | Maria Souza | `maria.souza@email.com` | Sem papel | `98765432100` |

O DAST faz login com o primeiro ADMIN e assina o token de cliente com o id de João da Silva; a collection Postman usa os mesmos dois.

## Chaves do Valkey

| Chave | Tipo | Conteúdo | Vida | Quem grava e apaga |
| --- | --- | --- | --- | --- |
| `identity:user:<id>` | Texto (JSON) | O usuário sem o hash da senha, com `cacheVersion` | `CACHE_TTL_SECONDS` (padrão 43200 s, 12 h) | Gravada na leitura de `GET /api/users/:id`, `GET /internal/users/:id` e `GET /api/me`, no padrão cache-aside (lê do cache e, na falta, do banco, gravando o resultado no cache); apagada depois do commit de toda escrita no usuário |
| `identity:reset-code:<userId>` | Hash | `codeHash` (o código com bcrypt) e `attempts` (tentativas de confirmação) | 600 s (10 min), definidos junto com o valor num `MULTI` | Gravada pelo pedido de código, que substitui um código pendente; `attempts` incrementado por um script Lua só enquanto a chave existe; apagada na confirmação certa |

- **Cache.** O 404 não é guardado. Um valor que o código atual não lê (corrompido, ou gravado com outro `cacheVersion`) conta como falta. Com o Valkey fora do ar, a leitura vai ao banco e a falha da invalidação só registra o evento de log `cache.invalidation_failed`, e a chave expira pelo TTL.
- **Código de redefinição.** Não é cache: perder a chave perde o código, e o `ADMIN` pede outro. Com o Valkey fora do ar, o pedido e a confirmação respondem 503.
