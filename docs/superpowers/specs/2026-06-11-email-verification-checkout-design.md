# Verificação de e-mail no checkout (#93)

> **Status em 2026-09-28:** implementado (PR #110). `apps/web/src/app/checkout/_actions/create-order.ts` recusa cliente com `emailVerified` falso, e `checkout-content.tsx` mostra o banner com o botão "Reenviar e-mail". O `callbackURL` do reenvio é `/checkout`, não `/verificar-email`.

> Status: aprovado (brainstorming). Decisão de produto: **B puro** — gate só no checkout.
> Data: 2026-06-11.

## Problema

`packages/auth/src/ecommerce.ts` roda com `requireEmailVerification: false` +
`autoSignIn: true`. Um cliente pode se cadastrar com e-mail alheio/com typo e
finalizar pedidos sem nunca provar posse do e-mail. Consequências: confirmação de
pedido para terceiros, pedido associado a e-mail errado, vetor de spam de pedidos.

## Decisão de produto

**B puro** (bloquear apenas o checkout), **não** A+B. Racional de e-commerce:

- Bloquear login inteiro (opção A) é fricção de SaaS/banking, não de loja —
  prejudica conversão sem ganho de segurança. Todo o dano descrito no issue
  ocorre no `placeOrder`, não em "navegar logado".
- Google OAuth já entrega `emailVerified: true` automático — gate A nem afetaria
  boa parte dos cadastros.
- Loja de ferramentas profissionais (ticket alto, CPF/CNPJ): tolera *uma*
  fricção pontual no checkout muito melhor que fricção no acesso diário.
- Pagamento ainda é stub (pedido nasce `pending_payment`) → existe janela natural
  para verificar sem custo de conversão.
- População legada = **1 conta de teste** não-verificada, 0 pedidos, sem Google
  (medido no banco em 2026-06-11). Não há contas reais presas a migrar.

Trade-off aceito: sessão legada não-verificada continua podendo logar e navegar —
só não finaliza pedido. Na prática, 1 conta de teste.

## Arquitetura

Gate único no fluxo de criação de pedido + feedback na UI do checkout. **Sem
mudança no pacote `@emach/auth`** por este spec: login e navegação seguem livres; `sendOnSignUp`
foi ligado pelo redesign da conta (spec 2026-06-09) e envia o e-mail no cadastro; o reenvio usa `authClient.sendVerificationEmail`,
que já funciona com o `emailVerification.sendVerificationEmail` configurado.

### 1. Gate server-side (autoritativo)

`apps/web/src/app/checkout/_actions/create-order.ts`:

- Após `requireCurrentClient()`, antes do rate limit e do `placeOrder`:
  se `!session.user.emailVerified` → retornar
  `{ ok: false, error: "Confirme seu e-mail antes de finalizar o pedido." }`.
- Vai **na própria action** (não em layout) porque server actions não herdam
  layout — invariante do CLAUDE.md ("`requireCurrentClient()` no topo de cada
  action"). Este é o gate que de fato protege; a UI abaixo é só UX.

Opcional (DRY): extrair `requireVerifiedClient()` em `lib/session.ts` que estende
`requireCurrentClient()`. Decisão de implementação — não obrigatório se houver só
um call site.

### 2. Feedback na UI do checkout (não-autoritativo)

`apps/web/src/app/checkout/page.tsx` já tem `session.user.emailVerified`:
passar `emailVerified` (e o `clientEmail` já passado) para `CheckoutContent`.

`apps/web/src/app/checkout/_components/checkout-content.tsx` (client):

- Quando `!emailVerified`: renderizar banner "Confirme seu e-mail para finalizar
  o pedido. Enviamos um link para `<email>`." + CTA **"Reenviar e-mail"**.
- O CTA chama `authClient.sendVerificationEmail({ email, callbackURL: "/verificar-email" })`,
  com toast de sucesso/erro (sonner, já em uso no projeto). _Nota 2026-09-28: o código usa `callbackURL: "/checkout"` para o cliente voltar ao checkout depois de confirmar; a rota `/verificar-email` continua sendo a que recebe o token._
- Desabilitar o botão "Finalizar pedido" enquanto não-verificado (defesa de UX;
  o gate real é o server-side).

### 3. Infra reaproveitada (intacta)

- `/verificar-email` (`page.tsx` + `verify-email-content.tsx`): recebe `?token=`,
  chama `authClient.verifyEmail`, com `autoSignInAfterVerification: true` o cliente
  fica logado e é redirecionado para `/dashboard`. **Não muda.**
- Template `packages/email/src/templates/verify-email.tsx` + `sendOnSignUp: true`.
  **Não muda.** (Confirmar no smoke que o `url` do template aponta para
  `/verificar-email?token=`.)

## Contas existentes

1 conta não-verificada (teste), 0 pedidos. Sem grace period, sem migração: ela
verifica naturalmente quando for finalizar um pedido (ou nunca, sendo teste).
Nenhuma ação de dados necessária.

## Testes

- **Unit/integração** `create-order`: pedido de cliente com `emailVerified: false`
  é rejeitado com a mensagem dedicada, antes de qualquer escrita. Pedido de
  cliente verificado segue o fluxo normal. (Análogo aos testes de guarda
  existentes em `lib/session.test.ts` / `place-order.test.ts`.)
- **Smoke real** (`bun dev:web`, Resend dev):
  1. cadastro por e-mail → cliente entra (auto-login) e navega;
  2. tentar finalizar pedido → banner + botão bloqueado + gate server-side nega;
  3. CTA "reenviar" dispara e-mail;
  4. clicar no link → `/verificar-email` confirma e loga;
  5. voltar ao checkout → banner some, pedido finaliza.

## Fora de escopo (YAGNI)

- Opção A (bloquear login) e tratamento de 403 na tela de login.
- Estado "verifique seu e-mail" no cadastro (auto-login mantém o cliente dentro).
- Rate limit dedicado no reenvio (Better Auth já tem rate limit global).
- Página standalone de reenvio (CTA inline no checkout basta).

## Acceptance criteria (issue #93)

- [x] Decisão registrada: **B** (este doc).
- [x] Cliente não-verificado não finaliza pedido, com mensagem clara (gate
      server-side em `create-order.ts` + banner + botão desabilitado).
      Verificado: teste `create-order.test.ts` + smoke visual.
- [x] CTA de reenvio funcional (smoke: toast de sucesso ao reenviar).
- [x] Plano para contas existentes documentado (nenhuma ação — 1 conta teste).
