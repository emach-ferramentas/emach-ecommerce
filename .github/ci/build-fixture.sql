-- Banco descartável do job build do CI. Com cacheComponents, todo
-- generateStaticParams precisa devolver pelo menos um resultado: as categorias
-- vêm do db:seed-categories e a ferramenta abaixo cobre /product/[slug].
INSERT INTO tool (id, name, slug, status, weight_kg, length_cm, width_cm, height_cm)
VALUES ('ci-tool', 'Furadeira CI', 'furadeira-ci', 'active', 1.5, 30, 10, 25);

INSERT INTO tool_variant (id, tool_id, sku, price_amount, is_default)
VALUES ('ci-variant', 'ci-tool', 'CI-001', 199.90, true);
