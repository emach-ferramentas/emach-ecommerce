# Supabase Storage Buckets

## tool-images

Armazena imagens de produto das ferramentas. Bucket **público** — leitura direta sem autenticação.

### Criar via Dashboard (cloud)

1. Supabase Dashboard → Storage → **New bucket**
2. Nome: `tool-images`
3. Public: **ON**
4. File size limit: **5 MB**
5. Allowed MIME types: `image/png`, `image/jpeg`, `image/webp`

> A CLI `supabase storage` (v2.91.x) só tem `cp/ls/mv/rm` — não cria bucket. Use Dashboard ou SQL.

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

### Padrão de URL pública

```
https://<project-ref>.supabase.co/storage/v1/object/public/tool-images/<path>
```

Salvar a URL resultante em `tool_image.url` (uma linha por imagem, `sort_order` define a posição).

### Arquitetura de acesso

O **upload/delete** das imagens é feito pelo **`emach-dashboard`** (repo irmão), via server actions que usam `supabaseAdmin` + `SUPABASE_SERVICE_ROLE_KEY`. Este repo (`emach-ecommerce`/storefront) **só lê**: consome `tool_image.url` (URL pública absoluta) direto em `<Image>`. Bucket RLS fechado para escrita; leitura pública via URL direta.

> `SUPABASE_SERVICE_ROLE_KEY` existe no `.env`/`packages/env` deste repo mas hoje **não é usado** no `apps/web` (não há `supabaseAdmin` aqui) — fica disponível caso o storefront passe a escrever no storage. A lógica de cleanup de storage (create/update/delete de imagens) vive no `emach-dashboard`, não aqui.
