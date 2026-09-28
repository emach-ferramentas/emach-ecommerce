# Redesign da conta do cliente (dashboard) — design

> **Status em 2026-09-28:** implementado. `apps/web/src/app/dashboard/page.tsx` é a Overview real; `AccountHero`, `AccountBadge`, `StatusStepper` e `QuickActionCard` vivem em `apps/web/src/app/dashboard/_components/`. `packages/auth/src/ecommerce.ts` tem `sendOnSignUp: true` e não força mais `emailVerified: true`. Entrega no PR #74.

> Data: 2026-06-09 · Escopo: `apps/web/src/app/dashboard/**` + nova rota overview.
> Objetivo: trazer a linguagem visual da home (chiaroscuro Ferrari) para as telas da
> conta, que hoje são "claras e planas", sem hierarquia nem assinatura de marca.

## 1. Contexto e problema

As telas da conta do cliente — Pedidos (`/dashboard/pedidos`), Reembolso
(`/dashboard/reembolso`) e Dados Pessoais (`/dashboard/dados-pessoais`) — são
funcionais mas "sem graça" comparadas à home. Diagnóstico ancorado no estado real
(logado, com dados):

1. **Sem o chiaroscuro da home.** A home alterna preto cinematográfico ↔ claro
   editorial (hero, painel de stats em `#000`, `ProductCard` escuro). A conta é
   **sidebar preta + painel 100% claro e plano** — o conteúdo nunca tem um "momento
   preto", então perde a assinatura da marca.
2. **Tudo é card hairline `bg-gray-10`.** Funciona, mas no espaço amplo fica frio e
   sem hierarquia; com poucos pedidos a tela fica majoritariamente vazia.
3. **Headers inconsistentes.** Pedidos/Reembolso usam `SectionLabel + h1 36px`;
   Dados Pessoais usa header com `border-b-2` + descrição. Três telas, dois padrões.
4. **Pedidos sem senso de progresso na lista.** O conceito de fases existe em
   `lib/orders/status.ts` (`STEPPER_PHASES`, `stepStateFor`) mas só é usado no
   detalhe — na lista o cliente vê só um badge.
5. **`/dashboard` só redireciona** para `/dashboard/pedidos` (`dashboard/page.tsx`) —
   não há uma "home da conta".

O que **não** é problema: a estrutura de dados é sólida (status, fases, refunds,
endereços) e os cards de pedido/reembolso são densos e corretos. O trabalho é de
**atmosfera e hierarquia**, não de dados.

## 2. Direção aprovada (brainstorming)

- **Linguagem da home (chiaroscuro)**, não apenas polish — reusando tokens e
  componentes existentes; muda atmosfera e composição, não a base.
- **Chiaroscuro por "Direção B" + hero escuro**: cada tela abre com um **hero escuro**
  (page-turn vertical da home) e usa **cards-chave escuros** para o que "precisa de
  atenção" (pedido a pagar, reembolso em análise). O resto do painel é claro.
- **Escopo completo**: as 3 telas + sidebar/layout compartilhado + nova Overview
  `/dashboard` + cuidado com mobile.

### Princípios de design (valem para todas as telas da conta)

- **Hero escuro no topo de cada tela** (`near-black #181818` + textura diagonal sutil
  + régua vermelha inferior `border-b-[3px] border-emach-red`), espelhando
  `.emach-bg-stats`/`.emach-bg-diagonal` da home. Kicker "Minha conta" em Barlow
  Condensed, título grande em Barlow Condensed 500.
- **Vermelho é verbo** (DESIGN.md): um único CTA vermelho por dobra; vermelho também
  marca a fase atual do stepper e o ponto/borda de pendência real.
- **Escala de fonte um degrau acima da atual** (feedback do usuário): meta/labels
  nunca abaixo de ~12px; nome de item 14–15px; labels de stepper 12px. Decisão de
  legibilidade — supera a tendência a micro-labels de 10–11px.
- **Cor de status por família semântica** (respeita a paleta restrita da marca):
  - 🟠 âmbar (`--amber #D97706`) = precisa de você / em análise
  - 🔵 azul (`--info #4C98B9`) = em processamento (pago / preparação / a caminho)
  - 🟢 verde (`--success #16A34A`) = concluído OK (entregue / reembolsado)
  - 🔴 vermelho (`--emach-red`) = problema (pagamento falhou)
  - ⚪ cinza (`--gray-50` + border) = encerrado neutro (cancelado)
  - A **fase exata** é dada pelo **stepper com ícones**, não por 8 cores distintas.
- **Badges com fill suave + dot**: `border` + `background` da cor a ~10% + texto da
  cor + bolinha `pt`. Em card escuro, o texto sobe de tom (mesma família). Substitui o
  badge outline-only de hoje (`BADGE_TONE_CLASS`).
- **Pendências acionáveis, não placar.** Nada de métricas de vaidade ("3 pedidos no
  total"). Só sinais que o cliente pode resolver agora ("1 a pagar"), que somem quando
  resolvidos.

## 3. Telas

### 3.1 Overview `/dashboard` (nova)

Substitui o `redirect()` atual por uma página real.

- **Hero escuro**: kicker "Minha conta", `Olá, {primeiroNome}`, subtítulo curto.
  **Sem faixa de métricas** (decisão explícita — linguagem de admin não cabe em loja).
- **"Continuar de onde parou"**: se houver pedido em `pending_payment`/`payment_failed`,
  renderiza o **card de pedido escuro** com badge e CTA "Pagar agora". Se não houver
  pendência, mostra o pedido mais recente (card claro) ou um empty-state acolhedor.
- **Atalhos** (`grid` de 3): Pedidos, Devoluções, Meus dados — ícone + nome + descrição
  do que faz. Pendência **real** aparece como selo acionável (ex.: "1 a pagar" no
  atalho Pedidos). CPF **não** gera selo aqui (ver 3.4).

### 3.2 Pedidos `/dashboard/pedidos`

- Hero escuro substitui o header atual (`SectionLabel + h1`).
- `OrdersTabs` mantém a lógica (`<Tabs variant="line">`, contagem por aba).
- **`OrderCard` redesenhado**:
  - Pedido que precisa de ação (`pending_payment`/`payment_failed`) = **card escuro**
    sob um label "Precisa da sua atenção"; demais pedidos = card claro.
  - **Badge colorido** (família semântica) no header do card.
  - **Mini-stepper com ícones na própria lista**: 💳 Pagamento → 📦 Preparação →
    🚚 A caminho → 🏠 Entregue. Fase atual com anel vermelho; concluídas preenchidas;
    entrega final em verde. Pedidos terminais-negativos (cancelado/devolvido/
    reembolsado) **não** exibem stepper (ou exibem estado neutro) — ver §4.
  - Footer de ações inalterado em comportamento (Cancelar / Ver detalhes / Pagar agora
    / Comprar de novo), só re-estilizado.

### 3.3 Reembolso `/dashboard/reembolso`

- Hero escuro + `RefundsTabs` (Em andamento / Finalizado) mantidos.
- **`RefundCard` redesenhado** com **stepper próprio do reembolso**:
  📄 Solicitado → 🔍 Em análise → ✅ Aprovado → 💵 Reembolsado.
  - `rejected` é terminal-negativo: stepper não progride até o fim; mostra o bloco de
    recusa (`OrderRefundBlock` já existe) com a cor muted/recusado.
  - Reembolso em estado ativo (`under_review`/`requested`/`approved`) = card escuro
    sob "Em andamento"; finalizados = claro.
  - Mantém motivo (`reasonText`/`REFUND_REASON_LABEL`) e valor (`amount`) com label
    contextual ("A reembolsar" / "Reembolsado" em verde / "Valor solicitado" riscado).

### 3.4 Dados Pessoais `/dashboard/dados-pessoais`

- **Header de perfil escuro**: avatar com iniciais (fill vermelho), kicker + nome.
  **Sem e-mail e sem badge de verificação no header** (decisão — pertencem ao card de
  e-mail). **Sem faixa de alerta de CPF.**
- **Cards de campo** (grid 2col, escala maior): Nome, E-mail, Telefone, CPF/CNPJ —
  reaproveitam a lógica read/edit inline de `PersonalDataForm`.
  - **Card de E-mail com verificação acionável**:
    - Verificado → badge verde "Verificado", só leitura.
    - Não verificado → badge âmbar "Não verificado" + botão **"Verificar e-mail"** que
      **dispara o envio do link de verificação** (`authClient.sendVerificationEmail`).
      Esta é uma **feature funcional nova** — ver §4.1 (ativação real da verificação).
  - **Card de CPF/CNPJ pendente**: apenas o card em vermelho (borda + label + "+
    Adicionar"), com nota *"Você também informa na finalização da compra, ao emitir a
    nota fiscal"*. Sem drama — porque o **checkout já capta o CPF** (ver §5).
- **Seção de endereços** (`AddressesSection`) mantém comportamento (padrão, outros,
  adicionar, sheet); re-estilizada para a nova escala/hierarquia.

## 4.1 Ativação real da verificação de e-mail (auth P0 — decidido)

_Nota 2026-09-28: o texto abaixo descreve o estado de antes do redesign; hoje `sendOnSignUp` é `true` e o hook `databaseHooks.user.create.before` continua, agora chamando `normalizeUserForWrite`; só saiu o `emailVerified: true` forçado._

Antes do redesign, `packages/auth/src/ecommerce.ts` forçava **todo cliente como verificado** na
criação (`databaseHooks.user.create.before → emailVerified: true`), com
`sendOnSignUp: false` e `requireEmailVerification: false`. Logo, ninguém fica "não
verificado" e o card de e-mail seria inerte.

Decisão (verificação **leve**, sem bloquear venda):
- **Remover** o hook `databaseHooks.user.create.before` que força `emailVerified: true`.
- `emailVerification.sendOnSignUp: true` — novo cadastro recebe o e-mail (template
  `VerifyEmailEmail` já existe e está ligado a `sendVerificationEmail`).
- `requireEmailVerification` permanece **false** — login/`autoSignIn` seguem funcionando;
  e-mail pendente é incentivo, não porteiro.
- **Clientes existentes** já estão `emailVerified: true` no banco → não afetados, sem
  migration, ninguém deslogado.
- No dashboard, o card de e-mail reflete o estado real e o botão "Verificar e-mail"
  dispara `authClient.sendVerificationEmail({ email, callbackURL: "/dashboard/dados-pessoais" })`.

> Mudança de **config** de auth (não de schema) — `ecommerce.ts` é do app, editável aqui;
> isolamento das instâncias preservado. Tratada como fase própria, com smoke de signup.

## 4. Componentes — criar / editar

Sem barrel files (proibido em `apps/web/src`). Co-locar em `_components/`.

**Novos (compartilhados em `dashboard/_components/`):**
- `account-hero.tsx` — hero escuro reutilizável. Props: `kicker`, `title`,
  `subtitle?`, `children?` (avatar/ações). Server Component (sem estado).
- `status-stepper.tsx` — stepper genérico com ícones. Recebe uma lista de fases
  `{ key, label, icon, state: 'done'|'current'|'upcoming'|'ok' }`. Usado por pedido e
  reembolso. Server-render (apresentação pura).
- `account-badge.tsx` — badge com fill suave + dot, variantes por família semântica
  (`amber|blue|green|red|gray`) e suporte a contexto escuro (`tone="onDark"`).

**Novos por tela:**
- `dashboard/page.tsx` — passa de `redirect()` a Overview real (Server Component).
- `dashboard/_components/quick-action-card.tsx` — atalho da overview.
- `dados-pessoais/_components/profile-header.tsx` — perfil escuro.

**Editar:**
- `dashboard/layout.tsx` — ajustar shell/spacing; manter a `DashboardSidebar`. _Nota 2026-09-28: a guarda de sessão e o shell (sidebar e `DashboardNavMobile`) hoje ficam em `dashboard/_components/dashboard-chrome.tsx`, montado sob Suspense pelo `layout.tsx` (#98); a lista de itens de navegação está em `dashboard/_components/nav-items.ts`._ O hero
  é renderizado por cada página (não pelo layout), pois título/conteúdo variam.
- `_components/dashboard-sidebar.tsx` — refino visual; **adicionar item "Início"**
  apontando para `/dashboard` (overview). Tratar mobile (ver §6).
- `pedidos/_components/order-card.tsx`, `order-status-badge.tsx`,
  `orders-empty-state.tsx`.
- `reembolso/_components/refund-card.tsx`, `refund-status-badge.tsx`,
  `refunds-empty-state.tsx`.
- `dados-pessoais/_components/personal-data-form.tsx` (card de e-mail com ação),
  `addresses-section.tsx`.
- `lib/orders/status.ts` — atualizar `BADGE_TONE_CLASS` para a nova paleta (fill+dot);
  adicionar mapa fase→ícone e ajuste de apresentação para `pending_payment` exibir a
  fase "Pagamento" como `current` (hoje `stepStateFor` a trata como upcoming — ajuste
  apenas na camada de apresentação do stepper, **sem** mexer em `statusRank`).
- `lib/refunds/status.ts` — adicionar `REFUND_STEPPER_PHASES` + helper de estado por
  fase (análogo a `stepStateFor`), com `rejected` como terminal-negativo.

**Tokens** (`packages/ui/src/styles/globals.css`): `--amber #D97706` não existe ainda
no set de marca — adicionar como token semântico (registrar em `@theme inline`). Os
demais (`--info`, `--success`, `--emach-red`, `--gray-*`) já existem.

## 5. Fora de escopo / o que NÃO muda

- **Checkout já capta CPF** (`checkout-content.tsx`: `document` é campo obrigatório do
  `checkoutSchema`, pré-preenchido com `clientDocument`, validado por `isValidCpfCnpj`).
  Nada a implementar lá — o CPF da conta é só conveniência.
- **Schema `dashboard-owned`** (`order`, `orderItem`, `refundRequest`, etc.): não
  editar em isolamento (ADR-0009). O redesign é apresentação no storefront + a
  ativação da verificação de e-mail (config de auth ecommerce, não schema — ver §4.1).
- **Tela de detalhe do pedido** (`pedidos/[id]`) e `/pagar`: fora deste ciclo (podem
  herdar o `account-hero`/badge depois).
- Pagamento real, débito de estoque, hardening — itens de roadmap não relacionados.

## 6. Implementação — considerações

- **RSC vs client.** Heros, steppers, badges e cards de leitura são Server Components.
  Interatividade existente continua client (`OrdersTabs`, `RefundsTabs`,
  `PersonalDataForm`, `AddressesSection`, `quick-add`). Não introduzir `async` em
  Client Component (CLAUDE.md).
- **Mobile.** A sidebar é `md:` (some no mobile sem substituto). Adicionar navegação
  mobile (ex.: barra/tabs no topo do conteúdo ou drawer) — garantir que as 4 telas e o
  hero respondam bem. Verificar em viewport estreito.
- **Disciplina de marca.** `border-radius` 0–2px; sem box-shadow; superfície clara =
  só `--gray-10`; `#fff` só em controles que "flutuam" (inputs, badges). Barlow /
  Barlow Condensed conforme §3 do DESIGN.md.
- **Logs/erros.** Server actions (verificação de e-mail) seguem o contrato:
  `"use server"`, guarda de sessão, `ActionResult<T>`, `log.error({ action, ... })` em
  catch — **sem** `console.*`.

## 7. Verificação (antes de "feito")

- `bun check-types` limpo.
- **Smoke visual obrigatório** (CLAUDE.md): `bun dev:web` + visitar
  `/dashboard`, `/dashboard/pedidos`, `/dashboard/reembolso`,
  `/dashboard/dados-pessoais` logado — `check-types` não pega fronteira RSC/client nem
  hierarquia visual.
- Testar estados reais: pedido `pending_payment` (card escuro + stepper), pedido em
  trânsito, pedido entregue; reembolso em análise vs reembolsado vs recusado; e-mail
  não verificado (botão dispara envio) vs verificado; CPF vazio vs preenchido.
- Conferir mobile.

## 8. Riscos

- **`stepStateFor` para `pending_payment`.** Hoje rank 0 → todas as fases "upcoming".
  O stepper precisa mostrar "Pagamento" como `current`. Resolver na camada de
  apresentação (mapa de fases do storefront), sem alterar `statusRank` (que outros
  consumidores usam).
- **Paleta âmbar nova.** Introduzir `--amber` com parcimônia — é cor semântica de
  status, não decoração; não pode competir com o vermelho de CTA.
- **Escopo da Overview.** É feature nova (não existia). Mantida enxuta (hero + 1 card +
  atalhos) para não virar projeto à parte.
