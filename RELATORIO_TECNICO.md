# Relatório Técnico: Correções na Integração de Faturamento e Billing

## 1. Visão Geral
Este relatório detalha as correções arquiteturais aplicadas ao módulo de faturamento (Billing), focadas especificamente na resolução das inconsistências entre seleção de plano, identificador de oferta (Offer ID), checkout e ativação de assinaturas pela integração com o gateway Cakto.

## 2. Inconsistências Identificadas
1. **Alteração Indevida de Plano no Checkout**: O ato de gerar um link de checkout estava reescrevendo preventivamente a propriedade `plan` no banco de dados Firestore (antes mesmo de qualquer aprovação de pagamento).
2. **Fallback Falso-Positivo de Offer ID**: Se um plano específico não tivesse uma oferta correspondente configurada, o código no servidor automaticamente usava o plano "Founder" como fallback. Isso poderia gerar cobranças errôneas para usuários.
3. **Persistência Perigosa de Links Antigos**: A interface de assinaturas (`SubscriptionPage`) exibia indiscriminadamente URLs de checkout passadas se estivessem persistidas no banco. Isso gerava o risco de que o cliente pagasse um boleto/checkout com um valor correspondente a um plano diferente do selecionado hoje.
4. **Atualização de Cartão não suportada nativamente pelo checkout padrão**: O sistema tentava exibir um botão "Atualizar Cartão" gerando um novo link de checkout no frontend que, no gateway Cakto, cria uma transação inteiramente nova ao invés de atualizar o método da recorrência atual.

## 3. Correções Aplicadas

### 3.1. Servidor e Gateway (`server/index.ts`)
- **Blindagem do Campo de Plano**: Ao gerar o checkout na rota `/api/cakto/create-checkout`, foi removida a substituição prematura. O payload que atualiza o salão no Firestore foi refatorado para manter o valor de `plan: salonData?.plan || "start"`.
  - **Motivo**: O plano definitivo (e recursos operacionais do sistema atrelados a ele) só deve ser promovido/rebaixado quando o `webhook` do gateway notificar aprovação/mudança oficial.
- **Fim do Fallback de Oferta Inseguro**: A escolha do `offerId` pela Cakto agora respeita estritamente o mapa configurado. Caso o plano solicitado não tenha oferta correspondente (`case 'enterprise': offerId = ""; default: offerId = "";`), um erro claro é devolvido (`throw new Error(...)`), bloqueando a geração de cobrança incorreta.

### 3.2. Interface do Usuário (`SubscriptionPage.tsx`)
- **Remoção de Cache Inseguro de URL de Checkout**: Toda a seção *"Link de Assinatura Ativo"* (com os botões para reabrir link antigo ou copiar URL) foi permanentemente removida.
  - **Motivo**: Não devemos confiar na URL persistida no passado se a oferta não foi validada para a intenção presente. Todo clique em "Regularizar Agora" ou "Pagar" gera um modal intencional para solicitar a geração oficial e correspondente ao momento.
- **Botões de Call-to-Action Ajustados**: 
  - Todos os estados de conta vencida/atrasada agora direcionam o cliente exclusivamente ao `showActivationModal`, descartando atalhos arriscados para a antiga `currentCheckoutUrl`.
  - O botão falho de "Atualizar Forma de Pagamento" por geração de checkout não assistido foi retirado.
- **Saneamento de Sintaxe (React)**: Corrigida a estrutura JSX da `SubscriptionPage.tsx` após as reestruturações que garantiram um build sólido e limpo (`npm run build`).
- **Correção da Consulta de Pagamentos**: Ajustada a consulta em tempo real da tabela de pagamentos para buscar na subcoleção `/salons/{salonId}/payments` em vez do caminho raiz inválido de coleção global, resolvendo erros de busca de dados no Firestore.

### 3.3. Utilitário Cliente de Integração Cakto (`src/lib/cakto.ts`)
- **Implementação do Módulo Centralizado**: Criado o arquivo utilitário `src/lib/cakto.ts` para lidar com toda a comunicação autenticada de faturamento da Cakto, desacoplando requisições de API das telas visuais.
  - **Métodos Expostos**:
    - `getSubscriptionStatus(salonId)`: Consulta o status detalhado da assinatura e faturamento.
    - `schedulePlanChange(salonId, planId)`: Solicita um agendamento seguro de alteração de plano.
    - `cancelPlanChange(salonId)`: Cancela com segurança qualquer agendamento programado ativo.
    - `simulateConfirmPlanChange(salonId)`: Executa a confirmação imediata da mudança no banco de dados para homologação.
  - **Refatoração da Interface**: Substituídos os blocos repetitivos de chamadas de rede no cliente (`SubscriptionPage.tsx`) pelos métodos centralizados e autenticados de `src/lib/cakto.ts`, simplificando a legibilidade e garantindo robustez de manutenção.

### 3.4. Regras de Segurança do Firestore (`firestore.rules`)
- **Novo Auxiliar de Permissões `canManageBilling`**: Criada uma regra de autorização robusta e centralizada em `firestore.rules` que valida acessos de faturamento combinando:
  - Verificação de Administrador da plataforma (dev e equipe interna, incluindo o e-mail `galicioriefonseca@gmail.com`).
  - Verificação de Papéis Administrativos do salão (Owner, Admin, Manager) mapeados no documento de perfil do usuário.
  - Verificação Direta de Propriedade do Salão (`ownerId == request.auth.uid`) diretamente no documento do salão correspondente. Isso protege e garante acesso total ao proprietário fundador mesmo se seu documento de perfil individual ainda não estiver totalmente sincronizado no Firestore.
- **Novo Auxiliar de Permissões `canManageBilling`**: Criada uma regra de autorização robusta e centralizada em `firestore.rules` que valida acessos de faturamento combinando:
  - Verificação de Administrador da plataforma (dev e equipe interna, incluindo o e-mail `galicioriefonseca@gmail.com`).
  - Verificação de Papéis Administrativos do salão (Owner, Admin, Manager) mapeados no documento de perfil do usuário.
  - Verificação Direta de Propriedade do Salão (`ownerId == request.auth.uid`) diretamente no documento do salão correspondente. Isso protege e garante acesso total ao proprietário fundador mesmo se seu documento de perfil individual ainda não estiver totalmente sincronizado no Firestore.
- **Políticas de Acesso para Subcoleções de Faturamento**: Atualizadas as políticas de leitura e criação para as coleções `payments`, `subscriptions` e `billingHistory` para consumir o novo auxiliar `canManageBilling(salonId)`. Isso resolveu em definitivo os erros de `Missing or insufficient permissions` reportados ao abrir a tela de faturamento.

## 4. Novo Fluxo de Autorização de Forma de Pagamento Futuro (Assinatura Ativa e Paga)

Foi projetado e implementado com total fidelidade comercial e de segurança o fluxo para que assinantes (especialmente do plano **Founder**) cuja mensalidade atual já está paga possam registrar e autorizar antecipadamente o método de faturamento que será utilizado a partir do próximo vencimento (próxima `next_payment_date`).

### 4.1. Princípios e Proteções Rigorosas
1. **Sem Cobrança Imediata**: O ato de salvar ou trocar a forma de pagamento não gera novas transações, checkouts de compra imediatos ou cobranças no cartão ou saldo.
2. **Preservação de Dados Originais**: O plano atual (`Founder`), o valor do plano (`R$ 297`), a oferta ativa e a data de cobertura já paga são estritamente preservados.
3. **Barreira Anti-Homologação**: Assinaturas que usem IDs de homologação (`sub_homolog_...`, `simulated` ou `sub_simulated_dev`) são totalmente bloqueadas, tanto no backend quanto no frontend, assegurando que o fluxo de homologação não contamine os dados legítimos de produção.
4. **Verificação Direta via API Cakto**: Não confiamos de forma cega nas informações guardadas no Firestore. O sistema faz uma chamada real via API da Cakto (`GET /public_api/subscriptions/{id}/`) para verificar o estado da assinatura, bloqueando a operação se:
   - A assinatura não existir;
   - Estiver cancelada;
   - Houver alguma fatura ou cobrança pendente/vencida (overdue);
   - Não houver data futura de vencimento (`next_payment_date`);
   - A API indicar qualquer irregularidade de segurança.

### 4.2. Endpoints Implementados (Express e Vercel Serverless)
Foram criados dois novos endpoints síncronos e simétricos (disponíveis tanto no servidor Express principal `server/index.ts` quanto nas funções Vercel Serverless em `/api/cakto/`):
- **`GET /api/cakto/real-subscription`**: Realiza uma consulta segura e autenticada via OAuth2 na API oficial da Cakto para buscar as informações atuais de status, vigência e métodos permitidos diretamente da assinatura real do cliente.
- **`POST /api/cakto/update-payment-method`**: Valida a permissão do usuário, recupera a assinatura real da Cakto, aplica filtros rígidos de proteção e atualiza a forma de pagamento futura no Firestore e na API.
  - Para **Cartão de Crédito**: Em conformidade com as diretrizes PCI-DSS, evita a inserção direta de dados inseguros e orienta de forma clara o usuário, registrando o pedido de suporte administrativo para link assistido criptografado.
  - Para **Pix Automático, Pix e Boleto**: Invoca o endpoint `PATCH` da Cakto para atualizar o método de pagamento de forma nativa e persistida na assinatura, retornando o link oficial de autorização do Pix Automático caso fornecido.

### 4.3. Interface do Painel do Usuário (`SubscriptionPage.tsx`)
A guia **"Pagamento"** na Central de Assinatura do LumièreOS foi completamente reformulada para exibir uma experiência interativa e de altíssimo nível:
- **Painel de Cobertura Atual**: Mostra o bloco em destaque *"Mensalidade Atual Garantida"*, com os status *"Mensalidade atual confirmada"* e *"Seu acesso está garantido até DD/MM/AAAA"*, indicando ao cliente que não haverá cobranças imediatas.
- **Seleção Dinâmica de Métodos**: Apresenta opções limpas de escolha:
  - *Cartão de Crédito Recorrente* (automático e sem comprometimento de limite total).
  - *Pix Automático* (débito recorrente programado).
  - *Pix Avulso* (faturamento manual com código copia-e-cola).
  - *Boleto Bancário* (faturamento manual com envio de boleto 5 dias antes de vencer).
- **Detalhamento Financeiro Transparente**: Um painel dinâmico calcula o Valor Recorrente (R$ 297,00/mês), a Próxima cobrança, e ressalta em destaque verde que a **Cobrança Imediata é de R$ 0,00**.
- **Segurança de Execução**: Apresenta feedbacks visuais de carregamento, alertas de bloqueio de homologação e histórico automático registrado em `/salons/{salonId}/billingHistory`.

## 5. Conclusão
O Build está verde e as vulnerabilidades comerciais no fluxo foram extirpadas. O fluxo do cliente com a Cakto respeita o princípio da imutabilidade do plano sem garantias financeiras, e a barreira de permissões e segurança do Firestore foi devidamente ajustada para garantir acesso legítimo e contínuo dos proprietários às faturas e históricos de pagamentos do LumièreOS.
