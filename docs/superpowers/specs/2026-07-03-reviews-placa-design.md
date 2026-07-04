# Placa de avaliações — redesign da seção de reviews da PDP

**Data:** 2026-07-03 · **Status:** aprovado (brainstorm visual, 4 telas no companion)
**Contexto:** a seção de reviews ficou de fora do redesign da PDP (#180). O bloco
`bg-near-black` contínuo destoa da rota, que pós-#180 é editorial clara (placa técnica
hairline, card branco de compra, relacionados claros).

## Decisão do dono (revoga registro anterior)

A preferência "avaliações = bloco preto único contínuo" (DESIGN.md §10, spec do #180)
foi **revogada pelo dono em 2026-07-03**: "o preto ali parece errado". A seção passa à
superfície clara com a gramática da placa técnica. O empty state (n=0, faixa escura
fina) **permanece como está** — não era o problema e vira o único eco escuro da seção.

## Direção escolhida

**Placa de avaliações** (opção A do brainstorm): moldura `border border-border` sobre
`--gray-10`, divisórias internas `divide-border` edge-to-edge, células com padding
próprio (`px-4 py-3.5 sm:px-5` como base, células de depoimento mais generosas) — a
mesma língua da ficha técnica. Largura da seção inalterada:
`mx-auto w-[calc(50%_+_480px)] max-w-[calc(100%_-_2.5rem)]`.

Anatomia **adaptativa por N** (mesmo princípio do `buildPlateLayout` com sobras). Modos:

| n | modo | anatomia |
|---|------|----------|
| 0 | `empty` | faixa escura fina atual, intacta |
| 1 | `single` | trilho + 1 célula de depoimento |
| 2–3 | `duo` | trilho + células de depoimento em grid 2-col (3ª estica full-width) |
| ≥4 | `grid` | linha de resumo (trilho + barras) + grid 2-col compacto + paginação |

### Trilho de resumo (coluna esquerda, `md:grid-cols-[240px_1fr]`)

- Nota média `4,0 / 5` em Barlow Condensed medium **42px em todos os modos** (o 56px
  atual era escala do bloco escuro; na placa clara, 42px alinha com a densidade da ficha).
- `StarRating` da média (estrelas vermelhas, como hoje).
- Contagem seca: **"1 avaliação" / "N avaliações"** — sem "verificado" no contador
  (a verificação é afirmada pelo selo, uma vez, na assinatura de cada review).
- Em `grid` (n≥4): contagem + **"X% recomendam"** (4–5 estrelas / total). O
  "% recomendam" **sai do header da seção** (hoje duplica) e só existe aqui.
- Mobile (`<md`): trilho colapsa numa linha horizontal acima do conteúdo
  (nota + estrelas + contagem), border-b.

### Célula de depoimento (`single` e `duo`)

- **`single`:** body em ~19px/1.5 weight 500, `max-w-[52ch]`, **sem estrelas na célula**
  (a nota do trilho já é a da única avaliação — feedback do dono: estrelas 2× é estranho).
- **`duo`:** cada célula **tem** `StarRating` do rating individual (as notas diferem da
  média do trilho — deixam de ser redundantes), body ~15px.
- `title` da review (opcional no schema): quando existir, linha bold acima do body.
- Assinatura: nome em Barlow Condensed semibold uppercase tracking, **selo
  "✓ Compra verificada"** (outline `border`/`#c8c8c8`, condensed 10.5px uppercase) e
  data (`formatReviewDate` atual). Toda review tem `orderId NOT NULL` — o selo é
  verdadeiro por construção, em 100% das reviews.

### Modo `grid` (n≥4)

- Linha de resumo: trilho à esquerda + célula de barras de distribuição à direita
  (5→1, barra `bg-emach-red` sobre trilho claro `#e0e0e0`, percentuais tabulares),
  `border-b` separando do grid. **Barras só existem neste modo** — com n<4 são ruído.
- Grid de reviews 2-col (`md:grid-cols-2`, `divide-border`), célula compacta como o
  `ReviewCard` atual (estrelas individuais + nome + selo ✓ + data + title/body).
  Review ímpar no fim **estica full-width** (col-span-2) — sem célula fantasma
  (mesma regra de sobras da placa técnica).
- Paginação: mantém a lógica atual (10/página, `reviewPage`), botões trocados para o
  vocabulário claro (outline `near-black`, hover fill `near-black`/texto branco —
  variantes existentes do sistema; **nunca** `ghost`/`outline` dark-only).

### Ordenação

- `ReviewSort` (select) move para o **header da seção** (linha do `SectionLabel`
  "O que dizem os clientes", à direita — onde hoje fica o "% recomendam" duplicado).
- Visível **só no modo `grid`** (ordenar 1–3 depoimentos é chrome sem função).
- Trigger volta ao estilo default claro do sistema (remove `border-white/30 text-white`).

## Componentes e arquivos

| Arquivo | Mudança |
|---|---|
| `product-reviews.tsx` | Reescreve: header (label + sort), trilho, modos por N |
| `review-list.tsx` | Vira modo `grid` claro; paginação light; toolbar interna morre |
| `review-card.tsx` | Modo claro (hairline `divide-border`); célula ímpar estica; selo ✓ |
| `review-sort.tsx` | Estilo claro; renderizado pelo header da seção |
| `review-layout.ts` (novo) | Função pura `reviewLayoutMode(n)` + regra de sobras; unit tests (espelha `plate-layout.ts`) |
| `product-reviews-section.tsx` | Empty state intacto; passa a escolher modo |
| `star-rating.tsx` | Inalterado (funciona nas duas superfícies) |
| `DESIGN.md` §10 | Substituir "bloco preto único" pela placa de avaliações + registrar a revogação |

Sem mudança de schema, queries ou server actions. `getReviews`/paginação/sort via
searchParams permanecem (o buraco dinâmico sob Suspense não muda).

## Fora de escopo

- CTA "Avaliar produto" / fluxo de submissão de review no storefront (não existe; fica
  para uma feature própria).
- Fotos em reviews, resposta da loja, filtro por estrela (sem dado/fluxo hoje).
- Clarear o empty state n=0.

## Verificação

- Unit tests de `review-layout.ts` (n=0..6: modo + sobras).
- `bun check-types` + `test:ci`.
- Smoke visual nas rotas reais: `furadeira-de-impacto-650w` (n=1, modo `single` — o
  estado que 100% dos produtos mostram hoje) e `compressor-de-ar-100l-2hp` (n=0,
  empty intacto). Para `duo`/`grid`, inserir reviews de teste via SQL (status
  `approved`) num produto de staging e conferir n=2, n=3, n=5 (célula esticada,
  barras, sort, paginação) — remover depois.
- Console limpo; mobile 414px (trilho colapsado em linha).

## Trilha de decisões do dono

1. Bloco preto rejeitado ("parece errado" na rota clara) — revoga preferência do #180.
2. Entre placa/editorial-puro/faixa-escura+claro, escolheu **placa** (coerência formal
   máxima com a rota; recomendação do agente era a faixa — dono preferiu placa).
3. Anatomia n=1: **lado a lado** (trilho + célula), não empilhado.
4. n=1 sem estrelas na célula do depoimento; contador "1 avaliação" seco — verificação
   só no selo. Estrelas por célula voltam a partir de n=2 (informação distinta).
