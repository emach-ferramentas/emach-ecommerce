# Product

## Register

product

## Users

Compradores brasileiros de ferramentas profissionais: eletricistas, pedreiros, marceneiros, profissionais de obra e indústria, mais o DIY sério. Contexto de uso frequentemente no celular (canteiro, loja física, deslocamento). O que pesa na decisão: especificação técnica (voltagem, potência, capacidade), preço parcelado, frete calculado por CEP e sinais de confiança (nota fiscal, filial física). Job-to-be-done: achar a ferramenta certa, comparar variantes (hoje variante = voltagem) e comprar com frete já calculado.

## Product Purpose

Storefront BR de ferramentas (furadeiras, serras, compressores, EPIs) que compartilha banco Supabase com o `emach-dashboard` (admin staff, repo irmão). Vende elétricas/manuais, medição e EPIs. Sucesso = conversão ao longo do funil (descobrir → comparar → checkout) com confiança técnica e logística: estoque validado em agregado multi-filial (ADR-0003), frete via Frenet (cotação por CEP, cache Redis de 30 min), pagamento Asaas (keystone pendente). Auth de cliente isolada (Better Auth `ecommerce`).

## Brand Personality

Prateleira por ofício (H3): loja de ferramenta organizada pelo serviço que o cliente vai fazer, clara como um balcão bem arrumado. Página em papel branco (`--paper`) com faixas em `--canteiro`, estrutura em grafite e foto de produto num poço neutro (`--well`). O vermelho da marca (`--emach-red`, #da291c) é **verbo, não atmosfera**: aparece uma vez por tela, no CTA de compra. Cantos de 3 px em controle e 5 px em card. Tipografia Archivo variável; títulos na mesma família, condensados pelo eixo de largura e em caixa alta. Voz direta e técnica, microcopy concreta (verbo + objeto: "Adicionar ao carrinho", "Ver os 12 produtos"), sem buzzword e sem travessão. A loja não fala de troca, devolução nem garantia. Detalhe em `DESIGN.md`.

## Anti-references

- Marketplace genérico e poluído (densidade caótica estilo Mercado Livre).
- SaaS-cream / warm-neutral default; qualquer fundo bege/sand.
- Vermelho usado como atmosfera ou decoração (é só acento de ação).
- Cantos arredondados moles, sombras difusas, glassmorphism decorativo.
- Card que se separa do fundo por sombra ou por troca de cor em vez de borda `--line`.
- Gradient text, eyebrow (rótulo em caixa alta acima do título), borda lateral colorida.

## Design Principles

1. **Vermelho é verbo.** Uma vez por tela, no CTA de maior prioridade; o resto vive em preto/branco/cinza.
2. **Precisão acima de ornamento.** Cantos de 3 e 5 px, bordas finas, sombra só no que flutua; cada elemento justifica sua presença.
3. **O ofício organiza a loja.** A navegação parte do serviço (`/servicos/<slug>`) e das prateleiras; o cliente acha a ferramenta pelo trabalho que vai fazer.
4. **Confiança técnica visível.** Especificação (voltagem, potência), estoque, preço parcelado e frete por CEP ficam legíveis e a um toque, não escondidos.
5. **No fluxo de compra, a ferramenta some na tarefa.** Familiaridade e densidade de produto vencem o enfeite. O único elemento com drama visual é o hero da home, congelado até o dono pedir mudança.

## Accessibility & Inclusion

- Contraste: corpo ≥4.5:1, texto grande ≥3:1; placeholders também 4.5:1 (não cinza-claro).
- `prefers-reduced-motion`: toda animação tem alternativa (crossfade ou instantâneo), já presente no código (hero, grades, gavetas).
- Overlays com focus-trap, Esc e restauração de foco; scroll-lock manual.
- Alvos de toque ≥44px no mobile (estabelecido na sweep de responsividade).
- Cor nunca é o único indicador de status (usar ícone/label junto).
- `typedRoutes` ativo; navegação por teclado preservada.
