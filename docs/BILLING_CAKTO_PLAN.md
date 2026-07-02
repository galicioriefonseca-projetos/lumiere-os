# Plano de Migração do Faturamento — Cakto Gateway Principal

Este documento detalha as especificações técnicas, arquitetura e fluxo de faturamento implementados para a migração do gateway principal do LumièreOS de Asaas para Cakto.

## 1. Contexto e Motivação
Para aumentar a eficiência e segurança, o faturamento principal foi migrado para a Cakto. O Asaas foi preservado integralmente como sistema legado para garantir que nenhum cliente ativo em produção tenha seu serviço ou faturamento interrompido.

## 2. Escopo Técnico e Arquitetura

### 2.1. Fluxo de Checkout (Cakto)
1. **Frontend**: O usuário inicia o faturamento de sua assinatura clicando em "Ativar Assinatura Recorrente Cakto" na página de configurações.
2. **Backend Server (`/api/cakto/create-checkout`)**:
   - Autentica a requisição usando tokens de ID do Firebase.
   - Faz o fluxo de Token OAuth2 para interagir com a API Cakto de forma segura.
   - Cria o link de checkout para o plano selecionado.
   - Salva informações preliminares no Firestore:
     - `billingProvider: "cakto"`
     - `caktoCheckoutUrl: string`
     - `caktoOfferId: string`
3. **Redirecionamento**: O usuário é redirecionado para o checkout seguro da Cakto.

### 2.2. Webhook de Faturamento (`/api/cakto/webhook`)
O backend expõe a rota pública de webhook para receber atualizações em tempo real da Cakto sobre o status de pagamentos:
- **Assinatura Criada/Ativada**:
  - `subscriptionStatus: "active"`
  - `paymentStatus: "paid"`
  - `nextBillingDate: timestamp` (Calculado ou retornado pela API)
  - `caktoSubscriptionId: string`
- **Fatura Vencida/Atrasada**:
  - `subscriptionStatus: "overdue"`
  - `paymentStatus: "overdue"`
- **Assinatura Cancelada**:
  - `subscriptionStatus: "canceled"`
  - `paymentStatus: "canceled"`
  - `isActive: false`

### 2.3. Variáveis de Ambiente (.env)
As credenciais são gerenciadas estritamente pelo servidor e nunca expostas ao frontend. Os IDs de produto e ofertas são dinamicamente buscados no Firestore (com cache para otimização):
- `CAKTO_CLIENT_ID`: Credencial OAuth2.
- `CAKTO_CLIENT_SECRET`: Segredo OAuth2.
- `CAKTO_API_URL`: URL base (sandbox ou produção).
- `CAKTO_WEBHOOK_SECRET`: Token de autenticação/assinatura do Webhook.

## 3. Compatibilidade e Legado (Asaas)
- **Status do Gateway**: O Asaas foi formalmente marcado como **LEGADO (DEPRECATED)**. Ele **NÃO deve ser utilizado como gateway principal** para novos cadastros ou faturamentos no LumièreOS. Todas as novas assinaturas e transações comerciais devem ser exclusivamente roteadas através da integração principal com a **Cakto**.
- **Preservação e Zero Interrupção**: Para garantir a conformidade e a estabilidade com clientes ativos em produção, a infraestrutura legada do Asaas (incluindo rotas, campos de banco de dados e listeners de webhook) permanece intacta e plenamente operacional. Clientes que já possuem `billingProvider: "asaas"` ou `asaasSubscriptionId` continuam sendo atendidos com as telas e faturamentos legados. Os webhooks do Asaas continuam processando atualizações normalmente.
- **Transição Transparente**: O painel administrativo (`MasterPanel`) permite visualizar e simular de forma isolada faturamentos tanto no Cakto quanto no Asaas para total segurança e flexibilidade de testes, mas novas ativações manuais de produção devem dar preferência estrita ao Cakto.
