# Documento de Requisitos do Produto (PRD) - LumièreOS

Este documento serve como a especificação oficial de produto e guia de testes para o **LumièreOS**, um ecossistema SaaS de alta performance para gestão e automação de salões de beleza e clínicas de estética.

---

## 1. Visão Geral do Produto

O **LumièreOS** é uma plataforma que consolida agendamentos, controle financeiro, inteligência de marketing e gestão de assinaturas para proprietários de salões de beleza. A plataforma opera sob um modelo de negócios SaaS (Software as a Service) com faturamento recorrente, integrado nativamente aos gateways de pagamento **Asaas** e **Asaas**.

### Objetivos Principais:
- **Redução do Churn:** Automação total da liberação e bloqueio de recursos conforme o status de pagamento.
- **Eficiência Operacional:** Provisionamento instantâneo de contas no Firebase Firestore após confirmação do webhook.
- **Flexibilidade Multigateway:** Suporte simultâneo a fluxos de checkout e faturamento via Asaas (recorrência externa) e Asaas (assinaturas e cobranças flexíveis).

---

## 2. Arquitetura Técnica & Fluxos de Integração

A aplicação é construída com um frontend React moderno (Vite) e um backend serverless distribuído (Vercel Functions).

```
┌─────────────────┐       ┌─────────────────┐       ┌──────────────────────┐
│  Gateway Asaas  │ ────> │  Vercel Server  │ ────> │  Firebase Firestore  │
│  & Asaas (Web)  │       │  /api/webhooks  │       │     (Salons/User)    │
└─────────────────┘       └─────────────────┘       └──────────────────────┘
```

### 2.1 Módulo Shared Admin (Firebase)
O acesso ao Firestore e Auth em ambiente serverless foi unificado em `api/_shared/firebaseAdmin.ts` utilizando autenticação segura via Service Account corporativa:
- **`getAdminDb()`**: Retorna a instância ativa do Firestore.
- **`getAdminAuth()`**: Retorna o serviço de Autenticação para validação de tokens JWT (`Bearer token`).
- **Resiliência a Inicializações Duplicadas:** Implementa o padrão Singleton para evitar estouro de conexões em ambientes Serverless (`getApps()`).

### 2.2 Sincronização de Assinaturas (Webhooks)
Os webhooks realizam a escuta ativa de eventos de pagamento e mapeiam os seguintes estados de assinatura no banco de dados (`salons`):

| Evento Recebido (Asaas) | Mapeamento no Banco (`paymentStatus` / `subscriptionStatus`) | Ação Operacional |
|:---|:---|:---|
| `purchase_approved` / `subscription_renewed` | `paid` / `active` | Libera acesso total ao painel do salão e atualiza data do próximo faturamento. |
| `purchase_refused` / Eventos de falha | `overdue` / `overdue` | Alerta o usuário no sistema sobre atraso, sem cortar o acesso imediatamente. |
| `subscription_canceled` | `canceled` / `canceled` | Interrompe o acesso e envia o salão para o fluxo de reativação de assinatura. |
| `subscription_created` | `pending` / `trial` | Inicia o período de teste monitorado. |

---

## 3. Roteiro de Testes Recomendado

Para garantir a homologação completa das integrações, execute os seguintes testes utilizando ferramentas como **Postman**, **Insomnia** ou comandos `curl`.

### 3.1 Teste 1: Validação do Webhook Asaas (Aprovação de Compra)
Este teste simula um pagamento bem-sucedido originado do checkout da Asaas.

- **Método:** `POST`
- **URL:** `https://lumiere-os.vercel.app/api/asaas/webhook` (Substitua pela sua URL ativa)
- **Headers:**
  ```http
  Content-Type: application/json
  x-asaas-token: <SEU_ASAAS_WEBHOOK_SECRET>
  ```
- **Payload (JSON):**
  ```json
  {
    "event": "purchase_approved",
    "id": "evt_test_12345",
    "order_id": "ord_998877",
    "subscription_id": "sub_active_test_99",
    "amount": 149.90,
    "external_id": "SALON_ID_PARA_TESTE"
  }
  ```
- **Resultado Esperado:** Retorno `200 OK` com payload contendo `{ "success": true, "eventProcessed": "purchase_approved" }`. O status do salão especificado deve mudar para `active` e `paid` no Firestore.

---

### 3.2 Teste 2: Webhook de Teste/Ping (Sem dados de Salão)
Simula o clique do botão "Testar" no painel da Asaas, onde o payload não carrega dados reais ou IDs de clientes.

- **Método:** `POST`
- **URL:** `https://lumiere-os.vercel.app/api/asaas/webhook`
- **Headers:**
  ```http
  Content-Type: application/json
  x-asaas-token: <SEU_ASAAS_WEBHOOK_SECRET>
  ```
- **Payload (JSON):**
  ```json
  {
    "event": "purchase_approved",
    "id": "evt_ping_only"
  }
  ```
- **Resultado Esperado:** Retorno `200 OK` com payload `{ "success": true, "info": "Webhook de teste/ping recebido com sucesso." }`. O webhook detecta que não há contexto de salão associado e finaliza graciosamente para não retornar erros de banco de dados (`500`).

---

### 3.3 Teste 3: Proteção de Segurança e Token Inválido
Garante que requisições não autorizadas sejam devidamente bloqueadas.

- **Método:** `POST`
- **URL:** `https://lumiere-os.vercel.app/api/asaas/webhook`
- **Headers:**
  ```http
  Content-Type: application/json
  x-asaas-token: token_incorreto_ou_malicioso
  ```
- **Resultado Esperado:** Retorno `401 Unauthorized` com payload `{ "error": "Assinatura inválida de webhook." }`.

---

## 4. Variáveis de Ambiente Necessárias (Vercel/.env)

Para que o ambiente de produção execute em conformidade com as regras deste PRD, as seguintes chaves devem estar configuradas no painel da Vercel:

```env
# Configurações do Firebase Admin
FIREBASE_PROJECT_ID="lumiereos-11a95"
FIREBASE_CLIENT_EMAIL="firebase-adminsdk-fbsvc@lumiereos-11a95.iam.gserviceaccount.com"
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

# Segredos de Integração de Cobrança
ASAAS_WEBHOOK_SECRET="seu_segredo_definido_no_painel_da_asaas"
```

---

*LumièreOS - Gestão Inteligente para Salões de Beleza de Alto Padrão.*
