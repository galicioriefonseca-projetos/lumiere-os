Asaas foi descontinuado como gateway ativo do LumièreOS.

# Planejamento da Integração de Assinaturas Recorrentes Asaas • LumièreOS (DEPRECATED / DESATIVADO)

> ⚠️ **IMPORTANTE**: Este documento e o planejamento de integração com o Asaas foram desativados e marcados como descontinuados em conformidade com as novas decisões arquiteturais do LumièreOS. O Asaas e o Mercado Pago foram completamente desativados dos fluxos visuais de produção, mantendo apenas suporte legados de dados históricos opcionais. Toda assinatura recorrente ativa utiliza **Cakto**, e o fluxo alternativo utiliza **Manual PIX**.

Este documento descreve as antigas diretrizes de segurança, compatibilidade retroativa e o roadmap de implementação do gateway **Asaas** como motor de cobrança e assinaturas do LumièreOS.

---

## 1. Novos Campos no Firestore (`Salon`)

Para gerenciar o estado da assinatura no Asaas sem interferir com os campos atuais do Stripe ou Mercado Pago, os seguintes campos opcionais foram introduzidos na interface `Salon` (`src/types/index.ts`):

- **`asaasCustomerId`** (`string`, opcional): ID exclusivo do cliente registrado no painel Asaas.
- **`asaasSubscriptionId`** (`string`, opcional): ID da assinatura recorrente ativa no Asaas.
- **`asaasCheckoutUrl`** (`string`, opcional): URL segura gerada pelo Asaas para finalização de pagamento/checkout do salão.
- **`asaasLastPaymentId`** (`string`, opcional): ID do último pagamento transacionado.
- **`asaasLastEvent`** (`string`, opcional): Nome do último webhook processado (ex: `PAYMENT_RECEIVED`, `SUB_UPDATED`).
- **`founderInitialPrice`** (`number`, opcional): Preço promocional inicial do plano Founder (ex: R$ 297,00).
- **`founderInitialPriceEndsAt`** (`number`, opcional): Timestamp (epoch ms) do fim da vigência do preço promocional.
- **`founderFuturePrice`** (`number`, opcional): Preço subsequente que será cobrado após o fim da vigência promocional.

### Por que são opcionais?
Todos os campos são estritamente opcionais para garantir que os documentos de salões já criados e ativos no banco de dados continuem sendo carregados e interpretados perfeitamente pelo aplicativo, sem lançar erros de validação estrutural ou causar quebras de runtime.

---

## 2. Princípios de Segurança e Governança de Dados

- **Isolamento de Chaves Privadas (API Keys)**: Chaves como `ASAAS_API_KEY` e `ASAAS_WEBHOOK_SECRET` **nunca** serão expostas ao frontend. Todas as comunicações com o gateway serão intermediadas por rotas seguras do servidor (Express no Cloud Run / Cloud Functions).
- **Sem Modificações Destrutivas**: Os dados históricos de cobrança (`manual_pix` ou assinaturas Stripe) nunca serão apagados ou alterados diretamente. O campo `billingProvider` só será atualizado para `'asaas'` se o cliente optar por migrar ativamente seu fluxo de cobrança.
- **Tolerância a Falhas**: Caso o sistema do Asaas fique indisponível, os salões já ativos (`subscriptionStatus: 'active'`) continuam operando normalmente via fallback local do Firestore.

---

## 3. Regras Específicas do Plano Founder (Preservação de Direitos)

A cliente Founder já existente (ex: Salão Founder Exemplo) deve ser tratada como assinante ativa e protegida contra cobranças ou interrupções automáticas.

1. **Preço Promocional**: O plano possui suporte a condições especiais de preço com reajuste agendado (`founderInitialPrice` / `founderFuturePrice`).
2. **Acesso Sem Bloqueio**: Clientes com `plan: 'founder'` não passam por fluxos de suspensão automática de conta, a menos que o admin da plataforma decida intervir manualmente via Master Panel.
3. **Migração Voluntária**: A founder só será integrada ao Asaas se o admin gerar o link de checkout e ela preencher as informações de pagamento de forma assistida.

---

## 4. Próximos Passos (Fases do Projeto)

### Fase 1: Fundamentação e Tipagem (Concluída nesta etapa)
- [x] Declaração de tipos TypeScript seguros na interface `Salon`.
- [x] Ajuste seguro na configuração unificada de billing (`src/config/billing.ts`).
- [x] Documentação e mapeamento de riscos.
- [x] Criação de chaves no `.env.example`.

### Fase 2: Integração de Backend e Webhooks (Concluída nesta etapa)
- [x] Implementação de rotas seguras `/api/asaas/*` no servidor Express.
- [x] Criação de endpoints de webhook para receber atualizações do Asaas (`PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`, `SUB_UPDATED`).
- [x] Criação do helper de sincronização com o banco Firestore usando o Firebase Admin SDK no servidor.

### Fase 2.5: Homologação Técnica (Concluída)
- [x] Implementação de middleware `authenticateRequest` usando o Firebase Admin SDK para validar ID tokens JWT do cliente.
- [x] Proteção contra vazamento ou criação de cobranças cruzadas: O backend agora valida se `salonData.ownerId === user.uid` antes de permitir qualquer alteração ou requisição ao Asaas.
- [x] Confirmação de isolamento de segredo: `ASAAS_API_KEY` permanece 100% no servidor e nunca vaza para o cliente.
- [x] Proteção avançada de idempotência para webhooks: Verificação se `asaasLastEvent === event` e `asaasLastPaymentId === payment.id` para evitar múltiplas gravações em retentativas redundantes.
- [x] Validação rigorosa de conformidade de estados de pagamento/assinatura.
- [x] Desativação e remoção de obrigatoriedade dos segredos legados do Mercado Pago no `.env.example`, garantindo que o servidor inicie sem as variáveis `MERCADOPAGO_WEBHOOK_SECRET`, `MP_PLAN_*`, etc.
- [x] Desacoplamento de valores de planos no servidor, fornecendo fallback de valores e introduzindo chaves opcionais `ASAAS_PLAN_*` para parametrização.

### Fase 3: Interface do Usuário e Migração (Etapa Final)
- [ ] Implementação da tela de checkout / link de faturamento na `AccountPage`.
- [ ] Exibição das faturas futuras e histórico de pagamentos do Asaas.
- [ ] Controles no Master Panel para administradores vincularem IDs do Asaas manualmente se necessário.
