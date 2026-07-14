
# Relatório Técnico - Patch P0 de Segurança do Billing Cakto

## Arquivos Alterados
- `api/cakto/create-checkout.ts`
- `server/index.ts`
- `api/cakto/webhook.ts`
- `api/cakto/update-payment-method.ts`
- `src/pages/MasterPanel.tsx`
- `src/pages/dashboard/SubscriptionPage.tsx`

## Funcionalidades Implementadas
1. **Sincronização Server/Express**: A lógica da rota `/api/cakto/create-checkout` foi sincronizada entre a função serverless (Vercel) e o servidor Express. O comportamento de validação agora é idêntico em ambos os ambientes.
2. **Proteção do Plano Founder**: 
   - A geração de checkout para o plano `founder` foi rigidamente protegida no backend. Somente clientes que já possuem o plano, têm a tag `isFounder` ou são `platform_admin` conseguem gerar novos checkouts ou atualizar cobrança para este plano.
   - Qualquer tentativa externa de gerar checkout `founder` por conta não autorizada resulta em `403 Forbidden`.
3. **Isolamento de Homologação**: 
   - Eventos `isSimulation=true` (ou `skipTokenValidation=true` no webhook) escrevem **estritamente** em campos iniciados com `homologation*`. 
   - Os dados reais do salão (`plan`, `subscriptionStatus`, `paymentStatus`, etc.) não são afetados de forma alguma por webhooks de homologação, prevenindo escalada de privilégios ou quebra de acesso por falhas de teste.
4. **Proteção contra Oferta Divergente (Offer Mismatch)**: 
   - No recebimento do webhook de pagamento aprovado da Cakto, se a oferta enviada (`offerId`) não bater com a `pendingOfferId` armazenada durante o checkout, a requisição é interceptada.
   - O plano **não** é ativado, uma trilha de auditoria é salva em `billingHistory` e a execução termina em 200 OK para evitar repetições da Cakto, retornando `requiresReview: true`.
5. **Correção do `subscription_created`**: Corrigido bug onde o status pending de homologação estava afetando acidentalmente o status real.
6. **Métodos de Pagamento**: Atualizações via PATCH da Cakto em `update-payment-method.ts` foram temporariamente convertidas para "Configuração Assistida" enquanto a API não possui endpoint homologado para troca direta (ex. link de Pix Automático). Nenhum campo real no Firestore é modificado neste fluxo prematuro.

## Resultados dos Testes (Lint/Build)
Os testes `npm run lint` e `npm run build` finalizaram com sucesso, as importações e integrações de dados estão de acordo.
