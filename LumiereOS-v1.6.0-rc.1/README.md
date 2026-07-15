# LumièreOS

SaaS de gestão para salões, clínicas de estética e negócios de beleza, com agenda, clientes, produção, financeiro, estoque, equipe, metas e faturamento recorrente.

> Versão: **1.6.0-rc.1 — Release Candidate comercial**. A publicação para cobrança real exige concluir o checklist externo em `RELEASE_CHECKLIST.md`.

## Stack

- React 19, TypeScript e Vite
- Express e funções serverless na Vercel
- Firebase Authentication, Firestore e Firebase Admin
- Cakto para checkout e assinatura recorrente
- Vitest e Firebase Rules Unit Testing

## Instalação

```bash
npm ci
cp .env.example .env
npm run dev
```

## Validação da release

```bash
npm run lint
npm run test:webhook
npm run test:billing
npm run test:rules
npm run build
npm run check:release
```

O teste das regras exige Java e o Firestore Emulator disponível. Não considere a release validada quando esse comando não concluir.

## Estrutura canônica

```text
api/                    Funções serverless
server/                 Servidor Express
src/components/ui/      Componentes de interface
src/lib/                Bibliotecas do frontend
src/pages/              Telas
firestore.rules         Única fonte oficial das regras
scripts/                Verificações de release
```

Não recrie as antigas pastas `components/` ou `lib/` na raiz, nem `src/firestore.rules`.

## Configuração

Consulte `.env.example`, `docs/COMMERCIAL_RELEASE.md` e `RELEASE_CHECKLIST.md`.

Para o Firebase Admin, prefira `FIREBASE_SERVICE_ACCOUNT_JSON`. Nunca envie credenciais para o repositório ou para conversas.

## Segurança de faturamento

- Abrir checkout grava somente campos `pending*`.
- Conta manual ativa permanece acessível durante a configuração da recorrência.
- Somente o webhook real validado converte o faturamento para Cakto.
- Homologação grava somente campos `homologation*`.
- O plano Founder exige autorização no backend.

## Aviso de lançamento

Este repositório contém uma release candidate técnica. Termos de Uso, Política de Privacidade, adequação à LGPD, política comercial, suporte, tributação e contratos precisam de revisão profissional antes da comercialização pública.
