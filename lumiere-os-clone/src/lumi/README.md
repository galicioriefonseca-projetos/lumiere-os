# Lumi Intelligence Engine (Sprint 3.0) - Documentação Técnica

Este diretório contém a fundação arquitetural da **Lumi**, a Inteligência Operacional do **LumièreOS**.

Diferente de IAs conversacionais genéricas, a Lumi atua como uma inteligência analítica baseada em dados reais e integridade estatística, operando sobre as coleções do Google Firestore de forma contextualizada e segura.

---

## 🏗️ Princípios de Arquitetura

A Lumi foi concebida sob os pilares da **Clean Architecture** e dos princípios **SOLID**:

1. **Desacoplamento de Provedor (Dependency Inversion)**: A IA não depende diretamente de um SDK específico. Através da interface `ILumiProvider`, o sistema está preparado para alternar dinamicamente entre Google Gemini, OpenAI ou execuções locais (Mocks/Regras de Negócio).
2. **Responsabilidade Única (Single Responsibility Principle)**:
   - A consolidação de métricas cabe unicamente ao `MetricsService`.
   - A descoberta de insights estatísticos cabe ao `InsightService`.
   - O desenvolvimento de estratégias de melhoria cabe ao `RecommendationService`.
3. **Imutabilidade e Consistência (Context-Driven)**: Toda a inteligência baseia-se no objeto `BusinessContext`, que consolida os dados do Firestore antes de qualquer cálculo ou raciocínio. A Lumi nunca inventa dados.

---

## 📁 Estrutura de Pastas e Módulos (`src/lumi/`)

```bash
src/lumi/
├── README.md               # Esta documentação técnica
├── types/
│   └── index.ts            # Tipos e contratos TypeScript (BusinessContext, HealthScore, etc.)
├── providers/
│   ├── LumiProvider.ts     # Interface contratual ILumiProvider e BaseLumiProvider
│   ├── GeminiProvider.ts   # Implementação preparada para o Google Gemini AI SDK
│   ├── OpenAIProvider.ts   # Implementação preparada para OpenAI GPT API
│   └── MockProvider.ts     # Provedor analítico de alta fidelidade para testes locais
├── services/
│   ├── MetricsService.ts   # Consolidação de indicadores e cálculo de Health Score (0-100)
│   ├── InsightService.ts   # Avaliação de padrões de negócio e dores comerciais
│   └── RecommendationService.ts # Sugestão de planos de ação corporativos focados em ROI
├── engine/
│   └── LumiIntelligenceEngine.ts # Orquestrador central e gerador de alertas inteligentes
├── hooks/
│   └── useLumi.ts          # Hook React otimizado com prevenção contra re-renders
└── utils/
    └── formatters.ts       # Formatadores estéticos e grades de cores para UI
```

---

## 🚀 Fluxo de Execução de Dados (Pipeline)

```text
[Firestore DB] ───(LumiIntelligenceEngine.loadContext)───► [BusinessContext]
                                                                  │
                                                                  ├─► [MetricsService] ──► [BusinessMetric]
                                                                  │                               │
                                                                  │◄──────────────────────────────┘
                                                                  │
                                                                  ├─► [LumiIntelligenceEngine.generateAlerts] ──► [Alerts]
                                                                  ├─► [InsightService.generateInsights] ────────► [Insights]
                                                                  ├─► [RecommendationService] ──────────────────► [Recommendations]
                                                                  │
                                                                  └─► [ILumiProvider.analyzeContext] ───────────► [AI Narrative]
```

---

## 📊 Sistema de Health Score (0 a 100)

O **Health Score** avalia a integridade do negócio ponderando 5 áreas corporativas cruciais:

1. **Agenda (Peso: 20%)**: Analisa a taxa de ocupação dos profissionais e aplica penalidades de até 40% com base nas taxas de cancelamento.
2. **Financeiro (Peso: 25%)**: Avalia o progresso no faturamento em relação às metas corporativas globais cadastradas no mês atual.
3. **Equipe (Peso: 20%)**: Consolida a média de notas dos checklists diários e o preenchimento de rotinas com o progresso de metas individuais dos colaboradores.
4. **Clientes (Peso: 15%)**: Mede a retenção de clientes por recorrência no CRM e a proporção de clientes ativos.
5. **Operação (Peso: 20%)**: Avalia a frequência de auditorias e checklists operacionais e penaliza a saúde com base no número de produtos em falta ou estoque crítico.

---

## 🚨 Alertas Inteligentes e Recomendações

O motor analisa correlações em tempo real para disparar notificações proativas de alto valor:

- **Alerta de Baixa Ocupação**: Disparado se a ocupação média da agenda cair abaixo de 35%.
- **Alerta de Faturamento Crítico**: Ativado quando o faturamento acumulado do mês está abaixo de 40% da meta global esperada para o período.
- **Janela de Ociosidade (Insights)**: Detecta se faixas específicas (como as manhãs de terça-feira) operam rotineiramente com ociosidade.
- **Ruptura de Estoque (Alertas/Recomendações)**: Bloqueia a área operacional caso produtos chave fiquem abaixo do limite mínimo e indica links para almoxarifado.

---

## 🔌 Preparação para o Gemini AI

A arquitetura já possui o provedor `GeminiProvider` estruturado. Quando as chaves de API forem introduzidas, basta:
1. Importar o SDK oficial do Google (`@google/genai`).
2. Configurar o provedor para ler a chave secreta `process.env.GEMINI_API_KEY` exclusivamente no lado do servidor.
3. Chamar `switchProvider('gemini')` no hook `useLumi` para fazer com que todo o processamento de narrativa seja direcionado de forma transparente para os LLMs da Google.
