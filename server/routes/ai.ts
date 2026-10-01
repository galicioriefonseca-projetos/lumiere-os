import { Router } from "express";
import { env } from "../config/env.js";
import { GoogleGenAI } from "@google/genai";
import { aiLimiter } from "../middleware/rateLimiter.js";
import { getAdminDb } from "../firebaseAdmin.js";
import { verifyIdToken } from "../shared/auth.js";

const router = Router();

// Helper to isolate Developer API Key authentication by unsetting GCP ADC environment variables temporarily
async function withDeveloperAuth<T>(apiKey: string, fn: (ai: GoogleGenAI) => Promise<T>): Promise<T> {
  const prevCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const prevGcloudProject = process.env.GOOGLE_GCLOUD_PROJECT;
  const prevCloudProject = process.env.GOOGLE_CLOUD_PROJECT;
  const prevGcloudProj = process.env.GCLOUD_PROJECT;
  const prevGcpProject = process.env.GCP_PROJECT;
  const prevMetadataHost = process.env.GCP_METADATA_HOST;
  const prevDetectMetadata = process.env.DETECT_GCP_METADATA;

  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
  delete process.env.GOOGLE_GCLOUD_PROJECT;
  delete process.env.GOOGLE_CLOUD_PROJECT;
  delete process.env.GCLOUD_PROJECT;
  delete process.env.GCP_PROJECT;
  
  // Setting these values ensures google-auth-library falls back and doesn't attempt to contact GCP Metadata Server or authenticate via default credentials
  process.env.GCP_METADATA_HOST = "localhost";
  process.env.DETECT_GCP_METADATA = "false";

  try {
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
          'Authorization': '', // Prevent/clear automatic attachment of GCP bearer tokens by the runtime
        },
      },
    });

    return await fn(ai);
  } finally {
    if (prevCredentials) process.env.GOOGLE_APPLICATION_CREDENTIALS = prevCredentials;
    if (prevGcloudProject) process.env.GOOGLE_GCLOUD_PROJECT = prevGcloudProject;
    if (prevCloudProject) process.env.GOOGLE_CLOUD_PROJECT = prevCloudProject;
    if (prevGcloudProj) process.env.GCLOUD_PROJECT = prevGcloudProj;
    if (prevGcpProject) process.env.GCP_PROJECT = prevGcpProject;
    
    if (prevMetadataHost) {
      process.env.GCP_METADATA_HOST = prevMetadataHost;
    } else {
      delete process.env.GCP_METADATA_HOST;
    }

    if (prevDetectMetadata) {
      process.env.DETECT_GCP_METADATA = prevDetectMetadata;
    } else {
      delete process.env.DETECT_GCP_METADATA;
    }
  }
}

// API Route para o Gemini Insights (Mantendo funcionalidades existentes do LumièreOS)
router.post("/gemini-insight", aiLimiter, async (req, res) => {
  try {
    const {
      salonName,
      businessTypeTranslated,
      monthlyCount,
      checklistPct,
      goalPercentage,
      goalCurrent,
      goalTarget,
      professionalsCount,
    } = req.body;

    const apiKey = env.gemini.apiKey;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("SUA_API_KEY")) {
      return res.json({ 
         text: "Inteligência Artificial Pausada: Por favor, adicione sua própria 'GEMINI_API_KEY' nas configurações (Settings) e reinicie o servidor para habilitar os insights gerados por IA."
      });
    }

    const text = await withDeveloperAuth(apiKey, async (ai) => {
      const prompt = `Você é um consultor especialista sênior em gestão de negócios para salões e clínicas de beleza parceiros do LumièreOS. Analise os seguintes indicadores de desempenho do estabelecimento "${salonName || 'Nosso Salão'}" (${businessTypeTranslated || 'Salão de Beleza'}) e gere um insight executivo personalizado de alto nível com um olhar cirúrgico:
Agendamentos este mês: ${monthlyCount || 0}
Uso/Aderência do Checklist Operacional Diário: ${checklistPct || 0}% de conformidade hoje.
Meta de faturamento do mês: ${goalPercentage || 0}% atingida (Atual: R$ ${(goalCurrent || 0).toLocaleString('pt-BR')} de uma meta planejada de R$ ${(goalTarget || 0).toLocaleString('pt-BR')}).
Membros ativos na equipe: ${professionalsCount || 0} profissionais cadastrados.

Gere um diagnóstico analítico em exatamente 2 ou 3 frases. Seja direto, motivador e encorajador, porém prático e profissional.
Foque em destacar um ponto positivo e propor uma sugestão estratégica cirúrgica de melhoria imediata usando linguagens do mercado ou práticas premium de atendimento.
Use sempre o tom em português (do Brasil). Não use saudações introdutórias como "Olá" ou "Com base nos dados", vá direto para a análise executiva.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      if (response && response.text) {
        return response.text.trim();
      } else {
        throw new Error('Retorno vazio da inteligência artificial.');
      }
    });

    return res.json({ text });
  } catch (err: any) {
    console.error('Erro ao gerar insights do Gemini no servidor:', err);
    return res.status(500).json({
      error: err?.message || 'Falha de comunicação com o servidor Lumière AI. Tente novamente em instantes.'
    });
  }
});

// API Route para o Gemini Insights de Equipe
router.post("/gemini-team-insight", aiLimiter, async (req, res) => {
  try {
    const {
      salonName,
      businessTypeTranslated,
      professionalsCount,
      rolesSummary,
      recentEvaluations
    } = req.body;

    const apiKey = env.gemini.apiKey;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("SUA_API_KEY")) {
      return res.json({ 
         text: "Para gerar insights sobre a equipe, adicione sua 'GEMINI_API_KEY' nas configurações."
      });
    }

    const text = await withDeveloperAuth(apiKey, async (ai) => {
      const prompt = `Atue como Especialista de RH e Alta Performance do LumièreOS. Analise a seguinte equipe do estabelecimento "${salonName || 'Nosso Salão'}" (${businessTypeTranslated || 'Salão de Beleza'}):
Tamanho da equipe: ${professionalsCount || 0} profissionais.
Distribuição de funções: ${rolesSummary || 'Não informada'}.
Últimas avaliações operacionais (Checklist diário / NPS interno): ${recentEvaluations || 'Sem dados recentes'}.

Gere um insight executivo em 2 a 3 frases focando em LIDERANÇA e ENGAJAMENTO. 
Sem rodeios. Identifique possíveis gargalos e dê um conselho prático imediato para o gestor.
Use tom em português (Brasil), elegante e encorajador.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
      });

      if (response && response.text) {
        return response.text.trim();
      } else {
        throw new Error('Retorno vazio da inteligência artificial.');
      }
    });

    return res.json({ text });
  } catch (err: any) {
    console.error('Erro ao gerar insights de equipe do Gemini:', err);
    return res.status(500).json({
      error: err?.message || 'Falha de comunicação com o servidor Lumière AI.'
    });
  }
});

// API Route para o Parser de Catálogos de Serviço e Produtos em PDF com IA
router.post("/parse-catalog-pdf", aiLimiter, async (req, res) => {
  try {
    const { pdfBase64, salonName } = req.body;
    
    if (!pdfBase64) {
      return res.status(400).json({ error: "O arquivo PDF (Base64) é obrigatório." });
    }

    const apiKey = env.gemini.apiKey;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("SUA_API_KEY")) {
      return res.status(400).json({ 
         error: "Inteligência Artificial Não Configurada: Para importar catálogos em formato PDF, configure sua 'GEMINI_API_KEY' na aba Secrets (Configurações)."
      });
    }

    const result = await withDeveloperAuth(apiKey, async (ai) => {
      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: [
          {
            inlineData: {
              data: pdfBase64.split(',').pop(), // remove data URI headers
              mimeType: "application/pdf"
            }
          },
          {
            text: `Analise o arquivo PDF de catálogo ou tabela de preços do estabelecimento "${salonName || 'Cliente'}". Identifique e extraia TODOS os serviços (cortes, colorações, tratamentos) e produtos (shampoo, escova, máscara, cremes home care) contidos nele.
Regras de Extração e Conversão de Campos:
1. "name": Nome claro do serviço ou produto (ex: "Corte Feminino", "Shampoo L'Oréal Liss Unlimited").
2. "category": Categoria elegante em português, por ex: "Cabelo", "Unha", "Cílios", "Sobrancelhas", "Massagem", "Maquiagem", "Estética", "Venda de Produtos", "Shampoo & Condicionador", "Finalizadores", "Cuidado Facial".
3. "price": Preço como número decimal positivo. Se for sob consulta/grátis, retorne 0. Se expressar uma variação (Ex: de R$ 150 a R$ 200), defina o valor médio ou mínimo.
4. "priceType": Identifique se o preço é "fixed" (preço fixo), "from" (a partir de) ou "variable" (sob avaliação/variável). Se o texto contiver "a partir de", comece com "from". Se não disser o preço, use "variable".
5. "type": Classifique detalhadamente entre "service" (serviço prestado no salão) ou "product" (produto físico de revenda).
6. "durationMinutes": Duração em minutos lógicos para serviços (Exemplo: Manicure = 45, Corte = 60, Escova = 60, Tintura = 90). Caso seja classificado como "product", "durationMinutes" deve ser obrigatoriamente 0.
7. "description": Breve descrição refinada de uma frase para o cliente.
Retorne estritamente o JSON estruturado em conformidade com o schema.`
          }
        ],
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              items: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    name: { type: "STRING" },
                    category: { type: "STRING" },
                    price: { type: "NUMBER" },
                    type: { type: "STRING", description: "logical 'service' or 'product'" },
                    priceType: { type: "STRING", description: "logical 'fixed', 'from', 'variable'" },
                    durationMinutes: { type: "INTEGER", description: "Logical time, or 0 if product" },
                    description: { type: "STRING" }
                  },
                  required: ["name", "category", "price", "type", "priceType", "durationMinutes"]
                }
              }
            },
            required: ["items"]
          }
        }
      });

      if (response && response.text) {
        return JSON.parse(response.text.trim());
      } else {
        throw new Error('Retorno sem conteúdo do serviço Lumière AI.');
      }
    });

    return res.json(result);
  } catch (err: any) {
    console.error('Erro ao processar catálogo pelo Gemini PDF Reader:', err);
    return res.status(500).json({
      error: err?.message || 'Falha de processamento via Inteligência Artificial.'
    });
  }
});

// API Route para o Chatbot Inteligente Lumière AI
router.post("/gemini-chat", aiLimiter, async (req, res) => {
  try {
    const {
      message,
      history,
      salonName,
      businessType,
      salonPlan,
      userName,
      userRole
    } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: "Sua mensagem é obrigatória." });
    }

    const apiKey = env.gemini.apiKey;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("SUA_API_KEY")) {
      return res.json({ 
         text: "Inteligência Artificial Pausada: Por favor, adicione sua própria 'GEMINI_API_KEY' nas configurações (Settings) do LumièreOS e reinicie o servidor do aplicativo para ativar o bate-papo."
      });
    }

    const text = await withDeveloperAuth(apiKey, async (ai) => {
      const systemInstruction = `Você é o Lumière Assistant, um chatbot de inteligência artificial de elite e consultor de alta performance integrado ao LumiereOS — o SaaS premium de gestão de salões de beleza e clínicas de estética.
Seu objetivo é ajudar proprietários, gerentes e profissionais a elevar o nível de seus negócios, melhorar a liderança de equipe, otimizar rotinas de abertura/fechamento com checklists (Módulo Operacional), aumentar vendas, reajustar comissões de forma justa, fidelizar clientes e organizar agendamentos.
Informações sobre o contexto atual do usuário:
- Salão/Estabelecimento: ${salonName || 'Nosso Salão'}
- Tipo de Negócio: ${businessType || 'Salão de beleza/clínica'}
- Plano LumiereOS do Salão: ${salonPlan || 'Performance'}
- Usuário que está falando com você: ${userName || 'Colaborador'} (Função no salão: ${userRole || 'Profissional'})

Instruções de Resposta:
1. Responda em Português do Brasil com um tom extremamente elegante, profissional, empático, encorajador e focado em alta-performance. Seu estilo é o de um mentor executivo de salões de beleza de prestígio.
2. Seja direto e estruturado nas respostas. Use listas de tópicos (bullets) para ideias de ação prática.
3. Não use saudações robotizadas longas ou textão desnecessário. Tente dar conselhos práticos que possam ser aplicados hoje mesmo.
4. Jamais invente dados confidenciais do LumiereOS ou finja que tem acesso a dados confidenciais que não foram compartilhados.
5. Formate suas respostas para Markdown simples (use negritos, bullets, e quebras de linha limpas), mas não use blocos de código grandes desnecessariamente.`;

      // Map incoming history list to Gemini's expected array of Content { role: "user" | "model", parts: [{ text: "..." }] }
      const formattedContents = [
        ...(history || []).map((msg: any) => ({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content || msg.text || '' }]
        })),
        {
          role: 'user',
          parts: [{ text: message }]
        }
      ];

      const response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: formattedContents,
        config: {
          systemInstruction: systemInstruction,
          temperature: 0.7,
        }
      });

      if (response && response.text) {
        return response.text.trim();
      } else {
        throw new Error('Sem resposta gerada pelo servidor do Lumière AI.');
      }
    });

    return res.json({ text });
  } catch (err: any) {
    console.error('Erro no Lumière AI Chatbot:', err);
    return res.status(500).json({
      error: err?.message || 'Falha de comunicação no barramento Lumière AI. Tente novamente.'
    });
  }
});

// Helper de fallback heurístico inteligente quando a API externa não estiver disponível
function buildHeuristicDailyInsights(data: {
  salonName: string;
  todayTarget: number;
  todayAchieved: number;
  progressPct: number;
  monthlyTarget: number;
  monthlyAchieved: number;
  monthlyProgressPct: number;
  scheduledCount: number;
  completedCount: number;
  pendingCount: number;
  checklistRunsCount: number;
  expensesToday: number;
  netCashToday: number;
}) {
  const {
    salonName,
    todayTarget,
    todayAchieved,
    progressPct,
    monthlyTarget,
    monthlyAchieved,
    monthlyProgressPct,
    scheduledCount,
    pendingCount,
    checklistRunsCount,
    expensesToday,
    netCashToday,
  } = data;

  let status: 'optimal' | 'attention' | 'critical' = 'optimal';
  let statusLabel = 'Operação em Ritmo Saudável';
  let executiveSummary = `O ritmo de atendimento do ${salonName} está em fluxo consistente hoje, com metas alinhadas ao planejamento semanal.`;

  if (progressPct < 40 && pendingCount > 3) {
    status = 'critical';
    statusLabel = 'Atenção Operacional & Metas';
    executiveSummary = `Atingimento de metas em ritmo lento para o horário e acúmulo de agendamentos pendentes demandam intervenção imediata da recepção.`;
  } else if (progressPct < 70 || pendingCount > 1 || expensesToday > todayAchieved) {
    status = 'attention';
    statusLabel = 'Ajustes de Ritmo Recomendados';
    executiveSummary = `Bom volume de operações em andamento, porém há pendências a confirmar e margem para acelerar o ticket médio antes do fechamento.`;
  }

  const pendenciesList: any[] = [];
  if (pendingCount > 0) {
    pendenciesList.push({
      id: 'pend_appointments',
      category: 'appointments',
      priority: pendingCount > 2 ? 'high' : 'medium',
      title: `${pendingCount} agendamento(s) aguardando confirmação`,
      description: `Clientes agendados para hoje ainda não confirmaram presença via WhatsApp ou recepção.`,
      actionLabel: 'Ver Agendamentos',
      actionUrl: '/dashboard/agendamentos'
    });
  }
  if (checklistRunsCount === 0) {
    pendenciesList.push({
      id: 'pend_checklist',
      category: 'checklists',
      priority: 'medium',
      title: 'Checklist Operacional Diário não registrado',
      description: 'O checklist de abertura e conformidade dos postos de atendimento ainda não foi concluído hoje.',
      actionLabel: 'Abrir Checklists',
      actionUrl: '/dashboard/checklist'
    });
  }
  if (pendenciesList.length === 0) {
    pendenciesList.push({
      id: 'pend_crm',
      category: 'team',
      priority: 'low',
      title: 'Rotina de CRM & Pós-Atendimento',
      description: 'Aproveite os intervalos da tarde para convidar clientes inativos para serviços de manutenção.',
      actionLabel: 'Ver CRM',
      actionUrl: '/dashboard/clientes'
    });
  }

  const financialAlertsList: any[] = [];
  if (netCashToday > 0) {
    financialAlertsList.push({
      id: 'fin_positive_flow',
      type: 'positive',
      title: 'Fluxo Líquido Positivo',
      description: `Saldo líquido do dia favorável em R$ ${netCashToday.toLocaleString('pt-BR')}, superando as despesas imediatas.`,
      highlight: `+ R$ ${netCashToday.toLocaleString('pt-BR')}`
    });
  } else if (netCashToday < 0) {
    financialAlertsList.push({
      id: 'fin_negative_flow',
      type: 'warning',
      title: 'Despesas Superiores à Entrada',
      description: `Despesas registradas hoje (R$ ${expensesToday.toLocaleString('pt-BR')}) superam os recebimentos imediatos. Acelere os fechamentos de comanda.`,
      highlight: `- R$ ${Math.abs(netCashToday).toLocaleString('pt-BR')}`
    });
  }

  if (todayTarget > 0 && todayAchieved < todayTarget) {
    const gap = todayTarget - todayAchieved;
    financialAlertsList.push({
      id: 'fin_goal_gap',
      type: 'info',
      title: 'Gap de Meta Diária',
      description: `Faltam R$ ${gap.toLocaleString('pt-BR')} para completar a cota prevista de hoje.`,
      highlight: `Faltam R$ ${gap.toLocaleString('pt-BR')}`
    });
  }

  return {
    executiveSummary,
    status,
    statusLabel,
    goalsDiagnosis: {
      analysis: `A meta diária atingiu ${Math.round(progressPct)}% do planejado (R$ ${todayAchieved.toLocaleString('pt-BR')} de R$ ${todayTarget.toLocaleString('pt-BR')}). No acumulado mensal, o salão alcançou ${Math.round(monthlyProgressPct)}% de R$ ${monthlyTarget.toLocaleString('pt-BR')}.`,
      paceDescription: todayAchieved >= todayTarget
        ? 'Meta diária superada com sucesso! Foque em upsell de produtos home care.'
        : `Faltam R$ ${(todayTarget - todayAchieved > 0 ? todayTarget - todayAchieved : 0).toLocaleString('pt-BR')} para cumprir a meta do dia.`
    },
    goals: {
      todayTarget,
      todayAchieved,
      progressPct: Math.round(progressPct),
      monthlyTarget,
      monthlyAchieved,
      monthlyProgressPct: Math.round(monthlyProgressPct)
    },
    pendencies: pendenciesList,
    financialAlerts: financialAlertsList,
    strategicTip: `Ofereça um serviço complementar express (como nutrição capilar ou spa de pés) durante os agendamentos já confirmados para elevar o ticket médio e fechar o dia acima da meta.`
  };
}

// API Route: LumièreIA Daily Executive Insights (Metas, Pendências e Alertas Financeiros)
router.post("/lumiere-insights/daily", aiLimiter, async (req, res) => {
  try {
    const { salonId, date, clientMetrics } = req.body || {};

    if (!salonId) {
      return res.status(400).json({ error: "O identificador do salão (salonId) é obrigatório." });
    }

    const todayStr = date || new Date().toISOString().substring(0, 10);
    const currentMonthStr = todayStr.substring(0, 7);
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentDay = now.getDate();

    let salonName = "Nosso Salão";
    let businessType = "Salão de Beleza";

    // Dados agregados com fallbacks seguros a partir do Firestore Admin
    let monthlyTarget = clientMetrics?.monthlyGoal || 0;
    let monthlyAchieved = clientMetrics?.monthRevenue || 0;
    let todayTarget = clientMetrics?.dailyGoal || 0;
    let todayAchieved = clientMetrics?.todayRevenue || 0;
    let scheduledCount = clientMetrics?.scheduledAppointments || 0;
    let completedCount = clientMetrics?.completedAppointments || 0;
    let pendingCount = clientMetrics?.pendingAppointments || 0;
    let checklistRunsCount = clientMetrics?.checklistRunsCount || 0;
    let expensesToday = clientMetrics?.expensesToday || 0;
    let netCashToday = clientMetrics?.netCashToday || (todayAchieved - expensesToday);

    try {
      const adminDb = getAdminDb();

      // 1. Obter dados do salão
      const salonSnap = await adminDb.collection("salons").doc(salonId).get();
      if (salonSnap.exists) {
        const sData = salonSnap.data() || {};
        salonName = sData.name || salonName;
        businessType = sData.businessType || businessType;
      }

      // 2. Metas do mês caso não tenham vindo no clientMetrics
      if (!monthlyTarget) {
        const goalsSnap = await adminDb
          .collection("salons")
          .doc(salonId)
          .collection("goals")
          .where("month", "==", currentMonthStr)
          .get();

        goalsSnap.forEach((doc) => {
          const g = doc.data();
          monthlyTarget += Number(g.targetAmount || g.targetValue || 0);
          monthlyAchieved += Number(g.currentAmount || g.currentValue || 0);
        });
      }

      // 3. Agendamentos de hoje caso não tenham vindo
      if (scheduledCount === 0 && completedCount === 0 && pendingCount === 0) {
        const appointmentsSnap = await adminDb
          .collection("salons")
          .doc(salonId)
          .collection("appointments")
          .where("date", "==", todayStr)
          .get();

        appointmentsSnap.forEach((doc) => {
          const appt = doc.data();
          const price = Number(appt.price || 0);
          if (appt.status === "completed") {
            completedCount++;
            if (!clientMetrics?.todayRevenue) todayAchieved += price;
          } else if (appt.status === "scheduled" || appt.status === "pending") {
            pendingCount++;
            scheduledCount++;
          } else if (appt.status === "confirmed") {
            scheduledCount++;
          }
        });
      }

      // 4. Transações financeiras de hoje
      if (expensesToday === 0) {
        const finSnap = await adminDb
          .collection("salons")
          .doc(salonId)
          .collection("financialTransactions")
          .where("date", "==", todayStr)
          .get();

        finSnap.forEach((doc) => {
          const t = doc.data();
          const amount = Number(t.amount || 0);
          if (t.type === "expense") {
            expensesToday += amount;
          } else if (t.type === "revenue" && !clientMetrics?.todayRevenue) {
            todayAchieved += amount;
          }
        });
      }

      // 5. Checklists de hoje
      if (checklistRunsCount === 0) {
        const checklistSnap = await adminDb
          .collection("salons")
          .doc(salonId)
          .collection("checklistRuns")
          .where("date", "==", todayStr)
          .get();
        checklistRunsCount = checklistSnap.size;
      }
    } catch (dbErr) {
      console.warn("[LumièreAI Insights] Falha não impeditiva ao ler Firestore Admin, usando métricas base:", dbErr);
    }

    // Normalizações de metas
    if (!todayTarget) {
      todayTarget = monthlyTarget > 0 ? Math.round(monthlyTarget / daysInMonth) : 1000;
    }
    if (!monthlyTarget) {
      monthlyTarget = todayTarget * daysInMonth;
    }
    const progressPct = todayTarget > 0 ? Math.min(Math.round((todayAchieved / todayTarget) * 100), 250) : 0;
    const monthlyProgressPct = monthlyTarget > 0 ? Math.min(Math.round((monthlyAchieved / monthlyTarget) * 100), 200) : 0;
    netCashToday = todayAchieved - expensesToday;

    const baseData = {
      salonName,
      todayTarget,
      todayAchieved,
      progressPct,
      monthlyTarget,
      monthlyAchieved,
      monthlyProgressPct,
      scheduledCount,
      completedCount,
      pendingCount,
      checklistRunsCount,
      expensesToday,
      netCashToday,
    };

    const apiKey = env.gemini.apiKey;
    if (!apiKey || apiKey === "MY_GEMINI_API_KEY" || apiKey.includes("SUA_API_KEY")) {
      // Retornar fallback inteligente e elegante imediatamente sem erro
      const fallbackResult = buildHeuristicDailyInsights(baseData);
      return res.json({
        ...fallbackResult,
        isAiGenerated: false,
        engine: "Lumière Heuristic Intelligence (Modo Local)",
        generatedAt: new Date().toISOString()
      });
    }

    try {
      const result = await withDeveloperAuth(apiKey, async (ai) => {
        const prompt = `Analise os seguintes indicadores executivos do salão "${salonName}" (${businessType}) para a operação do dia de hoje (${todayStr}):
- Meta Diária: R$ ${todayAchieved.toLocaleString('pt-BR')} realizados de R$ ${todayTarget.toLocaleString('pt-BR')} planejados (${progressPct}% alcançado).
- Meta Mensal: R$ ${monthlyAchieved.toLocaleString('pt-BR')} realizados de R$ ${monthlyTarget.toLocaleString('pt-BR')} planejados (${monthlyProgressPct}% alcançado no dia ${currentDay}/${daysInMonth}).
- Agendamentos Hoje: ${scheduledCount} agendados/confirmados, ${completedCount} já concluídos, ${pendingCount} pendentes de confirmação ou início.
- Checklists Operacionais Concluídos Hoje: ${checklistRunsCount} checklists preenchidos.
- Fluxo Financeiro Hoje: R$ ${todayAchieved.toLocaleString('pt-BR')} em receitas, R$ ${expensesToday.toLocaleString('pt-BR')} em despesas registradas (Saldo Líquido: R$ ${netCashToday.toLocaleString('pt-BR')}).

Gere um diagnóstico executivo sênior de alto nível (estilo Atelier Quiet Luxury: encorajador, elegante, cirúrgico, focado em lucro, retenção e organização).
Seja estritamente conciso e prático. Não use clichês ou generalismos. Retorne o JSON no formato requerido.`;

        const response = await ai.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: prompt,
          config: {
            systemInstruction: `Você é a LumièreIA, consultora executiva sênior e inteligência analítica do LumièreOS — SaaS premium para salões de beleza de alto padrão, clínicas de estética e barbearias.
Gere um resumo diário de alta precisão executiva com base nos dados reais do salão.
Tom de voz: Atelier Quiet Luxury, nobre, refinado, objetivo, motivador e estratégico.
Retorne estritamente o JSON estruturado conforme o schema.`,
            responseMimeType: "application/json",
            responseSchema: {
              type: "OBJECT",
              properties: {
                executiveSummary: {
                  type: "STRING",
                  description: "Resumo executivo de 1 a 2 frases elegantes sobre o ritmo e foco do dia."
                },
                status: {
                  type: "STRING",
                  description: "optimal se o dia estiver excelente, attention se houver pendências/meta atrasada, critical se risco alto"
                },
                statusLabel: {
                  type: "STRING",
                  description: "Frase curta de status (ex: Ritmo Operacional Saudável, Atenção às Metas)"
                },
                goalsDiagnosis: {
                  type: "OBJECT",
                  properties: {
                    analysis: { type: "STRING", description: "Diagnóstico conciso de 1-2 frases sobre a meta diária e mensal." },
                    paceDescription: { type: "STRING", description: "Ex: Faltam R$ 450 para a meta do dia; ritmo atual cobre 85% do necessário." }
                  },
                  required: ["analysis", "paceDescription"]
                },
                pendencies: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      id: { type: "STRING" },
                      category: { type: "STRING", description: "appointments, checklists, financial ou team" },
                      priority: { type: "STRING", description: "high, medium ou low" },
                      title: { type: "STRING" },
                      description: { type: "STRING" },
                      actionLabel: { type: "STRING" },
                      actionUrl: { type: "STRING" }
                    },
                    required: ["id", "category", "priority", "title", "description", "actionLabel", "actionUrl"]
                  }
                },
                financialAlerts: {
                  type: "ARRAY",
                  items: {
                    type: "OBJECT",
                    properties: {
                      id: { type: "STRING" },
                      type: { type: "STRING", description: "positive, warning, danger ou info" },
                      title: { type: "STRING" },
                      description: { type: "STRING" },
                      highlight: { type: "STRING" }
                    },
                    required: ["id", "type", "title", "description"]
                  }
                },
                strategicTip: {
                  type: "STRING",
                  description: "Uma dica de ouro prática e cirúrgica para o gestor aplicar hoje e potencializar o faturamento ou evitar perdas."
                }
              },
              required: ["executiveSummary", "status", "statusLabel", "goalsDiagnosis", "pendencies", "financialAlerts", "strategicTip"]
            }
          }
        });

        if (response && response.text) {
          return JSON.parse(response.text.trim());
        }
        throw new Error("Resposta vazia do modelo Gemini.");
      });

      return res.json({
        ...result,
        goals: {
          todayTarget,
          todayAchieved,
          progressPct,
          monthlyTarget,
          monthlyAchieved,
          monthlyProgressPct
        },
        isAiGenerated: true,
        engine: "Gemini 3.8 Flash (Google AI)",
        generatedAt: new Date().toISOString()
      });
    } catch (aiErr: any) {
      console.warn("[LumièreAI Insights] Falha na chamada ao Gemini, utilizando fallback heurístico:", aiErr?.message || aiErr);
      const fallbackResult = buildHeuristicDailyInsights(baseData);
      return res.json({
        ...fallbackResult,
        isAiGenerated: false,
        engine: "Lumière Heuristic Intelligence (Fallback Resiliente)",
        generatedAt: new Date().toISOString()
      });
    }
  } catch (err: any) {
    console.error("Erro ao gerar Lumière Daily Insights:", err);
    return res.status(500).json({
      error: err?.message || "Falha ao processar os insights diários do LumièreOS."
    });
  }
});

export { router as aiRoutes };
