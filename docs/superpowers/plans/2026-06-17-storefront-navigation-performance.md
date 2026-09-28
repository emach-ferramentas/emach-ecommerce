# Storefront Navigation Performance Implementation Plan

> **Status em 2026-09-28:** parcial. Entraram em #145 (e #146 para o `srcSet` da imagem do PDP): `cacheComponents` em `apps/web/next.config.ts`, guarda sob Suspense (`app/dashboard/_components/dashboard-chrome.tsx`, `app/checkout/page.tsx`, `app/(shop)/pedidos/[number]/page.tsx`), home e `/sobre` com `use cache`, PDP com shell cacheado (`lib/product-detail.ts`) e reviews dinâmicas, grids em CSS, `LazyMotion`, `BranchMap` lazy e fontes enxutas. Não entraram: a Task 10 (`SiteHeader` segue importado página a página) e o `lib/catalog-cache.ts` da Task 6, que não existe.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make storefront navigation faster — cacheable product pages, lighter client bundle on the hottest routes, smoother page transitions — by adopting Next 16 Cache Components and trimming JS, without breaking the P0 auth guard.

**Architecture:** Enable Next 16 `cacheComponents` (the PPR successor) app-wide. Static/cached shells prerender; runtime-data subtrees (session, review pagination, catalog filters, order pages, checkout success) move into `Suspense` boundaries. The product page — currently dynamic only because it reads `searchParams` for reviews — becomes a cached shell with a dynamic reviews hole. In parallel, trim `framer-motion` from the home/catalog First-Load, move `SiteHeader` into the shop layout, and lazy-load the below-the-fold branch map.

**Tech Stack:** Next.js 16.2 (App Router, Turbopack, React Compiler), React 19, Drizzle, Better Auth (ecommerce instance), framer-motion 12, Tailwind v4, Vitest.

> **Changelog v2 (adversarial review incorporated):** added generateStaticParams for `/product/[slug]` (F1) and `/pedidos/[number]`; concrete tasks for `/pedidos/[number]` (F2) and `/checkout/success` (F3); mandatory guard-test hardening (F4); removed framer-motion from `optimizePackageImports` (F5); index-driven CSS stagger for grids >4 items (F6); realistic catalog metadata handling (F7); `use cache` for `BranchMapSection` (F9); **dedup of `getToolBySlug` via a local app wrapper, NOT by editing `packages/db` (dashboard-owned/synced)** (R2 + ownership rule); product cache window aligned to the home (600s) with a price-staleness note (R1); Lighthouse baseline moved to Task 0 (R4).

## Global Constraints

- **Auth P0 invariants (CLAUDE.md):** `apps/web` uses only the `ecommerce` Better Auth instance. The `/dashboard` guard is 2-layer: `proxy.ts` checks cookie existence at the edge; the area `layout.tsx` validates the real session via `requireCurrentClient()`. Both layers stay. Any authenticated area outside `/dashboard` needs its own `requireCurrentClient()`. Routes that read session but live outside `/dashboard` (`/checkout`, `/pedidos/[number]`) already guard inline — keep that.

_Nota 2026-09-28: a validação da sessão hoje mora no `DashboardChrome` sob Suspense, não no `layout.tsx` (ver Task 2); `app/dashboard/layout.guard.test.ts` checa essa chamada._
- **Guard tests must stay green AND be hardened:** `app/dashboard/layout.guard.test.ts` currently reads `layout.tsx` source and asserts `.toContain("requireCurrentClient")`; `lib/session.test.ts` unit-tests the function. **Do not modify `lib/session.ts`.** When the guard call moves into a child component, the guard test MUST be updated to assert the real `await requireCurrentClient()` call in that child (not a string in a comment) — this is mandatory, not optional (F4).
- **Schema/query ownership (CLAUDE.md, ADR-0009):** `packages/db/src/{schema,queries,sql/triggers.sql}` is **owned-by-dashboard and synced into this repo via CI PR**. **Do NOT edit `packages/db/src/queries/catalog.ts` here** — any edit is overwritten on the next sync. The `getToolBySlug` dedup (#2) lives in a NEW local wrapper under `apps/web/src/lib`, not in the query module (R2).
- **No banned anti-patterns (CLAUDE.md):** no `console.*` (use `log` from `@/lib/evlog`), no `: any`/`as any`/`@ts-ignore`/`@ts-expect-error`, no `key={index}`, no `<img>` (use `next/image`), no `useMemo`/`useCallback` (React Compiler on), no barrel files, no `React.forwardRef`.
- **Cache Components rules:**
  - `cookies()`/`headers()`/`searchParams`/dynamic-route `params` are forbidden inside `use cache`. Pass them as arguments, or keep them in a `Suspense`-wrapped dynamic subtree.
  - A dynamic route (`[slug]`, `[number]`) that reads `params` at the page top-level under `cacheComponents` needs `generateStaticParams()` returning ≥1 entry, OR must resolve `params` inside a `Suspense` child (`params.then(...)`). Reading `await params` at the top of a cached/prerendered page without either is a build error (F1).
  - Module-level `'use cache'` or in-body `'use cache'` + `cacheLife(...)` replaces `export const revalidate`.
  - `Math.random()`/`Date.now()`/`new Date()` inside `use cache` execute once at cache-generation time (frozen until revalidation).
- **Price/stock freshness:** caching the PDP/catalog means dashboard-side price/promo/stock edits can be stale up to the cache window. There is **no `revalidateTag` hook** wired from the dashboard today (cross-repo, ADR-0009). Aggregate stock is re-validated at checkout (ADR-0003), so stale stock on the PDP is safe; **stale price is a business call** — this plan uses a 600s window (same as the home, which already caches product prices) to bound it. Adding active invalidation is out of scope (would start as a dashboard issue).
- **Verification per task:** `bun run --filter=web build` must succeed. After each cache task, confirm the target route's prerender status in the build output (cached/PPR, not pure `ƒ Dynamic`). Run `bun run --filter=web test` for tasks touching tested code. `bun check-types` before every commit.
- **Commits:** Conventional Commits in PT, subject ≤50 chars.
- **Subagent dispatch rule (CLAUDE.md):** any implementer prompt must include: "Read cada arquivo antes de Edit; se Edit falhar com `string not found`, re-Read antes de re-tentar; rode `bun check-types` antes de commit."

---

## File Structure

**New files:**
- `apps/web/src/app/dashboard/_components/dashboard-chrome.tsx` — async component: session guard (`await requireCurrentClient()`) + sidebar, rendered inside the layout `Suspense`.
- `apps/web/src/app/dashboard/_components/dashboard-chrome-skeleton.tsx` — fallback for the chrome `Suspense`.
- `apps/web/src/lib/product-detail.ts` — local wrapper: `getProductDetail(slug)` = React `cache()` around `getToolBySlug(db, slug)`, plus `getProductShell(slug)` = `'use cache'` variant for the page shell. **Lives in the app, not `packages/db`** (ownership).
- `apps/web/src/app/(shop)/product/[slug]/_components/product-reviews-section.tsx` — async component reading `searchParams`, rendered inside `Suspense` on the product page.
- `apps/web/src/lib/catalog-cache.ts` — `use cache` read helpers with no runtime args (category tree, home category images).
- CSS additions in `apps/web/src/index.css` (or a colocated stylesheet) — index-driven stagger reveal replacing framer-motion in the grids.

**Modified files (by task):** `next.config.ts`, `sitemap.ts`, `(shop)/page.tsx`, `(shop)/product/[slug]/page.tsx`, `(shop)/catalog/page.tsx`, `(shop)/checkout/success/page.tsx`, `(shop)/pedidos/[number]/page.tsx`, `dashboard/layout.tsx`, `dashboard/layout.guard.test.ts`, `checkout/layout.tsx`/`checkout/page.tsx`, `components/{category-grid,product-grid,hero-carousel,branch-map-section,site-header}.tsx`, `app/login/_components/login-brand-panel.tsx`, `app/(shop)/layout.tsx`, `app/layout.tsx`.

---

## Phase 0 — Baseline

### Task 0: Capture baseline metrics (build, bundle, Lighthouse)

**Files:** none (measurement only). **Do this BEFORE Task 1 — Phase 1 leaves the build broken mid-way, so the only clean baseline is now.**

- [ ] **Step 1: Build + record route types** — `bun run --filter=web build 2>&1 | tee /tmp/perf-baseline-build.txt`. Note `○ Static` vs `ƒ Dynamic` per route.

- [ ] **Step 2: Bundle baseline** —
```bash
python3 - <<'PY'
import os, glob
os.chdir('apps/web/.next')
total=sum(os.path.getsize(f) for f in glob.glob('static/chunks/*.js'))
print(f"total chunks: {total/1024:.0f} kB")
for f in sorted(glob.glob('static/chunks/*.js'), key=os.path.getsize, reverse=True)[:8]:
    print(f"{os.path.getsize(f)/1024:8.0f} kB  {os.path.basename(f)}")
PY
```
Save numbers (baseline ~3.1 MB, largest ~324 kB) for the PR.

- [ ] **Step 3: Lighthouse baseline (R4)** — `bun run --filter=web start` (serves the current prod build on 3001). Run Lighthouse (mobile preset, throttled) against `/`, `/catalog`, and one `/product/<slug>`. Record LCP, INP/TBT, CLS, Total JS into `/tmp/perf-baseline-lh.md`. This is the only chance to capture pre-change CWV; without it Phase 3 can only quantify build/bundle deltas.

---

## Phase 1 — Cache Components (keystone, highest risk)

> Do Phase 1 tasks **in order**. Task 1 flips the global flag and the build WILL fail until every runtime-API route is wrapped. Per the adversarial review, the failing routes are: `/` , `/catalog`, `/product/[slug]`, `/checkout`, `/checkout/success`, `/dashboard/*`, and `/pedidos/[number]`. Tasks 2–6 fix each.

### Task 1: Enable cacheComponents + migrate sitemap

**Files:** Modify `apps/web/next.config.ts`, `apps/web/src/app/sitemap.ts`.

- [ ] **Step 1: Flag + package-import optimization (F5, F10, F11)**

`cacheComponents` is a **top-level** config key (NOT inside `experimental`). **Merge** into the existing `experimental` block — do not create a second one (it would drop `appNewScrollHandler`). Do NOT add `framer-motion` to `optimizePackageImports` (it undercuts the `LazyMotion` work in Tasks 8–9 and `lucide-react` is already optimized by Next's defaults; keep it explicit for clarity only):
```ts
const nextConfig: NextConfig = {
  typedRoutes: true,
  reactCompiler: true,
  cacheComponents: true, // top-level
  experimental: {
    appNewScrollHandler: true,
    optimizePackageImports: ["lucide-react"],
  },
  turbopack: { root: path.join(import.meta.dirname, "../..") },
  images: { /* unchanged */ },
};
```

- [ ] **Step 2: Migrate sitemap (R5)** — remove `export const revalidate = 86_400;`. Add `'use cache'` + `cacheLife({ revalidate: 86_400 })` to the data path. Note in a comment: `new Date()` for `lastModified` is frozen at cache-generation time (refreshes every ~24h) — acceptable for a sitemap.

- [ ] **Step 3: Build to surface the dynamic-route errors** — `bun run --filter=web build 2>&1 | tail -50`. Expected: errors on the 7 routes listed above ("used `headers`/`searchParams`/`params` ... without a Suspense boundary"). This is the worklist for Tasks 2–6.

- [ ] **Step 4: Commit** — `git add apps/web/next.config.ts apps/web/src/app/sitemap.ts && git commit -m "feat: habilita cacheComponents (Next 16 PPR)"`

### Task 2: P0 auth guard into Suspense (dashboard + checkout) + harden the test

**Files:** Create `dashboard/_components/dashboard-chrome.tsx`, `dashboard/_components/dashboard-chrome-skeleton.tsx`; Modify `dashboard/layout.tsx`, `dashboard/layout.guard.test.ts`, `checkout/layout.tsx` (+`checkout/page.tsx` if needed).

**Interfaces:** Consumes `requireCurrentClient()` (unchanged). Produces `DashboardChrome` running the guard *inside* the boundary, `{children}` rendered only after the guard resolves.

- [ ] **Step 1: Green baseline** — `bun run --filter=web test src/app/dashboard/layout.guard.test.ts src/lib/session.test.ts` → PASS.

- [ ] **Step 2: Skeleton fallback** — `dashboard-chrome-skeleton.tsx`, a static sidebar+content frame (no data) so the shell prerenders:
```tsx
export function DashboardChromeSkeleton() {
  return (
    <main className="grid h-[calc(100vh-3.5rem)] w-full grid-cols-1 md:grid-cols-[260px_1fr]">
      <div className="hidden bg-near-black md:block" />
      <div className="flex min-w-0 flex-col overflow-y-auto" />
    </main>
  );
}
```

- [ ] **Step 3: `DashboardChrome` (guard + sidebar)** —
```tsx
import { requireCurrentClient } from "@/lib/session";
import { DashboardNavMobile } from "./dashboard-nav-mobile";
import { DashboardSidebar } from "./dashboard-sidebar";

export async function DashboardChrome({ children }: { children: React.ReactNode }) {
  const session = await requireCurrentClient();
  return (
    <main className="grid h-[calc(100vh-3.5rem)] w-full grid-cols-1 md:grid-cols-[260px_1fr]">
      <DashboardSidebar userEmail={session.user.email} userImage={session.user.image} userName={session.user.name} />
      <div className="flex min-w-0 flex-col overflow-y-auto">
        <DashboardNavMobile />
        <div className="min-w-0">{children}</div>
      </div>
    </main>
  );
}
```

- [ ] **Step 4: Rewrite `dashboard/layout.tsx`** — static `SiteHeader` shell + `Suspense` around `DashboardChrome`:
```tsx
import { Suspense } from "react";
import { SiteHeader } from "@/components/site-header";
import { DashboardChrome } from "./_components/dashboard-chrome";
import { DashboardChromeSkeleton } from "./_components/dashboard-chrome-skeleton";
// ...metadata unchanged...
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<DashboardChromeSkeleton />}>
        <DashboardChrome>{children}</DashboardChrome>
      </Suspense>
    </>
  );
}
```

- [ ] **Step 5: HARDEN the guard test (F4 — mandatory)** — update `layout.guard.test.ts` so it asserts the REAL call in the chrome, not a string in the layout:
```ts
it("o chrome do dashboard chama requireCurrentClient de verdade", () => {
  const chrome = readFileSync(join(dashboardDir, "_components/dashboard-chrome.tsx"), "utf8");
  expect(chrome).toContain("await requireCurrentClient()");
});
```
Keep the existing `session.ts` assertions. The first test (layout `.toContain`) may stay as a weaker check or be repointed — but the new assertion is the real guarantee.

- [ ] **Step 6: Checkout** — read `checkout/layout.tsx` + `checkout/page.tsx`. `checkout/page.tsx` calls `requireCurrentClient()` at top. Wrap the session-reading content in a `Suspense` (mirror the dashboard pattern: a `CheckoutChrome` async child, or a `Suspense` around the page body), guard before any sensitive render.

- [ ] **Step 7: Build + tests** — build no longer errors on `/dashboard/*`, `/checkout`. `bun run --filter=web test src/app/dashboard/layout.guard.test.ts src/lib/session.test.ts` → PASS.

- [ ] **Step 8: Smoke the guard (manual, REQUIRED — P0)** — logged-out `/dashboard` → redirect to `/login`, only the skeleton flashes, never sidebar/data. Logged-in renders. Same for `/checkout`.

- [ ] **Step 9: Commit** — `refactor: guarda de sessao sob Suspense (cacheComponents)`

### Task 3: Remaining runtime-API routes — `/pedidos/[number]` + `/checkout/success`

_Nota 2026-09-28: `/pedidos/[number]` não recebeu `generateStaticParams`. A página lê `params` e a sessão só dentro de `OrderConfirmationContent`, sob Suspense, e usa metadata estática (`app/(shop)/pedidos/[number]/page.tsx`). O `checkout` mora em `app/checkout/`, fora de `(shop)`._

**Files:** Modify `(shop)/pedidos/[number]/page.tsx`, `(shop)/checkout/success/page.tsx`.

> Confirmed by review: `pedidos/[number]/page.tsx` reads BOTH `await params` AND `await requireCurrentClient()` at top-level (double violation: dynamic params + headers); `checkout/success/page.tsx` reads `await searchParams` at top-level. Both break the build after Task 1.

- [ ] **Step 1: `/pedidos/[number]` (F1 + F2)** — add `generateStaticParams` returning at least one placeholder so the dynamic route validates (real numbers resolve on-demand):
```ts
export function generateStaticParams() { return [{ number: "0" }]; }
```
Move the session-gated order fetch + render into an async child wrapped in `Suspense` (so `params`/`headers` live inside a boundary):
```tsx
export default function OrderConfirmationPage({ params }: { params: Promise<{ number: string }> }) {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<OrderConfirmationSkeleton />}>
        <OrderConfirmationContent params={params} />
      </Suspense>
    </>
  );
}
// OrderConfirmationContent: async, awaits params + requireCurrentClient(), then the existing query/render.
```
(Alternatively resolve `params` via `params.then(...)` — but the async-child form is consistent with the rest of the plan.)

- [ ] **Step 2: `/checkout/success` (F3)** — move the `searchParams` read + order display into an async child inside `Suspense`:
```tsx
export default function CheckoutSuccessPage({ searchParams }: SuccessPageProps) {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<CheckoutSuccessSkeleton />}>
        <CheckoutSuccessContent searchParams={searchParams} />
      </Suspense>
    </>
  );
}
// CheckoutSuccessContent: async, `const { order } = await searchParams;` then the existing markup.
```

- [ ] **Step 3: Build** — both routes prerender a shell, no runtime-API errors. **Smoke:** visit `/checkout/success?order=...` and a real `/pedidos/<number>` (logged in) → render correctly; logged-out `/pedidos/<number>` → redirect.

- [ ] **Step 4: Commit** — `fix: pedidos e checkout/success sob Suspense (cacheComponents)`

### Task 4: Home page → use cache (+ BranchMapSection cache, #6)

**Files:** Modify `(shop)/page.tsx`, `components/branch-map-section.tsx`; Create/Modify `lib/catalog-cache.ts`.

- [ ] **Step 1: Remove `export const revalidate = 600`.**

- [ ] **Step 2: Wrap the home data fetch in `use cache` + parallelize independent reads (#6)** — home reads no runtime APIs:
```ts
async function loadHome() {
  "use cache";
  cacheLife({ revalidate: 600 });
  const [rootCategories, featuredPromotion, recentTools, banners] = await Promise.all([
    getRootCategories(), getFeaturedPromotion(db), getRecentTools(db, 8), getActiveBanners(),
  ]);
  const [categoryImages, voltagesByTool] = await Promise.all([
    getCategoryImages(rootCategories.map((c) => c.slug)),
    getVoltagesByTool([...recentTools.map((t) => t.id), ...(featuredPromotion?.tools.map((t) => t.id) ?? [])]),
  ]);
  return { rootCategories, featuredPromotion, recentTools, banners, categoryImages, voltagesByTool };
}
```

- [ ] **Step 3: `BranchMapSection` must not block the cached home (F9)** — it is an async Server Component with its own `getActiveBranches()` query. Give it its OWN `'use cache'` so it can render inside the (cached) home without a Suspense hole and without being pulled into `loadHome`:
```tsx
export async function BranchMapSection() {
  "use cache";
  cacheLife({ revalidate: 600 });
  const branches = await getActiveBranches();
  // ...rest unchanged...
}
```
(`getActiveBranches` reads no runtime APIs — verify. If the build complains the home can't prerender around it, wrap `<BranchMapSection />` in `<Suspense>` in `page.tsx` instead.)

- [ ] **Step 4: Build → `/` cached.** `bun run --filter=web build 2>&1 | grep -E "^.*/\s"` confirm `/` is prerendered, not `ƒ`. **Smoke:** home renders all sections; visual unchanged.

- [ ] **Step 5: Commit** — `perf: home cacheada via use cache + reads paralelos`

### Task 5: Product → cached shell + dynamic reviews + dedup (local wrapper)

**Files:** Modify `(shop)/product/[slug]/page.tsx`; Create `lib/product-detail.ts`, `(shop)/product/[slug]/_components/product-reviews-section.tsx`. **Do NOT edit `packages/db/src/queries/catalog.ts` (R2/ownership).**

**Interfaces:** `getProductDetail(slug)` = React `cache(() => getToolBySlug(db, slug))` (per-request dedup for `generateMetadata` + page). `getProductShell(slug)` = `'use cache'` + `cacheLife({ revalidate: 600 })` wrapping `getProductDetail`. Product shell cached; reviews dynamic.

- [ ] **Step 1: Local dedup wrapper (#2, R2)** — `apps/web/src/lib/product-detail.ts`:
```ts
import { cache } from "react";
import { db } from "@emach/db";
import { getToolBySlug } from "@emach/db/queries/catalog";
import { cacheLife } from "next/cache";

export const getProductDetail = cache((slug: string) => getToolBySlug(db, slug));

export async function getProductShell(slug: string) {
  "use cache";
  cacheLife({ revalidate: 600 }); // align to home; price staleness bounded (see Global Constraints)
  return getProductDetail(slug);
}
```
`generateMetadata` switches to `getProductDetail(slug)`; the page uses `getProductShell(slug)`. (`cache()` is a no-op outside a request, so import-safety is fine; this module is app-only, never seeds/db-tests.)

- [ ] **Step 2: generateStaticParams (F1)** — add to `page.tsx` so the dynamic route validates under cacheComponents:
```ts
export function generateStaticParams() { return [{ slug: "_" }]; }
```
(Real slugs render on-demand and cache per `cacheTag`/`cacheLife`. Optionally populate from a `getAllActiveSlugs()` later to prebuild popular PDPs — out of scope now.)

- [ ] **Step 3: Page shell stops reading `searchParams`** — remove `export const revalidate = 3600`. `generateMetadata` keeps awaiting only `params`. Page body:
```tsx
export default async function ProductPage({ params, searchParams }: ProductPageProps) {
  const { slug } = await params;
  const detail = await getProductShell(slug);
  if (!detail) notFound(); // notFound() OUTSIDE the use cache fn — safe
  return (
    <>
      <ProductJsonLd detail={detail} />
      <SiteHeader />
      {/* gallery + info + specs + related — all from detail, NO searchParams */}
      {detail.reviewStats.total > 0 && (
        <Suspense fallback={<ReviewsSkeleton />}>
          <ProductReviewsSection toolId={detail.tool.id} slug={slug}
            reviewStats={detail.reviewStats} searchParams={searchParams} />
        </Suspense>
      )}
    </>
  );
}
```
`searchParams` is passed as a Promise into the Suspense child; the page never awaits it.

- [ ] **Step 4: `ProductReviewsSection` (dynamic, reads searchParams)** — moves `parseReviewPage`/`parseReviewSort` + `getReviews` + `<ProductReviews>` here. (F8: `ReviewSort` uses `useSearchParams` client-side; it is covered by THIS Suspense — confirm it renders under the boundary.) JSON-LD aggregate rating stays in the shell (`reviewStats`), so review SEO is preserved.

- [ ] **Step 5: Build → `/product/[slug]` PPR/cached, no searchParams error. Smoke:** product loads instantly; paginate/sort reviews (URL changes) → reviews update, shell stays; 0-review product → no Suspense child.

- [ ] **Step 6: Commit** — `perf: produto com shell cacheado + reviews dinamicas`

### Task 6: Catalog → cached category tree + Suspense list (realistic about metadata)

_Nota 2026-09-28: `lib/catalog-cache.ts` não existe. O cache ficou em `getCatalogData` (`app/(shop)/catalog/_lib/catalog-data.ts`, `use cache` de 600 s), que também busca a árvore de categorias; a lista streama por `CatalogResults` sob Suspense. A metadata de `/catalog` ficou estática (a opção da F7). Categoria ganhou rota própria em `/catalog/[cat]` (spec de SEO de 2026-09-01)._

**Files:** Modify `(shop)/catalog/page.tsx`, `lib/catalog-cache.ts`.

> F7: `generateMetadata` reads `searchParams` (cat, q). Under cacheComponents this keeps metadata dynamic and may keep `/catalog` as `ƒ`. That's acceptable — the catalog is inherently dynamic (filters). The win here is the cached category tree + a streamed list, not a fully static catalog.

- [ ] **Step 1: Cache `getCategoryTree`** in `catalog-cache.ts` — `'use cache'` + `cacheLife({ revalidate: 600 })` + `cacheTag("category-tree")` (no runtime args).

- [ ] **Step 2: Stream the filtered list** — render page chrome + cached category tree; move `getTools` + `getVoltagesByTool` + `CatalogContent` into an async child reading `searchParams`, wrapped in `Suspense` (fallback = existing catalog skeleton). Pass the cached tree in as a prop.

- [ ] **Step 3: Metadata mitigation (F7)** — if the build shows `/catalog` blocking on metadata, simplify `generateMetadata` to derive the title from `params`/a static default and drop the `q`-based title (or accept `ƒ` for `/catalog`; document the choice). Verify in build output which it is.

- [ ] **Step 4: Build → `/catalog` shell streams the list; category tree cached. Smoke:** filters (voltage/price/sort/search/pagination) update the list; chrome/tree instant.

- [ ] **Step 5: Commit** — `perf: catalogo com arvore cacheada + lista em Suspense`

### Task 7: Phase 1 verification gate

- [ ] Full build succeeds, no route errors. Record route types vs `/tmp/perf-baseline-build.txt` (`/`, `/product/[slug]` cached/PPR; `/dashboard/*`, `/checkout`, `/pedidos/[number]`, `/checkout/success` prerender a shell).
- [ ] Full test suite (`bun run --filter=web test`) — re-run flaky DB tests isolated before blaming a change (CLAUDE.md).
- [ ] `bun check-types` clean.

---

## Phase 2 — Bundle & transition polish (parallelizable after Phase 1 is stable)

### Task 8: Trim framer-motion from the grids (index-driven CSS, F6)

**Files:** Modify `components/category-grid.tsx`, `product-grid.tsx`; add CSS.

- [ ] **Step 1: Index-driven stagger** — `animation` (not `transition`, so it completes in background tabs — optimize.md), visible-safe resting state, capped delay so a 24-item catalog grid doesn't take ~1s:
```css
@keyframes emach-reveal { from { opacity: 0; transform: translateY(16px) scale(0.97); } to { opacity: 1; transform: none; } }
.emach-reveal-item { animation: emach-reveal 0.5s cubic-bezier(0.16,1,0.3,1) both; animation-delay: calc(min(var(--i, 0), 8) * 0.05s); }
@media (prefers-reduced-motion: reduce) { .emach-reveal-item { animation: none; } }
```

- [ ] **Step 2: `category-grid.tsx`** — drop `motion`/`Variants`/`useReducedMotion` framer imports; keep the JS auto-cycle (`useState`/`useEffect` — not framer); render plain `div` with `className="emach-reveal-item"` and `style={{ "--i": idx } as CSSProperties}`. (4 items — delay cap irrelevant but consistent.)

- [ ] **Step 3: `product-grid.tsx`** — same; pass `style={{ "--i": index }}` per card. This is the one with up to 24 items — the cap matters here.

- [ ] **Step 4: Build + bundle check** — framer chunk no longer loads for `/catalog`. **Smoke:** home categories + novidades + catalog animate in once; content visible with JS off / reduced-motion.

- [ ] **Step 5: Commit** — `perf: grids com reveal em CSS (sem framer-motion)`

### Task 9: Shrink framer-motion on hero/login via LazyMotion

**Files:** Modify `components/hero-carousel.tsx`, `app/login/_components/login-brand-panel.tsx`.

> Review confirmed: hero uses `animate` keyframes + MotionValues; login uses `AnimatePresence`. All covered by `domAnimation` — no need for `domMax`. (Re-confirm during execution by reading hero in full.)

- [ ] **Step 1:** Replace `motion.*`→`m.*`, wrap animated subtree in `<LazyMotion features={domAnimation} strict>`; import `m`/`LazyMotion`/`domAnimation` from `framer-motion`.
- [ ] **Step 2:** Same for `login-brand-panel.tsx`.
- [ ] **Step 3:** Build + bundle check (framer chunk shrinks); **smoke** hero transitions + login animation + reduced-motion.
- [ ] **Step 4: Commit** — `perf: framer-motion via LazyMotion no hero/login`

### Task 10: Move SiteHeader into the shop layout

_Nota 2026-09-28: abandonada. `perf-fase2-results.md` registra o motivo (o `overlay` da home dependeria de `usePathname` e o header inteiro viraria fallback de Suspense, saindo do HTML inicial). `SiteHeader` continua importado em cada página._

**Files:** Modify `(shop)/layout.tsx`; remove per-page `<SiteHeader>` from the `(shop)` pages.

- [ ] **Step 1:** Add a small client wrapper in the layout that reads `usePathname()` and passes `overlay={pathname === "/"}` (home-only overlay). Verify a client child using `usePathname` in the (server) shop layout doesn't force the whole route dynamic under cacheComponents — if it does, keep `usePathname` confined to the header wrapper (it's already `"use client"`), which is fine.
- [ ] **Step 2:** Remove `<SiteHeader .../>` from `(shop)/page.tsx`, `catalog/page.tsx`, `product/[slug]/page.tsx`, `cart/page.tsx`, `sobre/page.tsx`, `checkout/success/page.tsx`, `pedidos/[number]/page.tsx`. (`/dashboard` + standalone auth layouts keep their own header.)
- [ ] **Step 3:** Build + check-types. **Smoke:** home→catalog→product→cart; header persists (cart count stable, no flash); home overlay over hero; inner pages solid header.
- [ ] **Step 4: Commit** — `refactor: SiteHeader no layout da loja`

### Task 11: Lazy-load the below-the-fold branch map

**Files:** Modify `components/branch-map-section.tsx`.

- [ ] **Step 1:** Import `BranchMap` via `next/dynamic` (code-splits the client chunk; keep it in SSR HTML — do NOT use `ssr: false`):
```ts
import dynamic from "next/dynamic";
const BranchMap = dynamic(() => import("@/components/branch-map").then((m) => m.BranchMap));
```
(The section data already has `'use cache'` from Task 4 Step 3; only the client interactivity JS is deferred.)
- [ ] **Step 2:** Do NOT lazy-load `ProductGallery`/`InnerImageZoom` — it is the PDP LCP image.
- [ ] **Step 3:** Build + bundle check (branch-map chunk split out). **Smoke:** map renders, pins/auto-cycle work.
- [ ] **Step 4: Commit** — `perf: lazy-load do BranchMap (below-the-fold)`

### Task 12: Audit font weights

**Files:** Modify `app/layout.tsx`.

- [ ] **Step 1:** `grep -rEoh "font-(normal|medium|semibold|bold)|font-\[?(400|500|600|700)" apps/web/src packages/ui/src | sort | uniq -c`. Map to numeric weights per family.
- [ ] **Step 2:** Trim the `weight: [...]` arrays in `layout.tsx` to the used set. Drop a weight only if unused across `apps/web` AND `packages/ui`.
- [ ] **Step 3:** Build + **smoke** headings/labels on home + PDP — no weight regresses. Restore any that looks wrong.
- [ ] **Step 4: Commit** — `perf: enxuga pesos de fonte carregados`

---

## Phase 3 — Final measurement & verification

### Task 13: Measure after, verify no regressions

- [ ] Production build + `start`. Run Lighthouse (same preset as Task 0) on `/`, `/catalog`, a `/product/<slug>`; compare LCP/INP/CLS/JS to `/tmp/perf-baseline-lh.md`.
- [ ] Bundle delta (re-run Task 0 Step 2 script): total chunks + framer chunk before/after.
- [ ] Route-type delta vs `/tmp/perf-baseline-build.txt`.
- [ ] Full test + `check-types` green (re-run flaky DB tests isolated).
- [ ] **P0 re-smoke:** logged-out `/dashboard` + `/pedidos/<n>` → `/login`; logged-in renders; checkout guard holds.
- [ ] Write the before/after table into the PR description. Note the price-staleness window (600s, no active invalidation — Global Constraints). Hand off to `$impeccable polish` for any motion rough edges.

---

## Self-Review

**Diagnosis coverage (#1–#7):** #1 product cacheable → Tasks 1+5 (cacheComponents + cached shell + dynamic reviews + generateStaticParams). #2 dedup → Task 5 Step 1 (local React `cache()` wrapper, not `packages/db`). #3 framer → Tasks 8 (grids→CSS, index-driven) + 9 (LazyMotion). #4 SiteHeader → Task 10. #5 lazy-load → Task 11 (branch map; gallery excluded — LCP). #6 home Promise.all → Task 4 Step 2. #7 fonts → Task 12 (`optimizePackageImports` reduced to lucide-react in Task 1).

**Adversarial-review resolution:** F1 (generateStaticParams) → Tasks 3+5. F2 (`/pedidos`) → Task 3. F3 (`/checkout/success`) → Task 3. F4 (guard test) → Task 2 Step 5 (mandatory). F5 (framer in optimizePackageImports) → removed, Task 1. F6 (stagger cap) → Task 8. F7 (catalog metadata) → Task 6 Step 3. F8 (ReviewSort) → Task 5 Step 4 note. F9 (BranchMapSection) → Task 4 Step 3. F10/F11 (config clarity) → Task 1 Step 1. R1 (price staleness) → 600s window + Global Constraints note. R2 (packages/db ownership) → local wrapper (Task 5). R4 (Lighthouse baseline) → Task 0 Step 3. R5 (sitemap date) → Task 1 Step 2 note.

**Open items to verify during execution (don't assume):** `sitemap.ts` `use cache` form; `checkout/layout.tsx` current guard shape; `getActiveBranches` reads no runtime APIs (Task 4 Step 3); hero-carousel feature set re: `domAnimation`; whether the shop-layout `usePathname` header wrapper keeps routes prerenderable (Task 10 Step 1); whether `/catalog` metadata blocks PPR (Task 6 Step 3).

**Residual risk accepted:** no active cache invalidation from the dashboard (cross-repo) — price/promo stale up to 600s; documented and bounded to match the existing home behavior.
