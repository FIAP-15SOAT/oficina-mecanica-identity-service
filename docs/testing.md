# Testes

## Índice

- [Unitários](#unitários)
- [E2E](#e2e)
- [Fixtures de contrato](#fixtures-de-contrato)
- [Por que os e2e dos componentes transversais têm rotas de teste](#por-que-os-e2e-dos-componentes-transversais-têm-rotas-de-teste)
- [Node 24](#node-24)
- [Postman e Newman](#postman-e-newman)

## Unitários

Jest 30 com `ts-jest`, em `app/test/unit/`, que espelha `app/src/`. Teste de use case instancia a classe com `jest.Mocked<IRepository>`, sem Nest DI e sem banco; os geradores de senha e de código, os value objects `Email` e `Cpf`, o montador dos e-mails de conta, o `JwtTokenService`, o adaptador do código de redefinição no Valkey e o gateway do Work Order têm specs próprios. As factories de mock ficam em `app/test/helpers/`.

```bash
# A partir de app/: testes unitários com cobertura
npm run test:cov
```

O `coverageThreshold` global exige 100% de linhas, statements, funções e branches, e o comando falha abaixo disso. É o mesmo lcov, o relatório de cobertura no formato LCOV (`app/coverage/lcov.info`), que o workflow de SAST envia ao Sonar; o badge do README mostra a cobertura que o Sonar mede dessa execução. Ficam fora da cobertura os módulos Nest, `main.ts`, `otel.ts`, enums, configs, exceções, DTOs e o `prisma.service.ts` (veja `collectCoverageFrom` no `package.json`).

## E2E

Jest com Supertest (biblioteca que faz requisições HTTP à aplicação dentro do teste) e **Testcontainers** (biblioteca que sobe containers Docker descartáveis a partir do teste) em `app/test/e2e/`, sem mocks de infraestrutura: PostgreSQL 18, Valkey 9.1 (o banco em memória compatível com Redis) e, nos testes de mensageria, LocalStack 4.14.0, o emulador local dos serviços AWS, com a topologia real de `app/localstack/init-topology.sh`. O helper `setupTestApp` (`app/test/helpers/test-app.helper.ts`) sobe o `AppModule` com o mesmo `configureApp` do `main.ts`, aplica a migration e, com `withMessaging`, liga o relay do outbox de verdade. Requer Docker.

```bash
# A partir de app/: E2E (a primeira execução baixa as imagens, depois usa o cache local)
npm run test:e2e
```

Suítes atuais (doze):

- **autenticação** (`auth.e2e-spec.ts`): login com o perfil RS256 do access decodificado, recusas com `Credenciais inválidas`, refresh, refresh recusado depois da troca de senha, pedido e confirmação do código de redefinição (sexta tentativa recusada mesmo com o código certo, tentativas concorrentes contadas de forma atômica, código expirado sem recriar a chave, senha fraca sem gastar tentativa), inspeção dos logs (nenhuma linha com o código, a senha nova ou o corpo do e-mail) e Valkey parado no pedido e na confirmação (503, senha intacta e outbox vazio);
- **usuários** (`user.e2e-spec.ts`): CRUD de `/api/users`, matriz de papéis e invalidação do cache;
- **minha conta** (`me.e2e-spec.ts`): perfil com token de funcionário e de cliente, só clientes PJ em `customers`, 503 com o Work Order fora do ar, com erro ou recusando, e troca da própria senha;
- **rotas internas** (`internal-user.e2e-spec.ts`): as três rotas `/internal`, conferidas contra as fixtures de contrato;
- **e-mail do usuário de acesso do cliente** (`internal-user-messaging.e2e-spec.ts`): `customer_initial_password` publicado até a fila `notification.fifo`;
- **código de redefinição no Valkey** (`password-reset-code.store.e2e-spec.ts`): o adaptador contra um Valkey real, com prazo mantido depois de seis tentativas, chave expirada não recriada, código pendente substituído e exclusão;
- **guard de autenticação** (`auth-guard.e2e-spec.ts`): token ausente ou assinado por outra chave, papel sem permissão e rotas públicas;
- health (incluindo banco e cache indisponíveis e encerramento gracioso);
- logging;
- telemetria;
- filtro de exceções;
- outbox (relay, ordem, mensagem sem ordem de serviço num grupo FIFO só dela, transação desfeita e duas réplicas do relay). Como o serviço não consome fila, os testes de mensageria leem a fila assinante `notification.fifo` com o `@aws-sdk/client-sqs` (só em `devDependencies`) para conferir o que o relay publicou.

**Work Order nos testes.** O E2E de `/api/me` não depende do Work Order: `app/test/helpers/work-order-stub.ts` sobe, dentro do processo do teste, um servidor HTTP que responde `GET /internal/users/:userId/customers` com os vínculos que cada teste define, e que pode fechar a conexão ou responder com um status de erro para simular o Work Order fora do ar.

**Tokens e chaves.** Os pares RS256 de access, refresh e cliente são gerados em memória a cada execução por `app/test/helpers/staff-jwt.helper.ts` e `customer-jwt.helper.ts`; nenhuma chave é versionada.

## Fixtures de contrato

As respostas das rotas internas que outros serviços consomem estão versionadas em `app/test/contracts/`. Cada uma tem um campo `$source` que diz de onde vem e que não faz parte do contrato.

| Fixture | Contrato | Uso |
| --- | --- | --- |
| `internal-user.json` | `GET /internal/users/:id` → `{ data: { id, name, email, role, isActive } }` (`role` também pode ser `null`, para o usuário de cliente) | Conferida pelo E2E das rotas internas; é a fixture que o Work Order deve copiar para o adaptador e os stubs dele |
| `internal-customer-user.json` | `POST /internal/customer-users` → `{ data: { userId, created } }` | Conferida pelo E2E das rotas internas; é a fixture que o Work Order deve copiar |
| `internal-customer-authentication.json` | `POST /internal/customer-authentications` → `{ data: { userId } }` | Conferida pelo E2E das rotas internas; é a fixture que a customer-auth deve copiar |
| `work-order/internal-user-customers.json` | `GET /internal/users/:userId/customers` do Work Order → `{ data: [{ id, name, type, document, isActive }] }`, com um cliente PF e um PJ | Unitário do gateway do Work Order; stub do DAST e do Compose local |

O E2E compara o formato da resposta real (chaves e tipos, em todos os níveis) com o da fixture, por `jsonShape` de `app/test/helpers/contract-fixture.helper.ts`. A fixture de `work-order/` foi montada a partir do contrato documentado da rota, porque o Work Order ainda não publica a dele; quando publicar, ela é substituída pela cópia da fixture do dono.

## Por que os e2e dos componentes transversais têm rotas de teste

Os comportamentos dos componentes transversais copiados do template (autenticação deny-by-default, formato dos erros, log de acesso, traces, encerramento com requisição em andamento) só aparecem numa requisição que passe pelo router, pelos guards, pelos filtros e pelos interceptors. Cada suíte desses componentes declara no próprio spec um controller que existe só no teste (por exemplo `AuthGuardProbeController` e `TestExceptionController`) e o monta por `setupTestApp({ controllers })`, ao lado do `AppModule`. Assim:

- o código de produção não ganha rota nenhuma só para ser testado;
- esses specs não dependem das regras de negócio dos usuários e continuam iguais quando elas mudam;
- um defeito de um componente transversal aponta para ele, não para uma regra de negócio.

## Node 24

Os binários nativos de `node_modules` (inclusive o `bcrypt`) dependem da versão do Node. Um `node_modules` instalado no Node 22 faz o e2e terminar com **segfault (exit 139)** no Node 24. Se acontecer, reinstale sob o Node 24:

```bash
# A partir de app/: trocar para o Node 24 e reinstalar do zero
source ~/.nvm/nvm.sh && nvm use 24
rm -rf node_modules
npm ci
```

O `engines` do `package.json` exige `node >=24.9`, e o CI roda no Node 24.

## Postman e Newman

Em [`collections/`](../collections) há a collection `identity-collection.json` e o environment `identity-environment.json` (Postman v2.1). A `baseUrl` é única: `http://localhost:3001`. As 58 requisições rodam em ordem, com testes em cada uma, e guardam no environment o token e os ids que as seguintes usam:

| Pasta | O que cobre |
| --- | --- |
| Health | Vivacidade e prontidão |
| Swagger | UI e contrato OpenAPI, que publica as rotas públicas e não publica as internas |
| Autenticação | Login do ADMIN semeado com o access decodificado (RS256, `kid`, `typ`, `iss`, `aud`, 10 min) e o refresh (7 dias), recusas do login (senha errada, usuário de cliente, corpo vazio) e do refresh |
| Gestão de Usuários | Criação de atendente e de mecânico, e-mail repetido, CPF inválido, listagem com filtro, detalhe, atualização, ativação e desativação, validações do corpo |
| Redefinição de Senha | Pedido do código, id inexistente, sem token, confirmação com código errado, senha fraca e código curto |
| Minha Conta | Perfil do ADMIN com `customers` só PJ, sem token, troca de senha com senha atual errada, igual à atual e fraca, e uma troca seguida da volta à senha do seed |
| Rotas Internas | Usuário por id (inclusive o de cliente, com `role` nulo), usuário de acesso de CPF já cadastrado, e-mail de outra pessoa, CPF inválido e credencial do cliente (aceita, senha errada e CPF sem usuário com o mesmo corpo, corpo sem CPF) |
| Remoção de Usuários | Exclui o atendente e o mecânico criados, de modo que a collection pode rodar de novo no mesmo banco |

`GET /api/me` precisa do Work Order; para rodar a collection sem ele, suba o stack com o stub de [Como executar localmente › Work Order](local-setup.md#work-order). Importe os dois arquivos no Postman ou rode com Newman, o executor de collections do Postman na linha de comando:

```bash
# A partir de app/: subir o stack com o stub do Work Order e rodar a collection
docker compose -f docker-compose.yml -f docker-compose.dast.yml up -d --build --wait
npx --yes newman run ../collections/identity-collection.json -e ../collections/identity-environment.json
```
