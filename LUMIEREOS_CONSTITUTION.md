# Constituição do LumièreOS

**Versão:** 1.0

## Objetivo

O LumièreOS é um SaaS para gestão de salões de beleza, clínicas de estética, barbearias e empresas do setor da beleza.

O objetivo principal é oferecer uma plataforma moderna, rápida, segura e escalável, permitindo que pequenas e médias empresas administrem seus negócios em um único sistema.

Toda implementação deve priorizar:
- simplicidade;
- escalabilidade;
- segurança;
- manutenção;
- experiência do usuário.

---

## Arquitetura Oficial

**Frontend**
- React 19
- TypeScript
- Vite
- TailwindCSS
- shadcn/ui

**Backend**
- Express
- Firebase Admin SDK

**Banco de Dados**
- Firestore

**Autenticação**
- Firebase Authentication

**Inteligência Artificial**
- Google Gemini (@google/genai)

**Pagamentos**
- Cakto

**Deploy**
- Vercel

---

## Princípios Fundamentais

1. **Toda funcionalidade deve pertencer a um módulo.**
   Nunca criar código "solto".

2. **Toda regra de negócio pertence ao backend.**
   Nunca colocar regra de negócio dentro dos componentes React.

3. **Componentes React nunca acessam diretamente o Firestore.**
   Sempre utilizar Services ou APIs.

4. **Toda entrada do usuário deve ser validada.**
   Utilizar Zod sempre que possível.

5. **Nunca utilizar any.**
   A tipagem deve ser forte.

6. **Nunca duplicar código.**
   Antes de criar um componente ou função nova, verificar se já existe algo semelhante.

7. **Sempre reutilizar:**
   - hooks;
   - components;
   - services;
   - utilities;
   - validators.

8. **Todo código novo deve possuir tratamento de erros.**

9. **Nunca armazenar segredos no frontend.**

10. **Firebase Admin SDK só pode ser utilizado no servidor.**

---

## Estrutura e Regras de Negócio

### Firestore
O Firestore é multiempresa. Toda informação pertence a um tenant (salonId).
Nenhuma coleção deve conter dados compartilhados entre empresas.
Toda consulta deve considerar o tenant atual.

### Autenticação
A autenticação oficial é Firebase Authentication.
Nunca criar outro mecanismo paralelo.

### Pagamentos
Toda assinatura é controlada pela Cakto.
O frontend nunca ativa um plano. A ativação ocorre exclusivamente através do webhook.

### Inteligência Artificial
Toda integração utiliza Google Gemini.
A IA nunca toma decisões críticas de negócio.
Respostas da IA devem ser validadas antes de serem persistidas.
Sempre utilizar JSON estruturado quando possível.

### Segurança
Toda API deve validar:
- autenticação;
- autorização;
- tenant;
- permissões.

Nunca confiar em dados enviados pelo cliente.

### Performance
Sempre minimizar:
- leituras do Firestore;
- gravações desnecessárias;
- re-renderizações.

### Organização
Sempre preferir arquitetura modular.
Exemplo:
```text
modules/
  auth/
  appointments/
  customers/
  billing/
  ai/
  settings/
  notifications/
```

### Qualidade
Todo código novo deve:
- ser legível;
- possuir nomes claros;
- evitar comentários desnecessários;
- evitar complexidade;
- seguir SOLID;
- seguir Clean Code.

### Compatibilidade
Nenhuma alteração pode quebrar funcionalidades existentes.
Mudanças estruturais devem ser compatíveis com versões anteriores ou possuir estratégia de migração.

---

## Objetivo Final

Toda decisão técnica deve responder positivamente às seguintes perguntas:
1. É segura?
2. É simples?
3. É escalável?
4. É fácil de manter?
5. Mantém consistência com a arquitetura?

Se qualquer resposta for "não", a implementação deve ser reavaliada antes de ser aceita.
