# ADR 0008: Código de redefinição de senha no Valkey

## Status

Aceito — 2026-11-08

## Contexto

Quando um usuário esquece a senha, o `ADMIN` pede um código de redefinição (`POST /api/users/:userId/password-resets`); o código, de 6 dígitos, chega ao usuário por e-mail, e o usuário o confirma com a senha nova (`POST /api/auth/password-reset-confirmations`). A regra de negócio exige que o código expire em 10 minutos e seja recusado depois de 5 tentativas, mesmo certo.

O código é um dado de vida curta, com um contador que muda a cada tentativa. Duas tentativas simultâneas não podem ambas passar pela quinta, e uma tentativa que chega depois da expiração não pode ressuscitar o código. O serviço já tem um Valkey (banco em memória compatível com Redis; no cluster, o Amazon ElastiCache) para o cache de usuário, mas um cache engole as próprias falhas, e um código que não pode ser gravado nem conferido precisa falhar a requisição.

## Decisão

**O código fica no Valkey do Identity, só como hash, numa chave com prazo de 600 s e contador de tentativas incrementado de forma atômica, por uma porta própria que falha a requisição com 503 quando o Valkey não responde. Não há tabela de códigos no PostgreSQL.**

1. **Chave e valor.** `identity:reset-code:<userId>` é um hash do Valkey com `codeHash` (o código com bcrypt, nunca em texto) e `attempts`. Um pedido novo substitui o código pendente.
2. **Prazo junto com o valor.** O pedido grava `HSET` e `EXPIRE 600` num `MULTI`/`EXEC`, para a chave nunca existir sem prazo; o Valkey apaga a chave no instante em que ela expira.
3. **Contador atômico que não recria a chave.** A confirmação roda um script Lua que, só se a chave existir, incrementa `attempts` e devolve o contador e o hash. Um `HINCRBY` sozinho numa chave expirada a recriaria sem prazo. Com o contador acima de 5, a confirmação recusa mesmo com o código certo.
4. **Senha fraca não gasta tentativa.** A força da senha nova é validada antes de qualquer conferência (422); só a comparação do código gasta tentativa.
5. **Mesma resposta para toda recusa.** E-mail sem usuário, código expirado ou nunca pedido, sexta tentativa e código errado respondem 401 com `Código de redefinição inválido ou expirado`.
6. **Porta própria.** `IPasswordResetCodeStore` é separada do `ICache`, e o adaptador abre o próprio cliente do Valkey. Valkey indisponível responde 503 com `Não foi possível processar o código de redefinição agora. Tente novamente em instantes` no pedido e na confirmação.
7. **Código antes do e-mail.** O pedido grava o código no Valkey e só depois grava o e-mail `password_reset_code` no outbox: uma falha do outbox deixa um código sem e-mail, que o próximo pedido substitui, em vez de um e-mail com um código que não existe.
8. **Ordem da confirmação.** A senha nova é gravada no PostgreSQL e, depois do commit, a chave é apagada e o cache do usuário é invalidado.

## Alternativas consideradas

| Alternativa | Trade-off | Rever se |
| --- | --- | --- |
| Tabela de códigos no PostgreSQL, como o Work Order faz hoje | Durável e transacional com a senha, mas exige limpar os códigos expirados e travar a linha para contar as tentativas sem corrida | Os códigos precisarem sobreviver a um reinício do cache |
| DynamoDB com TTL | Gerenciado e sem servidor, mas o TTL apaga com atraso (o código expirado continuaria legível até ser removido), não há contador atômico condicionado à existência do item, e seria mais uma tecnologia e uma tabela na infraestrutura | — |
| Guardar o código pelo `ICache` | Reaproveita o adaptador existente, mas o `ICache` engole as falhas do Valkey e não tem operações de hash nem script: um código que não foi gravado pareceria gravado | — |
| Código assinado (token) sem estado no servidor | Dispensa armazenamento, mas não conta tentativas nem permite invalidar o código anterior quando um novo é pedido | — |

## Consequências

### Positivas

- O prazo é exato e o contador é atômico, inclusive com confirmações simultâneas.
- Nenhuma tabela nem rotina de limpeza no PostgreSQL; o código nunca existe em texto fora da linha do outbox e da mensagem do e-mail.
- Uma tecnologia só para o cache e o código, já provisionada por serviço.

### Negativas e limites

- Um reinício ou uma troca do Valkey perde os códigos pendentes: a confirmação responde 401, e o `ADMIN` pede outro código.
- Com o Valkey fora do ar, a redefinição de senha para (503), embora login, refresh e o restante da API continuem.
- Se o Valkey falhar ao apagar a chave depois de a senha nova ser gravada, a confirmação responde 503 embora a senha tenha mudado. Repetir a confirmação com o mesmo código conclui e apaga a chave; se ninguém repetir, ela expira em até 10 minutos. O procedimento está no [runbook](../security.md#runbook).

## Referências

- [Arquitetura › Redefinição de senha no Valkey](../architecture.md#redefinição-de-senha-no-valkey)
- [Banco de dados › Chaves do Valkey](../database.md#chaves-do-valkey)
- [ADR 0006 — Cache do dono no ElastiCache](0006-cache-do-dono-no-elasticache.md)
