import { Router } from "express";
import { env } from "../config/env.js";
import { GoogleGenAI } from "@google/genai";
import { aiLimiter } from "../middleware/rateLimiter.js";

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

export { router as aiRoutes };
