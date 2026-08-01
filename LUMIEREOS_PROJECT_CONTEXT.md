# LumièreOS — Project Context

## Visão Geral

LumièreOS é uma plataforma SaaS (Software as a Service) destinada à gestão de empresas do setor da beleza.

O sistema atende principalmente:
- Salões de Beleza
- Barbearias
- Clínicas de Estética
- Clínicas de Harmonização Facial
- Spas
- Centros de Beleza

Cada empresa é tratada como um Tenant totalmente isolado.
Nenhum dado pode ser compartilhado entre empresas.

---

## Objetivo

Centralizar toda a operação do estabelecimento em um único sistema.

O sistema deve oferecer:
- Agenda
- Clientes
- Profissionais
- Serviços
- Produtos
- Financeiro
- Pagamentos
- CRM
- Relatórios
- Inteligência Artificial
- Configurações

---

## Stack Oficial

**Frontend**
- React 19
- TypeScript
- Vite
- TailwindCSS
- shadcn/ui
- React Router
- React Hook Form
- Zod

**Backend**
- Express

**Banco**
- Firebase Firestore

**Autenticação**
- Firebase Authentication

**Administração**
- Firebase Admin SDK

**Inteligência Artificial**
- Google Gemini
  - SDK oficial: `@google/genai`

**Pagamentos**
- Cakto

**Hospedagem**
- Vercel

---

## Arquitetura

O projeto utiliza arquitetura cliente-servidor.

**Frontend:**
- Interface
- Navegação
- Estado da aplicação
- Formulários

**Backend:**
- Regras de negócio
- Integração Gemini
- Integração Cakto
- Firebase Admin
- Segurança

---

## Multi-Tenant

Cada empresa possui seu próprio Tenant.
Todo registro deve pertencer exatamente a um Tenant.
Toda consulta deve considerar o tenantId.
Nunca acessar dados sem filtrar pelo Tenant.

---

## Autenticação

A autenticação é feita exclusivamente pelo Firebase Authentication.
O backend deve validar o ID Token em todas as rotas protegidas.

---

## Autorização

Cada usuário possui um papel (Role).

Exemplos:
- owner
- admin
- manager
- employee

Permissões devem ser verificadas no backend.

---

## Firestore

Toda coleção deve seguir o modelo multiempresa.

Exemplos:
- tenants
- customers
- appointments
- services
- products
- employees
- subscriptions
- billing_events
- notifications
- settings

---

## Pagamentos

O sistema utiliza a Cakto.

Fluxo:
Cadastro → Escolha do Plano → Checkout → Pagamento → Webhook → Atualização do Firestore → Assinatura Ativa

O frontend nunca ativa uma assinatura.

---

## Inteligência Artificial

A IA é baseada no Google Gemini.

Ela auxilia o usuário em tarefas como:
- Resumos
- Sugestões
- CRM
- Atendimento
- Marketing
- Relatórios
- Automações

A IA nunca deve alterar dados críticos sem validação.
Sempre preferir respostas estruturadas em JSON.

---

## Deploy

O deploy oficial é realizado na Vercel.
O ambiente utiliza variáveis de ambiente para todas as credenciais.
Nenhum segredo pode ser armazenado no frontend.

---

## Qualidade

Todo código deve:
- utilizar TypeScript;
- evitar duplicação;
- seguir SOLID;
- seguir Clean Code;
- tratar erros;
- utilizar tipagem forte;
- reutilizar componentes.

---

## Objetivo Técnico

O LumièreOS deve ser preparado para milhares de empresas simultaneamente.

Toda decisão técnica deve considerar:
- escalabilidade;
- segurança;
- desempenho;
- baixo custo operacional;
- facilidade de manutenção.

---

## Roadmap

**Curto prazo:**
- Cadastro
- Login
- Pagamentos
- Agenda
- Clientes

**Médio prazo:**
- CRM
- Financeiro
- Estoque
- IA Assistente
- Relatórios

**Longo prazo:**
- WhatsApp
- Automações
- Marketplace
- API Pública
- Aplicativo Mobile

---

## Regra Principal

Sempre analisar a arquitetura existente antes de implementar qualquer funcionalidade.
Novos recursos devem preservar compatibilidade, reutilizar componentes existentes e manter a consistência do projeto.
