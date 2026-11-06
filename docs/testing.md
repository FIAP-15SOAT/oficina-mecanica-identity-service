# Testes

## Índice

- [Unitários](#unitários)
- [E2E](#e2e)
- [Por que os e2e dos componentes transversais têm rotas de teste](#por-que-os-e2e-dos-componentes-transversais-têm-rotas-de-teste)
- [Node 24](#node-24)
- [Postman e Newman](#postman-e-newman)

## Unitários

Jest 30 com `ts-jest`, em `app/test/unit/`, que espelha `app/src/`. Teste de use case instancia a classe com `jest.Mocked<IRepository>`, sem Nest DI e sem banco. As factories de mock ficam em `app/test/helpers/`.

```bash
# A partir de app/: testes unitários com cobertura
npm run test:cov
```

O `coverageThreshold` global exige 100% de linhas, statements, funções e branches, e o comando falha abaixo disso. É o mesmo lcov, o relatório de cobertura no formato LCOV (`app/coverage/lcov.info`), que o workflow de SAST envia ao Sonar; o badge do README mostra a cobertura que o Sonar mede dessa execução. Ficam fora da cobertura os módulos Nest, `main.ts`, `otel.ts`, enums, configs, exceções, DTOs e o `prisma.service.ts` (veja `collectCoverageFrom` no `package.json`).

## E2E

Jest com Supertest (biblioteca que faz requisições HTTP à aplicação dentro do teste) e **Testcontainers** (biblioteca que sobe containers Docker descartáveis a partir do teste) em `app/test/e2e/`, sem mocks de infraestrutura: PostgreSQL 18, Valkey 9.1 (o cache em memória compatível com Redis) e, no teste do outbox, LocalStack 4.14.0, o emulador local dos serviços AWS, com a topologia real de `app/localstack/init-topology.sh`. O helper `setupTestApp` (`app/test/helpers/test-app.helper.ts`) sobe o `AppModule` com o mesmo `configureApp` do `main.ts`, aplica a migration e, com `withMessaging`, liga o relay do outbox de verdade. Requer Docker.

```bash
# A partir de app/: E2E (a primeira execução baixa as imagens, depois usa o cache local)
npm run test:e2e
```

Suítes atuais (seis):

- autenticação (guard e estratégia RS256);
- health (incluindo banco e cache indisponíveis e encerramento gracioso);
- logging;
- telemetria;
- filtro de exceções;
- outbox (relay, ordem, mensagem sem ordem de serviço num grupo FIFO só dela, transação desfeita e duas réplicas do relay). Como o serviço não consome fila, o teste lê a fila assinante `notification.fifo` com o `@aws-sdk/client-sqs` (só em `devDependencies`) para conferir o que o relay publicou.

O token de teste é assinado por `app/test/helpers/staff-jwt.helper.ts` com um par RS256 gerado em memória a cada execução; nenhuma chave é versionada.

## Por que os e2e dos componentes transversais têm rotas de teste

O serviço ainda não tem rota de negócio, mas os comportamentos dos componentes transversais copiados do template (autenticação deny-by-default, formato dos erros, log de acesso, traces, encerramento com requisição em andamento) só aparecem numa requisição que passe pelo router, pelos guards, pelos filtros e pelos interceptors. Cada suíte declara no próprio spec um controller que existe só no teste (por exemplo `AuthGuardProbeController` e `TestExceptionController`) e o monta por `setupTestApp({ controllers })`, ao lado do `AppModule`. Assim:

- o código de produção não ganha rota nenhuma só para ser testado;
- o padrão é permanente: quando chegarem as rotas de negócio, esses specs continuam iguais e não passam a depender das regras delas;
- um defeito de um componente transversal aponta para ele, não para uma regra de negócio.

## Node 24

Os binários nativos de `node_modules` dependem da versão do Node. Um `node_modules` instalado no Node 22 faz o e2e terminar com **segfault (exit 139)** no Node 24. Se acontecer, reinstale sob o Node 24:

```bash
# A partir de app/: trocar para o Node 24 e reinstalar do zero
source ~/.nvm/nvm.sh && nvm use 24
rm -rf node_modules
npm ci
```

O `engines` do `package.json` exige `node >=24.9`, e o CI roda no Node 24.

## Postman e Newman

Em [`collections/`](../collections) há a collection `identity-collection.json` e o environment `identity-environment.json` (Postman v2.1), com os health checks e o Swagger. A `baseUrl` é única: `http://localhost:3001`. Importe os dois no Postman ou rode com Newman, o executor de collections do Postman na linha de comando, contra o stack local:

```bash
# Subir o stack (a partir de app/) e rodar a collection
docker compose up -d --build --wait
npx --yes newman run ../collections/identity-collection.json -e ../collections/identity-environment.json
```
