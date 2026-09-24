# Checkout — modernização e alinhamento ao design system

**Data:** 2026-06-08
**Status:** implementado. Evidência: `apps/web/src/app/checkout/layout.tsx` monta `CheckoutHeader` (logo SVG + "Pagamento Seguro"), `DemoBanner` e `CheckoutFooter`.
**Rota afetada:** `/checkout` (`apps/web/src/app/checkout/`)

## Problema

A tela de checkout é legado pré-design-system. Sintomas levantados pelo usuário e
confirmados por código + screenshot:

- **Sem navbar/footer do sistema.** `app/checkout/page.tsx` está **fora** do route
  group `(shop)`, então não herda `(shop)/layout.tsx` (que injeta `SiteFooter`).
- **Header errado:** `CheckoutHeader` usa o texto `EMACH` (não o logo SVG), fundo
  claro — o `SiteHeader` do sistema é `bg-black` com `/emach-logo.svg`.
- **Footer mínimo:** um `<footer>` inline de uma linha vs. o footer do sistema.
- **Não-responsivo:** `flex flex-row`, `grid-cols-2` fixo, `w-[380px]`, `px-20` —
  zero breakpoints; quebra no mobile.
- **Controles shadcn crus:** `Input`/`Select`/`Button` violam o DESIGN.md §10
  ("Do NOT use shadcn Input/Select for EMACH-branded pages").
- **Container fora do padrão:** `max-w-6xl px-20` em vez de `<PageContainer>`.
- **StepIndicator enganoso:** 3 passos (Dados/Entrega/Pagamento) numa página única,
  `currentStep=1` fixo; pagamento é stub (roadmap #4).

## Decisões (confirmadas com o usuário)

| Tema | Decisão |
|---|---|
| Header | **Slim seguro**: logo SVG real (link → `/`) + "Pagamento Seguro", `bg-black`, sem nav/busca/carrinho (checkout sem rotas de fuga). |
| Footer | **Slim cinema**: `bg-cinema-3`, selo de segurança + CNPJ + copyright, tipografia do sistema; sem colunas de links. |
| Step indicator | **Remover** (reintroduzir passos reais quando o pagamento existir — roadmap #4). |
| Demo banner | **Manter, restilizado** (pagamento ainda é stub). |
| Tema do corpo | **Claro** (painel editorial branco) — mantém o ritmo chiaroscuro: header/footer escuros, corpo claro. |

## Arquitetura

Criar **`app/checkout/layout.tsx`** (route-group próprio, fora de `(shop)`) com o chrome
slim. Isso dá chrome ao checkout **sem** herdar o `SiteFooter` completo do `(shop)`.

> Alternativa descartada: mover `checkout/` para dentro de `(shop)` — traria o
> `SiteFooter` cheio (links de fuga), contrariando a decisão de footer slim.

```
app/checkout/
  layout.tsx        (NOVO) min-h-screen flex-col: CheckoutHeader + DemoBanner + {children} + CheckoutFooter
  page.tsx          (EDIT) remove StepIndicator/DemoBanner/footer inline; só renderiza CheckoutContent
  _components/
    checkout-content.tsx  (EDIT) container responsivo + emach controls
```

### Componentes

- **`CheckoutHeader`** (`components/checkout-header.tsx`, EDIT):
  - `bg-black`, altura `h-14` (igual SiteHeader).
  - `<Image src="/emach-logo.svg">` dentro de `<Link href="/">` (mesmo tratamento do
    SiteHeader: `h-[26px] w-[140px]`).
  - À direita: `<Lock>` + "Pagamento Seguro" em `text-white/70`.
  - Remove a prop `children` (não há mais StepIndicator).
  - Responsivo: no mobile (`< sm`) esconde o texto "Pagamento Seguro", mantém o cadeado.

- **`CheckoutFooter`** (`components/checkout-footer.tsx`, NOVO):
  - `bg-cinema-3 text-gray-60`, `role="contentinfo"`.
  - Selo: `<Lock>` + "Compra 100% segura" (Barlow Condensed uppercase, tracking 0.14em).
  - `EMACH Ferramentas Gerais LTDA · CNPJ 04.128.615/0001-59` (reaproveita o texto do
    `SiteFooter`).
  - `© 2026 EMACH. Todos os direitos reservados.` com `©` em `text-emach-red` (igual
    SiteFooter).
  - Centralizado, padding responsivo.

- **`DemoBanner`** (mover de `page.tsx` p/ `layout.tsx` ou manter helper): restiliza
  tracking/cores ao design system; mantém `bg-near-black`, `<AlertTriangle>` amber.

### Layout & responsividade (`checkout-content.tsx`)

- Container: `<PageContainer>` com largura útil constrangida (checkout não precisa de
  1440px) — usar `className` para `max-w-5xl` interno; padding `px-4 sm:px-6 lg:px-10`,
  `py-8 lg:py-12`.
- Grid principal: `grid grid-cols-1 gap-10 lg:grid-cols-[1fr_380px] lg:gap-12`.
  - Mobile: form e resumo empilhados (resumo abaixo do form).
  - Desktop (`lg`): duas colunas; resumo **sticky** (`lg:sticky lg:top-10`).
- Campos pareados: `grid-cols-1 sm:grid-cols-2` (hoje `grid-cols-2` fixo).
- Bloco "novo endereço": grids internos com fallback mobile
  (`grid-cols-1 sm:grid-cols-[140px_1fr]` etc.).

### Form controls (DESIGN.md §10)

| Hoje (shadcn) | Alvo (EMACH) |
|---|---|
| `<Input className="rounded-none">` em `TextField`/campos | `.emach-input` via `<input>` ou wrapper; label via `.emach-field__label` |
| `FieldShell` (Label shadcn) | `.emach-field` + `.emach-field__label` + `.emach-field__error` |
| `<Select>` (endereço) | `.emach-select` (chevron custom) — manter API tanstack-form |
| `<Button>` "Voltar"/"Confirmar" | `EmachButton` (`variant="outline"` + `variant="primary"`) |
| `<Checkbox>` (consentimentos) | **mantido** (já é o componente React padrão) |
| `<Separator>` | **mantido** (shadcn adotado oficialmente) |

- Manter toda a lógica do `tanstack/react-form` (validação Zod, máscaras, quote de
  frete, cupom, `createOrderAction`) **intacta** — mudança é só de apresentação/markup.
- Regra Ferrari Red: **um** CTA `primary` (vermelho) por fold — "Confirmar pedido".
  "Voltar ao Carrinho" fica `outline`.

## Não-objetivos (fora de escopo)

- Não reestruturar em multi-step real (depende do pagamento — roadmap #4).
- Não tocar em lógica de pedido/frete/cupom/validação.
- `/checkout/success` (vive em `(shop)`): chrome diferente. **Follow-up sugerido**
  (não nesta entrega): alinhar ao mesmo chrome slim para o fluxo ficar coerente.

## Verificação

- `bun check-types` limpo.
- Smoke visual na app viva (`:3007`): `/checkout` logado com item no carrinho.
  - Desktop: header preto com logo, grid 2-col, resumo sticky, footer cinema.
  - Mobile (DevTools ~375px): tudo empilhado, sem overflow horizontal, campos 1-col.
- Confirmar que o submit ainda cria pedido (lógica preservada).
