# Vídeo de destaque da ferramenta na galeria do produto

> **Status em 2026-09-28:** implementado (#140, `d82e407`). O bloqueio do SELECT caiu no sync #141 (`d9c26bf`): `getToolBySlug` em `packages/db/src/queries/tools.ts:265` já lê `video_url` e `video_poster_url` (linhas 282-283). O código vive em `apps/web/src/app/(shop)/product/[slug]/_components/gallery-slots.ts` (`buildSlots`), `product-gallery.tsx` e no `remotePattern` de `tool-videos` em `apps/web/next.config.ts:57`. Desde o #180 os thumbs são chips em overlay no painel da galeria, e a placa técnica também mostra o vídeo (`plate-media.tsx`).

> Issue: [#137] — `[catálogo] Renderizar vídeo de destaque da ferramenta na galeria do produto`
> Data: 2026-06-17
> Repo: `emach-ecommerce` (storefront)

## Contexto

O dashboard passou a permitir 1 vídeo de destaque por ferramenta (estilo Mercado
Livre). Duas colunas novas em `tool` carregam o vídeo:

- `video_url text` (nullable) — URL pública absoluta do vídeo (bucket `tool-videos`).
- `video_poster_url text` (nullable) — frame de capa.

Formato v1 lean: **MP4 (H.264) / WebM** apenas, sem transcoding — o player nativo
cobre ambos.

Design/viabilidade originais (lado dashboard): `emach-dashboard` →
`docs/superpowers/specs/2026-06-16-galeria-drag-video-design.md` (Parte 2).

## Estado do bloqueio (blocked-by) — resolvido parcialmente

_Nota 2026-09-28: resolvido por completo. O sync #141 trouxe os campos para o SELECT e o arquivo `catalog.ts` foi dividido (#157): `getToolBySlug` mora hoje em `packages/db/src/queries/tools.ts`. Se a issue no dashboard chegou a ser aberta: não verificado (o repo dashboard está fora do alcance desta revisão)._

O issue nasceu **blocked-by** a chegada das colunas via sync (ADR-0009). O PR de
sync **#139** (`chore: sincroniza schema da DB com o dashboard`) já adicionou as
colunas em `packages/db/src/schema/tools.ts`:

```ts
videoUrl: text("video_url"),
videoPosterUrl: text("video_poster_url"),
```

Como `Tool = typeof tool.$inferSelect`, após o `git pull` o type `Tool` ganha
`videoUrl: string | null` e `videoPosterUrl: string | null`.

**Pegadinha residual:** o #139 sincronizou **apenas** o `schema/tools.ts`, **não**
o SELECT de `getToolBySlug` em `packages/db/src/queries/catalog.ts`. Esse SELECT
lista colunas explícitas (não `SELECT *`) e **não** inclui `video_url`. Logo, mesmo
após o pull, `detail.tool.videoUrl` **compila** (o type tem o campo) mas vem
`undefined` em runtime. `catalog.ts` é **dashboard-owned (ADR-0009)** — a correção
do SELECT começa no dashboard e chega via próximo sync.

Consequência de design: todo o trabalho deste repo (whitelist + galeria + wiring)
é entregável agora; o vídeo só fica **visível em produção** depois que o SELECT
trouxer os campos. Sem o SELECT, nada quebra — a galeria apenas se comporta como
"sem vídeo".

## Decisões de UX (confirmadas)

- **Posicionamento estilo Mercado Livre:** o vídeo entra como **mais um thumbnail**
  na fileira de miniaturas existente (desde o #180, chips em overlay no canto inferior esquerdo do painel, sem a coluna vertical), **logo após a 1ª imagem**. Ordem:
  `[capa, VÍDEO, ...demais fotos]`.
- **Thumb do vídeo:** poster renderizado via `<ProductImage>` + overlay com ícone
  ▶ (lucide `Play`).
- **Capa nunca é o vídeo:** o slot grande abre sempre na 1ª imagem (`activeThumb = 0`),
  evitando autoplay/surpresa. Clicar no thumb de vídeo troca o slot grande para o
  player.
- **Slot grande com vídeo ativo:** `<video controls>` nativo (sem zoom — o
  `InnerImageZoom` é só para imagens).
- **Sem vídeo (maioria dos produtos):** layout idêntico ao atual, zero regressão.

## Arquitetura

Quatro componentes de trabalho, sendo o 4º uma dependência cross-repo.

### Pré-requisito — pull do #139

`git pull` (fast-forward, 2 commits: #138 hero + #139 sync) na `main`. Necessário
para o type `Tool` expor `videoUrl`/`videoPosterUrl`.

### 1. Whitelist do bucket `tool-videos` (`apps/web/next.config.ts`)

Adicionar um `remotePattern` ao array `images.remotePatterns`, espelhando o de
`tool-images`:

```ts
{
  protocol: "https",
  hostname: "wrxohbzepoyscsacjzvd.supabase.co",
  pathname: "/storage/v1/object/public/tool-videos/**",
},
```

**Por que é necessário:** o `<video src poster>` nativo **não** passa por
`next/image`, então o player em si não exigiria whitelist. Quem exige é o **thumb**
do vídeo, que renderiza o poster via `<ProductImage>` (que usa `next/image`). O
poster mora no mesmo bucket público `tool-videos`, coberto pelo pattern acima.

### 2. Galeria de slots tipados (`apps/web/src/app/(shop)/product/[slug]/_components/product-gallery.tsx`)

Hoje a galeria trata os slots como `string[]` (URLs de imagem). Generalizar para
uma união discriminada:

```ts
type GallerySlot =
  | { kind: "image"; url: string }
  | { kind: "video"; url: string; poster: string | null };
```

**Nova prop opcional:**

```ts
interface ProductGalleryProps {
  categorySlug: string;
  images: { url: string }[];
  name: string;
  video?: { url: string; poster: string | null } | null;
}
```

**Montagem dos slots — função pura extraída e testável:**

```ts
// vídeo logo após a 1ª imagem; activeThumb inicial = 0 (sempre a capa)
function buildSlots(
  images: { url: string }[],
  video: { url: string; poster: string | null } | null | undefined,
): GallerySlot[]
```

Regras:
- Sem imagens e sem vídeo → `[]` (caller já trata via placeholder atual).
- Com imagens, sem vídeo → todas as imagens como `kind:"image"` (comportamento atual).
- Com vídeo → `[img0, {kind:"video", ...}, img1, img2, ...]`.
- Edge: vídeo sem nenhuma imagem → `[{kind:"video", ...}]` (vídeo é o único slot;
  nesse caso ele será o slot ativo inicial, aceitável pois não há capa).

**`ThumbButton`:** discrimina por `kind`:
- `image` → `<ProductImage>` como hoje.
- `video` → `<ProductImage src={poster ?? undefined}>` (cai no placeholder de
  categoria se `poster` for null) + overlay centralizado com ícone `Play` da lucide
  + `aria-label="{name} — vídeo"`.

**Slot grande:** discrimina o slot ativo:
- `image` → `InnerImageZoom` como hoje.
- `video` → `<video>`:

```tsx
<video
  className="h-full w-full bg-image-bg object-contain"
  controls
  poster={poster ?? undefined}
  preload="metadata"
  src={url}
/>
```

`object-contain` (não `cover`) para não cortar o vídeo; `preload="metadata"` para
não baixar o arquivo inteiro no load; sem `autoPlay`.

A lógica "primeira thumb = capa ativa" se mantém: `activeThumb` inicial = `0`.
Como o vídeo entra no índice 1 (quando há ≥1 imagem), a capa continua sendo a
primeira a abrir.

### 3. Wiring na página (`apps/web/src/app/(shop)/product/[slug]/page.tsx`)

Derivar `video` de `detail.tool` e passar ao `<ProductGallery>`:

```ts
const video = detail.tool.videoUrl
  ? { url: detail.tool.videoUrl, poster: detail.tool.videoPosterUrl ?? null }
  : null;
```

```tsx
<ProductGallery
  categorySlug={...}
  images={detail.images}
  name={detail.tool.name}
  video={video}
/>
```

Isto é o wiring **definitivo** (não um placeholder): compila porque o type `Tool`
já tem os campos, e renderiza o vídeo automaticamente assim que o SELECT trouxer o
dado — sem nova edição na página.

### 4. Dependência cross-repo — issue no dashboard (SELECT de `getToolBySlug`)

O SELECT em `packages/db/src/queries/catalog.ts > getToolBySlug` precisa trazer:

```sql
t.video_url AS "videoUrl",
t.video_poster_url AS "videoPosterUrl",
```

`catalog.ts` é dashboard-owned (ADR-0009): **não editar em isolamento** neste repo
(o próximo PR de sync sobrescreveria). Abrir issue no `othavioquiliao/emach-dashboard`
descrevendo a necessidade (referenciando #137 daqui). Verificado em 2026-06-17:
nenhuma issue aberta no dashboard cobre isso.

Até a issue ser resolvida e sincronizada, o vídeo não aparece em produção, mas a
galeria funciona normalmente como "sem vídeo".

## Tratamento de erros / edge cases

| Caso | Comportamento |
|---|---|
| Produto sem vídeo (maioria) | `video = null` → galeria idêntica à atual, zero regressão |
| Vídeo sem poster (`video_poster_url` null) | Thumb cai no placeholder de categoria; `<video>` mostra o 1º frame |
| Vídeo + zero imagens (raro) | Vídeo é o único slot e abre no slot grande |
| Formato não suportado pelo browser | Player nativo exibe o controle de erro padrão; sem fallback custom (v1 lean) |
| SELECT ainda sem os campos | `detail.tool.videoUrl` undefined → `video = null` → sem vídeo, sem erro |

## Testes / verificação

- **Unitário — `buildSlots`:** função pura, cobre ordem (vídeo após a capa), caso
  sem vídeo (idêntico ao atual), caso sem imagens, caso vídeo-sem-poster.
- **`bun check-types`** após o pull e as edições.
- **Smoke visual** (`bun dev:web`, rota `/product/[slug]`): como o SELECT ainda não
  traz o dado, passar temporariamente uma prop `video` mockada na página para
  validar: thumb com ▶, troca para `<video>` ao clicar, e o caso sem-vídeo
  (remover o mock). Reverter o mock antes do commit — o wiring definitivo é o
  derivado de `detail.tool.videoUrl`.

> Nota (CLAUDE.md): mudanças de UI não são "feitas" sem verificação visual real;
> `bun check-types` verde não significa UI funcionando.

## Plano de implementação (resumo)

Ordem das tasks (3+ distintas → `subagent-driven-development`):

1. `git pull` (#138 + #139) + `bun check-types` baseline.
2. Whitelist `tool-videos` no `next.config.ts`.
3. Refatorar `product-gallery.tsx` para slots tipados + extrair `buildSlots` +
   teste unitário de `buildSlots`.
4. Wiring definitivo em `page.tsx`.
5. Smoke visual com prop mockada → reverter mock.
6. Abrir issue no `emach-dashboard` para o SELECT de `getToolBySlug`.

Tasks 1–5 entregam 100% neste repo. Task 6 destrava a visibilidade em produção via
próximo sync.

## Fora de escopo (YAGNI)

- Transcoding / múltiplas resoluções de vídeo (v1 é player nativo, MP4/WebM).
- Lazy-load avançado / IntersectionObserver no player (`preload="metadata"` basta).
- Lightbox/fullscreen custom (controles nativos do `<video>` cobrem).
- Edição do SELECT em `catalog.ts` neste repo (dashboard-owned).
