# Relatório Técnico de Segurança do Módulo de Faturamento (Cakto)

Este relatório detalha as correções de segurança críticas implementadas no processador de webhooks e no módulo de assinaturas/checkout da **Cakto** no LumièreOS para garantir o isolamento absoluto do ambiente de produção contra chamadas de homologação, testes simulados e tentativas de fraude de planos.

## 🛠️ Arquivos Alterados (Restritos ao Escopo)
- `api/cakto/webhook.ts`
- `api/cakto/webhook-test.ts`
- `api/cakto/webhook-security.test.ts`
- `api/cakto/create-checkout.ts`
- `api/cakto/update-payment-method.ts`
- `api/cakto/billing-security.test.ts`
- `server/index.ts`
- `package.json`
- `RELATORIO_TECNICO.md`

---

## 🔒 Regras de Segurança e Arquitetura Implementadas

### 1. Bloqueio de Webhook no Express quando Segredo Ausente
Para garantir a mesma robustez do ambiente Serverless, o endpoint de webhook Express em `/server/index.ts` agora valida a presença do segredo de validação quando executado em produção:
```typescript
const expectedSecret = process.env.CAKTO_WEBHOOK_SECRET;

if (process.env.NODE_ENV === "production" && !expectedSecret) {
  return res.status(503).json({
    error: "Webhook de faturamento não configurado."
  });
}

if (expectedSecret && receivedToken !== expectedSecret) {
  return res.status(401).json({
    error: "Assinatura inválida de webhook."
  });
}
```
Isso impede que mensagens arbitrárias sem verificação acessem o processador de faturamento caso o segredo não tenha sido carregado.

### 2. Exigência Rigorosa de Platform Admin (Sem Bypass de Desenvolvimento)
Removemos completamente qualquer bypass automático baseado em variáveis de ambiente (como `process.env.NODE_ENV !== "production"`) do endpoint de teste de webhook em `/api/cakto/webhook-test.ts`. 

Agora, tanto as rotas Express quanto as rotas Serverless exigem estritamente privilégios de `platform_admin` em **todos** os ambientes (incluindo desenvolvimento local):
```typescript
// Validar Platform Admin de forma rigorosa em qualquer ambiente
const isPlatformAdmin = await isPlatformAdminUser(user);
if (!isPlatformAdmin) {
  return res.status(403).json({
    error: "Acesso negado. Apenas Platform Admins podem realizar homologação do webhook."
  });
}
```

### 3. Proteção Global do Plano Founder (Patch P0.2)
Toda solicitação de checkout do plano `founder` agora é interceptada globalmente por uma proteção robusta (fora do bloco de salão existente).
- Se o salão não existir no banco de dados, a requisição é imediatamente rejeitada com **HTTP 403**.
- Se o salão existir, o plano Founder é liberado exclusivamente se o salão possuir a flag de autorização (`founderAuthorized === true`, `isFounderAuthorized === true` ou `isFounder === true`), estiver atualmente no plano `founder`, ou se a operação for realizada por um usuário com a role `platform_admin`.
- Removemos inteiramente o bypass por endereço de email estático (`galicioriefonseca@gmail.com`).

### 4. Isolamento Completo do Fluxo de Onboarding de Novos Salões (Patch P0.2)
Novos salões ainda sem cadastro no Firestore só podem solicitar checkouts para fins de criação (`checkoutPurpose === "new_subscription"`) e restritos exclusivamente aos planos canônicos públicos (`start`, `performance`, `network`, `enterprise`). Qualquer tentativa de carregar o plano `founder`, `activate_recurring` ou `regularize_payment` para um salão inexistente resulta em rejeição imediata, mitigando o risco de criação desordenada de documentos ou bypass de planos.

### 5. Configuração Totalmente Assistida de Alterações de Pagamento (Patch P0.2)
A alteração de formas de pagamento foi convertida em um fluxo assistido unificado. Qualquer chamada bem-sucedida de autenticação e autorização para alteração de método de pagamento retorna imediatamente a indicação de suporte financeiro assistido:
```json
{
  "success": false,
  "requiresSupport": true,
  "message": "A alteração desta forma de pagamento requer configuração assistida pela equipe financeira."
}
```
Isso impede modificações diretas no Firestore e descarta o uso de datas ou valores simulados sem confirmação oficial.

### 6. Ativação de Recorrência Segura (Activate Recurring)
Para ativações de recorrência (`checkoutPurpose === "activate_recurring"`), agora validamos que:
- O salão exista e possua uma conta com plano manual ativo (`billingProvider === "manual"` ou `billingMode === "manual_pix"`);
- O plano requisitado seja idêntico ao plano manual atualmente ativo no salão;
- O salão não possua nenhuma assinatura real ativa junto à Cakto.

---

## 📈 Resultados e Evidências Reais da Validação Técnica

### 1. Validação de Sintaxe e Tipagem (Lint)
Executamos o linter da aplicação com o comando `npm run lint`. O resultado foi validado com sucesso e sem erros:
```bash
> react-example@0.0.0 lint
> tsc --noEmit
```

### 2. Execução da Suíte de Testes do Webhook (Vitest)
Todos os testes de segurança do webhook de homologação passaram com sucesso absoluto:
```bash
> vitest run api/cakto/webhook-security.test.ts

  RUN  v4.1.10 /app/applet
  ✓ api/cakto/webhook-security.test.ts (4 tests) 12ms

  Test Files  1 passed (1)
       Tests  4 passed (4)
```

### 3. Execução da Suíte de Testes do Billing (Vitest)
Criamos e executamos a suíte de testes dedicados a faturamento em `api/cakto/billing-security.test.ts`. Todos os 10 casos de teste que cobrem as novas proteções globais de faturamento passaram com sucesso:
```bash
> vitest run api/cakto/billing-security.test.ts

  RUN  v4.1.10 /app/applet
  ✓ api/cakto/billing-security.test.ts (10 tests) 42ms

  Test Files  1 passed (1)
       Tests  10 passed (10)
```

### 4. Validação do Build de Produção
Executamos a compilação completa do applet e do servidor Express compilado. O build completou sem quaisquer erros ou conflitos de dependências:
```bash
Build succeeded - the applet is compiled
```
