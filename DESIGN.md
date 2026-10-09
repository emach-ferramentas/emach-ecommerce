# Design da loja: H3 "Prateleira por ofício"

Este arquivo descreve o sistema visual que roda em produção. O código vence quando os dois divergem. Os tokens vivem em `packages/ui/src/styles/globals.css` e a largura das telas em `apps/web/src/index.css`. Os primitivos ficam em `apps/web/src/components/`.

## 1. Regras que não se discutem

- **Vermelho é verbo.** `--emach-red` aparece uma vez por tela, no CTA de compra (variante `cta` do `EmachButton`). Estrutura, seleção e estado ativo usam grafite e `ink`, nunca vermelho. Exceções de sistema: a régua de navegação pendente (`NavigationProgress`), o badge do carrinho com itens e o `caret-color` do `body`. Nenhuma delas conta como o vermelho da tela.
- **Card se separa do fundo por borda, não por sombra.** Borda `border-line` de 1 px; no hover, `border-line-strong`. Sombra (`shadow-pop`, `shadow-bar`) só em camada que flutua sobre a página.
- **Sem eyebrow.** Título não leva rótulo pequeno em caixa alta acima dele. O scanner reprova `SectionLabel` e `tracking-[0.`.
- **Sem borda lateral colorida.** Nada de faixa vermelha à esquerda de item ativo, card ou aviso. O scanner reprova `border-<lado>-emach-red`, `border-emach-red` e `bg-emach-red/`.
- **Sem régua preta.** Bloco não se separa por linha escura. Título de seção, grupo de filtro, lista do carrinho e ficha técnica se separam por espaço; a contagem ao lado do título vira etiqueta (`CountChip`), e a ficha técnica alterna linhas com fundo `bg-canteiro`. No menu de departamentos, o hover pinta o item com fundo `bg-canteiro`, e o departamento da página aberta (`aria-current="page"`) fica com o mesmo fundo e em negrito, sem sublinhado. A linha cinza de 1 px (`border-line`) fica só entre itens de lista e na borda de card. O scanner reprova `border-ink` junto de `border-<lado>-2`.
- **Sem breadcrumb.** Nenhuma página mostra trilha de navegação; o título abre a página. O caminho para o Google segue no JSON-LD `BreadcrumbList` da página de produto. O scanner reprova `Breadcrumb`.
- **Cantos de 3 px em controle, 5 px em card.** Botão, campo, stepper e seta usam `rounded-[3px]`; card, painel e aviso usam `rounded-[5px]`. Círculo (`rounded-full`) só em ponto de status e avatar.
- **Preço sempre no formato R$ 899,00** (`fmtBRL` de `lib/format.ts`), com `tabular-nums` em coluna de valores.
- **A loja não fala de troca, devolução nem garantia** em texto de vitrine. `apps/web/src/lib/seo/institutional-content.test.ts` trava isso nas páginas institucionais, na caixa de compra e na barra fixa da página de produto.

## 2. Cores

Tokens do bloco H3 em `:root`. Cada um tem utilitário Tailwind (`bg-paper`, `text-ink`, `border-line` etc.) pelo `@theme inline`.

| Token | Valor | Uso |
| --- | --- | --- |
| `--paper` | `#ffffff` | Fundo da página, card, painel, gaveta do carrinho. É o `--background` do sistema. |
| `--canteiro` | `#f0f0ee` | Faixa alternada da home, rodapé da gaveta, hover de controle, campo somente leitura. |
| `--canteiro-2` | `#e4e5e2` | Linha de skeleton. |
| `--well` | `#f0f0ee` | Poço da foto de produto (card, "Ver rápido", galeria, placeholder do `ProductImage`). |
| `--ink` | `#16191d` | Texto principal, foco, borda do controle selecionado. |
| `--ink-2` | `#363b42` | Texto secundário, lede, link. |
| `--ink-muted` | `#5a6068` | Dica, metadado, placeholder. |
| `--line` | `#d8dad7` | Borda de card e divisória. É o `--border` do sistema. |
| `--line-strong` | `#aeb2b6` | Borda de controle (campo, botão `line`, stepper). |
| `--grafite` | `#1f2328` | Botão `dark`, barra utilitária do cabeçalho, toast, seleção de texto. |
| `--grafite-2` | `#2d3238` | Badge do carrinho vazio. |
| `--grafite-deep` | `#131518` | Rodapé do site. |
| `--on-dark` | `#f2f2f0` | Texto sobre grafite. |
| `--on-dark-muted` | `#b6bbc1` | Texto secundário sobre grafite. |
| `--line-dark` | `#3b4148` | Divisória sobre grafite. |
| `--ok` | `#17733a` | "Em estoque", desconto no resumo, passo concluído. |
| `--off` | `#6a717b` | "Esgotado" e estado indisponível. |
| `--error-text` | `#b3261e` | Erro de campo, botão `danger`, aviso de erro. |
| `--emach-red` | `#da291c` | CTA de compra. Hover em `--emach-red-hover` (`#b01e0a`). |

Seção escura (cabeçalho utilitário, rodapé) declara `[color-scheme:dark]` localmente. O `html` declara `color-scheme: light` para o modo escuro automático do Chromium não inverter a loja.

## 3. Tipografia

- Uma família: **Archivo** variável, carregada em `apps/web/src/app/layout.tsx` com o eixo `wdth`.
- `font-sans` é o corpo. `font-display` é a mesma Archivo com `font-variation-settings: "wdth" 62`, para títulos condensados em caixa alta.
- Título de página: `PAGE_TITLE_CLASS` (`page-head.tsx`): `font-display`, `font-extrabold`, `uppercase`, tamanho `clamp(2.4rem,1.6rem+2.2vw,3.6rem)` e entrelinha 0.92.
- Título de seção institucional: `INSTITUTIONAL_H2_CLASS`, `font-display` de 28 px.
- Título de painel: `font-extrabold text-[17px]` em `font-sans`, sem caixa alta.
- Corpo entre 14 e 16,5 px. Campo de formulário usa 16 px, porque abaixo disso o Safari do iOS dá zoom no foco.
- Caixa alta com tracking largo está fora do sistema: o scanner reprova `tracking-[0.`.

## 4. Cantos, elevação e movimento

- `--radius: 3px`. Os raios `--radius-sm` a `--radius-4xl` do `@theme inline`, usados pelos componentes shadcn, calculam a partir dele.
- `--elev-pop` (`shadow-pop`): popover da busca, seletor de ofício e toast.
- `--elev-bar` (`shadow-bar`): barra fixa de compra da página de produto (`sticky-buy-bar.tsx`).
- `--ease-expo` (`ease-out-expo`): entrada de gaveta e zoom da foto do card.
- Toda animação tem saída em `prefers-reduced-motion`. O bloco final de `globals.css` desliga `animate-pulse`, `animate-spin`, `.emach-shimmer`, o pulo do badge e a saída do item do carrinho.

## 5. Layout

- `shop-wrap` (`apps/web/src/index.css`): largura máxima 1296 px e respiro lateral de 16, 24 e 32 px (base, `md`, `lg`). Toda tela do H3 abre o conteúdo com ele.
- Breakpoints são os do Tailwind: `md` 768 px, `lg` 1024 px.
- Alvo de toque mínimo de 44 px (`min-h-11`, `size-11`).
- `StoreFrame` (`components/store-frame.tsx`) monta cabeçalho, o único `<main id="main-content">` e rodapé. Usam a moldura: `app/(shop)/layout.tsx`, o grupo `app/(auth)`, o layout da conta (`app/dashboard/layout.tsx`) e o `app/not-found.tsx`. Página e `loading.tsx` dentro dela não montam `SiteHeader` nem abrem outro `<main>`; `app/(shop)/layout.frame.test.ts` trava isso.

## 6. Primitivos

Antes de escrever marcação crua, procure aqui.

| Primitivo | Arquivo | Para que serve |
| --- | --- | --- |
| `EmachButton`, `EmachLinkButton`, `emachButtonVariants` | `emach-button.tsx` | Botão e link com cara de botão. `variant` é obrigatório e não tem default, para o vermelho nunca sair por omissão: `cta`, `dark`, `line`, `danger`, `link`. Tamanhos `md` (44 px) e `lg` (52 px); `full` ocupa a largura. `isLoading` troca o ícone por spinner, marca `aria-busy` e mantém o foco. CTA que navega usa `EmachLinkButton`, nunca `<Link>` em volta de `<EmachButton>`. |
| `PageHead` | `page-head.tsx` | Título com `PAGE_TITLE_CLASS`, lede (`children`) e slot à direita (`aside`). |
| `Panel`, `SummaryRow` | `panel.tsx` | Bloco com título, borda `line` e canto de 5 px, em tom `paper` ou `canteiro`. `SummaryRow` é a linha de valor do resumo, com `total` e tons `muted` e `discount`. |
| `Field`, `TextField` | `field.tsx` | Rótulo, dica e erro ligados ao controle por `aria-describedby` e `aria-invalid`. `TextField` encaixa um campo do TanStack Form e troca para `PasswordInput` quando `type="password"`. |
| `Notice` | `notice.tsx` | Aviso em linha, tons `info` (canteiro) e `error` (borda e texto `error-text`, `role="alert"`), com slot de ação. |
| `StatusChip` | `status-chip.tsx` | Rótulo de status com ícone, tons `ok`, `off`, `alert` e `neutral`. A cor nunca vem sozinha. |
| `StockLine` | `stock-line.tsx` | "Em estoque" ou "Esgotado" com o ponto de status. |
| `StatusScreen` | `status-screen.tsx` | Tela de erro ou de vazio: título, lede, ações e nota. Usada por `error.tsx`, `not-found.tsx` e afins. |
| `InstitutionalPage` | `institutional-page.tsx` | Página de texto com sumário lateral e data de atualização. |
| `ProductCard`, `ProductCardSkeleton` | `product-card.tsx`, `product-card-skeleton.tsx` | Card de produto (seção 7). O skeleton espelha a anatomia do card. |
| `Shelf` | `shelf.tsx` | Prateleira horizontal com setas no desktop e arraste no celular. A capa que abre a lista completa gruda na borda direita do trilho. |
| `CountChip` | `count-chip.tsx` | Contagem ao lado do título de seção ("4 produtos, 3 em estoque"), como etiqueta com borda `border-line`. |
| `QtyStepper` | `buy/qty-stepper.tsx` | Quantidade com `min` 1 por padrão e tamanhos `lg` e `md`. |
| `VoltagePicker` | `buy/voltage-picker.tsx` | Voltagem como rádios nativos em botões grandes. A opção esgotada fica visível, tracejada e desabilitada. |
| `ProductImage` | `product-image.tsx` | Foto com fade no carregamento e ícone por categoria em `bg-well` quando não há foto. |
| `ProductRating` | `product-rating.tsx` | Média em estrelas grafite. |

Formulário cru usa as classes de `globals.css`: `.emach-input`, `.emach-select` e `.emach-textarea` (altura 48 px, borda `line-strong` de 1,5 px, foco em `ink` com anel de 3 px, `aria-invalid` em `error-text`). Toast usa `.emach-toast` sobre grafite.

## 7. Padrões de tela

- **Card de produto.** Fundo `paper`, foto quadrada em `bg-well`, "Ver rápido" sempre visível, `StockLine`, nome, chips curtos, preço com parcelas (`installmentText` de `lib/installments.ts`: parcela mínima de R$ 10, até 12x) e um botão que muda conforme o produto (`cardAction` de `lib/card-action.ts`: adicionar, escolher voltagem no "Ver rápido", avisar quando chegar). Os chips e as voltagens vêm de `getCardExtras` (`lib/card-data.ts`).
- **Carrinho.** A gaveta (`cart-sheet.tsx`) é `bg-paper` com rodapé `bg-canteiro`. A página `/cart` fecha o resumo num `Panel` com `SummaryRow`. Divisória de item é `border-line`. A gaveta é um overlay próprio (`useOverlay` de `lib/use-overlay.ts`: trava de rolagem, Esc, foco preso e devolvido), assim como `mobile-menu.tsx`, `quick-view.tsx` e o `filter-drawer.tsx` do catálogo.
- **Cabeçalho e rodapé.** A barra utilitária do cabeçalho é `bg-grafite` e o rodapé é `bg-grafite-deep`, os dois com texto `on-dark`.
- **Loading.** O skeleton espelha a anatomia da tela real e é o mesmo componente no `loading.tsx` e no fallback do `page.tsx`. Referências: `ProductCardSkeleton` e `catalog/_components/catalog-skeleton.tsx`. Linha de texto pulsa (`animate-pulse` em `bg-canteiro-2`) e tile de imagem varre (`.emach-shimmer`). A chegada de rota entra sem animação de opacidade na página inteira, porque o fade roda em toda navegação e pisca a tela.
- **Navegação pendente.** `NavigationProgress` desenha uma régua de 2 px em `--emach-red` no topo depois de 150 ms de navegação pendente. A máquina de estados está em `lib/nav-progress.ts`.

## 8. Token antigo e exceções

O `globals.css` ainda define os tokens anteriores ao H3 (`--near-black`, `--gray-10` a `--gray-90`, `--cinema-*`, `--image-bg`, `--emach-red-on-dark`, `--success-on-dark`, `--amber-on-dark`, `--info-on-dark`). Em `apps/web/src`, só o hero congelado ainda os usa; dentro do próprio `globals.css`, o `.emach-shimmer` varre sobre `--image-bg`. Tela nova não usa nenhum deles.

`apps/web/src/test/h3-legacy.global.test.ts` varre todo o `apps/web/src` com `scanForLegacyTokens` (padrões em `h3-legacy-scan.ts`) e compara com `LEGACY_EXCEPTIONS`. Hoje a lista tem três arquivos, todos do hero: `components/hero-carousel.tsx`, `components/hero/hero-cta-variants.ts` e `components/hero/hero-element-renders.tsx`. A lista só encolhe: arquivo novo com token antigo falha, e exceção que ficou limpa também falha até a linha sair.

O hero não muda até o dono pedir. Ele usa a cópia congelada do botão antigo em `components/hero/hero-cta-variants.ts` (`heroCtaVariants`), que só `components/hero/*` importa.

## 9. Hero carousel (mobile ≠ desktop)

`components/hero-carousel.tsx` é o carrossel; `components/hero/` tem o slide, os elementos e a pilha segura do mobile. Duas regras de responsividade:

- **A escala por elemento vem de `banner.composition` (#210) e vale nos dois viewports.** Elemento posicionado (desktop sempre; mobile só com override) aplica a própria `scale` pelo transform do placement. Item herdado na pilha segura do mobile (`hero-safe-stack.tsx`) não aplica escala. Composição `NULL` ou inválida vira o mapa legado na hora (`lib/composition/legacy-composition.ts`).
- **No mobile o fundo do desktop cai.** A arte de banner é widescreen com título e specs queimados na imagem e corta no retrato. Banner mobile usa `backgroundMobileMode` igual a `none` ou `custom`, nunca `inherit` (valores do enum `bannerBackgroundMobileMode`). O glow só pulsa no desktop, porque o blur por frame trava o celular. Banner mobile sem produto fica vazio.

## 10. Armadilhas de overlay

- O Base UI seta `scrollbar-gutter: stable` inline no `<html>` durante a trava de rolagem de `Dialog` e `Sheet`. O gutter deixa uma faixa clara à direita dos elementos `position: fixed`. O `globals.css` anula o gutter com `html:has(body[style*="overflow: hidden"])` e `html:has(body[style*="overflow-y: hidden"])`, cobrindo os dois caminhos da lib.
- Popup ancorado (`DropdownMenu`, `Select`, `Popover`) cai em outro caminho da trava, que subtrai a barra de rolagem duas vezes da largura do `<body>`. O `globals.css` corrige com `width: 100% !important` no seletor `html[data-base-ui-scroll-locked] body`.
