# Hero / Banners componível — Design

> **Status em 2026-09-28:** parcial. Os slots (badge, countdown, CTA, título, descrição), as variantes de CTA e o fallback estão no código (`apps/web/src/components/hero/hero-element-renders.tsx`, `hero/hero-fallbacks.ts`). A disposição por enum `layout` foi substituída pela composição por elemento (`banner.composition`), ver `2026-07-30-hero-composition-design.md`; a ficha técnica deixou de ser só arte e virou DOM (`2026-06-22-hero-specs-dom-design.md`). Presets, builder e validações vivem no dashboard (não verificado aqui).

> Data: 2026-06-15 · Issue de consumo (ecommerce): #122 · Schema: `packages/db/src/schema/banner.ts` (owned-by-dashboard)
> Mockups da sessão: `.superpowers/brainstorm/1378197-1781544186/content/` (presets, cta, anchors, title-treatment, mobile, consistency)

## Modelo — presets + slots on/off + disposição

O hero deixa de ser hardcoded e vira um **sistema componível** dirigido pela tabela `banner`. Não é page-builder livre (sem drag-drop): é **presets (pontos de partida) + slots ligáveis/desligáveis + disposição por enum**. Cada banner é uma linha; a home renderiza os ativos ordenados num carrossel.

Princípio que guia tudo: **o banco controla a camada de overlay (consistente); a arte de fundo carrega o editorial livre** (ficha técnica, número decorativo) quando o banner quiser. Sistema visual = Ferrari (DESIGN.md): Barlow Condensed, cantos retos 2px, régua vermelha como assinatura.

## Slots — cada um liga/desliga independente

Os presets só pré-marcam; qualquer combinação é válida.

| Slot | Como liga/desliga | Notas |
|---|---|---|
| **Background** | `backgroundImageUrl` presente/nulo | Sem bg → fundo void-black + glow vermelho (construído no código) |
| **Background mobile** | `backgroundImageMobileUrl` | Fallback → desktop |
| **Produto central** | `productImageUrl` presente/nulo | `object-contain`, flutua com glow |
| **Produto mobile** | `productImageMobileUrl` | Fallback → produto desktop |
| **Título** | `title` presente/nulo | Barlow Condensed display; aciona a régua vermelha |
| **Descrição** | `subtitle` presente/nulo | Barlow, cinza claro |
| **Badge/selo** | `badgeText` presente/nulo | Pill branco (texto near-black). Ex: "-40% OFF", "LANÇAMENTO" |
| **Countdown** | `countdownTarget` presente/nulo | Contador ao vivo até a data-alvo; cria urgência |
| **CTA** | `ctaLabel`+`ctaHref` presentes/nulos | Botão único; cor via `ctaVariant` |

Ficha técnica **não é slot de código** — fica embutida na arte de fundo (decisão da arte). _Nota 2026-09-28: decisão revertida. `banner.specs` (jsonb) é renderizada como DOM por `HeroSpecs` em `hero/hero-element-renders.tsx` (#158)._ Dots do carrossel são automáticos (aparecem se >1 banner ativo), sempre centralizados embaixo.

## Disposição — enum `layout` (4 valores, todos)

_Nota 2026-09-28: o enum `banner_layout` hoje tem 8 valores (`packages/db/src/schema/banner.ts:14`) e o hero não lê mais `layout` para posicionar. A posição vem de `banner.composition`; o `layout` só alimenta a conversão legada de banners sem composition (`apps/web/src/lib/composition/legacy-composition.ts`)._

Define a posição do bloco de conteúdo. Dots sempre no meio embaixo.

- `split` (A) — texto à esquerda, CTA no canto inferior direito (separados). Produto à direita.
- `stack_left` (B) — título + descrição + CTA empilhados juntos, inferior esquerdo. Produto à direita.
- `center_bottom` (C) — conteúdo centralizado embaixo, produto no topo. Cinematográfico.
- `center_mid` (D) — tudo centralizado no meio, sem produto. Ideal pro Promo full-text.

## Variante de CTA — enum `ctaVariant` (4 valores), botão único

Um CTA por banner (sem segundo botão). Cor escolhível:

- `red` — `#E60012` fill, texto branco. Máximo destaque (default).
- `dark` — `#181818` fill + hairline branca, texto branco. Discreto/premium.
- `white` — fill branco, texto near-black. Inverte, alto contraste.
- `ghost` — transparente + borda branca (outline-light do DESIGN.md). Secundário.

O vermelho deixa de ser obrigatório no hero — vira uma opção. ("Vermelho é verbo" continua válido: cada banner usa o vermelho no máximo uma vez, no CTA.)

## Presets (atalhos que pré-configuram slots + layout)

Pontos de partida no dashboard; o staff ajusta depois:

1. **Produto em destaque** — bg + produto + título + descrição + CTA · `split` · ficha na arte.
2. **Promo full-text** — bg + badge + título + descrição + CTA · `center_mid` · sem produto.
3. **Countdown** — bg + produto + título + countdown + CTA · `split`/`stack_left`.
4. **Imagem pura** — só bg + CTA · sem overlay de texto (a arte manda 100%).

## Mobile

- Disposição mobile colapsa pra vertical: produto no topo, conteúdo embaixo, **CTA full-width na base** (M1), dots no meio. Alvo de toque grande (≥44px), segue DESIGN.md.
- Usa `backgroundImageMobileUrl` (portrait) e `productImageMobileUrl`, com fallbacks → desktop. _Nota 2026-09-28: o fundo mobile agora obedece `backgroundMobileMode` (`inherit`, `custom`, `none`), em `resolveMobileBg` de `hero/hero-slide.tsx`._ Ficha técnica no mobile é resolvida na arte mobile.

## Schema — delta vs o `banner` já sincronizado (owned-by-dashboard, ADR-0009)

Nasce no dashboard + re-sync via CI. Mudanças:

**Tornar nullable (slots desligáveis):**
- `title`: NOT NULL → nullable
- `backgroundImageUrl`: NOT NULL → nullable (banner sem bg = void-black + glow)
- `ctaLabel`, `ctaHref`: NOT NULL → nullable (CTA desligável)
- `altText`: NOT NULL → nullable (faz par com background; validação condicional abaixo)

**Adicionar:**
- `layout`: `pgEnum('banner_layout', ['split','stack_left','center_bottom','center_mid'])` NOT NULL default `'split'`
- `ctaVariant`: `pgEnum('banner_cta_variant', ['red','dark','white','ghost'])` NOT NULL default `'red'`
- `badgeText`: `text` nullable
- `countdownTarget`: `timestamptz` nullable

**Mantém:** `id`, `*MobileUrl`, `subtitle`, `sortOrder`, `isActive`, timestamps.

## Validações (zod no dashboard)

- **Conteúdo mínimo:** banner não pode ser 100% vazio — exigir `backgroundImageUrl` OU ao menos um de (`title`, `badgeText`). Evita slide em branco.
- `altText` obrigatório se `backgroundImageUrl` presente (acessibilidade).
- `ctaLabel` e `ctaHref` juntos (ambos ou nenhum); `ctaHref` começa com `/` ou `https://`.
- `countdownTarget` no futuro.
- **Máx 6 banners `isActive`** (autoplay ~9s → ciclo ~54s); ativar o 7º bloqueado com mensagem.
- Lengths: `title` ≤80, `subtitle` ≤140, `badgeText` ≤16, `ctaLabel` ≤30.

## Animações

Mantém as do hero atual: parallax no mouse, float do produto, glow vermelho pulsante, entrada blur/scale. Countdown atualiza por segundo (client). Tudo com alternativa `prefers-reduced-motion` (crossfade/estático).

## Fallback

Sem banners ativos → 2 slides hardcoded atuais como default (home nunca fica sem hero).

## Fluxo de entrega

1. **Dashboard (você):** issue novo — schema delta acima + **builder UI** (form com slots on/off, seletor de preset, enum de layout, enum de variante de CTA, upload das 4 imagens com guidelines de dimensão, campos badge/countdown, reorder, toggle ativo, validações). Mergear na main → sync CI abre PR de schema aqui.
2. **Ecommerce (eu, #122):** após o sync, implementar o consumo — leitura dos banners ativos (inline no Server Component), `HeroCarousel` dirigido por props, render de cada slot/layout/variante, mobile, fallback, whitelist do host no `next.config.ts`.
3. **Revalidação on-demand (#124):** fatia separada — refletir edições do dashboard na home em segundos.
