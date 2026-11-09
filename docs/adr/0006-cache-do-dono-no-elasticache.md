# ADR 0006: Cache do dono no ElastiCache

## Status

Aceito — 2026-11-05. Herdada da ADR 0006 do Inventory (ADR 0019 do Work Order), adaptada ao Identity. Revista em 2026-11-08, com a chave do usuário.

## Contexto

Cada serviço é o único cliente do próprio banco e do próprio cache. Um dado só fica certo em cache se quem o guarda souber quando ele muda, e só o dono da entidade sabe disso. O cache não pode virar dependência dura: com ele fora do ar, a API continua respondendo pelo banco.

## Decisão

Cache-aside (a aplicação lê do cache e, na falta, lê do banco e grava no cache) no ElastiCache for Valkey do próprio serviço (`cache-oficina-mecanica-identity`), só para dados que o Identity é dono, com invalidação no caso de uso depois do commit.

1. **Porta e adaptador.** `ICache` (`get`, `set` com TTL, `delete(keys[])`) em `application/ports/output/services/`; `ValkeyCacheAdapter` com `ioredis` por `CACHE_URL` (`rediss://` com senha no cluster, `redis://` local). TTL por `CACHE_TTL_SECONDS` (padrão 43200 s, 12 h).
2. **Só o dono guarda.** O serviço nunca guarda no cache o dado de outro serviço: guarda só o id e busca o dado no dono.
3. **Falha do cache vira leitura no banco.** Falha de leitura registra `cache.unavailable` e conta como falta; falha de exclusão registra `cache.invalidation_failed` e a chave expira pelo TTL. A prontidão não depende do cache.
4. **Chave do usuário.** `identity:user:<id>`, com o usuário sem o hash da senha e um `cacheVersion` (um valor que o código atual não lê conta como falta), lida por `GET /api/users/:id`, `GET /internal/users/:id` e `GET /api/me`; o 404 não é guardado. Toda escrita no usuário a apaga depois do commit. Login, refresh e redefinição de senha leem sempre o banco.
5. **Código de redefinição fora do cache.** O mesmo Valkey guarda os códigos de redefinição de senha, mas por uma porta própria que falha a requisição, porque o código não é cache ([ADR 0008](0008-codigo-de-reset-no-valkey.md)).

## Alternativas consideradas

| Alternativa | Trade-off | Rever se |
| --- | --- | --- |
| Valkey em pod no cluster, ou DynamoDB | Pod sem custo extra, mas fora de gestão; DynamoDB não tem TTL exato nem contador atômico | — |
| ElastiCache Serverless | Sem dimensionamento, mas indisponível no ambiente da AWS usado pela solução | O ambiente liberar o serviço |
| Cache em quem consome | Poupa a chamada interna, mas quem consome não sabe quando o dado muda | — |
| Cache em memória por réplica | Sem infraestrutura, mas serve dado velho sem invalidação entre réplicas | — |
| Invalidação centralizada no Unit of Work | Ninguém esquece, mas tira a regra do caso de uso e do padrão dos efeitos depois do commit | Escritas sem invalidação aparecerem |
| `@nestjs/cache-manager` | Integração pronta, mas sem prazo por comando (um Valkey que aceita TCP e não responde travaria a leitura) e sem distinguir falha de leitura de falha de invalidação | — |

## Consequências

### Positivas

- O dado em cache só muda por quem o escreve: sem invalidação entre serviços.
- Um Valkey fora do ar ou lento não derruba nem trava a API.

### Negativas e limites

- Toda escrita nova precisa apagar as chaves afetadas; o esquecimento serve dado velho por até o TTL.
- A corrida entre uma leitura que regrava valor velho e uma escrita que apaga continua possível, com janela de milissegundos.
- O ElastiCache é mais um recurso pago e provisionado por serviço.

## Referências

- [Arquitetura › Cache do dono](../architecture.md#cache-do-dono)
- [Cache-aside](https://learn.microsoft.com/azure/architecture/patterns/cache-aside)
