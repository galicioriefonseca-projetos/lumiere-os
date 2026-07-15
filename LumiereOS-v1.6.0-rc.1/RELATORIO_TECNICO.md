# Relatório técnico — LumièreOS v1.6.0-rc.1

Data da validação: **15/07/2026**

## Classificação

Esta entrega é uma **release candidate comercial**. O código foi organizado, endurecido e validado localmente, mas a liberação para cobrança pública depende das configurações e testes externos descritos em `RELEASE_CHECKLIST.md`.

## Principais mudanças implementadas

### Billing e Cakto

- A opção Founder de produção gera o checkout real sem suspender o salão.
- Conta manual paga preserva plano, acesso, vencimento e status durante a configuração da recorrência.
- Salão existente recebe somente `pending*` e `updatedAt` ao abrir checkout.
- O webhook real é a única autoridade para gravar IDs definitivos e converter o provedor para Cakto.
- Homologação usa retorno antecipado e grava somente `homologation*`.
- Oferta desconhecida ou divergente não ativa assinatura.
- O webhook Express usa o mesmo processador da função serverless, removendo duplicação funcional.
- Novo cliente só é promovido de `onboarding/{salonId}` para `salons/{salonId}` após pagamento aprovado, oferta correspondente e proprietário válido.
- Webhook não cria salões arbitrários sem onboarding.
- Cobrança recusada não revoga imediatamente um período já pago; o bloqueio deve respeitar a política comercial de tolerância.
- Alteração de forma de pagamento permanece assistida até existir operação oficial confirmada.

### Firebase e autorização

- Firebase Admin aceita `FIREBASE_SERVICE_ACCOUNT_JSON` em JSON ou base64.
- Fallback por variáveis separadas continua disponível e exige dados da mesma conta de serviço.
- Erros de credencial são reconhecidos e convertidos em resposta pública sanitizada.
- Platform Admin é resolvido por custom claim, `platformAdmins/{uid}`, `users/{uid}.role` ou fallback temporário do backend.
- Claims genéricas de administrador local não concedem acesso global.
- Erros internos, stack traces e mensagens do Google não são devolvidos ao cliente.

### Estrutura

- Componentes canônicos em `src/components/ui/`.
- Bibliotecas canônicas em `src/lib/`.
- `firestore.rules` na raiz é a única fonte oficial.
- Pastas duplicadas `components/`, `lib/` e `src/firestore.rules` foram removidas.
- Scripts temporários de patch e integrações legadas ativas foram removidos.
- `server/index.ts` não mantém um processador duplicado do webhook.
- Foi criado `scripts/verify-release.mjs` para impedir regressões estruturais e credenciais hardcoded.

### Operação comercial

- Healthcheck público sem segredos e verificação profunda protegida por segredo.
- CORS e cabeçalhos básicos de segurança configurados.
- `X-Powered-By` desativado no Express.
- Identidade pública, suporte e documentos legais são configuráveis por ambiente.
- Links de Termos, Privacidade, Licenciamento e suporte deixaram de ser elementos inertes.
- Modo demo fica desativado por padrão em produção.
- O frontend não consulta serviço externo para descobrir o IP do usuário durante auditoria.

### Performance

- Source maps do frontend não são publicados no build de produção.
- Dependências principais foram divididas em chunks de React, Firebase, gráficos e PDF.
- O chunk principal caiu de aproximadamente 1,74 MB para aproximadamente 548 KB minificado.
- Ainda existem chunks acima de 500 KB, especialmente Firebase e PDF; isso não bloqueia a RC, mas permanece como otimização futura.

## Validações executadas

### Instalação e lockfile

```text
npm ci --dry-run --ignore-scripts --no-audit --no-fund
✅ Aprovado
✅ package.json e package-lock.json sincronizados
```

Uma instalação integral em pasta limpa foi iniciada, mas o ambiente encerrou o processo após 15 minutos durante a extração de aproximadamente 1.400 pacotes. Não houve erro de lockfile ou resolução antes do encerramento. A instalação integral deve ser repetida no AI Studio ou CI.

### TypeScript

```text
npm run lint
✅ Aprovado
```

### Segurança do webhook

```text
npm run test:webhook
✅ 1 arquivo aprovado
✅ 4 testes aprovados
```

### Segurança de Billing

```text
npm run test:billing
✅ 1 arquivo aprovado
✅ 38 testes aprovados
```

Inclui validação de:

- Founder e autorização;
- imutabilidade do checkout;
- estados manual e Cakto;
- sanitização de erros;
- oferta oficial;
- promoção segura do onboarding;
- bloqueio de criação arbitrária de salões.

### Build

```text
npm run build
✅ 3.274 módulos transformados
✅ Frontend Vite aprovado
✅ PWA gerada
✅ Servidor Express compilado
✅ Build final sem source maps públicos do frontend
```

### Verificação estrutural

```text
npm run check:release
✅ Estrutura de release aprovada
```

### Smoke test do backend

```text
GET /api/health
✅ HTTP 200
✅ Nenhum segredo exposto
✅ Status degraded sem credenciais locais, comportamento esperado
```

### Firestore Rules

```text
npm run test:rules
❌ Não concluído neste ambiente
```

Motivo real: a porta padrão estava ocupada na primeira execução. Após mover o emulator para `127.0.0.1:8085`, o Firebase CLI tentou baixar `cloud-firestore-emulator-v1.21.0.jar`, mas o ambiente bloqueou o acesso ao arquivo externo. Os testes permanecem pendentes de execução em CI ou máquina com o emulator disponível.

## Dependências

```text
npm audit --omit=dev
13 moderadas
7 altas
1 crítica
21 no total
```

A vulnerabilidade crítica permanece no ecossistema atual do jsPDF. Não executar `npm audit fix --force` sem uma atualização controlada e testes completos dos relatórios PDF.

## Itens externos obrigatórios antes da venda pública

1. Configurar e validar Firebase Admin na Vercel.
2. Cadastrar o Platform Admin por UID.
3. Cadastrar ofertas oficiais e webhook da Cakto.
4. Executar `npm run test:rules` com sucesso.
5. Fazer teste controlado: gerar checkout, conferir somente `pending*`, pagar e validar webhook.
6. Publicar Termos de Uso, Política de Privacidade e Licenciamento revisados.
7. Definir LGPD, suporte, cancelamento, reembolso, fiscal e backup.
8. Revisar vulnerabilidades e planejar atualização do jsPDF.

## Conclusão

O repositório está preparado como **LumièreOS v1.6.0-rc.1** para importação, organização e validação no Google AI Studio. Não deve ser anunciado como produção comercial definitiva até os itens externos acima estarem concluídos.
