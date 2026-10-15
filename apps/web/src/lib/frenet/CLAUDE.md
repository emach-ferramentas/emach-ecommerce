# Frete Frenet

Cotação por `POST api.frenet.com.br/shipping/quote`. O contrato da API está em `docs/vendor/frenet/frenetapi.apib`.

- **Adapter:** `lib/shipping/quote.ts` preserva o contrato `{negotiate, options: ShippingOption[]}`, e os testes mockam esse boundary. Antes da chamada, `packItems` e `shippingBox` consolidam o carrinho em caixas reais. Item sem caixa vira `negotiate` ("Frete a combinar"). As tabelas `carrier`, `carrierZone` e `carrierRate` saíram do banco.
- **Cache e anti-fraude:** o cache Redis de 30 min (`lib/frenet/cache.ts`) faz o re-quote do `assertShippingQuoted` reusar a cotação exibida. O resultado é 1 chamada Frenet por checkout e anti-fraude determinístico. O anti-fraude valida o par serviço e preço e grava `order.shippingMethod` e `shippingServiceCode` (carrierId composto da opção casada).
- **Fail-open (#97):** Frenet fora ou em timeout cria o pedido com `shippingUnverified`, para revisão do staff.
- **Pegadinhas da API**, absorvidas em `lib/frenet/map.ts`: a chave tem o typo oficial `ShippingSevicesArray`, preço e prazo chegam como string, e o erro vem por serviço.
- **Envs:** `FRENET_TOKEN` e `FRENET_SELLER_CEP` são obrigatórias e precisam estar na Vercel. `FRENET_SELLER_CEP` tem regex, por isso o dummy dos testes é escolhido por validador (`packages/env/src/dummies.ts`).
- **Origem:** a origem real é a filial de `store_settings.shipping_origin_branch_id` (`getShippingSettings`). `FRENET_SELLER_CEP` vale só sem filial ou com CEP da filial inválido.
- **Valor declarado:** segue a política de seguro do dashboard (`insurancePolicy`, `insuranceCapAmount`). Origem e valor entram na chave do cache.
- **`shippingBox`** é registrado à mão no `schema` de `packages/db/src/index.ts`, fora do sync. A regra está em `packages/db/CLAUDE.md`.
