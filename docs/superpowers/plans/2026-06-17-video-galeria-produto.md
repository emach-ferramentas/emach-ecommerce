# Vídeo de destaque na galeria do produto — Implementation Plan

> **Status em 2026-09-28:** implementado (#140, `d82e407`): `gallery-slots.ts`, `product-gallery.tsx`, o wiring em `page.tsx` e o `remotePattern` de `tool-videos` em `apps/web/next.config.ts:57`. O SELECT de `getToolBySlug` já traz `video_url` e `video_poster_url` desde o sync #141 (`d9c26bf`), hoje em `packages/db/src/queries/tools.ts:282`. `catalog.ts` foi dividido (#157). Os checkboxes abaixo ficaram sem marcar e não refletem o que foi feito.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Renderizar o vídeo de destaque da ferramenta (`tool.video_url`/`video_poster_url`) como um slot na galeria do produto, estilo Mercado Livre, sem quebrar produtos sem vídeo.

**Architecture:** Generalizar a galeria de `string[]` para slots tipados (`image | video`). A lógica de montagem dos slots vira uma função pura (`buildSlots`) testável em isolamento. O thumb do vídeo usa o poster via `next/image` (exige whitelist do bucket); o slot grande troca o `InnerImageZoom` por um `<video controls>` nativo quando o vídeo está ativo. O wiring na página deriva a prop `video` de `detail.tool` e já é definitivo (compila com o #139). A leitura do `video_url` pela query (`catalog.ts`, dashboard-owned) é destravada por issue no repo dashboard.

**Tech Stack:** Next.js 16 (App Router, React 19, React Compiler), TypeScript, Vitest (env `node`), Biome/Ultracite, lucide-react, react-inner-image-zoom.

## Global Constraints

- **Spec de referência:** `docs/superpowers/specs/2026-06-17-video-galeria-produto-design.md`.
- **Branch de trabalho:** `feat/137-video-galeria-produto` (já criada, já com o #139 incorporado).
- **`catalog.ts` é dashboard-owned (ADR-0009)** — NÃO editar o SELECT de `getToolBySlug` neste repo.
- **Sem `console.*`** em produção; sem `: any`/`as any`/`@ts-ignore`/`@ts-expect-error`.
- **Sem `key={index}`** em `.map()` sem justificativa `biome-ignore`.
- **`<img>` puro proibido** — imagens via `next/image`/`ProductImage`.
- **Sem `React.forwardRef`, sem `useMemo`/`useCallback` manuais** (React 19 + React Compiler).
- **Verificação de UI exige smoke visual real** — `bun check-types` verde ≠ UI funcionando.
- **Rodar testes:** `bun run --filter=web test <path>`. Type-check: `bun check-types`.
- **Commits:** Conventional Commits em PT, subject ≤50 chars.
- **Bucket do Supabase:** host `wrxohbzepoyscsacjzvd.supabase.co`, bucket público `tool-videos`.

---

### Task 1: Whitelist do bucket `tool-videos` no `next.config.ts`

Sem teste unitário natural (config do Next). Verificação por type-check; o efeito real é observado no smoke da Task 4.

**Files:**
- Modify: `apps/web/next.config.ts:19-30` (array `images.remotePatterns`)

**Interfaces:**
- Consumes: nada.
- Produces: permite que `<ProductImage src="https://…/tool-videos/…">` (next/image) resolva o poster sem erro de host não-configurado.

- [ ] **Step 1: Adicionar o remotePattern**

Em `apps/web/next.config.ts`, dentro de `images.remotePatterns`, após o bloco `banner-images`, adicionar:

```ts
			{
				protocol: "https",
				hostname: "wrxohbzepoyscsacjzvd.supabase.co",
				pathname: "/storage/v1/object/public/tool-videos/**",
			},
```

O array final fica com 3 patterns: `tool-images`, `banner-images`, `tool-videos`.

- [ ] **Step 2: Type-check**

Run: `bun check-types`
Expected: PASS (sem novos erros).

- [ ] **Step 3: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "feat: whitelist bucket tool-videos no next/image (#137)"
```

---

### Task 2: Função pura `buildSlots` + tipo `GallerySlot` (TDD)

Extrai a montagem dos slots da galeria para um módulo puro (sem `"use client"`, sem imports de UI) — testável no env `node` do vitest. Esta é a única lógica com cobertura automatizada.

**Files:**
- Create: `apps/web/src/app/(shop)/product/[slug]/_components/gallery-slots.ts`
- Test: `apps/web/src/app/(shop)/product/[slug]/_components/gallery-slots.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `type GallerySlot = { kind: "image"; url: string } | { kind: "video"; url: string; poster: string | null }`
  - `function buildSlots(images: { url: string }[], video: { url: string; poster: string | null } | null | undefined): GallerySlot[]`

- [ ] **Step 1: Escrever o teste que falha**

Criar `apps/web/src/app/(shop)/product/[slug]/_components/gallery-slots.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildSlots } from "./gallery-slots";

const imgs = [{ url: "a.jpg" }, { url: "b.jpg" }, { url: "c.jpg" }];

describe("buildSlots", () => {
	it("sem vídeo retorna só imagens na mesma ordem", () => {
		expect(buildSlots(imgs, null)).toEqual([
			{ kind: "image", url: "a.jpg" },
			{ kind: "image", url: "b.jpg" },
			{ kind: "image", url: "c.jpg" },
		]);
	});

	it("trata video undefined igual a null", () => {
		expect(buildSlots(imgs, undefined)).toEqual([
			{ kind: "image", url: "a.jpg" },
			{ kind: "image", url: "b.jpg" },
			{ kind: "image", url: "c.jpg" },
		]);
	});

	it("insere o vídeo logo após a 1ª imagem", () => {
		expect(buildSlots(imgs, { url: "v.mp4", poster: "p.jpg" })).toEqual([
			{ kind: "image", url: "a.jpg" },
			{ kind: "video", url: "v.mp4", poster: "p.jpg" },
			{ kind: "image", url: "b.jpg" },
			{ kind: "image", url: "c.jpg" },
		]);
	});

	it("vídeo sem nenhuma imagem é o único slot", () => {
		expect(buildSlots([], { url: "v.mp4", poster: "p.jpg" })).toEqual([
			{ kind: "video", url: "v.mp4", poster: "p.jpg" },
		]);
	});

	it("sem imagens e sem vídeo retorna lista vazia", () => {
		expect(buildSlots([], null)).toEqual([]);
	});

	it("preserva poster null no slot de vídeo", () => {
		expect(buildSlots(imgs, { url: "v.mp4", poster: null })).toEqual([
			{ kind: "image", url: "a.jpg" },
			{ kind: "video", url: "v.mp4", poster: null },
			{ kind: "image", url: "b.jpg" },
			{ kind: "image", url: "c.jpg" },
		]);
	});
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `bun run --filter=web test src/app/\(shop\)/product/\[slug\]/_components/gallery-slots.test.ts`
Expected: FAIL — `Failed to resolve import "./gallery-slots"` (módulo ainda não existe).

- [ ] **Step 3: Implementar o módulo**

Criar `apps/web/src/app/(shop)/product/[slug]/_components/gallery-slots.ts`:

```ts
export type GallerySlot =
	| { kind: "image"; url: string }
	| { kind: "video"; url: string; poster: string | null };

export function buildSlots(
	images: { url: string }[],
	video: { url: string; poster: string | null } | null | undefined
): GallerySlot[] {
	const imageSlots: GallerySlot[] = images.map((i) => ({
		kind: "image",
		url: i.url,
	}));

	if (!video) {
		return imageSlots;
	}

	const videoSlot: GallerySlot = {
		kind: "video",
		url: video.url,
		poster: video.poster,
	};

	if (imageSlots.length === 0) {
		return [videoSlot];
	}

	return [imageSlots[0], videoSlot, ...imageSlots.slice(1)];
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

Run: `bun run --filter=web test src/app/\(shop\)/product/\[slug\]/_components/gallery-slots.test.ts`
Expected: PASS — 6 testes verdes.

- [ ] **Step 5: Type-check**

Run: `bun check-types`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add "apps/web/src/app/(shop)/product/[slug]/_components/gallery-slots.ts" "apps/web/src/app/(shop)/product/[slug]/_components/gallery-slots.test.ts"
git commit -m "feat: buildSlots para slots tipados da galeria (#137)"
```

---

### Task 3: Galeria consome slots tipados (thumb de vídeo + player)

Refatora `product-gallery.tsx` para usar `buildSlots`/`GallerySlot`, renderizar o thumb do vídeo (poster + ícone ▶) e trocar o slot grande por `<video>` quando o vídeo está ativo. Sem teste unitário (env `node`, sem render-testing) — verificação por type-check + smoke na Task 4.

**Files:**
- Modify: `apps/web/src/app/(shop)/product/[slug]/_components/product-gallery.tsx`

**Interfaces:**
- Consumes: `buildSlots`, `GallerySlot` de `./gallery-slots` (Task 2); `ProductImage` de `@/components/product-image`; `Play` de `lucide-react`.
- Produces: `ProductGallery` passa a aceitar a prop opcional `video?: { url: string; poster: string | null } | null` (consumida pela Task 4).

- [ ] **Step 1: Atualizar imports e a interface de props**

No topo de `product-gallery.tsx`, adicionar aos imports existentes:

```ts
import { Play } from "lucide-react";
import { buildSlots, type GallerySlot } from "./gallery-slots";
```

Atualizar a interface (adiciona `video`):

```ts
interface ProductGalleryProps {
	categorySlug: string;
	images: { url: string }[];
	name: string;
	video?: { url: string; poster: string | null } | null;
}
```

- [ ] **Step 2: Reescrever `ThumbButton` para discriminar imagem/vídeo**

Substituir a interface `ThumbButtonProps` e a função `ThumbButton` inteiras por:

```tsx
interface ThumbButtonProps {
	categorySlug: string;
	index: number;
	isActive: boolean;
	name: string;
	onClick: () => void;
	slot: GallerySlot;
}

function ThumbButton({
	categorySlug,
	index,
	isActive,
	name,
	onClick,
	slot,
}: ThumbButtonProps) {
	const isVideo = slot.kind === "video";
	const thumbSrc = slot.kind === "video" ? (slot.poster ?? undefined) : slot.url;
	const label = isVideo ? `${name} — vídeo` : `${name} — imagem ${index + 1}`;

	return (
		<button
			aria-label={label}
			className={cn(
				"relative aspect-square w-full cursor-pointer overflow-hidden border-2 bg-image-bg",
				isActive ? "border-emach-red" : "border-transparent"
			)}
			onClick={onClick}
			type="button"
		>
			<ProductImage
				alt={label}
				categorySlug={categorySlug}
				sizes="80px"
				src={thumbSrc}
			/>
			{isVideo && (
				<span
					aria-hidden="true"
					className="absolute inset-0 flex items-center justify-center bg-black/30"
				>
					<Play className="size-6 fill-white text-white drop-shadow" />
				</span>
			)}
		</button>
	);
}
```

- [ ] **Step 3: Trocar a montagem dos slots e o `renderThumb` no componente**

Dentro de `ProductGallery`, substituir:

```ts
	const slots = images.length > 0 ? images.map((i) => i.url) : [undefined];
	const [activeThumb, setActiveThumb] = useState(0);
	const activeSrc = slots[activeThumb] ?? slots[0];
	const needsCarousel = slots.length > MAX_STATIC_THUMBS;

	const renderThumb = (src: string | undefined, i: number) => (
		<ThumbButton
			categorySlug={categorySlug}
			index={i}
			isActive={activeThumb === i}
			key={src ?? i}
			name={name}
			onClick={() => setActiveThumb(i)}
			src={src}
		/>
	);
```

por:

```ts
	const slots = buildSlots(images, video);
	const [activeThumb, setActiveThumb] = useState(0);
	const activeSlot = slots[activeThumb] ?? slots[0];
	const needsCarousel = slots.length > MAX_STATIC_THUMBS;

	const renderThumb = (slot: GallerySlot, i: number) => (
		<ThumbButton
			categorySlug={categorySlug}
			index={i}
			isActive={activeThumb === i}
			key={slot.kind === "video" ? `video-${slot.url}` : slot.url}
			name={name}
			onClick={() => setActiveThumb(i)}
			slot={slot}
		/>
	);
```

- [ ] **Step 4: Atualizar as três chamadas de `renderThumb` (mobile, carrossel, desktop estático)**

As chamadas mudam de `renderThumb(src, i)` para `renderThumb(slot, i)`. Substituir os três `.map`:

Mobile (grid horizontal):
```tsx
						{slots.map((slot, i) => renderThumb(slot, i))}
```

Carrossel (vertical):
```tsx
									{slots.map((slot, i) => (
										<CarouselItem
											className="basis-1/5 pt-2"
											key={slot.kind === "video" ? `video-${slot.url}` : slot.url}
										>
											{renderThumb(slot, i)}
										</CarouselItem>
									))}
```

Desktop estático:
```tsx
								{slots.map((slot, i) => renderThumb(slot, i))}
```

- [ ] **Step 5: Trocar o slot grande para renderizar vídeo ou imagem**

Substituir o bloco do slot principal:

```tsx
					{activeSrc ? (
						<InnerImageZoom
							imgAttributes={{ alt: name }}
							src={activeSrc}
							zoomScale={1}
							zoomSrc={activeSrc}
						/>
					) : (
						<ProductImage alt={name} categorySlug={categorySlug} priority />
					)}
```

por:

```tsx
					{renderMainSlot()}
```

E adicionar, dentro do componente `ProductGallery` (antes do `return`), o helper `renderMainSlot`:

```tsx
	const renderMainSlot = () => {
		if (!activeSlot) {
			return <ProductImage alt={name} categorySlug={categorySlug} priority />;
		}
		if (activeSlot.kind === "video") {
			return (
				// biome-ignore lint/a11y/useMediaCaption: vídeo de produto sem legendas (v1 lean, issue #137)
				<video
					className="h-full w-full bg-image-bg object-contain"
					controls
					poster={activeSlot.poster ?? undefined}
					preload="metadata"
					src={activeSlot.url}
				/>
			);
		}
		return (
			<InnerImageZoom
				imgAttributes={{ alt: name }}
				src={activeSlot.url}
				zoomScale={1}
				zoomSrc={activeSlot.url}
			/>
		);
	};
```

- [ ] **Step 6: Type-check e lint**

Run: `bun check-types`
Expected: PASS.

Run: `bun check`
Expected: PASS (o `biome-ignore` cobre o `useMediaCaption` do `<video>`). Se acusar `noArrayIndexKey` em algum `.map`, confirmar que todas as keys usam `slot.url`, não `i`.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(shop)/product/[slug]/_components/product-gallery.tsx"
git commit -m "feat: renderiza slot de vídeo na galeria do produto (#137)"
```

---

### Task 4: Wiring na página + smoke visual

Deriva a prop `video` de `detail.tool` e passa ao `<ProductGallery>`. Verificação por smoke visual com mock temporário (o SELECT da query ainda não traz o dado — Task 5).

**Files:**
- Modify: `apps/web/src/app/(shop)/product/[slug]/page.tsx:95-109`

**Interfaces:**
- Consumes: `detail.tool.videoUrl`, `detail.tool.videoPosterUrl` (type `Tool`, disponíveis após o #139); prop `video` do `ProductGallery` (Task 3).
- Produces: nada (folha da feature neste repo).

- [ ] **Step 1: Derivar `video` no componente da página**

Em `page.tsx`, junto das outras derivações (após `const pathname = …`), adicionar:

```ts
	const video = detail.tool.videoUrl
		? { url: detail.tool.videoUrl, poster: detail.tool.videoPosterUrl ?? null }
		: null;
```

- [ ] **Step 2: Passar a prop ao `ProductGallery`**

Atualizar a chamada:

```tsx
				<ProductGallery
					categorySlug={primaryCategorySlug ?? ""}
					images={detail.images}
					name={detail.tool.name}
					video={video}
				/>
```

- [ ] **Step 3: Type-check**

Run: `bun check-types`
Expected: PASS (`detail.tool.videoUrl` existe no type `Tool` após o #139).

- [ ] **Step 4: Smoke visual com mock temporário**

Como o SELECT de `getToolBySlug` ainda não traz `video_url`, `video` será `null` em runtime. Para validar a UI, forçar um mock TEMPORÁRIO na chamada (substituir `video={video}` por):

```tsx
					video={{ url: "https://www.w3schools.com/html/mov_bbb.mp4", poster: null }}
```

(O `<video>` nativo não depende do whitelist; `poster: null` cai no placeholder de categoria no thumb, então o smoke não exige o bucket.)

Rodar e visitar:
```bash
bun dev:web
```
Abrir `/product/<slug-de-qualquer-produto-com-imagens>` e confirmar visualmente:
1. O thumb de vídeo aparece **logo após a 1ª imagem** (índice 1), com overlay escuro + ícone ▶.
2. O slot grande abre na **1ª imagem** (não no vídeo) ao carregar.
3. Clicar no thumb de vídeo troca o slot grande para o `<video controls>` (sem zoom); dá play.
4. Clicar de volta numa imagem volta o `InnerImageZoom`.
5. Mobile (viewport estreito): o thumb de vídeo aparece no grid horizontal.

Capturar/inspecionar a rota (ex.: `agent-browser` ou claude-in-chrome) — não declarar "feito" sem ver a UI.

- [ ] **Step 5: Reverter o mock**

Desfazer o Step 4: voltar a prop para `video={video}`. Confirmar que sem o mock a galeria fica idêntica à atual (sem thumb de vídeo) — caso sem-vídeo (maioria).

- [ ] **Step 6: Type-check final**

Run: `bun check-types`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add "apps/web/src/app/(shop)/product/[slug]/page.tsx"
git commit -m "feat: passa video de destaque a ProductGallery (#137)"
```

---

### Task 5: Issue no dashboard para o SELECT de `getToolBySlug`

_Nota 2026-09-28: o SELECT já chegou por sync (#141) e `catalog.ts` não existe mais; `getToolBySlug` está em `packages/db/src/queries/tools.ts`. Se a issue foi aberta no dashboard: não verificado._

Destrava a leitura do `video_url`/`video_poster_url` pela query. `catalog.ts` é dashboard-owned (ADR-0009) — a mudança começa no dashboard e chega via sync. Não é código neste repo.

**Files:** nenhum (handoff cross-repo).

**Interfaces:**
- Consumes: nada.
- Produces: issue rastreável no `othavioquiliao/emach-dashboard`.

- [ ] **Step 1: Conferir que não há issue equivalente aberta**

Run:
```bash
gh issue list --repo othavioquiliao/emach-dashboard --state open --search "catalog video getToolBySlug"
```
Expected: nenhuma issue cobrindo o SELECT de vídeo (verificado em 2026-06-17; reconfirmar antes de criar).

- [ ] **Step 2: Criar a issue**

```bash
gh issue create --repo othavioquiliao/emach-dashboard \
  --title "db(catalog): trazer video_url/video_poster_url no SELECT de getToolBySlug" \
  --body "## Contexto

O #139 sincronizou as colunas \`tool.video_url\`/\`tool.video_poster_url\` (schema), mas o SELECT de \`getToolBySlug\` em \`packages/db/src/queries/catalog.ts\` lista colunas explícitas e **não** inclui os campos de vídeo. Resultado: no ecommerce \`detail.tool.videoUrl\` compila (type) mas vem \`undefined\` em runtime, então o vídeo de destaque nunca renderiza.

## O que fazer (no dashboard, fonte de verdade)

Adicionar ao SELECT de \`getToolBySlug\`:

\`\`\`sql
t.video_url AS \"videoUrl\",
t.video_poster_url AS \"videoPosterUrl\",
\`\`\`

Chega ao ecommerce pelo próximo PR de sync (ADR-0009).

## Relacionado

- emach-ecommerce #137 (render do vídeo na galeria — já implementado, aguardando este campo)."
```

- [ ] **Step 3: Anotar o número da issue criada**

Registrar o número retornado para referência no PR do #137 (ex.: "Bloqueio residual rastreado em dashboard#NNN").

---

## Self-Review

**1. Spec coverage:**
- Whitelist `tool-videos` → Task 1. ✓
- Render `<video controls poster src>` quando há `video_url` → Tasks 2–4. ✓
- Vídeo como slot estilo ML, após a 1ª imagem, capa nunca é o vídeo → Task 2 (`buildSlots`) + Task 3 (`activeThumb=0`). ✓
- Caso sem vídeo não quebra layout → Task 2 (`!video` retorna só imagens) + Task 4 Step 5 (verificação). ✓
- Edge: vídeo sem poster → Task 3 (`poster ?? undefined`, placeholder no thumb). ✓
- Edge: vídeo sem imagens → Task 2 (`[videoSlot]`). ✓
- MP4/WebM player nativo, sem transcoding → Task 3 (`<video>` nativo). ✓
- Dependência SELECT (dashboard-owned) → Task 5. ✓
- Verificação smoke visual → Task 4. ✓

**2. Placeholder scan:** nenhum TBD/TODO; todo passo tem código/comando concreto. ✓

**3. Type consistency:** `GallerySlot` e a assinatura de `buildSlots` (Task 2) batem com o uso em `product-gallery.tsx` (Task 3) e com o shape de `video` derivado na `page.tsx` (Task 4: `{ url; poster: string | null }`). `activeSlot`/`slot` discriminados por `kind` de forma consistente. ✓

## Ordem e dependências

Task 1 e Task 2 são independentes. Task 3 depende da 2. Task 4 depende da 3. Task 5 é independente (pode ser feita a qualquer momento). Ordem recomendada: 1 → 2 → 3 → 4 → 5.
