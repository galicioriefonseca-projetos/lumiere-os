# Arquitetura de Billing do LumièreOS

## Provedores ativos

- `manual` / `manual_pix`: cobrança operada pela equipe financeira
- `cakto`: assinatura recorrente confirmada pela Cakto

## Estado manual ativo

Uma conta manual paga mantém:

```text
billingProvider: manual
billingMode: manual_pix
subscriptionStatus: active
paymentStatus: paid
activationStatus: active
isActive: true
```

Ao configurar as próximas mensalidades, o sistema preserva esse estado e grava somente:

```text
pendingPlan
pendingOfferId
pendingCheckoutUrl
pendingCheckoutEmail
pendingRequestedAt
pendingCheckoutPurpose
pendingBillingActivation
updatedAt
```

## Confirmação real

Somente um webhook real, autenticado e vinculado a um `offerId` oficial pode:

- gravar IDs definitivos da Cakto;
- mudar `billingProvider` para `cakto`;
- confirmar o plano e o status;
- limpar campos `pending*`.

Oferta ausente, desconhecida ou divergente é encaminhada para revisão e não ativa assinatura.

## Homologação

Testes usam retorno antecipado e gravam somente campos com prefixo `homologation`. Nunca alteram plano, acesso, vencimento, provedor ou histórico financeiro real.

## Founder

O plano Founder só pode ser solicitado por salão existente e autorizado, ou por Platform Admin. `activate_recurring` exige que o plano solicitado seja o plano atual da conta.

## Alteração de forma de pagamento

Enquanto não houver operação oficial confirmada no gateway, a alteração é assistida e não modifica Firestore nem chama endpoints presumidos.
