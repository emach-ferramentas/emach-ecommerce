# PDP redesign — editorial claro + placa técnica

**Data:** 2026-07-03 · **Status:** aprovado em brainstorming (visual companion, 6 telas de mockup)
**Rota:** `apps/web/src/app/(shop)/product/[slug]`

## 1. Problema

A PDP é a única superfície grande fora do sistema visual da marca: abre num campo claro uniforme sem nenhum momento de contraste, o produto fica num tile pequeno com ar morto ao redor, o buy box é uma pilha de widgets com peso igual, e produto raso (poucas specs, 0 avaliações) deixa a página oca — a ficha rendia 2 cards pretos soltos e a seção de avaliações sumia (`return null`). Sem breadcrumb. Diagnóstico completo validado com o dono ("estranho", "sem graça").

## 2. Decisões tomadas (trilha do brainstorming)

| Decisão | Escolha do dono | Alternativas descartadas |
|---|---|---|
| Escopo | Redesign completo (topo + camada de conteúdo) | só topo; polish sem inverter |
| Direção do topo | **C — editorial claro refinado** | palco escuro dividido; hero full-bleed escuro |
| Bloco de compra | **Card branco flutuante** | flat hairlines; card escuro estilo resumo do cart |
| Ficha | **Placa técnica** (grade de células hairline claras) | hero-cards pretos (odiados); tabela tipográfica; split com coluna editorial |
| Arranjo da ficha | Descrição acima · placa à esquerda · mídia à direita | mídia à esquerda |
| Ficha sem mídia | **Placa uniforme** (sem célula-âncora) | assinatura 2×2 (ar morto); assinatura achatada 2×1 |
| Conteúdo da ficha | **Só spec real** — sem linhas de garantia/SKU/nota fiscal, sem título editorial sintético | preenchimento institucional |

## 3. Layout da página (desktop)

Ordem das seções (**muda a atual**: relacionados saem de antes das avaliações para o fim):

1. Breadcrumb
2. Topo: galeria + buy box
3. Ficha técnica (placa)
4. Avaliações (nunca some)
5. Relacionados (rampa de saída)

Todas as seções abaixo do topo mantêm o alinhamento existente `mx-auto w-[calc(50%_+_480px)] max-w-[calc(100%_-_2.5rem)]` (coluna da galeria + buy box).

### 3.1 Breadcrumb (novo)

- `Início / Catálogo / {categoria raiz} / {produto}` — último item `near-black` semibold, demais `gray-60`, separador `/`.
- Tipografia: 12px Barlow. Sem chevrons decorativos.
- Mobile: colapsa para `‹ {categoria}` (link para a categoria raiz).
- Componente novo `breadcrumb.tsx` em `_components/` (ou compartilhado se o catálogo quiser depois). Emitir JSON-LD `BreadcrumbList` junto do `ProductJsonLd`.

### 3.2 Galeria

- Painel único `bg-image-bg` (#ECECEC) ocupando a largura toda da metade esquerda (a coluna vertical de thumbs morre; a imagem ganha a largura que ela ocupava). Proporção `aspect-square` mantida.
- **Thumbs viram overlay** no canto inferior esquerdo do painel: chips 40–48px com fundo branco, borda 2px (ativa = `border-emach-red`), inclusive o slot de vídeo (badge ▶). Reusa `gallery-slots.ts` (`buildSlots`/`slotKey`) sem mudança de lógica.
- Zoom (`InnerImageZoom`) e otimização de imagem (`optimizedSrcSet`, `GALLERY_SIZES`) mantidos; recalibrar `sizes` se a largura efetiva mudar.
- Botão/lupa de zoom permanece no canto inferior direito.
- Mobile: painel full-width, thumbs overlay iguais (28–34px).

### 3.3 Buy box

Coluna direita `lg:w-[480px]` (inalterada). De cima pra baixo:

1. Kicker categoria (`SectionLabel tone="accent"`) + título 36px Barlow Condensed + linha `SKU {sku} · ★ rating (n)` (rating só quando `count > 0`).
2. **Card branco de compra** — `bg-white border border-border` (exceção documentada do Surface Standard, ver §6):
   - Linha de preço: badge `−{pct}%` vermelho + preço 40px Barlow Condensed bold tabular + riscado.
   - "Você economiza {valor}" (`success-text`) quando houver desconto.
   - "Em até 12× de {parcela} sem juros".
   - Voltagem (fieldset atual de chips; estados ativo/esgotado inalterados).
   - Linha `QuantityPicker` + `EmachButton variant="dark"` "Adicionar ao carrinho".
   - `EmachButton variant="primary"` "Comprar agora" full-width (único vermelho da tela, regra mantida).
3. **Fora do card**: `FreightCalculator` (input CEP + Calcular), trust strip (3 células hairline: Frete Brasil / Garantia 2 anos / Compra segura — a garantia vive aqui, não na ficha), link Compartilhar.
4. `StickyBuyBar` mantida sem mudanças (aparece ao rolar além dos CTAs; borda vermelha superior).

### 3.4 Ficha técnica (placa) — a seção nova

Header da seção: kicker `SectionLabel tone="accent"` "Ficha técnica" à esquerda + categoria (`font-display` uppercase `gray-60`) à direita. Abaixo, a **descrição** do produto (15px, `max-w-[70ch]`, `near-black/80`) quando existir. Depois, a **placa**: grade de células com bordas hairline compartilhadas (`border-border`), moldura externa 1px, radius 2px, fundo `gray-10` (mesma superfície da página — separação só por borda).

**Célula de spec:**
- Label: Barlow Condensed 600, 10–11px, uppercase, tracking .12em, `gray-60`.
- Valor numérico (`number`/`numeric_range`): Barlow Condensed bold 38px tabular + unidade 15–16px `gray-60` (regex `HERO_VALUE` existente separa número/unidade).
- Valor textual (`text`/`select`/`boolean`/`color`): Barlow semibold 17px (bool → "Sim"/"Não"; formatações atuais de `fmtAttr` mantidas).
- Ordenação: `sortOrder` da attribute definition (dashboard-owned), como hoje.

**Mídia da placa** (célula 2×2 no canto direito, colunas 3–4, linhas 1–2): prioridade `tool.videoUrl` (poster + badge "▶ VER EM AÇÃO"; clique abre `<Dialog>` com o `<video controls>`, mesmo padrão do zoom da galeria) → senão **segunda imagem** (`images[1]`) → senão **sem célula de mídia**.

**Algoritmo de spans** (desktop, 4 colunas base; N = nº de specs):

- **Com mídia:** mídia ocupa 2×2 à direita. Specs preenchem colunas 1–2 nas linhas 1–2 (até 4 células), depois linhas inteiras de 4. N<4: células crescem pra fechar as duas linhas da âncora (N=1 → célula 2×2; N=2 → duas células 2 colunas × 1 linha empilhadas; N=3 → uma célula larga na linha 1 + duas na linha 2). Sobras abaixo seguem a regra geral.
- **Sem mídia (placa uniforme):** linhas de 4 células iguais. Sobras da última linha esticam pra fechar a régua: sobra 1 → célula horizontal full-width (label à esquerda, valor à direita, baseline); sobra 2 → metades; sobra 3 → terços. N≤4 → uma linha única (N=1 → horizontal full-width; N=2 → metades; N=3 → terços; N=4 → 4).
- **Mobile (2 colunas base):** mídia (quando houver) full-width no topo; specs 2 por linha; sobra 1 → horizontal full-width.
- **N=0:** renderiza só descrição + mídia (mídia como bloco solto 16:9); sem descrição e sem mídia, a seção não renderiza.

**Implementação:** função pura `buildPlateLayout(specs, media, cols)` → lista de células com `{colSpan, rowSpan, kind}`, com **unit test** cobrindo N=0..12 × com/sem mídia (mesmo espírito de `gallery-slots.test.ts`). O grid usa `grid-column: span X` calculado no server (Server Component — N é conhecido no render).

**Morre nesta seção:** hero-cards `bg-near-black`, painel preto "Especificações completas", linhas institucionais (marca/garantia/SKU/nota fiscal — não aparecem na ficha; garantia/NF já vivem na trust strip do buy box, SKU já vive sob o título).

### 3.5 Avaliações

- **Com reviews:** bloco preto único atual (resumo + lista + paginação) mantido como está.
- **Sem reviews (novo):** em vez de `return null`, uma **faixa escura fina** (`bg-near-black`, padding ~16px): kicker "Avaliações" + texto "Este produto ainda não recebeu avaliações. Avaliações vêm de compradores verificados, com nota fiscal." à esquerda; 5 estrelas outline (`white/35`) à direita. Sem CTA (avaliação exige compra).
- `ProductReviewsSection` continua sob Suspense; o skeleton atual serve.

### 3.6 Relacionados

- Ganham o padrão de header das outras seções: kicker vermelho "Continue explorando" + título "Você também pode gostar" (28px) + link "Ver categoria" à direita (categoria raiz do produto; sem categoria → link para `/catalog`). Usar `SectionHeader` (já tem kicker + título + slot de link "Ver todas", conforme DESIGN.md §10).
- Grid de 5 `ProductCard` (dark) inalterado. **Movem para o fim da página** (depois das avaliações).

## 4. Mobile (stack)

Breadcrumb colapsado → galeria full-width → kicker/título/SKU → card branco de compra → frete → trust strip (empilhada) → ficha (placa 2 colunas) → avaliações → relacionados. `StickyBuyBar` inalterada. Nenhum `scale` novo; sem regressão nos gotchas de hero mobile (não se aplica aqui).

## 5. Arquivos afetados (previsão)

| Arquivo | Mudança |
|---|---|
| `page.tsx` | ordem das seções; breadcrumb; passar `images`/`video` pra ficha |
| `_components/breadcrumb.tsx` | **novo** |
| `_components/product-gallery.tsx` | thumbs overlay (remove coluna/carrossel vertical), painel full-width |
| `_components/product-info.tsx` | card branco de compra; reagrupar frete/trust/share fora do card |
| `_components/product-specs.tsx` | **reescrita**: placa + `buildPlateLayout` |
| `_components/plate-layout.ts` (+ `.test.ts`) | **novo**: algoritmo puro de spans + unit tests |
| `_components/product-reviews-section.tsx` | empty state (faixa escura) em vez de `null` |
| `_components/related-products.tsx` | header com kicker + link; sem mudança no grid |
| `DESIGN.md` | §2 exceção do card branco; §10 substituir descrição da ficha antiga pela placa; ordem de seções |

## 6. Impactos no sistema de design (DESIGN.md)

1. **Exceção nova ao Surface Standard (§2):** o card de compra da PDP usa `#fff` + `border-border` — entra no rol de "realces que flutuam" (com search overlay, popovers, toast). Registrar explicitamente pra não virar precedente de card branco genérico.
2. **§10 — Página de produto:** a descrição atual ("3 hero-cards escuros + painel preto") sai; entra a placa técnica (grade hairline clara, algoritmo de spans, mídia 2×2). O padrão "dados de produto = seção contida alinhada à coluna do topo" permanece.
3. Nenhum token novo. Vermelho continua 1×/tela ("Comprar agora"); kickers vermelhos são label, não CTA (regra existente).

## 7. Dados e follow-ups (fora do escopo da UI, criar issues)

1. **Seed de specs raso:** distribuição atual no banco: 3 produtos com 1 spec, 6 com 2, 1 com 3, 1 com 4. Alvo do dono: **≥4 specs por produto**. Enriquecer valores (`tool_attribute_value` é escrita compartilhada; definitions por categoria já existem via `db:seed-attributes`). A placa cobre N pequeno de qualquer forma.
2. **Imagem errada:** o compressor `compressor-de-ar-100l-2hp` exibe fotos de misturador de argamassa (seed). Corrigir via dashboard.
3. **Vídeos:** `tool.videoUrl` já existe; poucos produtos têm. A placa e a galeria degradam sem ele.

## 8. Testes e verificação

- Unit: `plate-layout.test.ts` (N=0..12 × com/sem mídia × mobile/desktop) — teste da função pura, entra no `test:ci`.
- Existentes: `gallery-slots.test.ts` continua valendo (lógica de slots intacta).
- Smoke visual: `bun dev:web` + PDP do compressor (N=2 sem mídia — pior caso real) e da serra (N=3) em desktop e mobile; conferir breadcrumb, card branco, faixa de avaliações vazia, ordem das seções.
- `bun check-types` + `bun check` (lint) antes de commit.

## 9. Fora de escopo (explícito)

- Título editorial sintético por produto (rejeitado — conteúdo inventado).
- Linhas institucionais na ficha (garantia/SKU/NF — rejeitadas).
- Variantes além de voltagem, mudanças em `catalog.ts`/queries dashboard-owned.
- Pagamento, avaliação sem compra, comparador de produtos.
