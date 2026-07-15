# Plano de operação da Cakto

## Configuração necessária

1. Definir as credenciais Cakto no backend.
2. Cadastrar os `offerId` oficiais em `settings/cakto`.
3. Configurar o segredo do webhook.
4. Registrar no painel da Cakto a URL de webhook da produção.
5. Validar a conta Firebase Admin usada pelas funções serverless.

## Fluxo de checkout

1. Usuário autenticado solicita o checkout.
2. Backend valida propriedade e autorização.
3. Backend resolve a oferta oficial do plano.
4. Salão existente recebe apenas campos `pending*`.
5. Cliente abre o checkout externo.
6. Webhook confirmado converte os dados pendentes em assinatura real.

## Teste Founder controlado

1. Manter a conta Founder em faturamento manual ativo.
2. Gerar o checkout sem alterar o acesso atual.
3. Verificar no Firestore que somente campos `pending*` foram gravados.
4. Confirmar nos logs que não houve erro do Firebase Admin.
5. Fazer uma cobrança controlada somente após as etapas anteriores.
6. Conferir IDs, plano, vencimento e limpeza dos campos pendentes após o webhook.

## Proibições

- Não desativar a conta ao abrir o checkout.
- Não usar simulação como fallback em produção.
- Não inferir plano pelo nome da oferta.
- Não inventar vencimento, URL ou endpoint.
- Não exibir erros internos do Google/Firebase ao cliente.
