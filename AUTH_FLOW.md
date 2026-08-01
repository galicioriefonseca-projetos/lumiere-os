# AUTH_FLOW.md

## Fluxo Oficial de Autenticação e Autorização

**Versão:** 1.0

---

## Objetivo

Definir como usuários são autenticados, autorizados e associados a empresas (tenants) dentro do LumièreOS.

O sistema utiliza Firebase Authentication como provedor oficial de identidade.

---

## Conceitos

### Usuário (User)
Representa uma pessoa autenticada pelo Firebase.

Exemplo:
- Proprietário
- Gerente
- Funcionário

Um usuário pode pertencer a um ou mais tenants no futuro.

---

### Tenant
Representa uma empresa.

Exemplos:
- Salão
- Barbearia
- Clínica

Todos os dados do sistema pertencem a um tenant.

---

### Membership
Relaciona um usuário a um tenant.

Campos mínimos:
- tenantId
- uid
- role
- active
- createdAt

---

## Papéis (Roles)

### owner
Responsável pela empresa.

Permissões:
- acesso total;
- gerenciamento de usuários;
- gerenciamento da assinatura;
- configurações;
- financeiro.

---

### admin
Administrador operacional.

Permissões:
- clientes;
- agenda;
- serviços;
- profissionais;
- estoque;
- relatórios.

Não pode alterar a assinatura.

---

### manager
Gerente.

Permissões definidas conforme necessidade do estabelecimento.

---

### employee
Funcionário.

Permissões limitadas.

Exemplos:
- visualizar agenda;
- atender clientes;
- registrar serviços.

---

## Processo de Cadastro

1. Usuário cria conta.
2. Firebase Authentication gera o UID.
3. Backend cria o Tenant.
4. Backend cria a Membership como owner.
5. Backend cria configurações iniciais.
6. Usuário é direcionado para a escolha do plano ou período de teste.

---

## Processo de Login

1. Usuário realiza login no Firebase.
2. Frontend recebe o ID Token.
3. Token é enviado ao backend.
4. Backend valida o token com Firebase Admin.
5. Backend identifica o tenant ativo.
6. Backend verifica a Membership.
7. Backend verifica a assinatura.
8. Backend retorna o contexto do usuário.

---

## Troca de Tenant (futuro)

Caso um usuário pertença a mais de uma empresa:
1. O backend lista os tenants disponíveis.
2. O usuário seleciona o tenant desejado.
3. O backend emite um novo contexto de sessão.
4. Todas as consultas passam a utilizar o tenant selecionado.

---

## Validações Obrigatórias

Toda requisição autenticada deve verificar:
- ID Token válido;
- usuário ativo;
- tenant existente;
- membership ativa;
- papel (role);
- permissões;
- assinatura (quando aplicável).

Nenhuma operação deve prosseguir sem essas verificações.

---

## Permissões

Permissões devem ser verificadas no backend.
O frontend apenas controla a experiência do usuário (ex.: ocultar menus), mas nunca é responsável por impedir ações críticas.

---

## Sessão

O contexto autenticado deve conter:
- uid;
- tenantId;
- role;
- permissões;
- plano;
- status da assinatura.

Esse contexto deve ser reutilizado durante toda a sessão.

---

## Convites

Fluxo recomendado:
1. Owner/Admin convida um usuário.
2. Sistema registra o convite.
3. Usuário recebe o link.
4. Após aceitar, uma Membership é criada.

---

## Recuperação de Senha

Responsabilidade do Firebase Authentication.
O backend não manipula senhas.

---

## Encerramento de Sessão

Ao fazer logout:
- remover tokens locais;
- limpar cache do usuário;
- limpar contexto do tenant;
- redirecionar para a tela de login.

---

## Segurança

Nunca confiar em dados enviados pelo cliente.

Sempre validar:
- token;
- tenantId;
- role;
- permissões.

Nunca aceitar "tenantId" informado pelo frontend sem validação da Membership.

---

## Auditoria

Registrar eventos relevantes:
- login;
- logout;
- criação de usuário;
- convite;
- alteração de papel;
- bloqueio de acesso.

---

## Evolução

A arquitetura deve permitir futuramente:
- múltiplos tenants por usuário;
- autenticação social;
- autenticação multifator (MFA);
- SSO corporativo;
- auditoria avançada.

---

## Fonte da Verdade

- **Firebase Authentication** → Identidade do usuário.
- **Firestore** → Relação usuário/tenant.
- **Membership** → Papel e permissões.
- **Cakto** → Estado da assinatura.

Nenhum outro componente deve substituir essas responsabilidades.
