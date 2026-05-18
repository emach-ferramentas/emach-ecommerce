# Débito de estoque na criação do pedido

O storefront debita o estoque de forma síncrona no momento em que o pedido é criado (`order.status = pending_payment`), dentro da mesma transação que insere o `order` e os `order_item` — não há reserva, e o débito não espera a confirmação do pagamento. O storefront só debita; o crédito de volta (cancelamento, estorno, devolução) é responsabilidade do dashboard. O ledger compartilhado é `stock_movement`, com `actor_type = 'system'` para o débito de venda (`reason = 'saida_venda'`).

## Considered Options

- **Reserva-então-confirma**: reservar estoque no checkout, debitar de fato só no `paid`, liberar a reserva por expiração. Rejeitado por exigir um modelo de reserva (coluna de quantidade reservada, job de expiração) que o volume atual não justifica.
- **Débito no pagamento confirmado**: rejeitado porque abriria janela de oversell entre `pending_payment` e `paid`.

## Consequences

- Anti-oversell é forte e simples: a guarda `quantity >= qty` no `UPDATE` condicional impede venda a descoberto dentro da transação.
- Um pedido abandonado (criado e nunca pago) mantém o estoque debitado até que o staff cancele o pedido no dashboard e credite o estoque de volta. Não há expiração automática.
