# Migração de clientes com pagamento manual para Asaas

## Regra

Clientes que já possuem um ciclo pago manualmente não devem receber uma nova cobrança no momento da migração para o Asaas.

A migração deve preservar `nextBillingDate` quando disponível. Se a data não existir, ela é derivada de `lastPaymentAt` avançando o ciclo mensal até ficar no futuro.

A assinatura Asaas deve ser criada com:
- o novo plano/preço oficial;
- o ciclo selecionado;
- `nextDueDate` igual ao próximo vencimento do ciclo já pago;
- `billingType=UNDEFINED` quando nenhum cartão/token foi fornecido.

Não abrir a fatura pendente como forma de configurar o cartão durante a migração manual. O Asaas documenta que informar um cartão posteriormente em uma assinatura criada sem cartão pode processar imediatamente a cobrança pendente, independentemente de `nextDueDate`.

## Essenza

O pagamento manual de R$297 não deve ser recriado como pagamento Asaas. Ao migrar para o plano Profissional de R$397, o primeiro vencimento Asaas deve ser o próximo ciclo acordado, não a data em que o cartão for cadastrado.

## Segurança

- Nunca confiar no preço enviado pelo frontend.
- Resolver plano, preço e ciclo no backend.
- Reutilizar/reconciliar assinatura existente antes de criar outra.
- Usar lock idempotente por salon.
- Não marcar a conta como paga apenas porque a assinatura foi criada; a ativação financeira continua dependendo de webhook/pagamento confirmado.
