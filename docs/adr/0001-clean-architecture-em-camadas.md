# ADR 0001: Clean Architecture em camadas, com fronteira livre de framework

## Status

Aceito — 2026-11-05. Herdada da ADR 0001 do Inventory (ADR 0009 do Work Order), adaptada ao Identity.

## Contexto

O Identity vai concentrar regras de identidade (cadastro de funcionários, papéis, credenciais, redefinição de senha e emissão do token de acesso) que precisam ser testáveis sem framework web, sem ORM e sem broker de mensagens, e capazes de evoluir sem que uma troca de ferramenta as atinja. O serviço nasce do mesmo template dos demais serviços NestJS da solução, e as quatro bases de código (Work Order, Identity, Billing e Inventory) precisam ter a mesma forma para o code review comparar com o template.

## Decisão

Clean Architecture com quatro camadas e regra de dependência única (o código aponta só para dentro):

- `domain/`: regras e invariantes, catálogo de mensagens e portas de repositório;
- `application/`: casos de uso, portas de entrada e de saída (`ICache`, `ILogger`, `IMetrics` e, quando houver, gateways para outros serviços);
- `interface-adapters/`: Clean Controllers e Presenters, classes TypeScript simples sem decorators do NestJS;
- `infrastructure/`: borda HTTP do NestJS, Prisma, mensageria, cache, logging, telemetria e health.

A regra é imposta por ferramenta: as regras `no-restricted-imports` de `app/eslint.config.mjs` proíbem `@nestjs/*`, `@generated/*` (Prisma), `@opentelemetry/*`, `@aws-sdk/*` e `ioredis` em `domain/`, `application/` e `interface-adapters/`, e só `infrastructure/persistence/prisma/` importa o Prisma. Use cases e Clean Controllers são classes sem `@Injectable`, compostas por `useFactory` no módulo Nest.

## Alternativas consideradas

| Alternativa | Trade-off | Rever se |
| --- | --- | --- |
| Camadas tradicionais (N-tier) com services chamando o Prisma direto | Menos arquivos, mas acopla a regra de credenciais e papéis ao ORM e exige banco para testar um caso de uso | — |
| Transaction Script nos services | Simples para CRUD, mas as regras de senha, papel e token ficariam duplicadas em cada ponto de entrada | O serviço continuar sendo só CRUD |
| Hexagonal com duas camadas (sem `interface-adapters`) | Mais enxuta, mas perde o teste do Clean Controller isolado do NestJS | — |
| Estrutura própria, diferente do template | Livre para otimizar este serviço, mas quebra a comparação com o Work Order no code review e multiplica as formas de manter | — |

## Consequências

### Positivas

- Regra de negócio testada com mocks de interface, sem Nest e sem banco.
- Vazamento de framework vira erro de lint, não surpresa em produção.
- Estrutura igual à dos outros serviços: onboarding e review previsíveis.

### Negativas e limites

- Mais indireção por funcionalidade (porta, caso de uso, Clean Controller, `@Controller`).
- Duplicação aparente de DTOs: o tipo puro em `interface-adapters/` e o DTO decorado em `infrastructure/http/`.
- `interface-adapters/` só passa a existir quando chegar a primeira rota de negócio.

## Referências

- [Arquitetura › Camadas](../architecture.md#camadas)
