# Supabase Storage Buckets

## tool-images

Armazena imagens de produto das ferramentas. Bucket **público** — leitura direta sem autenticação.

### Criar via Dashboard (cloud)

1. Supabase Dashboard → Storage → **New bucket**
2. Nome: `tool-images`
3. Public: **ON**
4. File size limit: **5 MB**
5. Allowed MIME types: `image/png`, `image/jpeg`, `image/webp`

> A CLI `supabase storage` (versão não verificada) só tem `cp/ls/mv/rm` — não cria bucket. Use Dashboard ou SQL.

### Criar via SQL (alternativa)

```sql
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tool-images',
  'tool-images',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
);
```

> Supabase local (`bun --cwd packages/db test:supabase:start`): o `config.toml` não define buckets e o limite global é 50MiB. Para testar upload/leitura local, rodar o SQL acima no banco local. Este repo não escreve no storage.

### Padrão de URL pública

```
https://<project-ref>.supabase.co/storage/v1/object/public/tool-images/<path>
```

Salvar a URL resultante em `tool_image.url` (uma linha por imagem, `sort_order` define a posição).

### Arquitetura de acesso

O **upload/delete** das imagens é feito pelo **`emach-dashboard`** (repo irmão), via server actions que usam `supabaseAdmin` + `SUPABASE_SERVICE_ROLE_KEY`. Este repo (`emach-ecommerce`/storefront) **só lê**: consome `tool_image.url` (URL pública absoluta) direto em `<Image>`. Bucket RLS fechado para escrita; leitura pública via URL direta.

> `SUPABASE_SERVICE_ROLE_KEY` e `NEXT_PUBLIC_SUPABASE_URL` são obrigatórias no schema Zod de `packages/env/src/schemas.ts:25-26` (validadas no boot e por `bun check:env`), mas nenhum código de `apps/web` usa a service role hoje (não há `supabaseAdmin`). Manter cadastradas na Vercel mesmo sem uso; a lógica de cleanup de storage vive no `emach-dashboard`.

## banner-images e tool-videos

Buckets públicos lidos pelo storefront (banners do hero e vídeo/poster da galeria do produto, `tool.video_url`/`tool.video_poster_url`). Mesma arquitetura de acesso de `tool-images`: upload pelo `emach-dashboard`, leitura por URL pública absoluta. Os três estão em `images.remotePatterns` de `apps/web/next.config.ts`. Limite de tamanho e MIME: preencher com os valores do dashboard (não verificado neste repo).
