# Migração de faturamento manual para Asaas

Clientes que já pagaram um período manualmente não devem ser cobrados novamente ao ativar o faturamento Asaas.

## Regra

- `lastPaymentAt` / `billing.manualLastPaymentDate`: último pagamento manual já quitado.
- `nextBillingDate` / `billing.manualNextBillingDate`: primeiro vencimento que o Asaas deverá assumir.
- A primeira assinatura Asaas deve usar essa data em `nextDueDate`.
- O dia em que o cartão foi cadastrado não redefine o ciclo.

## Cartão

A assinatura deve ser criada com os dados/token do cartão durante a criação quando o objetivo for apenas configurar o cartão para uma cobrança futura. Não deve ser criada uma assinatura sem cartão e depois aberta uma cobrança pendente para que o cliente informe o cartão, porque o Asaas pode processar a cobrança pendente imediatamente quando o cartão for informado posteriormente.

## Fonte financeira

O pagamento manual permanece como histórico interno do LumièreOS. A partir da primeira cobrança Asaas, os pagamentos recorrentes e seus status devem ser reconciliados pelos webhooks e pela API do Asaas.
