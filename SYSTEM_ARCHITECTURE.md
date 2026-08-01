# SYSTEM_ARCHITECTURE.md

## Arquitetura Oficial do LumièreOS

**Versão:** 1.0

---

## Visão Geral

O LumièreOS é um SaaS multi-tenant para gestão de empresas do setor da beleza.

A arquitetura segue o princípio de separação de responsabilidades:
- **Frontend** → Interface e experiência do usuário.
- **Backend** → Regras de negócio e integrações.
- **Firestore** → Persistência de dados.
- **Gemini** → Inteligência Artificial.
- **Cakto** → Assinaturas e pagamentos.
- **Vercel** → Hospedagem.

---

## Componentes

### Frontend
Responsabilidades:
- Interface
- Navegação
- Formulários
- Consumo da API
- Estado da aplicação

*Nunca contém regras de negócio críticas.*

---

### Backend
Responsabilidades:
- Autenticação
- Autorização
- Validações
- Firestore
- Gemini
- Cakto
- Webhooks

*Todo acesso ao Firestore deve ocorrer por meio do backend quando envolver lógica de negócio ou operações sensíveis.*

---

### Firestore
Responsável por:
- Empresas (Tenants)
- Usuários
- Clientes
- Agenda
- Serviços
- Produtos
- Assinaturas
- Configurações

*Toda consulta deve respeitar o tenantId.*

---

### Gemini
Responsável por:
- Assistente inteligente
- Geração de conteúdo
- Sugestões
- Classificações
- Resumos
- Relatórios

*Nunca altera dados diretamente. Toda resposta passa por validação antes de ser utilizada.*

---

### Cakto
Responsável por:
- Checkout
- Assinaturas
- Renovação
- Cancelamento
- Webhooks

*A Cakto é a única fonte de verdade para o estado financeiro da assinatura.*

---

## Fluxo de Autenticação

1. Usuário realiza login com Firebase Authentication.
2. O frontend obtém o ID Token.
3. O token é enviado ao backend.
4. O backend valida o token com Firebase Admin.
5. O backend identifica o usuário e o tenant.
6. A autorização é aplicada conforme o papel (role) e o status da assinatura.

---

## Fluxo de Cadastro

1. Usuário cria uma conta.
2. Firebase Authentication cria o usuário.
3. O backend cria o Tenant.
4. O backend cria a Membership com papel de Owner.
5. O status inicial da assinatura é "pending_payment" ou "trial", conforme a estratégia do produto.

---

## Fluxo de Assinatura

1. Usuário escolhe um plano.
2. O backend cria a sessão de checkout na Cakto.
3. O usuário conclui o pagamento.
4. A Cakto envia um webhook.
5. O backend valida a autenticidade do webhook.
6. O Firestore é atualizado.
7. A assinatura passa para "active".
8. O acesso é liberado.

*O frontend nunca altera o estado da assinatura.*

---

## Fluxo da IA

1. Usuário envia uma solicitação.
2. O backend prepara o contexto.
3. O Gemini processa a solicitação.
4. A resposta é validada (Zod/JSON).
5. O backend decide como utilizar a resposta.
6. O frontend recebe apenas o resultado necessário.

---

## Fluxo de Permissões

Cada requisição protegida verifica:
- Usuário autenticado.
- Tenant válido.
- Papel do usuário.
- Permissões específicas.
- Assinatura ativa (quando exigido).

*Somente após essas validações a ação é executada.*

---

## Organização dos Módulos

Cada módulo deve ser independente.

Estrutura recomendada:
```text
modules/
  - auth
  - billing
  - customers
  - appointments
  - professionals
  - services
  - products
  - inventory
  - crm
  - ai
  - notifications
  - settings
```

Cada módulo deve conter:
- controllers
- services
- repositories
- validators
- types
- routes
- utils

---

## Comunicação entre Componentes

- Frontend → Backend → Serviços → Repositórios → Firestore
- Frontend → Backend → Gemini
- Frontend → Backend → Cakto

*Nenhum componente React acessa integrações externas diretamente.*

---

## Segurança

- Firebase Admin apenas no servidor.
- Secrets somente em variáveis de ambiente.
- Validação de entrada em todas as APIs.
- Regras do Firestore alinhadas ao modelo multi-tenant.
- Webhooks com validação de assinatura.

---

## Escalabilidade

A arquitetura deve suportar:
- milhares de tenants;
- múltiplos usuários por tenant;
- módulos independentes;
- novas integrações sem alterar o núcleo do sistema.

---

## Princípios Arquiteturais

1. Separação de responsabilidades.
2. Baixo acoplamento.
3. Alta coesão.
4. Reutilização.
5. Segurança por padrão.
6. Escalabilidade horizontal.
7. Compatibilidade retroativa sempre que possível.

---

## Fonte da Verdade

As seguintes integrações são consideradas autoridades em seus respectivos domínios:
- **Firebase Authentication** → Identidade do usuário.
- **Firestore** → Dados operacionais.
- **Cakto** → Estado da assinatura.
- **Gemini** → Geração de conteúdo e assistência.
- **Vercel** → Ambiente de execução.

*Nenhum outro componente deve substituir essas responsabilidades.*
