# Product

## Register

product

## Users

Compradores brasileiros de ferramentas profissionais: eletricistas, pedreiros, marceneiros, profissionais de obra e indústria, mais o DIY sério. Contexto de uso frequentemente no celular (canteiro, loja física, deslocamento). O que pesa na decisão: especificação técnica (voltagem, potência, capacidade), preço parcelado, frete calculado por CEP e sinais de confiança (garantia, nota fiscal, filial física). Job-to-be-done: achar a ferramenta certa, comparar variantes (hoje variante = voltagem) e comprar com frete já calculado.

## Product Purpose

Storefront BR de ferramentas (furadeiras, serras, compressores, EPIs) que compartilha banco Supabase com o `emach-dashboard` (admin staff, repo irmão). Vende elétricas/manuais, medição e EPIs. Sucesso = conversão ao longo do funil (descobrir → comparar → checkout) com confiança técnica e logística: estoque validado em agregado multi-filial (ADR-0003), frete via Frenet (cotação por CEP, cache Redis de 30 min), pagamento Asaas (keystone pendente). Auth de cliente isolada (Better Auth `ecommerce`).

## Brand Personality

Ferrari-inspired: preciso, performático, confiante. Chiaroscuro intencional — preto absoluto cinematográfico alternando com superfície clara editorial (`gray-10` #f4f4f4, única superfície clara do sistema). Ferrari Red (#DA291C) é **verbo, não atmosfera**: aparece UMA vez por tela, no CTA de maior prioridade. Cantos retos (radius 2px) = precisão de engenharia. Tipografia Barlow + Barlow Condensed (labels uppercase, tracking largo). Voz direta e técnica, microcopy concreta (verbo + objeto: "Adicionar ao carrinho", "Ver N produtos"), sem buzzword e sem em-dash.

## Anti-references

- Marketplace genérico e poluído (densidade caótica estilo Mercado Livre).
- SaaS-cream / warm-neutral default; qualquer fundo bege/sand.
- Vermelho usado como atmosfera ou decoração (é só acento de ação).
- Cantos arredondados moles, sombras difusas, glassmorphism decorativo.
- "Branco duplo": misturar `#fff` com `#f4f4f4` como fundo. Card que se separa do fundo por cor em vez de hairline (`border-border`, nunca `border-gray-10`).
- Gradient text, eyebrow uppercase em toda seção, side-stripe borders.

## Design Principles

1. **Vermelho é verbo.** Uma vez por tela, no CTA de maior prioridade; o resto vive em preto/branco/cinza.
2. **Precisão acima de ornamento.** Cantos retos, hairlines, sem sombra mole; cada elemento justifica sua presença.
3. **Chiaroscuro com propósito.** Preto cinematográfico carrega marca e imersão (home, login, hero, vinhetas, cabeçalhos e cards da conta, drawer e resumo do carrinho); superfície clara carrega tarefa e leitura (catálogo, produto, checkout, corpo das telas).
4. **Confiança técnica visível.** Especificação (voltagem/potência), preço parcelado, frete por CEP e garantia precisam estar legíveis e a um toque, não escondidos.
5. **No fluxo de compra, a ferramenta some na tarefa.** Familiaridade e densidade de produto vencem o drama nas telas de tarefa; o drama editorial mora na home, no login e nos cabeçalhos escuros; nas telas de tarefa a densidade de produto vence.

## Accessibility & Inclusion

- Contraste: corpo ≥4.5:1, texto grande ≥3:1; placeholders também 4.5:1 (não cinza-claro).
- `prefers-reduced-motion`: toda animação tem alternativa (crossfade/instantâneo) — já presente no código (hero, grids, drawers).
- Overlays com focus-trap, Esc e restauração de foco; scroll-lock manual.
- Alvos de toque ≥44px no mobile (estabelecido na sweep de responsividade).
- Cor nunca é o único indicador de status (usar ícone/label junto).
- `typedRoutes` ativo; navegação por teclado preservada.
