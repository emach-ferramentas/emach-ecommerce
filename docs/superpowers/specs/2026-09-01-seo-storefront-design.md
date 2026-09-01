# SEO do storefront — canonical, dados estruturados, rotas de categoria e páginas institucionais

Data: 2026-09-01 · Status: aprovado em brainstorming (3 tracks, URL plana de categoria, sem troca/garantia)

## Problema

O storefront já tem a base de SEO montada (`metadataBase` + template de título, OG/Twitter default, `robots.ts`, `sitemap.ts` com cache de 24h, `Product` + `BreadcrumbList` JSON-LD na PDP, `generateStaticParams` nos produtos). O que falta está na arquitetura de URL e nos dados estruturados de site, não na tag individual:

1. **Nenhuma rota declara `alternates.canonical`.** `/catalog` aceita 8 query params (`cat`, `q`, `page`, `sort`, `voltage`, `pmin`, `pmax`, `promo`); cada combinação é uma URL indexável distinta com o mesmo conteúdo.
2. **Categoria não tem URL própria.** O alvo comercial ("furadeira de impacto profissional") vive em `/catalog?cat=furadeiras`, formato que o Google trata como parâmetro. O `sitemap.ts` submete essas URLs com query. A rota não consegue ter `generateMetadata` nem H1 por categoria: sob `cacheComponents`, ler `searchParams` em `generateMetadata` bloqueia o prerender do shell (comentário em `catalog/page.tsx`).
3. **Sem `Organization`, `WebSite` e `LocalBusiness`.** As filiais físicas (`lib/branches.ts`: endereço, telefone, horário) não aparecem como dado estruturado, então a busca local ("loja de ferramentas em [cidade]") não enxerga a EMACH.
4. **`Product` JSON-LD sem `itemCondition` e `priceValidUntil`**, campos que o Rich Results Test aponta como recomendados.
5. **H1 da home** é `sr-only` com "EMACH — Ferramentas Profissionais": o sinal mais forte da página sem nenhuma keyword do catálogo.
6. **Não existem páginas institucionais** (privacidade, entrega). Além do sinal de confiança, a LGPD exige a de privacidade.

## Decisões (validadas com o usuário)

- **Os 3 tracks, na ordem 1 → 2 → 3**, um PR por track. O Track 1 estabiliza o canonical antes do Track 2 mexer em URL.
- **URL de categoria plana: `/catalog/[slug]`**, usando o slug único global de `category` (vale também para subcategoria, até `depth 5`). Escolhida sobre a aninhada (`/catalog/eletricas/furadeiras`) porque recategorizar no dashboard não muda a URL; a hierarquia aparece no breadcrumb e no `BreadcrumbList`, via `category.path`.
- **Sem página de trocas/devolução e sem menção a garantia** em nenhum texto novo. Consequência: `hasMerchantReturnPolicy` fica fora do `Product` JSON-LD.
- **Páginas institucionais: `/privacidade` e `/entrega`**, com texto completo (sem lacunas a preencher). FAQ técnico e formas de pagamento ficaram de fora (pagamento ainda é stub, roadmap #4).
- **Copy humanizada só em texto estático deste repositório.** `tool.description` e `category.description` moram no banco de produção compartilhado, em tabelas dashboard-owned (ADR-0009): não são escritas daqui. Reescrever descrições de produto é tarefa do `emach-dashboard`.
- **H1 da home continua `sr-only`**, com texto reescrito com as keywords do catálogo. H1 visível no hero é decisão de design visual e fica para outra rodada.

## Escopo

Três PRs sobre `apps/web`. **Fora de escopo**: qualquer escrita em banco, coluna nova em tabela dashboard-owned (`gtin`/`mpn` em `tool`), OG image dinâmica por produto, blog/FAQ, mudança visual no hero, revisão de `tool.description`.

## Track 1 — quick wins (sem mudar URL)

### Canonical

- Helper puro `apps/web/src/lib/seo/canonical.ts`: `canonicalFor(path: string): Metadata["alternates"]`, absoluto sobre `NEXT_PUBLIC_SITE_URL`.
- Aplicado em toda rota indexável: home, `/catalog`, `/product/[slug]`, `/sobre` (e, nos tracks seguintes, `/catalog/[slug]`, `/privacidade`, `/entrega`).
- `/catalog` canonicaliza **estático** em `/catalog`, ignorando todos os query params. Não lê `searchParams` (preserva o prerender do shell).
- PDP canonicaliza em `/product/[slug]`, ignorando o param de variante.

### Dados estruturados de site

Componente `apps/web/src/components/seo/site-json-ld.tsx` (Server Component), montado no `app/(shop)/layout.tsx`. Um `<script type="application/ld+json">` com `@graph`:

- **`Organization`**: `name`, `url`, `logo` (`/images/logos/icone.svg`), `sameAs` a partir de `storeSettings.social{Instagram,Linkedin,Facebook,X,Youtube}Url`, incluindo só os que têm `*Visible = true` e URL preenchida.
- **`WebSite`** com `potentialAction: SearchAction` → `/catalog?q={search_term_string}` (caixa de busca nos resultados do Google).
- **`HardwareStore`** (subtipo de `LocalBusiness`), um por filial de `getActiveBranches()`: `name`, `telephone`, `address: PostalAddress` (rua, número, bairro, cidade, UF, CEP), `openingHoursSpecification` derivado de `businessHours` (dias e faixas, reaproveitando `getBusinessHoursRows`). Sem `geo` (não há lat/long na tabela).

Builders puros em `apps/web/src/lib/seo/site-json-ld.ts` (recebem dados, devolvem objeto), testados sem DB. Escape de `<` como já feito em `product-json-ld.tsx`.

### `Product` JSON-LD enriquecido

Em `product-json-ld.tsx`:

- `itemCondition: "https://schema.org/NewCondition"` em cada `Offer`.
- `priceValidUntil`: `activePromotion.endsAt` (ISO date) quando houver promoção com fim; senão hoje + 1 ano.
- `@id` estável na oferta (`${url}#offer-${sku}`).
- Fora, decidido: `hasMerchantReturnPolicy`, `gtin`/`mpn`, `shippingDetails` (frete é cotado por CEP na Frenet; valor fixo seria promessa falsa).

### Testes

- `lib/seo/canonical.test.ts` (unit).
- `lib/seo/site-json-ld.test.ts` (unit): shape do `@graph`, `sameAs` respeita `*Visible`, `openingHoursSpecification` para filial com intervalo de almoço e sem horário.
- `product-json-ld.test.ts` (unit, novo — hoje o componente não tem teste): ofertas por variante, `itemCondition`, `priceValidUntil` com e sem promoção, ausência de `hasMerchantReturnPolicy`.

## Track 2 — `/catalog/[slug]`

### Rota

`apps/web/src/app/(shop)/catalog/[cat]/page.tsx`:

- `generateStaticParams` sobre `getAllCategorySlugs(db)`.
- `generateMetadata`: `title` = nome da categoria; `description` = `category.description` quando existir, senão frase padrão com o nome; `alternates.canonical` = `/catalog/${slug}`; OG com o mesmo título.
- Corpo reaproveita `CatalogContent` / `getCatalogData` passando `cat` vindo de `params` e os demais filtros de `searchParams` (mesmo parse de `catalog/page.tsx`, extraído para `_lib/parse-search-params.ts` para não duplicar).
- H1 real com o nome da categoria (hoje `CatalogContent` já renderiza um H1; passa a receber o nome).
- Slug inexistente ou inativo → `notFound()`.

### Migração dos links

Os 5 call-sites de `?cat=` passam a `/catalog/${slug}`:
`components/category-tile.tsx`, `product/[slug]/_components/breadcrumb.tsx`, `product/[slug]/_components/related-products.tsx`, `product/[slug]/_components/product-json-ld.tsx` (`BreadcrumbList`), `app/sitemap.ts`. `typedRoutes: true` faz o tsc pegar o que escapar.

O drill-down de categoria dentro do sidebar (`category-tree`/acordeão) continua navegando por `?cat=` **ou** passa a `/catalog/[slug]`: decidir na implementação pelo custo; se ficar em `?cat=`, o redirect abaixo resolve.

### Redirect permanente (308)

No `proxy.ts`: request a `/catalog` com `cat` na query → `NextResponse.redirect(308)` para `/catalog/${cat}` preservando os demais params. Só quando `cat` é não vazio. Testado em `proxy.test.ts` (unit: monta `NextRequest`, verifica status e `Location`).

### Sitemap

`sitemap.ts` lista `/catalog/${slug}` em vez de `/catalog?cat=${slug}`. Prioridade 0.8 mantida.

### Testes

- `proxy.test.ts` (redirect com e sem outros params; sem `cat` não redireciona).
- `parse-search-params.test.ts` (unit).
- Integração já existente: `catalog-data.test.ts`.
- Smoke: `bun dev:web` + visitar `/catalog/<slug real>`, `/catalog?cat=<slug>` (deve redirecionar), `/sitemap.xml`.

## Track 3 — páginas institucionais e copy

### `/privacidade`

`app/(shop)/privacidade/page.tsx`, texto estático em `_content.ts`. Descreve o que o sistema faz, lido do código:

- dados coletados no cadastro (`client`: nome, e-mail, CPF/CNPJ, telefone) e no endereço (`clientAddress`);
- consentimento registrado em `consentLog`;
- direito de acesso e portabilidade atendidos via exportação (`clientExportLog`), auditoria em `clientAuditLog`;
- sessão (cookie `ecommerce.session_token`, Better Auth), login Google;
- o que vai para terceiros: Frenet recebe CEP e dimensões (não dados pessoais), Resend recebe e-mail para transacionais, Vercel Analytics/Speed Insights (sem cookie de rastreio);
- canal de contato do encarregado (e-mail já usado pelo site).

Sem menção a troca, devolução ou garantia.

### `/entrega`

`app/(shop)/entrega/page.tsx`:

- frete cotado por CEP na Frenet, no carrinho e no checkout, com as opções e prazos da cotação;
- "frete a combinar": item volumoso sem caixa cadastrada, atendimento entra em contato;
- retirada nas filiais, com endereço e horário reais de `getActiveBranches()` (mesma fonte do `/sobre`);
- acompanhamento do pedido em `/dashboard/pedidos`.

Nunca cita prazo fixo: quem dá prazo é a cotação.

### Integração

- Links no `site-footer.tsx` (grupo institucional).
- Entradas no `sitemap.ts` (prioridade 0.4) e canonical em cada uma.
- Metadata própria (título, description, OG).

### Copy humanizada

Passa por `/humanize-pt-br` + `/unslop`:

- corpo de `/privacidade` e `/entrega`;
- `metadata.description` de home, `/catalog`, `/sobre`, `/cart`, `/login` e das rotas novas;
- description padrão das páginas de categoria;
- H1 `sr-only` da home (`hero-carousel.tsx`): keywords reais do catálogo, ex. "Ferramentas profissionais, EPIs e equipamentos de medição para obra e oficina";
- `/sobre` e labels de seção da home só onde soarem genéricos (a voz atual já é boa).

Texto com afirmação verificável (o que o sistema faz com dados, como o frete funciona) passa pelo `verificador-factual` contra o código antes do PR.

### Testes

- Render test das duas páginas (unit, sem DB para `/privacidade`; `/entrega` com `getActiveBranches` mockado).
- Smoke visual das duas rotas e do footer.

## Riscos e mitigações

- **`use cache` no sitemap**: mudança de URL só aparece após o revalidate de 24h ou redeploy. Redeploy no PR do Track 2 resolve.
- **Links externos antigos para `?cat=`**: cobertos pelo redirect 308 no `proxy.ts`.
- **Facet/drill-down do sidebar**: se continuar em `?cat=`, cada clique passa pelo redirect (um round-trip extra). Preferir migrar para `/catalog/[slug]`.
- **`storeSettings` sem linha**: builders tratam `null` (sem `sameAs`); a página nunca quebra por dado ausente.
