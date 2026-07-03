# Frenet como motor de cotação de frete

**Data:** 2026-07-02
**Status:** aprovado (brainstorming com o Otávio)
**Substitui em produção:** motor de tabelas próprias (`2026-06-22-frete-tabelas-checkout-design.md`), que por sua vez substituiu o SuperFrete (`2026-06-03-frete-superfrete-design.md`).

## Contexto e decisão

O storefront cota frete hoje com um motor 100% local (zona de CEP de destino × faixa de peso × caixa), sem chamada de rede. A decisão deste design é trocar o **provedor** da cotação pela API da Frenet (`POST api.frenet.com.br/shipping/quote`), mantendo intactos o contrato da UI, o anti-fraude do checkout e o empacotamento local:

1. **Frenet vira o motor único** — as tabelas `carrier`/`carrierZone`/`carrierRate` são aposentadas (a manutenção manual de zonas×faixas some do dashboard). Preço e prazo passam a ser reais, por transportadora/serviço.
2. **`packItems` permanece como pré-processamento** — o carrinho continua sendo consolidado em caixas reais (catálogo `shippingBox`), e cada caixa vira uma linha do `ShippingItemArray` da Frenet. A cotação espelha o pacote fisicamente despachado; cotar itens soltos superestimaria o frete de carrinho multi-item.

## Objetivo

Cotação de frete no checkout e na calculadora da PDP servida pela Frenet, com múltiplas opções reais (Sedex, PAC, transportadoras), escolha do cliente persistida no pedido e o mesmo comportamento de segurança de hoje.

## Não-objetivos

- Rastreamento (`/tracking/trackinginfo`) e lookup de CEP (`/CEP/Address/{cep}`) — bônus futuros (ver Observações).
- Campos opcionais `isFragile`, `Category`, `SKU`, `Coupom` do request (ver Observações).
- Remoção física das tabelas do motor antigo — mudança de schema começa no dashboard (ADR-0009).
- Onboarding via API da Frenet — o token já foi obtido no painel.

## Arquitetura

O contrato externo **não muda**: `quoteShipping(input: QuoteShippingInput) → Promise<{negotiate, options: ShippingOption[]}>` continua sendo a interface consumida por `quoteShippingAction` (checkout + PDP) e `assertShippingQuoted` (anti-fraude). Só o miolo do adapter troca.

```
quoteShippingAction / assertShippingQuoted
        │
        ▼
apps/web/src/lib/shipping/quote.ts   (adapter — assinatura preservada)
        │ 1. busca dims dos tools + caixas ativas (getActiveBoxes — igual hoje)
        │ 2. buildQuoteItems → packItems → caixas reais (igual hoje)
        │    └─ item sem caixa (out_of_catalog) → negotiate: true (igual hoje)
        │ 3. cache Redis: hit? → retorna sem chamar a Frenet
        ▼
apps/web/src/lib/frenet/client.ts    (NOVO — POST /shipping/quote)
        ▼
apps/web/src/lib/frenet/map.ts       (NOVO — resposta Frenet → ShippingOption[])
```

`packages/db` **não é editado**: `packItems`, `getActiveBoxes` e o schema continuam como estão; o storefront apenas deixa de chamar `quoteShipping` (motor de zonas) e `getActiveCarriersWithTables`.

## Componentes

### `lib/frenet/client.ts`

- `fetchFrenetQuote(body: FrenetQuoteRequest): Promise<FrenetQuoteResponse>`
- `fetch` com `AbortController`, timeout de 10s; header `token: env.FRENET_TOKEN`; `Content-Type`/`Accept: application/json`.
- Classe `FrenetError extends Error` lançada em `!res.ok`, timeout ou body inesperado (precedente: client do SuperFrete removido, commit `59cb97a`).
- **Sem retry automático em v1** — o fail-open cobre o server-side e a UI já tem retry (`quoteNonce`).

### Payload do request

| Campo Frenet | Fonte |
|---|---|
| `SellerCEP` | `env.FRENET_SELLER_CEP` (v1; ver Config) |
| `RecipientCEP` | `destinationCep` já normalizado (8 dígitos) |
| `ShipmentInvoiceValue` | `declaredValueCents / 100` (subtotal do carrinho, semântica atual) |
| `RecipientCountry` | `"BR"` fixo |
| `ShippingItemArray` | 1 linha por caixa do `packItems`: `Weight` = peso total da caixa (itens + tara) em kg, `Length/Height/Width` = dimensões da caixa do catálogo em cm (o schema só tem as **internas** — `internalLengthCm/WidthCm/HeightCm`; aproximação aceitável e única disponível), `Quantity: 1` |

### `lib/frenet/map.ts`

Absorve as pegadinhas do contrato Frenet:

- A chave da resposta tem **typo oficial**: `ShippingSevicesArray` (sem o segundo "r").
- `ShippingPrice` e `DeliveryTime` chegam como **string** → `priceCents = Math.round(Number.parseFloat(price) * 100)` (mesmo arredondamento do `mapQuoteResult` atual — obrigatório para o anti-fraude de 1 centavo não rejeitar cotação legítima) e `deliveryDays = Number.parseInt(time, 10)`.
- **Erro é por serviço**: filtra entradas com `Error: true` ou preço/prazo não-numérico; os demais serviços seguem válidos.
- Zero serviços válidos → `negotiate: true` (mesma semântica de "Frete a combinar").
- Mapeamento para `ShippingOption`: `carrierId = "{CarrierCode}-{ServiceCode}"` (composto — `ServiceCode` sozinho pode colidir entre transportadoras), `name = "{Carrier} — {ServiceDescription}"` (ex.: `"Correios — Sedex"`), `priceCents`, `deliveryDays`. Opções ordenadas por preço crescente. O `shippingServiceCode` do `CreateOrderInput` carrega esse mesmo ID composto.

### Cache (`lib/frenet/cache.ts` ou inline no adapter)

- Redis via `@emach/redis` com fallback in-memory quando Upstash não está provisionado (mesmo padrão do `rate-limit.ts`).
- Key: hash determinístico de `(sellerCep, destinationCep, declaredValueCents, assinatura das caixas empacotadas [dims+peso ordenados])`. Value: `{negotiate, options}` serializado. TTL: **30 minutos**.
- Efeitos: (a) **1 chamada Frenet por checkout** na prática — o re-quote do `assertShippingQuoted` acerta o cache da cotação que o cliente acabou de ver; (b) **anti-fraude determinístico** — compara contra exatamente o que foi exibido, sem corrida com mudança de preço na Frenet entre as duas chamadas.
- Erro de leitura/escrita no cache **nunca** derruba a cotação — degrada para chamada direta (com `log.error`).

## Anti-fraude e fail-open (políticas preservadas)

- `assertShippingQuoted` continua re-cotando server-side, **fora da transação** do pedido, com tolerância de 1 centavo (`PRICE_TOLERANCE_CENTS`).
- `negotiate: true` continua **bloqueando** o pedido (`OrderError`) — agora também cobre "Frenet não retornou nenhum serviço válido para este CEP/pacote".
- Falha de infra na cotação (agora incluindo timeout/queda/5xx da Frenet) mantém o **fail-open** (#97): pedido criado com `shippingUnverified: true` para revisão do staff. Com API externa esse cenário volta a ser realista — **atualizar o CLAUDE.md raiz**, que hoje afirma que o fail-open de API externa "deixou de existir".
- `resolveDestinationCep` retornando `null` segue não-bloqueante (`shippingUnverified` default), como hoje.

## Persistência da escolha do serviço

Hoje `selectedCarrierId` morre na UI e `order.shippingMethod` fica sempre `null`. Correção, sem mudança de schema:

1. `CreateOrderInput` ganha `shippingServiceCode: string` **opcional**.
2. `assertShippingQuoted` valida o **par** (serviço, preço) contra as opções re-cotadas quando `shippingServiceCode` vier; sem ele, mantém o match só por preço (compatibilidade durante a janela de deploy).
3. `placeOrder` grava `order.shippingMethod` com o label legível (`"Correios — Sedex"`), que o dashboard já exibe.
4. UI: `checkout-content.tsx` passa a serializar o serviço selecionado no submit (o estado `selectedCarrierId` já existe; hoje só não é enviado).

O `ServiceCode` cru (necessário pro rastreamento futuro) exigiria coluna nova em `order` — mudança que começa no dashboard; está na lista de requisitos, fora deste escopo.

## Config e env

| Var | Obrigatória | Descrição |
|---|---|---|
| `FRENET_TOKEN` | ✅ | Token do painel Frenet (header `token`) |
| `FRENET_SELLER_CEP` | ✅ | CEP de origem, 8 dígitos (zod: `/^\d{8}$/`) |
| `FRENET_BASE_URL` | — (default `https://api.frenet.com.br`) | Override p/ testes |

- Entram em `serverSchema` (`packages/env/src/schemas.ts`). **Antes do merge**: `vercel env add` das obrigatórias, senão o gate `check:env` do CI quebra.
- `vitest.setup.ts` já injeta dummies para obrigatórias novas automaticamente (deriva do schema).
- v1 usa env para o `SellerCEP` (sem dependência cross-repo). Quando o dashboard expuser a config de origem (`storeSettings.shippingOriginBranchId` → `branch.cep` — a query `getShippingSettings()` já existe, órfã), o adapter passa a preferir o valor do banco, mantendo a env como fallback documentado.
- Gotcha de dev: editar `apps/web/.env` mid-sessão não reflete no `next dev` rodando (precedência de `process.env` do shell) — relançar o shell/servidor.

## UI

- `ShippingOptions` (radio) já renderiza lista de opções — passa a exibir os serviços da Frenet ordenados por preço; sem redesign.
- Calculadora da PDP (`freight-calculator.tsx`) funciona sem mudança (mesma action, 1 item → 1 caixa).
- Estados de erro/retry existentes cobrem falha da Frenet no client-side.

## Testes

Todos **unit** (rodam no `test:ci`, sem tocar a lista `INTEGRATION`):

- `client.test.ts`: `vi.spyOn(globalThis, 'fetch')` — 200 feliz, `!res.ok` → `FrenetError`, timeout/abort → `FrenetError`.
- `map.test.ts`: typo `ShippingSevicesArray`, preços/prazos string → centavos/dias, `Error: true` filtrado, lista vazia → `negotiate`, ordenação por preço.
- Adapter: client + DB mockados — cache hit/miss, `out_of_catalog` → `negotiate` sem chamar a Frenet.
- `place-order.shipping.test.ts` / `place-order.test.ts` **continuam passando sem edição** (mockam o boundary `@/lib/shipping/quote`, que é preservado); ganham caso novo para a validação do par serviço+preço.
- Smoke run-time manual: dev server → PDP e checkout com token real (o `bun check-types` não pega erro de contrato de API externa).

## Requisitos para o dashboard (repassar ao repo irmão)

1. **CEP de origem** — expor config pro staff: `storeSettings.shippingOriginBranchId` apontando para filial com `cep` preenchido. Até lá, env no storefront.
2. **Peso/dimensões por produto viram dado crítico de cotação** — já são NOT NULL, mas o banco aceita `0` (CHECK é `>= 0`); o form de produto precisa validar `> 0` (kg/cm), e vale um audit dos produtos existentes com dims/peso zerados (Frenet cota errado ou rejeita).
3. **Cadastro de caixas (`shippingBox`) permanece** — pré-requisito de cotação; item sem caixa = "Frete a combinar".
4. **Aposentar UI de transportadoras/zonas/faixas** (`carrier`/`carrierZone`/`carrierRate`) + eventual drop das tabelas via sync (lembrar do registro manual no `packages/db/src/index.ts`).
5. **Futuro (rastreamento):** coluna `order.shippingServiceCode` + captura do código de rastreio no fluxo de expedição, para ligar o `/tracking/trackinginfo`.

## Observações e sugestões (recomendações do Claude)

Campos e endpoints da Frenet deixados fora da v1, com recomendação de quando revisitar:

- **`isFragile` (por item)** — sinaliza produto frágil; pode acionar regra/preço de manuseio no painel Frenet. Ferramentas elétricas são majoritariamente robustas, e o campo exigiria flag nova por produto (schema dashboard-owned). **Recomendo: não usar agora**; revisitar se a operação registrar avarias recorrentes em categorias específicas (ex.: acessórios com peças de vidro/cerâmica).
- **`Category` (por item)** — usado pelas *regras de frete avançadas* do painel Frenet (ex.: frete grátis por categoria). Enviar custaria um join com `category` na cotação. **Recomendo: não enviar na v1**, mas é a alavanca certa se vocês quiserem campanhas de frete por categoria — nesse caso, configurar a regra no painel Frenet e adicionar o campo aqui é mudança pequena.
- **`SKU` (por item)** — nossa linha de cotação é uma **caixa consolidada**, não um SKU; enviar SKU de caixa sintética seria enganoso. **Recomendo: omitir** (decisão coerente com o empacotamento local). Se um dia a cotação virar por-item, aí sim enviar `toolVariant.sku`.
- **`Coupom`** — vincula a cotação a regra avançada de cupom no painel Frenet (ex.: cupom de frete grátis). Hoje cupom/promocode é resolvido no nosso checkout (`order.discountAmount`). **Recomendo: manter fora**; se quiserem campanha "FRETEGRATIS" gerida pela Frenet, este é o campo.
- **`Diameter`** — só para volumes cilíndricos; nosso schema é retangular (L×A×C). Irrelevante.
- **`GET /shipping/info`** — lista os serviços habilitados na conta. **Sugestão de baixo custo:** usar num script `scripts/check-frenet.ts` (smoke de credencial: valida token e lista serviços ativos) — útil no onboarding de env nova e pra diagnosticar "por que sumiu o Sedex da cotação" sem abrir o painel.
- **`GET /CEP/Address/{cep}`** — lookup de endereço. O checkout já pede CEP; autofill de rua/bairro/cidade melhoraria o form de endereço novo. **Recomendo considerar** como melhoria de UX separada (também daria pra usar ViaCEP, gratuito, sem gastar quota Frenet).
- **`/tracking/trackinginfo`** — rastreamento com eventos (postado → em trânsito → entregue). Depende do ciclo de vida pós-pago (pagamento real, roadmap #4) e da coluna `shippingServiceCode`. **Recomendo: planejar junto com a integração de pagamento**, é o próximo passo natural depois desta.
- **`OriginalShippingPrice`/`OriginalDeliveryTime`** — a resposta traz o valor "original" além do ajustado por regras do painel. Daria um "de R$ X por R$ Y" no frete. **Recomendo: ignorar por ora** (só faz sentido com regras de desconto de frete ativas no painel).
- **Monitoramento operacional** — com API externa, a taxa de `shippingUnverified` vira o termômetro da saúde da integração. `log.error` do evlog em toda `FrenetError` com contexto (`action`, CEP, caixas); quando o drain externo chegar (hardening, roadmap #5), alertar sobre picos. **Sugestão extra:** logar cache hit-rate no início pra calibrar o TTL de 30min.
- **Latência no checkout** — a cotação client-side agora atravessa uma API externa (~1-3s). O debounce de 600ms + estado de loading existentes cobrem; se a percepção ficar ruim, pré-cotar no evento de blur do CEP é a otimização barata.
