# Referência da API

> A fonte viva do contrato público é o **Swagger** em `http://localhost:3001/api/docs` (spec em `/api/docs-json`). Esta página é o resumo legível das rotas, inclusive das rotas internas, que ficam fora do Swagger.

## Índice

- [Acesso](#acesso)
- [Autenticação](#autenticação-apiauth)
- [Usuários](#usuários-apiusers)
- [Minha conta](#minha-conta-apime)
- [Rotas internas](#rotas-internas-internal)
- [Perfil dos tokens](#perfil-dos-tokens)
- [Formato de resposta](#formato-de-resposta)
- [Erros](#erros)

## Acesso

- **Swagger:** `http://localhost:3001/api/docs`
- **Base URL:** `http://localhost:3001/api` (local). No cluster, o Identity responde no listener `8081` do NLB interno, o Network Load Balancer que liga o API Gateway aos serviços. Hoje o API Gateway publica do Identity só `GET /health/identity` e `GET /docs/identity`; as rotas `/api/auth`, `/api/users` e `/api/me` do gateway ainda vão ao Work Order.

Toda rota de `/api` exige `Authorization: Bearer <token>`, salvo as marcadas como públicas abaixo. O token de **funcionário** é o access token emitido por `POST /api/auth/login`; o token de **cliente** é o que a customer-auth, a função Lambda de login do cliente, emite, e só vale em `/api/me`. Os dois são validados localmente, só pela assinatura e pelos claims. Token ausente, expirado, assinado por outra chave ou do tipo errado para a rota responde **401** com `Token de autenticação inválido ou ausente`; papel sem permissão responde **403**.

Os papéis de funcionário são `ADMIN`, `MECHANIC` e `ATTENDANT`. O usuário de acesso de um cliente não tem papel (`role = null`).

## Autenticação (`/api/auth`)

| Método | Rota | Descrição | Acesso | Respostas |
| --- | --- | --- | --- | --- |
| POST | `/login` | Login do funcionário: devolve o par de tokens e o usuário | Público | 200, 400, 401 |
| POST | `/refresh` | Troca um refresh token válido por um par novo | Público | 200, 400, 401 |
| POST | `/password-reset-confirmations` | Confirma o código de redefinição e grava a senha nova | Público | 204, 400, 401, 422, 503 |

### Login

Corpo: `email` (e-mail válido) e `password` (texto). Resposta **200**:

```json
{
  "data": {
    "accessToken": "eyJhbGciOiJSUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJSUzI1NiIs...",
    "user": { "id": "1c905c27-4c5e-4d85-a53d-914ed8b87bbe", "name": "Guilherme da Rocha Salvador", "email": "guilhermedarochasalvador@gmail.com", "role": "ADMIN" }
  }
}
```

Usuário inexistente, desativado, com senha errada ou sem papel (usuário de cliente) responde **401** com `Credenciais inválidas`, a mesma mensagem nos quatro casos. O usuário é lido sempre no PostgreSQL, nunca no cache.

### Refresh

Corpo: `refreshToken` (texto). Resposta **200** no mesmo formato do login, com um par novo. Token inválido ou expirado, assinado por outra chave, um access enviado no lugar do refresh, usuário inexistente, desativado ou sem papel e refresh emitido antes da última troca de senha respondem **401** com `Refresh token inválido ou expirado`.

### Confirmação da redefinição de senha

Corpo: `email` (e-mail válido), `code` (texto de 6 caracteres, o código recebido por e-mail) e `newPassword` (texto). Resposta **204** sem corpo. Na ordem em que são conferidos:

| Situação | Resposta |
| --- | --- |
| Corpo inválido (`E-mail inválido`, `O código deve ter 6 dígitos`, campo com tipo errado) | **400** |
| Senha nova fraca, antes de qualquer outra conferência e sem gastar tentativa | **422** com `A senha deve ter no mínimo 8 caracteres e conter pelo menos uma letra maiúscula, uma letra minúscula, um número e um caractere especial` |
| E-mail sem usuário, código expirado ou nunca pedido, sexta tentativa (mesmo com o código certo) ou código errado | **401** com `Código de redefinição inválido ou expirado` |
| Valkey (o banco em memória que guarda o código) indisponível | **503** com `Não foi possível processar o código de redefinição agora. Tente novamente em instantes` |

A confirmação não compara a senha nova com a atual. O código vale 10 minutos e 5 tentativas; o pedido dele é `POST /api/users/:userId/password-resets`.

## Usuários (`/api/users`)

Todas as rotas exigem o token de funcionário com o papel `ADMIN`.

| Método | Rota | Descrição | Respostas |
| --- | --- | --- | --- |
| POST | `/` | Cria um funcionário com senha inicial gerada, enviada por e-mail | 201, 400, 401, 403, 409, 422 |
| GET | `/` | Lista paginada, da criação mais recente para a mais antiga (filtros `role` e `name`) | 200, 400, 401, 403 |
| GET | `/:id` | Detalha um usuário | 200, 400, 401, 403, 404 |
| PUT | `/:id` | Atualiza nome, e-mail e papel | 200, 400, 401, 403, 404, 409, 422 |
| PATCH | `/:id` | Ativa ou desativa (`{ "active": true \| false }`) | 200, 400, 401, 403, 404, 422 |
| DELETE | `/:id` | Exclui o usuário | 204, 400, 401, 403, 404 |
| POST | `/:userId/password-resets` | Gera um código de redefinição de senha e o envia por e-mail ao usuário | 204, 400, 401, 403, 404, 503 |

- **Criação.** Corpo: `name` (3 a 150 caracteres), `email`, `role` (`ADMIN`, `MECHANIC` ou `ATTENDANT`) e `cpf` opcional (texto). E-mail já usado responde **409** com `E-mail já cadastrado no sistema` e CPF já usado, com `CPF já cadastrado`; CPF com dígito verificador errado responde **422** com `CPF inválido`. A senha inicial, de 12 caracteres, vai só no e-mail `staff_initial_password`, gravado no outbox (a tabela onde a mensagem é gravada na mesma transação do dado, depois publicada para a Lambda que envia o e-mail) na mesma transação da criação ([Mensageria](messaging.md)); a resposta nunca a traz.
- **Listagem.** Query: `page` (padrão 1), `limit` (padrão 10, máximo 100), `role` e `name` (busca parcial, sem diferenciar maiúsculas). Resposta `{ data: [...], pagination: { page, limit, totalRecords, totalPages } }`.
- **Detalhe.** Resposta `{ data: { id, name, email, role, isActive, createdAt, updatedAt } }`, lida do cache `identity:user:<id>` quando há. Id que não é UUID responde **400**; usuário inexistente, **404** com `Usuário não encontrado(a) com identificador: <id>`.
- **Atualização.** Corpo com `name`, `email` e `role`, todos opcionais e com as mesmas regras da criação; o CPF não muda por aqui. E-mail de outro usuário responde **409** com `E-mail já cadastrado no sistema`.
- **Status.** Ativar o usuário já ativo responde **422** com `Usuário já está ativo`; desativar o já desativado, **422** com `Usuário já está desativado`. O usuário desativado não faz login nem refresh, mas o access que ele já tem vale até expirar ([Segurança](security.md#janelas-de-revogação-aceitas)).
- **Pedido de código.** Gera um código de 6 dígitos, guarda o hash dele no Valkey por 10 minutos e grava o e-mail `password_reset_code` no outbox. Um pedido novo substitui o código pendente. Valkey indisponível responde **503** com a mensagem da confirmação, e nada vai para o outbox.

Toda escrita num usuário existente apaga a chave de cache dele depois do commit.

## Minha conta (`/api/me`)

As duas rotas aceitam o token de funcionário e o token de cliente.

| Método | Rota | Descrição | Respostas |
| --- | --- | --- | --- |
| GET | `/` | Perfil do usuário do token, com as empresas a que ele tem acesso | 200, 401, 404, 503 |
| PATCH | `/password` | Troca a própria senha | 204, 400, 401, 404, 409, 422 |

- **Perfil.** Resposta `{ data: { id, name, email, role, customers } }`. `customers` vem do Work Order (`GET /internal/users/:userId/customers`, só vínculos ativos de clientes ativos) e lista só os clientes PJ, cada um como `{ id, name, type }`. Work Order sem resposta, com erro 5xx ou com um 4xx (que aqui é quebra de contrato, porque o pedido não vem do usuário) responde **503** com `Não foi possível carregar os clientes vinculados agora. Tente novamente em instantes`. Usuário do token que não existe mais responde **404**.
- **Troca de senha.** Corpo: `currentPassword` e `newPassword`. Senha atual errada responde **401** com `Senha atual incorreta`; senha nova igual à atual, **409** com `A nova senha não pode ser igual à senha atual`; senha nova fraca, **422** com a mensagem de senha forte. A troca grava `password_changed_at`, o que invalida os refresh tokens emitidos antes dela.

## Rotas internas (`/internal`)

Fora do prefixo `/api`, sem token, fora do Swagger e fora do API Gateway: só respondem pela rede do cluster. São o contrato que o Identity oferece ao Work Order e à customer-auth; hoje nenhum dos dois as chama ainda, e a customer-auth ainda confere a credencial do cliente no banco do Work Order. Os corpos de sucesso estão versionados como fixtures de contrato em [`app/test/contracts/`](../app/test/contracts).

| Método | Rota | Consumidor do contrato | Respostas |
| --- | --- | --- | --- |
| GET | `/internal/users/:id` | Work Order | 200, 400, 404 |
| POST | `/internal/customer-users` | Work Order | 200, 400, 409, 422 |
| POST | `/internal/customer-authentications` | customer-auth | 200, 400, 401 |

- **`GET /internal/users/:id`.** Resposta `{ data: { id, name, email, role, isActive } }`, pelo mesmo cache do detalhe. `role` é `null` para o usuário de cliente. Fixture: `internal-user.json`.
- **`POST /internal/customer-users`.** Corpo `{ name, email, cpf }`, com a validação do cadastro de usuário e o CPF obrigatório (`O CPF é obrigatório`; CPF inválido, **422** `CPF inválido`). Se o CPF já tem usuário, devolve o mesmo `userId` com `created = false` e não grava nada; se não, cria um usuário sem papel com senha inicial, enviada pelo e-mail `customer_initial_password` na mesma transação, e devolve `created = true`. O e-mail de um usuário diferente do dono do CPF responde **409** com `O e-mail informado já pertence a outro usuário. Verifique o cadastro do cliente`, exista o CPF ou não. A operação é idempotente pelo CPF, então o Work Order pode repetir a chamada. Resposta `{ data: { userId, created } }`; fixture: `internal-customer-user.json`.
- **`POST /internal/customer-authentications`.** Corpo `{ cpf, password }`. Confere CPF válido, usuário ativo e senha, ignorando o papel. Resposta `{ data: { userId } }`; fixture: `internal-customer-authentication.json`. Só o corpo sem um dos campos (`O CPF é obrigatório`, `A senha é obrigatória`) ou com tipo errado (`O CPF deve ser um texto`, `A senha deve ser um texto`) responde **400**. Qualquer recusa, inclusive CPF com dígito verificador errado, responde **401** com `Credenciais inválidas` e o mesmo corpo ([por quê](security.md#recusa-única-na-credencial-do-cliente)). O vínculo do usuário com um cliente não é conferido aqui: é dado do Work Order.

## Perfil dos tokens

| Token | Algoritmo | Claims | Validade |
| --- | --- | --- | --- |
| Access de funcionário | RS256, `kid` no cabeçalho | `sub`, `email`, `name`, `role`, `typ = access`, `iss = oficina-identity`, `aud = oficina-services` | 10 min |
| Refresh de funcionário | RS256, sem `kid` | `sub`, `email`, `name`, `role`, `typ = refresh`, `iss = oficina-identity`, `aud = oficina-identity` | 7 dias |
| Cliente (emitido pela customer-auth) | RS256 | `sub` (o id do usuário), `iss = oficina-customer-auth`, `aud = oficina-api` | 60 min |

As chaves e as janelas de revogação estão em [Segurança](security.md).

## Formato de resposta

Sucesso com corpo: `{ "data": ... }`, e a listagem paginada acrescenta `pagination`. Datas em ISO 8601 no horário de Brasília, com o deslocamento fixo `-03:00`. `204` não tem corpo.

## Erros

Todo erro sai como `{ "statusCode", "error", "message" }`, com a mensagem em português e sem stack, host ou texto do driver. Erros de validação do corpo trazem `message` como lista.

| Status | Quando |
| --- | --- |
| 400 | Corpo, query ou id inválido (`ValidationPipe`, `ParseUUIDPipe`) |
| 401 | Token ausente ou inválido, credenciais recusadas, refresh recusado, código de redefinição recusado, senha atual incorreta |
| 403 | Papel sem permissão na rota |
| 404 | Usuário não encontrado |
| 409 | E-mail ou CPF já cadastrado, e-mail de outra pessoa no usuário de acesso do cliente, senha nova igual à atual |
| 422 | Regra de domínio: CPF inválido, senha fraca, usuário já no status pedido |
| 503 | Valkey indisponível na redefinição de senha; Work Order sem resposta, com erro 5xx ou com um 4xx em `GET /api/me` |
| 500 | Erro inesperado, inclusive PostgreSQL indisponível: `Ocorreu um erro inesperado` |
