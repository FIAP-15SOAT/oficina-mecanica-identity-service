# ADR 0007: Identity como único emissor do token de funcionário

## Status

Aceito — 2026-11-08

## Contexto

A solução tem quatro serviços (Work Order, Identity, Billing e Inventory) e duas funções Lambda: a customer-auth, que faz o login do cliente da oficina por CPF e senha e emite o token de cliente, e a de notificação, que envia e-mails. Todo serviço precisa saber quem é o funcionário de cada requisição e o papel dele (`ADMIN`, `MECHANIC` ou `ATTENDANT`), e cada um é dono só dos próprios dados: os usuários, os papéis e as senhas são do Identity.

A decisão precisa responder a quatro perguntas:

- quem assina o token de funcionário (um JWT, JSON Web Token), e com que tipo de chave: RS256, o algoritmo com um par de chaves RSA, em que só quem tem a privada assina e qualquer um com a pública confere;
- como os outros serviços validam o token sem que toda requisição dependa do Identity;
- o que acontece quando um funcionário é desativado ou troca de senha com um token ainda válido;
- como a customer-auth confere a credencial do cliente, sem ler o banco do Identity.

## Decisão

**Só o Identity emite o token de funcionário, assinado em RS256 com chaves privadas que só ele guarda. Todo serviço valida o token localmente, só pela assinatura e pelos claims, com a chave pública recebida por configuração, e nenhum relê o usuário. Login e refresh conferem o usuário no banco e recusam na hora o desativado ou com senha trocada; o access já emitido vale até expirar, em até 10 minutos.**

1. **Par de tokens.** `POST /api/auth/login` exige usuário ativo, senha correta e papel, e devolve o access (10 minutos, `typ = access`, `iss = oficina-identity`, `aud = oficina-services`, `kid` no cabeçalho, com `sub`, `email`, `name` e `role`) e o refresh (7 dias, `typ = refresh`, `aud = oficina-identity`, sem `kid`). O usuário sem papel, que é o usuário de acesso de um cliente, não faz login de funcionário.
2. **Chaves separadas.** O access é assinado com `STAFF_JWT_PRIVATE_KEY` e o refresh com `STAFF_JWT_REFRESH_PRIVATE_KEY`, outra chave; um token nunca passa pela validação do outro. As privadas são secrets do environment `production` do repositório, materializadas no Secret Kubernetes `jwt-private-keys`; a pública e o `kid` são secrets da organização, que todos os serviços leem.
3. **Validação local, sem revalidar.** A `JwtStrategy` de cada serviço confere assinatura, `kid`, `iss`, `aud`, `exp` e `typ`, e a autorização usa o `role` do token. Nenhum serviço consulta o Identity nem o banco a cada requisição, e o próprio Identity segue a mesma regra nas rotas dele.
4. **Revogação no login e no refresh.** O login recusa o usuário desativado. O refresh relê o usuário e recusa o desativado, o sem papel e o refresh emitido antes de `password_changed_at`, gravado em toda troca de senha. A janela aceita é a validade do access: até 10 minutos.
5. **Credencial do cliente por rota interna.** `POST /internal/customer-authentications` confere CPF, usuário ativo e senha e devolve o id do usuário; a customer-auth emite o token de cliente (60 minutos, sem refresh). Toda recusa responde 401 com o mesmo corpo, para não revelar quais CPFs têm conta. A rota é o contrato oferecido à customer-auth: hoje ela ainda confere a credencial no banco do Work Order.

Hoje o API Gateway ainda encaminha o login ao Work Order, que guarda o mesmo par de chaves: os dois serviços assinam com ele, e o access emitido por um vale no outro.

## Alternativas consideradas

| Alternativa | Trade-off | Rever se |
| --- | --- | --- |
| Revalidar o token no Identity a cada requisição | Desativação imediata, mas toda requisição de todo serviço passaria a depender do Identity estar no ar e somaria uma chamada de rede | A regra de negócio exigir que a desativação valha na hora |
| Revalidar o usuário só no Work Order | Cobriria o serviço mais usado, mas a regra ficaria diferente em cada serviço e o Work Order leria um dado que não é dele | — |
| Lambda authorizer no API Gateway (uma função que o gateway chama para autorizar cada requisição) | Validaria antes de chegar aos serviços, mas duplicaria o mapa de rota e papel fora dos serviços, e o gateway não é a única porta (as chamadas internas não passam por ele) | — |
| Segredo compartilhado (HS256) entre os serviços | Mais simples de configurar, mas quem valida também consegue emitir, e o vazamento de um serviço compromete todos | — |
| Access de 15 minutos, ou de 5 minutos com mais refreshes | 15 minutos alargaria a janela de revogação; 5 minutos multiplicaria os refreshes sem ganho real | — |
| JWKS (endpoint com as chaves públicas) e rotação automática de chaves | Trocaria o par sem reconfigurar os serviços, mas é infraestrutura a mais para um par que muda raramente | Surgir a necessidade de rotação frequente |
| Lista de revogação de tokens | Revogação imediata, mas exigiria consultar um estado compartilhado a cada requisição, o mesmo custo da revalidação | A regra de negócio exigir que a desativação valha na hora |

## Consequências

### Positivas

- Nenhum serviço além do Identity consegue emitir um token de funcionário: os outros só têm a chave pública.
- O Identity fora do ar não derruba os outros serviços: o token já emitido continua valendo até expirar.
- Uma validação só, igual em todo serviço, e nenhuma consulta extra por requisição.

### Negativas e limites

- Um funcionário desativado ou com a senha trocada continua acessando o Identity e os outros serviços com o access que já tem, por até 10 minutos; com o token de cliente, a janela é de até 60 minutos em `/api/me`.
- Com o Identity fora do ar, login, refresh e redefinição de senha param.
- Trocar o par exige atualizar os secrets e reiniciar os Deployments de todos os serviços ao mesmo tempo, e invalida todos os tokens emitidos com o par anterior.

## Referências

- [Segurança](../security.md)
- [Arquitetura › Emissão e validação dos tokens](../architecture.md#emissão-e-validação-dos-tokens)
- [RFC 7519 — JSON Web Token](https://www.rfc-editor.org/rfc/rfc7519)
