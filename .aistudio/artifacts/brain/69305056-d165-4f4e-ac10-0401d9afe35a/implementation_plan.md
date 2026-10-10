# Plano de Implementação: Cupons de Desconto no LumièreOS

A funcionalidade de cupom de desconto será implementada para permitir que assinaturas específicas sejam ativadas gratuitamente.

## Tarefas

### 1. Backend: Validação de Cupons
- Criar uma coleção `coupons` no Firestore com os campos `code` (string), `planId` (string), `active` (boolean), `expiresAt` (timestamp).
- Criar uma função de serviço para validar o cupom no `BillingService.ts`.

### 2. Frontend: Registro com Cupom
- Atualizar `src/pages/auth/RegisterPage.tsx` para enviar o campo `coupon` na requisição `POST /api/billing/create-checkout`.

### 3. Backend: Integração do Cupom no Checkout
- Atualizar `/server/routes/billing/create-checkout.ts` para:
  - Verificar se o cupom enviado é válido.
  - Se o cupom for válido e tornar a assinatura gratuita:
    - Pular a criação do Checkout no Asaas.
    - Ativar o salão/assinatura diretamente como "active" e com o plano correspondente (Performance, R$ 597,00).
    - Registrar a ativação na coleção de pagamentos/histórico como "paid_via_coupon".

## Considerações de Segurança
- A validação de cupons será feita estritamente no backend.
- O campo `coupon` enviado pelo frontend será validado contra a coleção `coupons`.
- Nenhuma informação de pagamento será processada se o cupom for utilizado com sucesso.
