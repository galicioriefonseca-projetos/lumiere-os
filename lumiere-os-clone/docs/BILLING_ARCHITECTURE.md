Asaas foi descontinuado como gateway ativo do LumièreOS.

# Arquitetura de Faturamento Recorrente (Billing Architecture) - LumièreOS

Este documento descreve a arquitetura de faturamento projetada para suportar a cobrança recorrente e a gestão de assinaturas do LumièreOS de forma modular, segura e 100% retrocompatível com a base de clientes existente.

## 1. Visão Geral e Filosofia de Design

A arquitetura de faturamento do LumièreOS é inspirada em padrões de **Clean Architecture** e no princípio de **Inversão de Dependência (Dependency Inversion Principle - SOLID)**. 

O objetivo principal é desacoplar a lógica de negócio de faturamento (como o LumièreOS gerencia planos, limites e status de salões) das especificidades operacionais de qualquer gateway de pagamento externo (como o Asaas, Mercado Pago, Stripe, etc.).

Isso garante que:
- O sistema seja facilmente testável através de mocks ou provedores fictícios de teste.
- Novas integrações de gateways possam ser introduzidas sem reescrever a lógica de controle da aplicação.
- Mudanças de regras em um gateway específico fiquem isoladas dentro do arquivo do respectivo provedor.
- Não haja risco de impactar a base de clientes atual durante a evolução e refatoração das integrações.

---

## 2. Estrutura do Módulo de Faturamento

A estrutura de arquivos foi implementada dentro do subdiretório `src/services/billing/`:

```bash
src/services/billing/
├── BillingProvider.ts          # Contrato operacional unificado (Interface)
├── BillingService.ts           # Orquestrador global e fachada de consumo da aplicação (Service)
├── providers/
│   └── asaas/
│       └── AsaasProvider.ts    # Implementação isolada e segura do gateway Asaas
└── types/
    └── index.ts                # Definições de tipo universais altamente tipadas
```

---

## 3. Componentes e Responsabilidades

### A. Tipos Unificados (`types/index.ts`)
Define as estruturas de dados fundamentais do faturamento no LumièreOS:
*   **`BillingCustomer`**: Dados cadastrais do cliente de faturamento vinculados a um salão específico.
*   **`BillingSubscription`**: Lógica de vigência de uma assinatura recorrente, ciclos, método de pagamento ativo e status.
*   **`BillingInvoice`**: Cobranças individuais de cada ciclo de faturamento.
*   **`BillingPayment`**: Registro histórico de transações reais.
*   **`BillingWebhookEvent`**: Evento padronizado recebido e processado pelo sistema.

### B. O Contrato (`BillingProvider.ts`)
A interface `BillingProvider` define o contrato estrito que qualquer gateway de pagamento deve implementar para ser compatível com o LumièreOS. Ela abstrai ações cruciais:
*   `createCustomer` / `updateCustomer` (Controle de clientes)
*   `createSubscription` / `updateSubscription` / `cancelSubscription` / `resumeSubscription` (Gestão de ciclo de vida de assinaturas recorrentes)
*   `changePaymentMethod` (Flexibilidade de troca de cartão, PIX ou boleto)
*   `generatePix` (Emissão dinâmica de QR Code e Pix Copia e Cola)
*   `listInvoices` / `listPayments` (Histórico transparente e conciliação financeira)
*   `processWebhook` (Conversão do payload nativo do gateway para o padrão universal do LumièreOS)

### C. O Orquestrador (`BillingService.ts`)
O `BillingService` atua como a única porta de entrada (**Facade**) para todas as interações de faturamento do frontend ou backend do LumièreOS. Suas principais atribuições são:
1.  **Orquestração**: Encaminhar as requisições ao provedor ativo (`provider`).
2.  **Injeção de Dependência**: Permitir a troca dinâmica do provedor através do método `setProvider(provider)`.
3.  **Segurança e Validação**: Adicionar camadas de segurança adicionais antes de repassar chamadas para serviços externos.

### D. O Gateway Específico (DEPRECATED - Asaas/Mercado Pago)
Tanto o Asaas quanto o Mercado Pago foram desativados e removidos de todas as partes ativas do frontend e simulação do LumièreOS. Suas implementações no código são mantidas passivas e seus campos no Firestore servem estritamente como legado histórico compatível. Todo faturamento recorrente ativo utiliza exclusivamente a **Asaas**, e o faturamento manual utiliza o **Manual PIX**.

---

## 4. Fluxo de Comunicação e Ciclo de Vida

O fluxo de comunicação segue as diretrizes abaixo:

1.  **Iniciação**: A interface do LumièreOS (por exemplo, na aba "Minha Conta" ou ao expirar o Trial) solicita ao `BillingService` a criação de uma assinatura.
2.  **Gateway Request**: O `BillingService` recebe a solicitação e delega ao `AsaasProvider` (ou qualquer outro gateway injetado) a tarefa de processar a requisição junto à API correspondente.
3.  **Processamento**: O Provedor formata os dados conforme o protocolo da API parceira, efetua a transação segura (futuramente via Cloud Functions) e retorna as informações normalizadas em tipos comuns do LumièreOS (ex: `BillingSubscription`).
4.  **Sincronização Passiva (Webhooks)**: 
    *   O gateway envia atualizações assíncronas de status (ex: fatura paga, assinatura cancelada por inadimplência) para o endpoint de Webhook do LumièreOS.
    *   O webhook intercepta o evento, delega a tradução do payload para o `AsaasProvider.processWebhook(event)`, e então o LumièreOS atualiza as coleções de salões no Firestore para refletir o novo status de faturamento em tempo real.

---

## 5. Como Adicionar Novos Gateways Futuramente

Graças ao desacoplamento total, adicionar um novo gateway (por exemplo, **Stripe** ou **Mercado Pago**) requer apenas 3 etapas simples:

1.  **Criar o Novo Provider**:
    Crie uma pasta sob `/providers` e implemente a interface `BillingProvider`:
    ```typescript
    // src/services/billing/providers/stripe/StripeProvider.ts
    import { BillingProvider } from '../../BillingProvider';
    // ... importações dos tipos

    export class StripeProvider implements BillingProvider {
      // Implemente todos os métodos exigidos pelo contrato...
    }
    ```
2.  **Instanciar ou Injetar o Novo Provedor**:
    O `BillingService` pode ser configurado dinamicamente para usar o novo gateway com uma única linha:
    ```typescript
    import { StripeProvider } from './providers/stripe/StripeProvider';
    
    // Altera o provedor de pagamentos globalmente
    billingService.setProvider(new StripeProvider());
    ```
3.  **Vantagem**: Nenhuma linha de código das telas de UI, do controle de rotas ou de outras partes do sistema precisa ser modificada. O LumièreOS continua interagindo com a assinatura através do `billingService` de forma transparente.
