# Preparação para comercialização

Esta versão é uma **release candidate**. O código foi preparado para uma validação comercial controlada, mas o lançamento público depende de configurações externas e decisões empresariais.

## 1. Vercel

Configure em Production:

- `APP_URL`
- `ALLOWED_ORIGINS`
- `FIREBASE_SERVICE_ACCOUNT_JSON` — opção preferencial
- `FIREBASE_EXPECTED_PROJECT_ID`
- `PLATFORM_ADMIN_EMAIL` — fallback temporário
- `ASAAS_CLIENT_ID`
- `ASAAS_CLIENT_SECRET`
- `ASAAS_API_URL`
- `ASAAS_WEBHOOK_SECRET`
- `HEALTHCHECK_SECRET`

Após mudar variáveis, faça um novo deploy. O ambiente do Google AI Studio e o da Vercel são independentes.

## 2. Firebase

- Confirmar que Firebase Web e Firebase Admin pertencem ao mesmo projeto.
- Criar `platformAdmins/{uid}` para o administrador da plataforma.
- Manter também `users/{uid}.role = "platform_admin"` quando apropriado.
- Publicar `firestore.rules` como única fonte de regras.
- Executar os testes no Firestore Emulator antes da publicação definitiva.
- Definir política de backup e restauração.

## 3. Asaas

- Cadastrar `productId` e ofertas oficiais em `settings/asaas`.
- Configurar a URL do webhook e seu segredo.
- Validar eventos reais aceitos pela integração.
- Fazer primeiro um teste de geração de checkout sem pagamento.
- Depois, executar uma cobrança controlada com uma conta autorizada.

## 4. Operação

- Definir responsável por suporte e faturamento.
- Criar processo de cancelamento, reembolso, inadimplência e reativação.
- Definir SLA e canal de atendimento.
- Configurar monitoramento de erros e disponibilidade.
- Criar rotina de revisão de acessos administrativos.

## 5. Jurídico e comercial

Antes do lançamento público, obter revisão profissional para:

- Termos de Uso
- Política de Privacidade e cookies
- LGPD e tratamento de dados
- Contratos e política de cancelamento
- Tributação, emissão fiscal e cobrança recorrente
- Uso de inteligência artificial e limites de responsabilidade

## 6. Dependências

Há vulnerabilidades conhecidas no conjunto atual, com atenção especial ao ecossistema jsPDF. Faça atualização controlada em uma sprint própria e valide todos os relatórios PDF. Não use `npm audit fix --force` sem testes.
