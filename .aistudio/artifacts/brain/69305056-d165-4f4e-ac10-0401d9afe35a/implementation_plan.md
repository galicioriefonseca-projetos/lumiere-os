# Relatórios Inteligentes do Google Meu Negócio & Comparativo na Área do Cliente (LumièreOS)

## 1. Visão Geral da Funcionalidade
O sistema agora processa os relatórios em PDF de desempenho do Google Meu Negócio (GBP) enviados pela agência e os converte em inteligência visual interativa na Área do Cliente:
- Extração automática via IA Gemini (`gemini-3.8-flash`) das métricas de performance (Pesquisa Google, Google Maps, Chamadas telefônicas, Solicitações de Rotas GPS, Cliques no Website, Avaliações e Palavras-chave).
- Persistência estruturada com intervalos de datas (`startDate`, `endDate`, `month`, `year`) no Firestore.
- Visualização completa na Área do Cliente com seleção de datas no calendário, gráficos interativos e comparativo automatizado mês a mês.

---

## 2. Componentes e Endpoints Implementados

### Backend (`/server/routes/clientPortal.ts`)
1. **Endpoint `POST /reports/parse-pdf`**:
   - Processamento de PDFs em Base64 com Gemini Flash.
   - Extração estruturada de datas ISO (`startDate`, `endDate`), mês, ano e indicadores de conversão física (rotas, chamadas, cliques).
   - Cálculo do comparativo preliminar com relatórios anteriores do cliente.
2. **Endpoints `POST /reports` e `PUT /reports/:id`**:
   - Validação e gravação de metadados temporais para filtros de calendário flexíveis.
   - Inferência automática de datas a partir do rótulo do mês/ano se não fornecidos explicitamente.
3. **Endpoint `GET /reports/comparison`**:
   - Cálculo de taxas de variação percentual (Δ%) mês a mês para o histórico do cliente.

### Frontend (`/src/components/portal/ReportsAnalyticsTab.tsx`)
1. **Seletor de Datas no Calendário**:
   - Atalhos rápidos: *Todos os Meses*, *Últimos 3 Meses*, *Últimos 6 Meses*, *Filtrar Datas (Calendário)*.
   - Date inputs (`startDate` e `endDate`) com atualização instantânea de todos os gráficos e KPIs.
   - **Toggle de Comparativo Direto Mês a Mês**: permite ao cliente escolher um Mês Base e comparar diretamente com outro mês específico (ex: Outubro vs Setembro).
2. **Cards de KPIs com Variação (Δ%)**:
   - Visualizações Google (Pesquisa + Maps) com tag de crescimento/queda.
   - Chamadas Telefônicas (ligações diretas).
   - Solicitações de Rotas no Mapa (GPS / Waze).
   - Cliques no Website / WhatsApp e Nota de Avaliação (★).
3. **Gráficos Visuais Interativos (`recharts`)**:
   - **Gráfico 1**: Evolução de Visibilidade Google (Área/Barras) com Google Maps vs Pesquisa Google.
   - **Gráfico 2**: Conversões Mês a Mês (Rotas vs Ligações vs Cliques no Site).
   - **Gráfico 3**: Distribuição de Ações dos Consumidores (Donut/Pie Chart).
   - **Gráfico 4**: Ranking com os Termos Mais Buscados no Google.
4. **Tabela Comparativa Mês a Mês Lado a Lado**:
   - Comparação tabular linha a linha de todas as métricas com variações recentes.
5. **Resumo Executivo da IA**:
   - Síntese estratégica gerada para o período selecionado.
6. **Acervo de Relatórios Oficiais**:
   - Cards com visualização detalhada em modal, link do Looker Studio e PDF.
