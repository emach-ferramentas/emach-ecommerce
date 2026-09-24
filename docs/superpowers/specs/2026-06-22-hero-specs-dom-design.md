# Hero: renderizar `banner.specs` como DOM no carousel

**Issue:** #158 (handoff de emach-dashboard#229)
**Data:** 2026-06-22
**Status:** implementado. Evidência: `apps/web/src/components/hero/hero-element-renders.tsx` renderiza `banner.specs` como `<ul>` via `resolveHeroSpecs` (`lib/hero-specs.ts`).

## Contexto e motivação

No hero, a ficha técnica ("FICHA TÉCNICA · 1200W · 800 RPM…") estava **queimada
dentro da arte de background widescreen**. Isso quebrava o mobile (o `object-cover`
recorta a arte em retrato) e era inacessível (não é texto: sem a11y, sem SEO, sem
i18n). O fix de composição mobile já foi feito (commit `7747774`); esta mudança
remove as specs da imagem e as renderiza como DOM semântico — resolvendo a classe
inteira do problema, não só o mobile.

O dado já existe: o dashboard adicionou a coluna `banner.specs` (`jsonb`,
`string[]`, nullable) e ela foi sincronizada para cá pelo PR de schema **#159**
(ADR-0009). O dado guarda **só os valores** (`["1200W","800 RPM","Ø125mm"]`); o
header **"FICHA TÉCNICA" é label fixo de rendering** (não vem no dado).

## Escopo

**Um único arquivo:** `apps/web/src/components/hero-carousel.tsx`.

Nada muda no data flow: `getActiveBanners()` em `apps/web/src/app/(shop)/page.tsx`
usa `.select()` puro (sem projeção), então a coluna `specs` **já chega** no
componente. O schema (`packages/db/src/schema/banner.ts`) é owned-by-dashboard e
**não** se edita aqui.

## Decisão visual (validada no companion)

Tratamento **inline com bullet (`·`)**: uma linha — label + valores separados por
`·`, em Barlow Condensed uppercase com tracking, sobre a arte escura. Escolhido por:

- **Continuidade:** replica exatamente o que estava queimado na arte.
- **Leveza:** o hero já é denso (título grande + produto flutuante + CTA); a
  linha única não rouba altura nem empurra o CTA pra fora da dobra no mobile.
- **Hierarquia:** não cria um segundo foco visual que compita com o vermelho do
  CTA (DESIGN.md: destaque/vermelho uma vez por tela).

Rejeitadas: **chips/selos** (o contorno cria 2º foco que compete com o CTA) e
**lista vertical** (consome altura; risco no mobile).

## Design

### Abordagem: sub-componente `HeroSpecs`

Extrair `HeroSpecs({ specs })`, seguindo o padrão do arquivo (`HeroCta`,
`HeroCountdown`, `HeroProduct`, `HeroBackground`, `HeroGlow` já são componentes
próprios). Mantém o `HeroContentBlock` legível e isola guard + a11y.

### Mudanças pontuais

1. **Tipo:** adicionar `"specs"` ao `Pick` do `HeroBanner` (≈ linha 37).
2. **Fallbacks:** adicionar `specs: null` aos 2 itens de `FALLBACK_BANNERS` (eles
   já têm `title: null`/`subtitle: null` → continuam sem painel, sem risco de
   duplicar arte).
3. **Componente novo** `HeroSpecs`:
   - Filtra valores vazios/whitespace; se não sobra nada, retorna `null`.
   - `<ul aria-label="Ficha técnica">` com um `<li>` por valor.
   - Label visual **"FICHA TÉCNICA"** como `<span aria-hidden="true">` — evita o
     leitor de tela duplicar com o `aria-label` da lista.
   - Separador `·` via CSS `::before` (decorativo, não lido).
   - Barlow Condensed, uppercase, tracking, `drop-shadow` para legibilidade sobre
     imagem (mesmo padrão do subtítulo/countdown).
   - `key={spec}` nos `<li>` (valores são distintos por natureza; evita o
     `key={index}` banido pelo CLAUDE.md).
4. **Posição:** renderizar em `HeroContentBlock` **entre a régua vermelha e o
   subtítulo** (badge → título → régua → **specs** → subtítulo → countdown → CTA).
   Como fica dentro do bloco, herda o alinhamento por layout (`cfg.content`) nos 8
   presets automaticamente.
5. **Gradiente de legibilidade (detalhe não-óbvio):** hoje
   `const hasText = Boolean(banner.title || banner.subtitle)` (em
   `HeroSlideContent`) liga o scrim/gradiente que protege o texto overlay. Um
   banner com **specs mas sem título/subtítulo** ficaria sem proteção de
   contraste. Incluir specs no cálculo → o gradiente liga quando há qualquer
   conteúdo overlay. Banner "imagem pura" (sem título, sem subtítulo, sem specs)
   continua com a arte intacta — mantém a regra existente do CLAUDE.md.

### Esboço de referência (não-normativo)

```tsx
// Ficha técnica do hero (#158): valores de banner.specs como <ul> semântico em
// vez de queimados na arte. "FICHA TÉCNICA" é label fixo de render (não vem no
// dado). null/[]/só-vazios = sem painel.
function HeroSpecs({ specs }: { specs: string[] | null }) {
  const values = specs?.filter((s) => s.trim().length > 0) ?? [];
  if (values.length === 0) {
    return null;
  }
  return (
    <div className="mt-3 flex flex-wrap items-baseline gap-x-1 ...">
      <span aria-hidden="true" className="font-display uppercase tracking-[0.12em] text-white/55 ...">
        Ficha técnica
      </span>
      <ul aria-label="Ficha técnica" className="font-display uppercase tracking-[0.08em] text-white/90 drop-shadow-... ">
        {values.map((spec) => (
          // separador "·" via before:content-['·'] em cada <li>
          <li className="inline before:mx-1.5 before:text-white/40 before:content-['·']" key={spec}>
            {spec}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

(Classes Tailwind exatas a finalizar na implementação; o que importa é a
estrutura semântica e a hierarquia visual.)

## Edge cases

- `specs === null` → sem painel.
- `specs === []` → sem painel.
- `specs` só com strings vazias/whitespace → filtradas → sem painel.
- specs presentes sem título/subtítulo → painel renderiza **e** o gradiente liga
  (item 5).
- Valores longos → quebram na linha (inline + `flex-wrap`), sem estourar altura.

## Mobile

Aparece em **ambos** os breakpoints — é o objetivo do issue (a11y +
responsividade). Tratamento inline quebra naturalmente. **Sem** gating `lg:`
(diferente de `productScale`/`ctaScale`, que são desktop-only porque estouram o
viewport mobile).

## Verificação

CLAUDE.md: UI não se declara "feita" sem verificação visual real na rota.

1. `bun check-types` (sem `: any`/`as any`; respeitar anti-patterns do CLAUDE.md).
2. **Smoke visual** (`bun dev:web`): ativar/seedar um banner com
   `specs: ["1200W","800 RPM","Ø125mm"]` e visitar `/` — conferir desktop e
   mobile (DevTools responsivo), incluindo um banner com `specs: null` (sem
   painel) e um com specs + sem título (gradiente liga).
3. Se houver setup de testing-library no repo, teste unit do guard de `HeroSpecs`
   (null / [] / só-vazios → não renderiza). Caso contrário, o smoke cobre.

## Fora de escopo / coordenação de rollout

- **Schema/dado:** já entregue (dashboard#229 + PR #159).
- **Arte queimada:** banners de produção cuja arte de background ainda tem as
  specs queimadas vão **duplicar** (DOM + imagem) até subirem nova arte sem specs
  pelo dashboard. É coordenação de conteúdo, não código. Sinalizar no fechamento
  do issue. Os `FALLBACK_BANNERS` não têm specs → não afetados.
- Sem mudança de schema, query, ou em outras rotas.
