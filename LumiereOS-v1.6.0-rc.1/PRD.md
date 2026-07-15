# PRD — LumièreOS 1.0

## 1. Visão do produto

O LumièreOS é uma plataforma SaaS de gestão para salões, clínicas de estética, barbearias e negócios de beleza. O produto centraliza operação, relacionamento com clientes, gestão financeira, equipe e assinatura do software.

## 2. Público principal

- Proprietários e gestores de negócios de beleza
- Equipes administrativas e recepcionistas
- Profissionais prestadores de serviço
- Redes com múltiplas unidades

## 3. Proposta de valor

Reduzir controles dispersos, aumentar a visibilidade operacional e apoiar decisões de crescimento com uma experiência simples, segura e orientada a resultados.

## 4. Módulos da versão comercial

- Dashboard e indicadores
- Agenda e atendimentos
- Clientes
- Lançamentos e produção
- Financeiro
- Estoque
- Profissionais, comissões e metas
- Serviços e precificação
- Central de assinatura
- Painel Master da plataforma
- Assistente de inteligência Lumi

## 5. Planos

Os planos canônicos são `start`, `founder`, `performance`, `network` e `enterprise`. O plano Founder é reservado a contas previamente autorizadas.

Valores, limites e ofertas devem ser lidos das configurações oficiais do produto e do gateway. Não devem ser duplicados em regras de negócio isoladas.

## 6. Faturamento

Provedores ativos:

- `manual` / `manual_pix` para cobranças administradas pela equipe
- `cakto` para assinatura recorrente confirmada pelo gateway

Regras fundamentais:

1. A abertura do checkout não ativa nem troca o plano definitivo.
2. Abertura do checkout grava somente dados pendentes.
3. O webhook autenticado é a autoridade para confirmar pagamento e assinatura.
4. Homologação não altera dados reais.
5. Uma assinatura Cakto ativa não pode criar outra assinatura em paralelo.
6. Contas manuais ativas preservam acesso enquanto configuram a recorrência.

## 7. Segurança e isolamento

- Autenticação com Firebase
- Autorização global de Platform Admin por UID, role ou custom claim
- Isolamento por salão no Firestore
- Regras canônicas em `firestore.rules`
- Webhooks validados por segredo
- Erros internos e credenciais nunca expostos ao cliente
- CORS e cabeçalhos de segurança configurados

## 8. Critérios para lançamento público

- Instalação limpa e build aprovados
- Testes de Billing e webhook aprovados
- Firestore Rules aprovadas no Emulator
- Credenciais de produção verificadas
- Teste financeiro controlado concluído
- Monitoramento e rotina de backup definidos
- Termos de Uso e Política de Privacidade revisados
- Processo de suporte, cancelamento e cobrança documentado

## 9. Fora do escopo desta release

- Alteração automática da forma de pagamento pela API da Cakto sem endpoint oficial confirmado
- Integrações legadas com Asaas e Mercado Pago
- Garantias jurídicas, fiscais ou contábeis sem revisão especializada
