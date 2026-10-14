# anti-slop vendorizado

- Origem: https://github.com/dmmulroy/anti-slop
- Commit: `13909c9e07590f5a85d93c62712259fe14a883f7`
- Copiado em: 2026-10-14
- Caminho de origem: `src/` (canônico upstream), copiado para `tools/oxlint/anti-slop/`.
- Dependências: `oxlint` e `@oxlint/plugins` na mesma versão exata (1.78.0), devDependencies da raiz.

O `vendor/eslint-stylistic/` traz o próprio `LICENSE` (MIT) e o próprio `UPSTREAM.md`; os dois seguem junto com o código.

## Desvios locais

- Os `*.test.ts` de `src/` não foram copiados. O RuleTester do upstream depende de `tsx` e não roda no CI daqui.
- O plugin Effect (`effect/`) foi copiado mas não está registrado em `.oxlintrc.json`: o repo não depende de `effect`.
- Severidade em `.oxlintrc.json` difere do upstream em dois pontos:
  - `off`: `no-module-mocking`. Teste unit mocka `@emach/db` porque o CI não tem banco.
  - Em `*.test.ts(x)` ficam `off` as regras de cast e `unknown` (`no-chained-type-assertions`, `no-unknown-parameters`, `no-unknown-returns`, `require-safety-comment-for-type-assertion`): o fake parcial de banco ou de callback é o próprio cast.
- O código daqui fica fora do Biome (`biome.json`) e do próprio oxlint (`ignorePatterns`).

## Atualizar

Buscar um commit explícito do upstream, comparar `src/` com esta cópia, portar as mudanças preservando os desvios acima e atualizar este arquivo.
