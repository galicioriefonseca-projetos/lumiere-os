# LumièreOS — Status de validação do núcleo comercial

Data da revisão: 2026-07-24

## Implementado diretamente nesta revisão

- Cadastro cria conta Firebase antes do checkout.
- Perfil inicial é criado como `role: pending` e `salonId: null`.
- Checkout exige token Firebase e recebe somente `planId` e dados do onboarding.
- Founder foi removido da recomendação pública.
- Novo salão é preparado em `onboarding/{salonId}` e só é promovido pelo webhook aprovado.
- Forma de pagamento é escolhida no checkout da Asaas e registrada pelo webhook.
- Autorização por simples coincidência de `ownerEmail` foi removida das Firestore Rules e do fallback do frontend.
- Campos financeiros permanecem protegidos contra edição pelo cliente.
- Idempotência do webhook passou a reivindicar eventos em transação.
- Eventos sem intenção completa são encaminhados para revisão.
- Cancelamento preserva acesso enquanto existir período pago vigente.
- Pagamentos e histórico usam IDs idempotentes por evento.
- Convites são resolvidos e aceitos por endpoints backend; o frontend não concede role ou salonId.
- `inspect.ts` e alias pessoal de tutorial foram removidos.
- O verificador de release bloqueia scripts de inspeção, debug e dump.

## Validações concluídas

- Análise sintática de 156 arquivos TypeScript/TSX: aprovada.
- `node scripts/verify-release.mjs`: aprovado.
- Firestore Rules: 26 cenários de teste presentes no arquivo.
- Billing: 45 cenários de teste presentes no arquivo.
- Webhook: 4 cenários de segurança presentes no arquivo.

## Validações ainda obrigatórias antes do deploy

O ambiente atual não conseguiu baixar todas as dependências do registro NPM. Portanto, ainda precisam ser executados em ambiente com dependências disponíveis:

```bash
npm ci
npm run lint
npm run test:webhook
npm run test:billing
npm run test:rules
npm run build
npm run check:release
npm audit --omit=dev
```

As Firestore Rules só podem ser consideradas aprovadas após execução real no Firebase Emulator.

## Veredito

**NÃO PUBLICAR ESTA RC antes do pipeline completo acima ficar verde.**

Este arquivo é um checkpoint técnico consolidado, não uma autorização de deploy.
