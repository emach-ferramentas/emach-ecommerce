# Otimização de render das imagens do hero (#126)

> **Status em 2026-09-28:** implementado. `apps/web/next.config.ts:41-42` declara `formats: ["image/avif", "image/webp"]` e `qualities: [75, 85]`; o fundo usa `quality={75}` e `priority={isFirst}` em `hero/hero-slide.tsx`, e o produto usa `quality={85}` sem `unoptimized` em `hero/hero-element-renders.tsx`. O hero saiu de `hero-carousel.tsx` para `components/hero/` (#210), e o `sizes` do produto hoje é `(max-width: 1024px) 92vw, 42vw`.

**Data:** 2026-06-15
**Issue:** othavioquiliao/emach-ecommerce#126 (`perf`)
**Blocked by:** #122 (hero consumível servido pelo banco) — **CLOSED**, desbloqueado.

## Problema

O dashboard passou a aceitar masters de banner grandes (fundo/produto desktop até 4MB,
mobiles até 2MB; bucket `banner-images` travado em 5MB). Servir o arquivo de origem cru no
hero da home destruiria o LCP.

O hero (`hero-carousel.tsx`) já consome esses banners via `next/image` (#122), mas a
implementação atual **não otimiza o suficiente** e, no caso do produto, **não otimiza de jeito
nenhum**:

- `next.config.ts` não declara `images.formats` → reotimização não serve AVIF/WebP.
- `quality={100}` em todas as imagens → peso desnecessário.
- `priority` em **todos** os slides → todas as imagens competem pela fila de fetch
  high-priority, prejudicando o LCP do primeiro slide.
- O `<Image>` do **produto** tem `unoptimized` (stopgap introduzido no commit do #122,
  `1ee46ac`) → serve o master cru, ignorando formats/quality/sizes por completo.

## Objetivo

Garantir que o usuário final receba uma versão **otimizada e leve** (AVIF/WebP redimensionado)
independentemente do master de 4MB, mantendo qualidade visual alta no hero.

## Escopo

Ajuste cirúrgico em **2 arquivos**, sem novos componentes:

### 1. `apps/web/next.config.ts`

```ts
images: {
  formats: ["image/avif", "image/webp"], // novo — AC item 1
  qualities: [75, 85],                    // era [75, 100]
  remotePatterns: [ /* inalterado — banner-images já whitelisted (#122) */ ],
}
```

- `formats` habilita a reotimização on-demand a servir AVIF (com fallback WebP).
- `qualities` passa a `[75, 85]`: o `next/image` só aceita valores de `quality` que estejam
  nesse array, então ele precisa conter exatamente os dois valores usados no carousel (75 e 85).
  O `100` sai porque deixa de ser usado.

### 2. `apps/web/src/components/hero-carousel.tsx`

_Nota 2026-09-28: o arquivo foi dividido no #210. `isFirst` continua vindo de `index === 0` em `hero-carousel.tsx`; o fundo mora em `hero/hero-slide.tsx` e o produto em `hero/hero-element-renders.tsx`. O produto só emite `priority` quando `preload` é verdadeiro, para não duplicar o preload do mesmo asset entre desktop e mobile (`productImageLoadProps`)._

Propagar a posição do slide até `HeroSlideContent` via novo prop `isFirst: boolean`, derivado
de `index === 0` no `.map` de `HeroCarousel`. Com isso:

- **Fundo desktop + fundo mobile (`<Image>`):**
  - `priority={isFirst}` (era `priority` fixo)
  - `quality={75}` (era `100`)
  - `sizes="100vw"` (mantido — fundo full-bleed)
  - `fetchPriority="high"` apenas no primeiro slide (AC literal; redundante com `priority`,
    que já emite `fetchpriority=high`, mas mantém o checkbox explícito).
  - Slides não-primeiros: `priority=false` ⇒ `loading="lazy"` por default.

- **Produto (`<Image>`):**
  - **Remover `unoptimized`** — esta é a mudança-chave que faz o produto passar a ser
    AVIF/WebP redimensionado.
  - `priority={isFirst}` (era `priority` fixo)
  - `quality={85}` (era `100`) — produto é o elemento focal, com bordas duras sobre
    transparência; 85 preserva nitidez sem banding.
  - `sizes="(max-width: 1024px) 82vw, 42vw"` (mantido — _Nota 2026-09-28: hoje é `92vw`, ver `hero-element-renders.tsx`_ — já casava com a largura real:
    `lg:w-[40%]`/`[42%]` no desktop, `w-[82%]` no mobile).
  - `fetchPriority="high"` apenas no primeiro slide.

## Decisões

- **Quality diferenciado (bg 75 / produto 85):** fundo full-bleed tolera mais compressão;
  produto focal preserva nitidez. Define `qualities: [75, 85]`.
- **`sizes` mantido:** já está correto vs. o layout atual; não há trabalho a fazer além de
  confirmar no smoke.

## Nuance conhecida (documentada, não é blocker)

Em carrossel embla todos os slides ficam no DOM (deslocados horizontalmente), então o
lazy-loading nativo do browser pode não diferir muito o carregamento dos slides 2+. Mesmo
assim, remover `priority` deles os tira da fila de fetch high-priority — ganho real de LCP no
primeiro slide. Aceito como suficiente para o objetivo da issue.

## Fora de escopo (insight registrado)

O produto renderiza um único `<Image src={mobileProduct}>`, onde
`mobileProduct = productImageMobileUrl ?? productImageUrl`. Se um banner tiver produto mobile
separado, o **desktop também serve a arte mobile** — bug de correção (não de perf). Não tocar
aqui; abrir issue própria se confirmar com dado real.

_Nota 2026-09-28: resolvido no #210. `HeroPositionedProduct` (`hero/hero-slide.tsx`) usa `productImageUrl` no desktop e `productImageMobileUrl ?? productImageUrl` no mobile._

## Verificação

- `bun check-types` verde.
- Smoke em `localhost:3009`: aba Network confirma o hero servido como **AVIF** redimensionado
  (os PNGs fallback locais em `/images/hero-imagens/` já exercitam o pipeline `next/image`) e
  `fetchpriority="high"` apenas no primeiro slide.
- AC do "banner real ~4MB": exige dado cadastrado no banco (lado dashboard). O pipeline é
  validado com o fallback; a verificação com master real de 4MB depende de cadastro e fica
  anotada como follow-up de validação, não de código.

## Acceptance criteria (issue #126)

- [ ] `next.config.ts` com `images.formats` incluindo AVIF + WebP
- [ ] Primeiro slide do hero com `priority`/`fetchPriority="high"`; slides seguintes lazy
- [ ] `sizes` correto por imagem (fundo `100vw`; produto conforme largura real)
- [ ] Todas as imagens de banner via `next/image` (zero `<img>` cru) — já satisfeito
- [ ] Com banner real de ~4MB, o recurso servido é AVIF/WebP redimensionado (Network) e LCP
      saudável — pipeline validado com fallback; master real depende de cadastro
- [ ] `bun check-types` verde; smoke visual com banner de alta resolução
