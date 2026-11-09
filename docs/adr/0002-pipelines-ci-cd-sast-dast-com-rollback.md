# ADR 0002: Pipelines de CI, CD, SAST e DAST separados, com rollback e DAST pelo login

## Status

Aceito — 2026-11-05. Herdada da ADR 0002 do Inventory (ADR 0014 do Work Order), adaptada ao Identity. Revista em 2026-11-08: com o login de funcionário no Identity, o DAST obtém o token pelo login, como no Work Order, e faz uma segunda varredura com um token de cliente.

## Contexto

Validar uma mudança, entregá-la, analisá-la estaticamente (SAST) e atacá-la com um scanner dinâmico (DAST) têm gatilhos, duração e poder de bloqueio diferentes. Além disso:

- o CD publica no EKS (o Kubernetes gerenciado da AWS) sem intervenção e precisa desfazer um deploy que não sobe;
- quase toda rota exige o token RS256 de funcionário, e `/api/me` aceita também o token de cliente, que a customer-auth (a função Lambda de login do cliente, fora deste repositório) emite; o DAST precisa dos dois tokens sem segredo versionado.

## Decisão

**Quatro workflows**, um por responsabilidade:

| Workflow | Gatilho | Papel |
| --- | --- | --- |
| CI | push em `feature/**` e `fix/**` | Lint, unitários, E2E, build, validação das migrations e abertura do PR |
| CD | push na `main` e `workflow_dispatch` | Imagem no ECR, credenciais, migração, deploy e smoke |
| SAST | PR para a `main` e push na `main` | Testes unitários com cobertura e SonarQube Cloud |
| DAST | PR para a `main` e `workflow_dispatch` | OWASP ZAP contra a API no `docker-compose` |

**Rollback no CD.** O `App Deploy` aplica o Deployment com a imagem de tag imutável (SHA), espera o rollout e faz o smoke `GET /health/identity` pelo gateway. Se o rollout ou o smoke falham, executa `kubectl rollout undo` e falha o job. O `workflow_dispatch` com `image_tag` reimplanta uma imagem já publicada, sem build e sem migração (uma imagem antiga rodaria migrations velhas sobre o schema novo).

**DAST pelo login.** O `dast.yml` gera pares RS256 efêmeros com `openssl` (access e refresh do funcionário, com um `kid` próprio do DAST, `staff-dast`, e o par do token de cliente), sobe o stack com o seed e com um stub do Work Order, e obtém o token por `POST /api/auth/login` com o ADMIN semeado. O e-mail e a senha `Tech@2026` ficam no workflow, porque já são públicos no seed e na collection. Para a segunda varredura, assina um token de cliente com a privada do par de cliente e o id do usuário de cliente semeado, como faria a customer-auth, e apaga a privada. Os tokens e as privadas são mascarados nos logs. O ZAP lê `/api/docs-json` e envia `Authorization: Bearer <token>` nas duas varreduras.

**Ruleset.** Depois do primeiro PR, a `main` passa a exigir `Lint`, `Unit Tests`, `E2E Tests`, `Build`, `SAST` e `OWASP ZAP API Scan`; `DB Validation` roda, mas não é obrigatório. O merge é sempre humano.

## Alternativas consideradas

| Alternativa | Trade-off | Rever se |
| --- | --- | --- |
| Um workflow monolítico | Um arquivo só, mas mistura gatilhos e deixa o scan lento atrasar o feedback do lint e dos testes | — |
| DAST só no Work Order | Menos CI para manter, mas os outros serviços ficariam sem varredura dinâmica | — |
| DAST com token fixo guardado em secret | Sem passo de geração, mas um segredo de longa vida que valida token em um serviço real | — |
| Token de ADMIN assinado pelo próprio workflow, sem login | Não depende do seed, mas não exercita o login nem o caminho real de emissão do token | — |
| E-mail e senha do ADMIN em secrets do repositório | Esconde a credencial, mas ela já é pública no seed e na collection, e o secret só somaria configuração | A credencial do DAST deixar de ser a do seed |
| DAST sem autenticação | Varre só health e Swagger, e as rotas de negócio nunca seriam exercitadas | O serviço não ter rota protegida |
| Rollback manual | Sem lógica no workflow, mas deixa o serviço fora do ar até alguém agir | — |
| Deploy sem smoke pelo gateway (só rollout) | Menos dependência do gateway, mas o rollout não prova a rota publicada; o smoke é pulado com aviso se a API do gateway ainda não existe | — |
| CD acoplado ao CI por `workflow_run` | Garante o CI antes do CD, mas a `main` protegida já só recebe PR com checks verdes | — |

## Consequências

### Positivas

- Feedback rápido do CI; SAST e DAST em paralelo ao deploy.
- Deploy que não sobe volta sozinho para a revisão anterior.
- O DAST exercita o login, as rotas protegidas e `/api/me` com os dois tokens, sem segredo versionado.

### Negativas e limites

- O CI só dispara em `feature/**` e `fix/**`: outro nome de branch não roda checks.
- O rollback automático só cobre rollout e smoke; uma migration já aplicada não é desfeita.
- Quatro arquivos de workflow para manter em sincronia com o template.

## Referências

- [CI/CD](../ci-cd.md)
