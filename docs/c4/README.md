# 🧩 Modelo C4 — Identity Service

Este diretório documenta a API do Identity com o [modelo C4](https://c4model.com), uma forma de descrever a arquitetura em níveis de zoom (contexto, containers, componentes e código). Aqui fica o nível de Componente: as peças internas do container **API do Identity** e como elas se ligam ao banco, ao cache, à mensageria e à Lambda de notificação, a função `oficina-mecanica-lambda-notification`, que envia os e-mails publicados pelo serviço.

## Índice

- [Convenções](#convenções)
- [Nível 3 — Componente da API do Identity](#nível-3--componente-da-api-do-identity)
- [Documentação relacionada](#documentação-relacionada)

## Convenções

- **Tipo explícito em todo elemento.** Cada elemento declara o tipo entre colchetes (`[Pessoa]`, `[Sistema Externo]`, `[Container Externo: tecnologia]`, `[Componente: tecnologia]`).
- **Ícone de componente.** Cada componente leva o ícone UML clássico (dois retângulos), na paleta azul dos demais elementos.
- **Tecnologia só ao cruzar fronteira.** As setas entre componentes do mesmo container não levam tecnologia; ela aparece nas relações com o funcionário, o Kubernetes, o banco, o cache e a mensageria.
- **Imagem com o fonte.** A imagem é gerada pelo PlantUML, ferramenta que desenha diagramas a partir de texto, com a biblioteca [C4-PlantUML](https://github.com/plantuml-stdlib/C4-PlantUML) v2.14.0, e o fonte do diagrama fica embutido no próprio PNG.

## Nível 3 — Componente da API do Identity

<p align="center"><img src="images/c4-component.png" alt="Diagrama de Componente C4 da API do Identity: o Funcionário apresenta o token de funcionário ao componente Guards/Segurança; o Kubernetes consulta o Health, que verifica o banco; a Mensageria lê e apaga as linhas do outbox pelos Repositories e publica no SNS, que entrega notification.email.send à Lambda de notificação pela fila notification.fifo; os Repositories gravam no PostgreSQL e o Cache usa o ElastiCache Valkey; o Cliente Interno ainda não tem chamador" width="100%"></p>

O serviço ainda não tem rota de negócio, então o diagrama mostra só os componentes transversais, os que todo serviço da solução tem. Destaques do fluxo:

- o **Funcionário** apresenta o token de funcionário ao **Guards / Segurança**, que o valida pela chave pública, sem consultar o banco;
- o **Kubernetes** consulta o **Health**, e a prontidão depende só do PostgreSQL;
- a **Mensageria** publica no tópico as linhas do outbox (a tabela onde a mensagem é gravada na mesma transação do dado), e a fila `notification.fifo` as entrega à **Lambda de notificação**;
- o serviço não consome nenhuma fila.

| Componente | Tecnologia | Responsabilidade |
|---|---|---|
| **Guards / Segurança** | NestJS Guards | `AuthenticationGuard` global que nega por padrão (exige o token de funcionário em toda rota, salvo as marcadas com `@Public()`), `JwtStrategy` RS256 pela chave pública e `RolesGuard` (controle de acesso por papel) |
| **Health** | NestJS Module | `GET /api/health/live` sem I/O e `GET /api/health/ready` com `SELECT 1`, consumidas pelas probes (verificações periódicas) do Kubernetes |
| **Cliente Interno** | @nestjs/axios | `InternalHttpClient` para as rotas `/internal` de outros serviços, com prazo de 2 s, `x-request-id` e `traceparent`; ainda sem chamador |
| **Mensageria** | NestJS Module · AWS SDK | Relay do outbox (rotina que lê o outbox e publica) para o SNS FIFO, sob um advisory lock do PostgreSQL que deixa só uma réplica publicar por vez |
| **Repositories** | Prisma | Unit of Work (a transação que agrupa as escritas de um caso de uso) e outbox gravado na mesma transação da mudança de estado |
| **Cache** | NestJS Module · ioredis | Porta `ICache` sobre o Valkey, no padrão cache-aside (lê do cache e, na falta, do banco), que falha aberto: com o cache fora do ar, a leitura vai ao banco; ainda sem chaves |

| Elemento externo | Tipo | Papel |
|---|---|---|
| **Funcionário** | Pessoa | Administrador, mecânico ou atendente, com o token de funcionário |
| **Kubernetes** | Sistema externo | Executa as probes de inicialização, vivacidade e prontidão do pod |
| **Lambda de notificação** | Sistema externo | A função `oficina-mecanica-lambda-notification`, que lê `notification.fifo` e envia os e-mails |
| **Banco de Dados** | Container externo | Amazon RDS PostgreSQL 18 do Identity, hoje só com a tabela `outbox` |
| **Cache Distribuído** | Container externo | Amazon ElastiCache Valkey 9.1 do Identity (Valkey é o banco em memória compatível com Redis) |
| **Mensageria AWS** | Container externo | Tópico SNS FIFO `oficina-events.fifo` e a fila SQS FIFO `notification.fifo`, assinante do tópico, que pertence à Lambda de notificação |

## Documentação relacionada

- [Arquitetura](../architecture.md)
- [ADR 0005 — Publicação no SNS FIFO com outbox transacional](../adr/0005-mensageria-sns-fifo-com-outbox.md)
- [ADR 0006 — Cache do dono no ElastiCache](../adr/0006-cache-do-dono-no-elasticache.md)
