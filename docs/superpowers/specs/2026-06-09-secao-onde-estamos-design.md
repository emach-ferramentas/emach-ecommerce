# Seção "Onde estamos" — mapa de filiais georreferenciado

**Data:** 2026-06-09
**Status:** aprovado (design), pendente implementação
**Arquivo-alvo:** `apps/web/src/app/(shop)/page.tsx` (home)

## Problema

A última seção da home antes do footer — "Feito para durar" (`page.tsx:173-217`) — exibe
um grid 3×2 de **6 estatísticas inventadas** (`STATS`, `page.tsx:22-29`): `200+ horas de
teste`, `2 anos garantia`, `98% aprovação`, `50+ cidades`, `24/7 suporte`, `12× sem juros`.
Nenhuma vem do banco. Vários são frágeis e não-verificáveis ("98% aprovação", "50+ cidades").

Trocar mock por número real não resolve: os dados reais de uma loja nova são modestos
(10 produtos, 3 filiais, 5 reviews) e ficariam *mais fracos* que os mocks grandiosos. A seção
precisa **provar algo que fica melhor sendo verdade**. Decisão do dono: **presença física
(filiais)** — tangível, honesta, e diferenciada no varejo de ferramentas BR.

Dois problemas de design herdados que esta seção também corrige (achados via `impeccable`):
- **Side-stripe border banido:** a `border-l-[3px] border-emach-red` (separador vertical
  vermelho) é vermelho decorativo. O DESIGN.md diz "vermelho é verbo, não decoração". O
  vermelho migra para os **pins/estados** (onde significa *é aqui que estamos*).
- **Hero-metric template banido:** os 6 stats são o template SaaS clichê. Removidos.

## Objetivo

Substituir a seção por **"Onde estamos"**: um mapa do Brasil georreferenciado com um pin por
filial na coordenada real, ao lado de uma lista navegável das lojas. Interação: hover/focus
sincroniza mapa ↔ lista ↔ estado destacado, e rola a lista interna até a filial; clicar abre
"Como chegar" (Google Maps). Tudo SSR-first, com uma camada de interação client mínima.

### Requisitos do dono (literais)

1. **Localização correta de verdade.** "Caso eu adicione outro endereço aleatório tem que
   aparecer certo." → pin derivado da coordenada real, sem calibração manual.
2. **Escalar sem quebrar.** 3 filiais hoje, mais no futuro → lista com scroll interno
   (carrossel), mapa só ganha pins.
3. **Hover-sync + scroll-sync.** Hover num pin destaca a filial na lista e rola até ela;
   hover na lista destaca o pin/estado.
4. **Click no pin → "Como chegar"** (Google Maps).
5. **Performance** (foco `impeccable`): a home é Server Component cacheado (`revalidate=600`);
   o trabalho geográfico não pode ir pro client.

## Decisões de arquitetura

### Por que NÃO mapcn / MapLibre GL

A `mapcn` (sugerida) é construída sobre MapLibre GL (WebGL + tiles): ~200KB+ no client,
client-only (quebra o SSR da home), exige tile provider/API key. É canhão pra um selo de marca
estático. Fica reservada para uma eventual página `/filiais` interativa no futuro.

### SVG estático server-side + camada client fina

```
┌─ BrazilMapSection (Server Component) ─────────────────────────┐
│  • fetch filiais ativas (status='active')                     │
│  • geocode cidade+UF → [lng,lat] (base IBGE local)            │
│  • projeta [lng,lat] → [x,y] (geoMercator de params fixos)    │
│  • monta mapsUrl + flags (phone/hours condicionais)           │
│  • paths dos 27 estados = constante pré-computada             │
│         │ passa props já serializadas (sem d3, sem geojson)   │
│         ▼                                                      │
│  ┌─ BranchMap (Client Component, "use client", ~2KB) ───────┐ │
│  │  • renderiza SVG (estados + pins <a>) + lista scrollável │ │
│  │  • useState(hoveredId): hover/focus pin OU item →        │ │
│  │    destaca par + estado, scrollIntoView no item          │ │
│  │  • click = <a target=_blank rel=noopener> Google Maps    │ │
│  └──────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────────┘
```

**d3-geo, topojson e o GeoJSON nunca vão pro client.** Ficam em um script offline
(devDependency) que gera assets estáticos. O client recebe apenas as coordenadas já projetadas
e os paths prontos.

## Componentes e arquivos

### Assets gerados offline (script único, não-runtime)

`scripts/gen-brazil-map.mjs` (rodado manualmente quando o mapa precisar mudar; usa `d3-geo` +
GeoJSON IBGE + `municipios.csv`, simplificado via `mapshaper -simplify`):

- **`apps/web/src/lib/branch-map/brazil-states.ts`** — constante `BRAZIL_STATES: {uf, path}[]`
  (27 estados, paths SVG simplificados ~15-20KB total) + `BRAZIL_VIEWBOX`. Mesma projeção dos
  pins.
- **`apps/web/src/lib/branch-map/municipios.json`** — `{ "<cidade-normalizada>|<uf>": [lng,lat] }`
  derivado da base IBGE (5570 municípios, ~200KB, **server-only**) + centroides das 27 UFs para
  fallback.
- **`apps/web/src/lib/branch-map/projection.ts`** — params fixos da `geoMercator`
  (`scale`, `translate`) que casam com `brazil-states.ts`, e `project([lng,lat]) → [x,y]` como
  função pura (Mercator reimplementada, **zero dep em runtime**).

### Runtime

- **`apps/web/src/lib/branch-map/geocode.ts`** (server) — `cityToLngLat(city, uf): [lng,lat]`.
  Lookup normalizado (sem acento, lowercase) em `municipios.json`; fallback para o centroide da
  UF (toda filial tem UF → nunca falha). Retorna também `{ exact: boolean }` para log.
- **`apps/web/src/lib/branch-map/maps-url.ts`** — `branchMapsUrl(branch)`:
  `https://www.google.com/maps/search/?api=1&query=` + endereço encodado.
- **`apps/web/src/components/branch-map-section.tsx`** (Server) — orquestra: query de filiais,
  geocode+projeção, monta `BranchPin[]`, renderiza copy (esquerda) + `<BranchMap/>` (direita).
  Reusa `SectionLabel` (tone accent), `EmachButton` (`variant="outline-light"` → `/sobre`),
  `PageContainer`.
- **`apps/web/src/components/branch-map.tsx`** (Client) — SVG + lista interativa.

### Query de filiais

Extrair a lógica de `getBranches()` (hoje em `sobre/page.tsx:164`) para um helper compartilhado
em `apps/web/src/lib/branch-map/` ou `packages/db/queries` (a /sobre e o footer já consultam
`branch`; evitar 3ª cópia). Campos: `name, city, state, cep, street, streetNumber,
neighborhood, phone, businessHours, status`. Filtro `status='active'`, ordenar por `created_at`
ou nome.

## Data flow

1. Server: `getActiveBranches()` → linhas de `branch`.
2. Para cada filial: `cityToLngLat(city, uf)` → `project(...)` → `{x, y}`; `branchMapsUrl(...)`.
3. UFs com filial → set de destaque para os paths de estado.
4. Props pro client: `{ pins: BranchPin[], states: {uf, path, highlighted}[], viewBox }`.
   `BranchPin = { id, city, uf, addr, phone?, hours?, x, y, mapsUrl }`.
5. Client renderiza; hidrata só os handlers de hover/focus/scroll.

## Layout e responsividade

- **Desktop:** 2 colunas. Esquerda (~36%): eyebrow "Onde estamos", headline, parágrafo, CTA.
  Direita (~64%): mapa (~50%) + lista scrollável (~50%), separadas por hairline 1px (não o
  side-stripe vermelho de 3px).
- **Mobile:** stack — copy, mapa, lista (cada uma full-width). Lista mantém `max-height` +
  `overflow-y:auto`.
- **Lista:** `max-height` ~ altura do mapa, `overflow-y:auto`, `scroll-behavior:smooth`. Com 3
  filiais não rola; acima disso vira carrossel vertical. Sem limite rígido de filiais.

## Copy (aprovada)

- Eyebrow: **Onde estamos**
- Headline: **Perto de quem coloca a mão na massa.**
- Parágrafo: *Três lojas físicas no Sul e Sudeste. Você passa, vê a ferramenta na bancada, tira
  dúvida com quem usa e leva com nota fiscal.*
- CTA: **Ver filiais →** (`EmachButton outline-light` → `/sobre`)
- Sem em dash, sem buzzword (regra `impeccable`).

> Nota: o parágrafo cita "três lojas". Se o número de filiais mudar, generalizar a frase para
> não fixar a contagem (ex.: "Lojas físicas no Sul e Sudeste."). Tratar na implementação.

## Dados honestos (sem invenção)

Telefone e horário aparecem **só onde a filial tem cadastro**: hoje SP tem horário, Curitiba tem
telefone, Joinville mostra só endereço. Renderização condicional por campo; nada de placeholder
inventado.

## Interação (detalhe)

- **Hover/focus em pin ou item** → `setHovered(uf)`: aplica classe ativa no pin, no item e no
  `<path>` do estado (fill vermelho translúcido); `scrollIntoView({block:'nearest'})` no item.
- **Click no pin/item** → `<a href=mapsUrl target="_blank" rel="noopener">` (CLAUDE.md: blank
  sempre com noopener). Funciona sem JS (progressive enhancement).
- **Teclado:** pins são links focáveis; `:focus-visible` dispara o mesmo destaque.

## Performance

- d3-geo / GeoJSON / mapshaper: só no script offline (devDependency). **Zero no bundle client.**
- Client recebe coords já projetadas + paths prontos. Componente client ~2KB, sem libs.
- Paths de estado simplificados (~15-20KB SSR, ~5-8KB gzip).
- Seção é SSR + cache `revalidate=600` (já vigente na home).

## Acessibilidade e motion

- Pins = `<a>` com `aria-label` ("EMACH São Paulo — Av. Paulista 1578").
- `prefers-reduced-motion: reduce` → sem transição/scroll suave (instantâneo).
- Contraste: texto branco/cinza sobre preto ≥ 4.5:1 (subir cinzas para o lado do branco se
  necessário).

## Error handling

- Filial sem coordenada exata → fallback centroide UF; `log.info`/`log.warn` via evlog
  (`@/lib/evlog`) registrando cidade não encontrada (nunca `console`).
- Zero filiais ativas → seção não renderiza (`branches.length > 0`), como as outras seções da
  home.
- Geocode é determinístico e offline; sem ponto de falha de rede em runtime.

## Testing

- `geocode.test.ts` (vitest): `cityToLngLat` acha cidade conhecida; cai no centroide da UF
  quando a cidade não está na base; normalização de acento/caixa.
- `projection.test.ts`: `project([lng,lat])` de coordenadas conhecidas (ex.: SP capital) cai
  dentro do bounding box esperado do viewBox; ordem lng/lat correta.
- `maps-url.test.ts`: encoda endereço corretamente.
- Smoke runtime (CLAUDE.md): `bun dev:web` + visitar `/` — `check-types` não pega SQL/SSR;
  confirmar mapa, pins, hover, scroll e link na rota.

## Fora de escopo (futuro)

- Página `/filiais` interativa (aí sim MapLibre/zoom faria sentido).
- Coluna `latitude`/`longitude` em `branch` (precisão de rua; nasce no `emach-dashboard`,
  ADR-0009). Hoje a coordenada de cidade basta para o mapa nacional.
- Cluster de pins quando filiais se sobrepõem na mesma cidade.

## Limpeza

- Remover `STATS` (`page.tsx:22-29`) e o markup da seção atual (`page.tsx:173-217`).
- Verificar se `.emach-bg-stats` (`globals.css`) fica órfã; remover se sim.
