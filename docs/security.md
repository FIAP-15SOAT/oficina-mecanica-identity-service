# Segurança

Como o Identity emite e valida os tokens, onde ficam as chaves, que janelas de revogação a solução aceita e o que fazer nos incidentes conhecidos.

## Índice

- [Mitigações aplicadas no código](#mitigações-aplicadas-no-código)
- [Chaves dos tokens](#chaves-dos-tokens)
- [Validação dos tokens](#validação-dos-tokens)
- [Janelas de revogação aceitas](#janelas-de-revogação-aceitas)
- [Recusa única na credencial do cliente](#recusa-única-na-credencial-do-cliente)
- [Senhas e códigos fora dos logs](#senhas-e-códigos-fora-dos-logs)
- [Runbook](#runbook)

## Mitigações aplicadas no código

- Helmet (cabeçalhos de segurança HTTP), CORS só para as origens de `ALLOWED_ORIGINS`, `SanitizeStringsPipe` global e `ValidationPipe` com `whitelist`, `forbidNonWhitelisted` e `transform`: campo desconhecido no corpo responde 400.
- Senhas com bcrypt (custo `BCRYPT_SALT_ROUNDS`, padrão 12) e regra de senha forte no domínio (`User.validatePasswordStrength`): no mínimo 8 caracteres, com maiúscula, minúscula, número e caractere especial.
- Código de redefinição de 6 dígitos guardado só como hash bcrypt, que expira em 10 minutos e é recusado depois de 5 tentativas, mesmo certo. Só o `ADMIN` pede um código; não há autoatendimento.
- Mensagem única por fluxo, sem oráculo de enumeração de usuários (uma resposta que revelaria se um e-mail ou CPF existe): `Credenciais inválidas` no login e na credencial do cliente, `Refresh token inválido ou expirado` no refresh e `Código de redefinição inválido ou expirado` na confirmação da redefinição. O motivo real vai só para o log, no campo `failureReason` ou `resetOutcome`.
- Nome do destinatário escapado no HTML dos e-mails de conta, porque é digitado pelo usuário.
- Filtros de exceção que nunca expõem stack, host ou texto do driver ao cliente; um 401 não gera linha de erro nem stack trace.
- Rotas `/internal` sem token, mas fora do prefixo `/api`, fora do Swagger e fora do API Gateway: só respondem pela rede do cluster.

## Chaves dos tokens

Nenhuma chave é versionada (`*.pem` está no `.gitignore`); testes, Compose local e DAST usam pares gerados na hora.

| Chave | Onde fica | Quem usa |
| --- | --- | --- |
| `STAFF_JWT_PRIVATE_KEY` (PKCS#8, `BEGIN PRIVATE KEY`) | Secret do environment `production` do repositório → Secret Kubernetes `jwt-private-keys` | O Identity, para assinar o access token |
| `STAFF_JWT_REFRESH_PRIVATE_KEY` (PKCS#8) | Secret do environment `production` do repositório → Secret Kubernetes `jwt-private-keys` | O Identity, para assinar e conferir o refresh token (a pública é derivada da privada) |
| `STAFF_JWT_PUBLIC_KEY` (`BEGIN PUBLIC KEY`) | Secret da organização `FIAP-15SOAT` → Secret Kubernetes `jwt-public-keys` | Todo serviço que valida o token de funcionário |
| `STAFF_JWT_KEY_ID` | Secret da organização → Secret Kubernetes `jwt-public-keys` | O Identity, no cabeçalho `kid`, e os validadores, que o conferem |
| `CUSTOMER_JWT_PUBLIC_KEY` | Secret do repositório → Secret Kubernetes `jwt-public-keys` | O Identity, para validar o token de cliente em `/api/me` |

O job `Prepare Deployment Configuration` do CD confere que cada chave existe e é um bloco PEM do tipo certo antes de tocar no cluster, codifica os valores em base64, mascara-os no log e aplica os Secrets por stdin, sem arquivo intermediário ([CI/CD](ci-cd.md#cd)). Sem o `jwt-private-keys`, o pod não sobe, porque o `JwtTokenService` exige as duas chaves privadas no boot.

Hoje o Work Order também guarda as duas chaves privadas, porque o API Gateway ainda encaminha o login a ele: os dois serviços assinam com o mesmo par, e o access emitido por um vale no outro. Por isso uma troca de par atualiza os secrets dos dois repositórios ao mesmo tempo.

**Gerar ou trocar o par.** Gere os pares fora do repositório e atualize os secrets juntos, com um `kid` novo:

```bash
tmp="$(mktemp -d)"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$tmp/staff.key"
openssl pkey -in "$tmp/staff.key" -pubout -out "$tmp/staff.pub"
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out "$tmp/refresh.key"
for repo in oficina-mecanica-identity-service oficina-mecanica-work-order-service; do
  gh secret set STAFF_JWT_PRIVATE_KEY --env production -R "FIAP-15SOAT/$repo" < "$tmp/staff.key"
  gh secret set STAFF_JWT_REFRESH_PRIVATE_KEY --env production -R "FIAP-15SOAT/$repo" < "$tmp/refresh.key"
done
gh secret set STAFF_JWT_PUBLIC_KEY --org FIAP-15SOAT --visibility all < "$tmp/staff.pub"
gh secret set STAFF_JWT_KEY_ID --org FIAP-15SOAT --visibility all --body "staff-$(date +%Y-%m-%d)"
rm -rf "$tmp"
```

Atualizar um Secret não reinicia os pods: rode o CD de cada serviço e reinicie os Deployments, para todas as réplicas assinarem e validarem com o par novo ao mesmo tempo. Uma troca de par invalida todos os tokens emitidos com o anterior.

```bash
kubectl rollout restart deployment/identity-service -n identity
kubectl rollout status deployment/identity-service -n identity --timeout=180s
```

## Validação dos tokens

Duas estratégias do Passport (a biblioteca de autenticação do NestJS), isoladas, cada uma com a própria chave, emissor e audiência. As duas fixam `algorithms: ['RS256']`, então um token HS256 (inclusive um forjado com a chave pública como segredo) ou sem assinatura é recusado antes de qualquer outra conferência.

- **`jwt` (funcionário)**: `STAFF_JWT_PUBLIC_KEY`, `kid` igual a `STAFF_JWT_KEY_ID`, `iss = oficina-identity`, `aud = oficina-services`, `exp` e `typ = access`. Um refresh enviado como access falha na chave, na audiência e no `typ`.
- **`customer-jwt` (cliente)**: `CUSTOMER_JWT_PUBLIC_KEY`, `iss = oficina-customer-auth`, `aud = oficina-api`, `exp` e `sub` obrigatórios. O token de cliente só carrega `sub`, o id do usuário, e só é aceito em `GET /api/me` e `PATCH /api/me/password`.
- **Refresh**: conferido só pelo `RefreshTokenUseCase`, com a chave do refresh, `aud = oficina-identity` e `typ = refresh`; depois o usuário é relido no PostgreSQL.

Nenhuma das estratégias relê o usuário: a validação é só pela assinatura e pelos claims, como nos outros serviços da solução. As consequências estão na seção seguinte.

## Janelas de revogação aceitas

Não há lista de revogação de token. As janelas abaixo são aceitas pela solução:

| Situação | Onde vale na hora | Janela aceita |
| --- | --- | --- |
| Funcionário desativado ou com a senha trocada (pela própria conta ou por redefinição) | Login e refresh recusam com 401: o login confere `isActive`, e o refresh confere `isActive` e recusa o refresh emitido antes de `password_changed_at` | O access que ele já tem continua aceito nas rotas do Identity e dos outros serviços até expirar, **em até 10 minutos** |
| Usuário de cliente desativado ou com a senha trocada | Hoje a customer-auth ainda confere a credencial no banco do Work Order, então desativar ou trocar a senha de um usuário no Identity ainda não alcança o login do cliente | O token de cliente que ele já tem continua aceito em `GET /api/me` e `PATCH /api/me/password` até expirar, **em até 60 minutos**; os vínculos com clientes vêm do Work Order, que só devolve os ativos |
| Usuário excluído | Login e refresh; `GET /api/me` e `PATCH /api/me/password` respondem 404, porque o usuário não existe mais | O access de funcionário que ele já tem continua aceito nas demais rotas do Identity e nos outros serviços até expirar, **em até 10 minutos** |

Para encurtar a janela de um funcionário, desative-o e espere o access expirar; não há outro mecanismo.

## Recusa única na credencial do cliente

`POST /internal/customer-authentications`, o contrato oferecido à customer-auth para conferir o CPF e a senha digitados pelo cliente (hoje ela ainda confere a credencial no banco do Work Order), responde **401** com `Credenciais inválidas` e o mesmo corpo para qualquer recusa: CPF com dígito verificador errado, CPF sem usuário, usuário desativado e senha errada. Se cada caso tivesse uma resposta, quem tenta logins descobriria quais CPFs têm conta na oficina (enumeração de usuários) e concentraria as tentativas de senha neles. Só o corpo malformado, sem um dos campos ou com tipo errado, responde 400, porque isso não depende de nenhum dado cadastrado. O motivo da recusa fica só no evento de log `auth.authentication.failed`, no campo `failureReason`.

## Senhas e códigos fora dos logs

A senha inicial e o código de redefinição existem em texto só em dois lugares: na linha da tabela `outbox` do PostgreSQL do Identity (onde a mensagem é gravada na mesma transação do dado), até o relay, a rotina do serviço que publica essas linhas, publicá-la e apagá-la (normalmente em menos de um segundo), e na mensagem `notification.email.send`, que trafega pelo SNS e pela fila `notification.fifo`, com criptografia em repouso e retenção de 1 dia. O catálogo de log não tem campo para senha, código nem corpo de e-mail, e os testes E2E conferem que nenhuma linha de log os contém. Senhas e códigos são guardados só como hash bcrypt.

## Runbook

| Sintoma | Causa | O que fazer |
| --- | --- | --- |
| Usuário diz que o código de redefinição não funciona, logo depois de um reinício ou troca do Valkey | O Valkey não persiste o código: o reinício perde os códigos pendentes, e a confirmação responde 401 | O `ADMIN` pede outro código (`POST /api/users/:userId/password-resets`) |
| A confirmação da redefinição respondeu 503, mas o usuário já entra com a senha nova | O Valkey falhou ao apagar a chave do código depois de a senha nova ser gravada: a senha mudou, e a resposta é 503 | Repetir a confirmação com o mesmo código e a mesma senha conclui e apaga a chave; ou deixar a chave expirar em até 10 minutos |
| Pedido ou confirmação de redefinição respondem 503 com `Não foi possível processar o código de redefinição agora. Tente novamente em instantes` | Valkey indisponível ou lento (prazo de 500 ms por comando) | Conferir o ElastiCache do Identity; nenhum e-mail sai enquanto isso, e o cache de usuário cai para o banco sozinho |
| Pedido de código respondeu 500 e o e-mail não chegou | O código foi gravado no Valkey, mas o outbox (PostgreSQL) falhou | Pedir outro código, que substitui o anterior |
| `GET /api/me` responde 503 com `Não foi possível carregar os clientes vinculados agora. Tente novamente em instantes` | Work Order sem resposta (fora do ar ou acima do prazo de 2 s), com erro 5xx ou com um 4xx em `GET /internal/users/:userId/customers` | Conferir o Work Order; login, refresh e `/api/users` seguem funcionando |
| E-mail de senha inicial ou de código não chega | Relay parado (evento `messaging.outbox.publish_failed`), mensagem na DLQ (dead-letter queue, a fila que guarda as mensagens que falharam 5 vezes) da Lambda de notificação ou falha no envio da Lambda | Conferir o log do relay e a DLQ de `notification.fifo`; as linhas não publicadas continuam na tabela `outbox` |
| Funcionário desligado continua acessando | O access dele vale até 10 minutos depois da desativação | Desativar (`PATCH /api/users/:id` com `{ "active": false }`) e esperar o access expirar |
