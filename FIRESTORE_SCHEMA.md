# Esquema Oficial do Firestore - LumièreOS

**Versão:** 1.0

## Objetivo

O Firestore do LumièreOS é projetado para ser:
- Multi-tenant
- Escalável
- Seguro
- Performático
- Preparado para milhares de empresas

Nenhuma coleção deve conter dados compartilhados entre empresas.
Todo documento deve possuir um tenantId quando aplicável.

---

## Coleções

### tenants
Representa uma empresa.

Campos:
- id
- slug
- companyName
- document
- email
- phone
- plan
- subscriptionStatus
- timezone
- locale
- active
- createdAt
- updatedAt

### users
Representa um usuário autenticado.

Campos:
- uid
- tenantId
- email
- displayName
- photoURL
- role
- active
- createdAt
- updatedAt

### memberships
Relaciona usuários aos tenants.

Campos:
- tenantId
- uid
- role
- permissions
- invitedBy
- createdAt

*Um usuário poderá participar de mais de uma empresa futuramente.*

### customers
Clientes do estabelecimento.

Campos:
- tenantId
- name
- phone
- email
- birthday
- gender
- notes
- tags
- createdAt
- updatedAt

### professionals
Funcionários.

Campos:
- tenantId
- name
- email
- specialties
- commission
- active
- createdAt

### services
Serviços oferecidos.

Campos:
- tenantId
- name
- duration
- price
- category
- active
- createdAt

### products
Produtos vendidos.

Campos:
- tenantId
- name
- sku
- barcode
- stock
- minimumStock
- price
- active

### appointments
Agendamentos.

Campos:
- tenantId
- customerId
- professionalId
- serviceId
- startTime
- endTime
- status
- notes
- createdAt
- updatedAt

**Status permitidos:**
- scheduled
- confirmed
- completed
- cancelled
- no_show

### payments
Pagamentos internos.

Campos:
- tenantId
- appointmentId
- amount
- paymentMethod
- status
- createdAt

### subscriptions
Assinaturas da Cakto.

Campos:
- tenantId
- provider
- subscriptionId
- plan
- status
- nextBillingDate
- cancelAt
- updatedAt

**Status:**
- trial
- pending_payment
- active
- past_due
- cancelled
- expired
- blocked

### billing_events
Eventos recebidos do webhook.

Campos:
- eventId
- provider
- eventType
- payload
- processed
- receivedAt

*Esta coleção serve para garantir idempotência e auditoria.*

### notifications
Notificações do sistema.

Campos:
- tenantId
- title
- message
- read
- createdAt

### ai_conversations
Histórico de interações com a IA.

Campos:
- tenantId
- uid
- prompt
- response
- model
- tokens
- createdAt

### settings
Configurações do tenant.

Campos:
- tenantId
- businessHours
- theme
- integrations
- ai
- notifications

---

## Regras

### IDs
Nunca utilizar IDs sequenciais.
Sempre utilizar IDs gerados pelo Firestore ou UUIDs.

### Datas
Sempre utilizar Timestamp do Firestore.
Nunca salvar datas como string.

### Exclusão
Nunca excluir registros críticos.
Preferir:
`active = false`
ou
`deletedAt`

---

## Índices
Criar índices compostos para consultas frequentes.

Exemplos:
- **appointments**: tenantId + startTime
- **customers**: tenantId + name
- **services**: tenantId + active
- **subscriptions**: tenantId + status

---

## Segurança
Toda consulta deve validar:
- usuário autenticado;
- tenantId;
- permissões;
- assinatura ativa (quando aplicável).

Nenhum documento deve ser acessado por outro tenant.

---

## Convenções

**Campos booleanos:**
- active
- read
- deleted

**Campos de data:**
- createdAt
- updatedAt
- deletedAt

**Campos de relacionamento:**
- tenantId
- customerId
- professionalId
- serviceId
- appointmentId
- subscriptionId

*Sempre utilizar nomes em inglês para coleções e campos.*

---

## Evolução
Novas coleções somente poderão ser criadas quando:
- não houver coleção equivalente;
- seguirem o padrão desta documentação;
- forem compatíveis com a arquitetura multi-tenant;
- possuírem estratégia de segurança e índices.
