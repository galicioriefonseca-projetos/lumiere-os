# Relatório Técnico de Segurança do Módulo de Faturamento (Cakto)

Este relatório detalha as correções de segurança críticas implementadas no processador de webhooks da **Cakto** no LumièreOS para garantir o isolamento absoluto do ambiente de produção contra chamadas de homologação, testes simulados e tentativas de fraude de planos.

## 🛠️ Arquivos Alterados (Restritos ao Escopo)
- `api/cakto/webhook.ts`
- `api/cakto/webhook-test.ts`
- `server/index.ts`
- `RELATORIO_TECNICO.md`

---

## 🔒 Regras de Segurança e Arquitetura Implementadas

### 1. Isolamento Absoluto de Homologação (Homologation Mode)
Para prevenir que testes de homologação ou payloads simulados alterem o estado real de faturamento dos salões em produção, foi instituído o `homologationMode` unificado sob a seguinte regra:
```typescript
const homologationMode =
  skipTokenValidation === true ||
  isSimulation === true;
```
Quando este modo é ativado:
- **Retorno Antecipado:** O fluxo de processamento é desviado imediatamente após a identificação do salão (`salonDoc`).
- **Nenhuma Alteração de Campos Reais:** Campos reais como `plan`, `subscriptionStatus`, `paymentStatus`, `ownerEmail`, `isActive` ou `nextBillingDate` nunca são tocados ou modificados.
- **Gravação Segura em Prefixo de Homologação:** Todos os dados recebidos são persistidos exclusivamente nos atributos iniciados com `homologation*` (ex: `homologationPlan`, `homologationLastEvent`, etc.), gerados pela função isolada `buildHomologationWebhookUpdate`.
- **Prevenção de Criação de Salão:** Em modo homologação, o sistema nunca cria registros de salão novos caso o ID pesquisado não exista.
- **Nenhum billingHistory Real:** Não são gravados registros reais na subcoleção `billingHistory`.

### 2. Assinatura Express Unificada
As rotas Express (`/server/index.ts`) e Serverless (`/api/cakto/webhook.ts`) foram sincronizadas sob a mesma assinatura de método robusta:
```typescript
async function processCaktoWebhookPayload(
  bodyData: any,
  skipTokenValidation = false,
  isSimulation = false
)
```
A rota de teste de homologação `/api/cakto/webhook-test` foi adaptada para invocar a função passando os parâmetros corretos:
```typescript
processCaktoWebhookPayload(simulatedPayload, true, true);
```

### 3. Validação Rígida de Ofertas e Prevenção de Fraudes (Offer Mismatch)
- **Bloqueio de Ofertas Desconhecidas:** Webhooks contendo `offerId` não cadastrados no painel administrativo do LumièreOS nunca ativam ou alteram assinaturas. Eles geram um estado de revisão em `billingWebhookReview` com status `unknown_offer` para análise humana.
- **Divergência de Oferta (Offer Mismatch):** Se o salão possui um faturamento pendente (`pendingOfferId`) gerado durante o checkout, o webhook aprovado recebido deve conter exatamente a mesma oferta. Qualquer divergência aborta a ativação do plano, gera uma trilha em `billingHistory` de auditoria interna e mantém a assinatura bloqueada, prevenindo burlas por substituição de ofertas mais baratas.
- **Independência de Nomes de Checkout:** A determinação do plano atualizado é baseada estritamente no mapeamento fixo de `offerId` cadastrados no sistema, nunca utilizando palavras contidas no título ou nome do checkout.

### 4. Gestão Consistente de Vencimentos e Atributos Reais
- **Consistência de E-mail:** O e-mail do checkout (`customerEmail`) atualiza o campo `caktoCheckoutEmail`, mas **nunca** sobrescreve ou altera o e-mail de propriedade do salão (`ownerEmail`), preservando a titularidade da conta.
- **Vencimento sem Invenções:** O campo `nextBillingDate` só é atualizado caso a data recebida no payload (`current_period_end` ou `next_billing_date`) exista, seja uma data válida e seu parse não resulte em `NaN`. Caso contrário, o salão é marcado para sincronização pendente (`billingSyncRequired`), sem chutar ou inventar datas arbitrárias.

---

## 🛡️ Casos de Teste de Segurança Cobertos

A lógica foi arquitetada para responder perfeitamente aos seguintes cenários de ataque e homologação:
1. **Webhook de Produção sem Segredo:** Rejeição imediata (`401 Unauthorized`) se o token enviado pela Cakto não coincidir com o `CAKTO_WEBHOOK_SECRET` do ambiente de produção.
2. **Homologação com Salão Inexistente:** Retorno antecipado amigável com falha segura (`salonFound: false`) sem tentar criar registros fictícios.
3. **Escalada de Privilégio via Webhook Teste:** Chamadas em modo de teste gravam apenas dados sob prefixo `homologation*` e nunca concedem acesso ao plano real.
4. **Substituição de Oferta (Offer Bypassing):** Tentativa de aprovar plano caro enviando oferta não correspondente à solicitação inicial do cliente é retida sob estado `offer_mismatch`.
5. **Tentativa de Ativação via Oferta Random:** Cadastro de oferta inexistente rejeita ativação sob estado `unknown_offer`.
6. **Integridade de Titularidade (Owner Protection):** Alteração de e-mail de faturamento preserva o `ownerEmail` do salão intacto.
7. **Falha de Formatação de Data:** Preserva o vencimento atual se a Cakto enviar datas malformadas ou nulas, agendando sincronização assistida.
8. **Prevenção contra Duplicidade:** Eventos legítimos já processados (`caktoLastEventId`) são descartados sob idempotência para evitar loops de cobrança desnecessários.

---

## 📈 Resultados da Validação Técnica
- **Lint (`npm run lint`):** Validado com sucesso (zero erros de tipagem/TypeScript).
- **Compilação (`npm run build`):** Compilação bem-sucedida, sem conflitos ou incompatibilidades.
- **Garantia de Escopo:** Nenhuma alteração foi realizada fora dos 4 arquivos explícitos definidos pelo usuário.
