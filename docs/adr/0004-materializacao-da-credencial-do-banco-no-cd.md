# ADR 0004: Materialização da credencial do banco no CD

## Status

Aceito — 2026-11-05. Herdada da ADR 0004 do Inventory (ADR 0017 do Work Order), adaptada ao Identity.

## Contexto

A senha mestre do PostgreSQL é gerada e mantida pelo Amazon RDS (`rds-oficina-mecanica-identity`), que a guarda no AWS Secrets Manager. O serviço e o Job de migração recebem a conexão pelo contrato único `DATABASE_URL` do Prisma. O ARN, o endpoint e a senha não devem ser copiados para GitHub Secrets ou Variables, nem lidos pelos workloads.

## Decisão

O job `prepare-deploy` do CD, que já tem credencial AWS e `kubectl`, atua como intermediário:

1. consulta `DescribeDBInstances` até `DBInstanceStatus=available` e `MasterUserSecret.SecretStatus=active`;
2. lê o estágio `AWSCURRENT` do secret com `GetSecretValue`;
3. monta a URL PostgreSQL em um trecho Node.js inline no `cd.yml`, com `encodeURIComponent` no usuário e na senha e `schema=public&sslmode=require&uselibpqcompat=true`;
4. mascara senha e URL, preenche `DATABASE_URL` no documento `database-credentials` de `k8s/01-secrets.yaml` e o aplica por stdin (a entrada padrão do `kubectl`), sem argumento de processo, arquivo, output ou log.

O Job de migração e o Deployment consomem a mesma chave de `database-credentials`. O cache segue o mesmo princípio: `CACHE_URL` (`rediss://`) é montada a partir do endpoint do ElastiCache e do secret `cache-oficina-mecanica-identity-auth-token` e vai para `cache-credentials`.

## Alternativas consideradas

| Alternativa | Trade-off | Rever se |
| --- | --- | --- |
| Copiar senha, host e ARN para GitHub Secrets ou Variables | Simples, mas duplica a origem de verdade e exige sincronização manual | — |
| External Secrets Operator | Sincroniza sozinho, mas traz controller, CRDs e IAM de workload | Mais de um serviço precisar de rotação |
| Secrets Store CSI Driver | Monta o secret no Pod, mas muda o contrato de montagem e refresh | — |
| Pod ou Job lendo a AWS direto | Sem passo no CD, mas exige IRSA e permissão no Secrets Manager no runtime | — |
| Terraform lendo `SecretString` | Aplica na infra, mas leva a credencial ao state | — |
| Arquivo Node.js auxiliar | Reutilizável, mas é um arquivo a mais para uma operação linear | A lógica crescer |
| Rotação automática | Mais seguro, mas exige refresh e retry coordenados nos Pods; fica desabilitada | Uma mudança dedicada à rotação |

## Consequências

### Positivas

- RDS e Secrets Manager seguem como única origem da senha.
- Migração e aplicação recebem a mesma conexão, com TLS.

### Negativas e limites

- O CD depende das APIs do RDS, do ElastiCache e do Secrets Manager e falha antes da migração se algo estiver indisponível.
- O valor vira Secret do Kubernetes, sujeito às proteções do cluster.
- Sem rotação nem renovação automática dos Pods por mudança isolada da credencial; o escopo é deploy greenfield.

## Referências

- [CI/CD › CD](../ci-cd.md#cd)
- `.github/workflows/cd.yml` e `k8s/01-secrets.yaml`
