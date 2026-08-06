# BILLING.md

## Sistema Oficial de Assinaturas e Pagamentos

**Versão:** 1.0

---

## Objetivo

O Billing é responsável pelo ciclo de vida financeiro de um Tenant.

Ele controla:
- planos;
- assinaturas;
- períodos de teste;
- upgrades;
- downgrades;
- cancelamentos;
- bloqueios;
- reativações.

O Billing nunca depende do frontend para alterar o estado de uma assinatura.
A fonte oficial da assinatura é a Asaas.

---

## Conceitos

### Tenant
Empresa que utiliza o LumièreOS.
Cada Tenant possui exatamente uma assinatura ativa.

---

### Plano
Representa o pacote contratado.

Exemplos:
- Starter
- Professional
- Business
- Enterprise

Cada plano define:
- preço;
- limite de usuários;
- limite de IA;
- funcionalidades disponíveis.

---

### Assinatura
Representa o contrato financeiro.

Campos mínimos:
- provider
- subscriptionId
- tenantId
- plan
- status
- startedAt
- nextBillingDate
- cancelAt
- updatedAt

---

## Status da Assinatura

### trial
Período gratuito.
Acesso liberado.

---

### pending_payment
Cadastro concluído.
Pagamento ainda não realizado.
Acesso limitado ao onboarding.

---

### active
Pagamento confirmado.
Sistema totalmente liberado.

---

### past_due
Pagamento em atraso.
Sistema permanece disponível durante o período de tolerância.

---

### suspended
Pagamento não regularizado.
Acesso bloqueado.
Dados preservados.

---

### cancelled
Assinatura cancelada pelo cliente.
Permanece ativa até o final do ciclo pago.

---

### expired
Fim definitivo da assinatura.
Sistema bloqueado.
Dados preservados.

---

## Fluxo de Cadastro

1. Criar conta.
   ↓
2. Criar Tenant.
   ↓
3. Criar assinatura: `status = pending_payment`
   ↓
4. Escolher plano.
   ↓
5. Checkout Asaas.
   ↓
6. Webhook confirma pagamento.
   ↓
7. Status: `active`

---

## Trial

Caso exista período gratuito:
`status = trial`
`trialEndsAt = data`

Ao término:
↓
`pending_payment` ou `suspended` conforme estratégia comercial.

---

## Checkout

O backend cria a sessão de checkout.
O frontend apenas redireciona.
Nunca criar checkout diretamente no cliente.

---

## Webhook

Todo webhook recebido deve:
Validar assinatura.
↓
Validar autenticidade.
↓
Verificar idempotência.
↓
Atualizar Firestore.
↓
Registrar evento.

---

## Idempotência

Cada evento recebido deve possuir: `eventId`

Antes de processar:
Verificar se o evento já foi tratado.
Se existir: Ignorar.

---

## Upgrade

Fluxo:
Plano atual
↓
Novo plano
↓
Asaas
↓
Webhook
↓
Atualizar assinatura
↓
Liberar novos recursos

---

## Downgrade

Mesmo fluxo.
A alteração entra em vigor conforme política definida pela Asaas.

---

## Cancelamento

Quando cancelar:
`status = cancelled`

O acesso permanece disponível até:
`nextBillingDate`

Após isso:
`expired`

---

## Reativação

Fluxo:
Novo pagamento
↓
Webhook
↓
Status = active
↓
Liberar acesso

---

## Falha de Pagamento

Recebido webhook: `payment_failed`
↓
Status = past_due
↓
Notificar usuário
↓
Aguardar regularização

---

## Bloqueio

Caso ultrapasse o período de tolerância:
`status = suspended`

Bloquear:
- Agenda
- Clientes
- Financeiro
- IA
- Relatórios

Permitir apenas:
- Configurações
- Pagamento
- Suporte

---

## Auditoria

Registrar todos os eventos:
- criação;
- pagamento;
- falha;
- upgrade;
- downgrade;
- cancelamento;
- reativação.

Coleção: `billing_events`

---

## Segurança

O frontend nunca altera:
- status
- plan
- subscriptionId

Esses dados somente podem ser modificados pelo backend após confirmação da Asaas.

---

## Permissões

Apenas usuários Owner podem:
- alterar plano;
- cancelar assinatura;
- atualizar pagamento;
- visualizar cobrança.

---

## Notificações

O sistema deve avisar:
- pagamento aprovado;
- pagamento recusado;
- renovação;
- cancelamento;
- vencimento próximo;
- fim do trial.

---

## Evolução

Preparado para:
- cupons;
- descontos;
- planos anuais;
- planos mensais;
- add-ons;
- múltiplas assinaturas;
- faturamento internacional.

---

## Fonte da Verdade

A Asaas é a autoridade financeira.
O Firestore apenas replica o estado confirmado pelo webhook.
Nenhuma informação financeira deve ser alterada diretamente pelo frontend.
