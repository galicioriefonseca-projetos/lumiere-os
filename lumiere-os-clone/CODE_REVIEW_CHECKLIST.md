# CODE_REVIEW_CHECKLIST.md

## Checklist Oficial de Revisão de Código

**Versão:** 1.0

---

## Objetivo

Toda implementação deve passar por uma revisão técnica antes de ser considerada concluída.

O objetivo é detectar:
- Bugs
- Regressões
- Código duplicado
- Problemas de arquitetura
- Problemas de segurança
- Problemas de performance

O código somente pode ser considerado pronto quando todos os itens deste checklist forem atendidos.

---

## Arquitetura
✓ Respeita a arquitetura oficial?
✓ Segue a Constituição do LumièreOS?
✓ Não criou acoplamento desnecessário?
✓ Mantém baixo acoplamento?
✓ Mantém alta coesão?

---

## Estrutura
✓ Criou arquivos apenas quando necessário?
✓ Evitou duplicação?
✓ Reutilizou componentes existentes?
✓ Reutilizou Hooks?
✓ Reutilizou Services?
✓ Reutilizou Validators?
✓ Reutilizou Repositories?

---

## Firestore
✓ Todas as consultas utilizam tenantId?
✓ Nenhum dado pode ser acessado entre empresas?
✓ Criou índices quando necessário?
✓ Evitou leituras desnecessárias?
✓ Evitou gravações repetidas?
✓ Utilizou Timestamp?

---

## Segurança
✓ Firebase Admin apenas no backend?
✓ Secrets protegidos?
✓ Entradas validadas?
✓ JWT validado?
✓ Permissões verificadas?
✓ Role validada?
✓ Tenant validado?
✓ Dados sensíveis protegidos?

---

## IA
✓ Prompt estruturado?
✓ Resposta validada?
✓ JSON validado?
✓ Tratou hallucinations?
✓ Tratou timeout?
✓ Tratou quota?
✓ Tratou rate limit?

---

## Billing
✓ Frontend não altera assinatura?
✓ Webhook validado?
✓ Idempotência implementada?
✓ Eventos registrados?
✓ Plano sincronizado?
✓ Status sincronizado?

---

## Backend
✓ Controller sem regra de negócio?
✓ Service centraliza a lógica?
✓ Repository acessa Firestore?
✓ Tratamento de erros implementado?
✓ Logs estruturados?

---

## Frontend
✓ Componentes pequenos?
✓ Hooks reutilizados?
✓ Estados mínimos?
✓ Loading implementado?
✓ Feedback ao usuário?
✓ Tratamento de erro?
✓ Responsividade?
✓ Acessibilidade básica?

---

## TypeScript
✓ Nenhum any?
✓ Tipagem completa?
✓ Interfaces reutilizadas?
✓ Types reutilizados?
✓ Generics quando necessário?

---

## Performance
✓ Evitou re-renderizações?
✓ Evitou consultas duplicadas?
✓ Evitou loops desnecessários?
✓ Utilizou paginação?
✓ Utilizou lazy loading quando aplicável?

---

## UX
✓ Fluxo intuitivo?
✓ Feedback visual?
✓ Estados de carregamento?
✓ Mensagens claras?
✓ Confirmações em ações críticas?

---

## Testes
✓ Testes unitários?
✓ Testes de integração?
✓ Casos de erro?
✓ Casos extremos?
✓ Fluxos críticos?

---

## Deploy
✓ Compatível com Vercel?
✓ Variáveis de ambiente documentadas?
✓ Build sem erros?
✓ Lint sem erros?
✓ TypeScript sem erros?

---

## Documentação
✓ Atualizou documentação?
✓ Atualizou changelog?
✓ Atualizou arquitetura quando necessário?
✓ Atualizou esquema do Firestore quando necessário?

---

## Compatibilidade
✓ Não quebrou funcionalidades existentes?
✓ Não alterou APIs públicas?
✓ Não alterou coleções sem migração?
✓ Não alterou contratos existentes?

---

## Produção

Antes de finalizar responder internamente:
1. Compila?
2. É seguro?
3. É escalável?
4. É simples?
5. É reutilizável?
6. Está consistente com o restante do projeto?
7. Pode ser colocado em produção hoje?

Se qualquer resposta for NÃO, a implementação deve ser revisada antes da entrega.

---

## Critério Final

Uma tarefa somente é considerada concluída quando:
- código implementado;
- documentação atualizada;
- arquitetura preservada;
- checklist aprovado;
- pronto para produção.
