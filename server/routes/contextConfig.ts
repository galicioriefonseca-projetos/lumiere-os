import { Router, Request, Response } from "express";
import { getAdminDb } from "../firebaseAdmin.js";
import { verifyIdToken } from "../shared/auth.js";
import { ContextConfig, NicheType, VocabularyConfig, UiPreferences } from "../../src/types/index.js";

export const contextConfigRoutes = Router();

export const NICHE_DEFAULT_CONFIGS: Record<NicheType, Omit<ContextConfig, 'updatedAt'>> = {
  salon: {
    niche: 'salon',
    nicheLabel: 'Salão de Beleza, Barbearia & Esmalteria',
    vocabulary: {
      clientTerm: 'Cliente',
      clientTermPlural: 'Clientes',
      workstationTerm: 'Cadeira / Bancada',
      workstationTermPlural: 'Cadeiras / Bancadas',
      professionalTerm: 'Profissional',
      professionalTermPlural: 'Profissionais',
      serviceTerm: 'Serviço',
      serviceTermPlural: 'Serviços',
      appointmentTerm: 'Agendamento',
      appointmentTermPlural: 'Agendamentos',
      workplaceTerm: 'Salão',
      workplaceTermPlural: 'Salões',
      flowItemTerm: 'Comanda',
      flowItemTermPlural: 'Comandas'
    },
    uiPreferences: {
      themeBadge: 'Beleza & Estética',
      defaultView: 'flow',
      primaryIcon: 'Scissors',
      enableComandasFlow: true,
      enableWorkstations: true,
      enableClientPortal: false,
      enableMedicalRecords: false
    }
  },
  clinic: {
    niche: 'clinic',
    nicheLabel: 'Clínica, Consultório & Saúde Integrada',
    vocabulary: {
      clientTerm: 'Paciente',
      clientTermPlural: 'Pacientes',
      workstationTerm: 'Sala / Consultório',
      workstationTermPlural: 'Salas / Consultórios',
      professionalTerm: 'Especialista / Terapeuta',
      professionalTermPlural: 'Especialistas & Terapeutas',
      serviceTerm: 'Consulta / Procedimento',
      serviceTermPlural: 'Consultas & Procedimentos',
      appointmentTerm: 'Consulta',
      appointmentTermPlural: 'Consultas',
      workplaceTerm: 'Clínica',
      workplaceTermPlural: 'Clínicas',
      flowItemTerm: 'Prontuário',
      flowItemTermPlural: 'Prontuários'
    },
    uiPreferences: {
      themeBadge: 'Saúde & Estética Médica',
      defaultView: 'calendar',
      primaryIcon: 'Activity',
      enableComandasFlow: false,
      enableWorkstations: true,
      enableClientPortal: false,
      enableMedicalRecords: true
    }
  },
  studio: {
    niche: 'studio',
    nicheLabel: 'Estúdio Criativo, Tatuagem, Foto & Arte',
    vocabulary: {
      clientTerm: 'Cliente',
      clientTermPlural: 'Clientes',
      workstationTerm: 'Estação / Espaço',
      workstationTermPlural: 'Estações / Espaços',
      professionalTerm: 'Artista / Especialista',
      professionalTermPlural: 'Artistas & Especialistas',
      serviceTerm: 'Sessão / Projeto',
      serviceTermPlural: 'Sessões & Projetos',
      appointmentTerm: 'Sessão',
      appointmentTermPlural: 'Sessões',
      workplaceTerm: 'Estúdio',
      workplaceTermPlural: 'Estúdios',
      flowItemTerm: 'Ordem de Serviço',
      flowItemTermPlural: 'Ordens de Serviço'
    },
    uiPreferences: {
      themeBadge: 'Estúdio & Criação',
      defaultView: 'calendar',
      primaryIcon: 'Sparkles',
      enableComandasFlow: false,
      enableWorkstations: true,
      enableClientPortal: false,
      enableMedicalRecords: false
    }
  },
  freelancer: {
    niche: 'freelancer',
    nicheLabel: 'Profissional Liberal & Autônomo',
    vocabulary: {
      clientTerm: 'Cliente / Contratante',
      clientTermPlural: 'Clientes / Contratantes',
      workstationTerm: 'Meu Espaço',
      workstationTermPlural: 'Meus Espaços',
      professionalTerm: 'Meu Perfil',
      professionalTermPlural: 'Meus Perfis',
      serviceTerm: 'Trabalho / Honorário',
      serviceTermPlural: 'Trabalhos & Honorários',
      appointmentTerm: 'Atendimento',
      appointmentTermPlural: 'Atendimentos',
      workplaceTerm: 'Meu Negócio',
      workplaceTermPlural: 'Meus Negócios',
      flowItemTerm: 'Proposta / Pedido',
      flowItemTermPlural: 'Propostas & Pedidos'
    },
    uiPreferences: {
      themeBadge: 'Profissional Liberal',
      defaultView: 'calendar',
      primaryIcon: 'Briefcase',
      enableComandasFlow: false,
      enableWorkstations: false,
      enableClientPortal: false,
      enableMedicalRecords: false
    }
  },
  agency: {
    niche: 'agency',
    nicheLabel: 'Agência Digital, Marketing & Tráfego',
    vocabulary: {
      clientTerm: 'Cliente / Conta',
      clientTermPlural: 'Clientes & Contas',
      workstationTerm: 'Squad / Time',
      workstationTermPlural: 'Squads / Times',
      professionalTerm: 'Especialista / Membro',
      professionalTermPlural: 'Especialistas & Equipe',
      serviceTerm: 'Serviço / Entrega',
      serviceTermPlural: 'Serviços & Entregas',
      appointmentTerm: 'Reunião / Alinhamento',
      appointmentTermPlural: 'Reuniões & Alinhamentos',
      workplaceTerm: 'Agência',
      workplaceTermPlural: 'Agências',
      flowItemTerm: 'Job / Sprint',
      flowItemTermPlural: 'Jobs & Sprints'
    },
    uiPreferences: {
      themeBadge: 'Marketing & Digital',
      defaultView: 'calendar',
      primaryIcon: 'Briefcase',
      enableComandasFlow: false,
      enableWorkstations: false,
      enableClientPortal: true,
      enableMedicalRecords: false
    }
  },
  consulting: {
    niche: 'consulting',
    nicheLabel: 'Consultoria Empresarial & Assessoria',
    vocabulary: {
      clientTerm: 'Cliente / Contratante',
      clientTermPlural: 'Clientes / Contratantes',
      workstationTerm: 'Sala de Reunião',
      workstationTermPlural: 'Salas de Reunião',
      professionalTerm: 'Consultor / Assessor',
      professionalTermPlural: 'Consultores & Assessores',
      serviceTerm: 'Consultoria / Sessão',
      serviceTermPlural: 'Consultorias & Sessões',
      appointmentTerm: 'Sessão / Reunião',
      appointmentTermPlural: 'Sessões & Reuniões',
      workplaceTerm: 'Consultoria',
      workplaceTermPlural: 'Consultorias',
      flowItemTerm: 'Plano de Ação',
      flowItemTermPlural: 'Planos de Ação'
    },
    uiPreferences: {
      themeBadge: 'Consultoria & Gestão',
      defaultView: 'calendar',
      primaryIcon: 'Briefcase',
      enableComandasFlow: false,
      enableWorkstations: false,
      enableClientPortal: false,
      enableMedicalRecords: false
    }
  }
};

export function inferNicheFromSalon(salonData: any): NicheType {
  if (!salonData) return 'salon';

  const managementMode = String(salonData.managementMode || '').toLowerCase();
  if (managementMode === 'liberal') {
    return 'freelancer';
  }

  const businessType = String(salonData.businessType || '').toLowerCase();
  const segment = String(salonData.segment || '').toLowerCase();
  const name = String(salonData.name || '').toLowerCase();

  if (businessType === 'clinic' || segment === 'health' || name.includes('clinica') || name.includes('consultorio') || name.includes('odonto') || name.includes('estetica medica')) {
    return 'clinic';
  }

  if (businessType === 'studio' || name.includes('tatuagem') || name.includes('tattoo') || name.includes('fotografia') || name.includes('studio ') || name.includes('estudio')) {
    return 'studio';
  }

  if (businessType === 'agency' || segment === 'agency' || name.includes('agencia') || name.includes('marketing') || name.includes('trafego')) {
    return 'agency';
  }

  if (businessType === 'consulting' || segment === 'consulting' || name.includes('consultoria') || name.includes('assessoria')) {
    return 'consulting';
  }

  return 'salon';
}

export function buildContextConfig(niche: NicheType, customOverrides?: Partial<VocabularyConfig>, customPreferences?: Partial<UiPreferences>): ContextConfig {
  const template = NICHE_DEFAULT_CONFIGS[niche] || NICHE_DEFAULT_CONFIGS.salon;
  return {
    niche: template.niche,
    nicheLabel: template.nicheLabel,
    vocabulary: {
      ...template.vocabulary,
      ...(customOverrides || {})
    },
    uiPreferences: {
      ...template.uiPreferences,
      ...(customPreferences || {})
    },
    customOverrides: customOverrides || {},
    updatedAt: Date.now()
  };
}

// GET /api/context-config/templates - Retorna modelos de nichos para o onboarding e configurações
contextConfigRoutes.get("/templates", (_req: Request, res: Response) => {
  return res.json({
    success: true,
    templates: NICHE_DEFAULT_CONFIGS
  });
});

// GET /api/context-config - Retorna a configuração de contexto atual do salão
contextConfigRoutes.get("/", async (req: Request, res: Response) => {
  try {
    const user = await verifyIdToken(req);
    const adminDb = getAdminDb();

    const userSnap = await adminDb.collection("users").doc(user.uid).get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const userData = userSnap.data();
    const salonId = userData?.salonId;
    if (!salonId) {
      return res.status(400).json({ error: "Salão não vinculado ao usuário." });
    }

    const salonSnap = await adminDb.collection("salons").doc(salonId).get();
    if (!salonSnap.exists) {
      return res.status(404).json({ error: "Salão não encontrado." });
    }

    const salonData = salonSnap.data() || {};
    let config = salonData.contextConfig as ContextConfig | undefined;

    if (!config) {
      const inferredNiche = inferNicheFromSalon(salonData);
      config = buildContextConfig(inferredNiche);
    }

    return res.json({
      success: true,
      contextConfig: config
    });
  } catch (error: any) {
    console.error("[ContextConfig GET] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao consultar contexto." });
  }
});

// POST /api/context-config/initialize - Inicializa e persiste a configuração do nicho ao finalizar o onboarding
contextConfigRoutes.post("/initialize", async (req: Request, res: Response) => {
  try {
    const user = await verifyIdToken(req);
    const adminDb = getAdminDb();

    const userSnap = await adminDb.collection("users").doc(user.uid).get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const userData = userSnap.data();
    const salonId = userData?.salonId;
    if (!salonId) {
      return res.status(400).json({ error: "Salão não vinculado ao usuário." });
    }

    const salonRef = adminDb.collection("salons").doc(salonId);
    const salonSnap = await salonRef.get();
    if (!salonSnap.exists) {
      return res.status(404).json({ error: "Salão não encontrado." });
    }

    const salonData = salonSnap.data() || {};
    const { niche: requestedNiche, customOverrides, customPreferences } = req.body || {};

    const chosenNiche: NicheType = requestedNiche && NICHE_DEFAULT_CONFIGS[requestedNiche as NicheType]
      ? (requestedNiche as NicheType)
      : inferNicheFromSalon(salonData);

    const contextConfig = buildContextConfig(chosenNiche, customOverrides, customPreferences);

    // Mapear compatibilidade com businessType e segment
    let mappedSegment = 'beauty';
    let mappedBusinessType = 'salon';
    if (chosenNiche === 'clinic') {
      mappedSegment = 'health';
      mappedBusinessType = 'clinic';
    } else if (chosenNiche === 'studio') {
      mappedSegment = 'services';
      mappedBusinessType = 'studio';
    } else if (chosenNiche === 'freelancer') {
      mappedSegment = 'services';
      mappedBusinessType = 'services';
    } else if (chosenNiche === 'agency') {
      mappedSegment = 'agency';
      mappedBusinessType = 'agency';
    } else if (chosenNiche === 'consulting') {
      mappedSegment = 'consulting';
      mappedBusinessType = 'consulting';
    }

    const updatePayload: Record<string, any> = {
      contextConfig,
      segment: mappedSegment,
      businessType: mappedBusinessType,
      managementMode: chosenNiche === 'freelancer' ? 'liberal' : (salonData.managementMode || 'business'),
      updatedAt: Date.now()
    };

    // Ajustar enabledModules caso não estejam definidos
    if (!salonData.enabledModules) {
      const isComandas = contextConfig.uiPreferences.enableComandasFlow;
      const isClientPortal = contextConfig.uiPreferences.enableClientPortal;
      updatePayload.enabledModules = {
        appointments: true,
        clients: true,
        financial: true,
        services: true,
        team: chosenNiche !== 'freelancer',
        checklists: true,
        goals: true,
        inventory: chosenNiche === 'salon' || chosenNiche === 'clinic',
        commissions: chosenNiche !== 'freelancer',
        pricing: true,
        gamification: chosenNiche === 'salon' || chosenNiche === 'clinic',
        clientPortal: isClientPortal
      };
    }

    await salonRef.update(updatePayload);

    console.log(`[ContextConfig] Inicializado com sucesso para salão ${salonId}: nicho=${chosenNiche}`);

    return res.json({
      success: true,
      message: `Contexto do nicho ${contextConfig.nicheLabel} configurado com sucesso!`,
      contextConfig
    });
  } catch (error: any) {
    console.error("[ContextConfig Initialize] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao inicializar contexto." });
  }
});

// PUT /api/context-config - Atualiza ajustes manuais e vocabulário customizado
contextConfigRoutes.put("/", async (req: Request, res: Response) => {
  try {
    const user = await verifyIdToken(req);
    const adminDb = getAdminDb();

    const userSnap = await adminDb.collection("users").doc(user.uid).get();
    if (!userSnap.exists) {
      return res.status(404).json({ error: "Usuário não encontrado." });
    }

    const userData = userSnap.data();
    const salonId = userData?.salonId;
    if (!salonId) {
      return res.status(400).json({ error: "Salão não vinculado ao usuário." });
    }

    const salonRef = adminDb.collection("salons").doc(salonId);
    const salonSnap = await salonRef.get();
    if (!salonSnap.exists) {
      return res.status(404).json({ error: "Salão não encontrado." });
    }

    const salonData = salonSnap.data() || {};
    const { niche: requestedNiche, customOverrides, uiPreferences } = req.body || {};

    const currentNiche: NicheType = requestedNiche && NICHE_DEFAULT_CONFIGS[requestedNiche as NicheType]
      ? requestedNiche
      : (salonData.contextConfig?.niche || inferNicheFromSalon(salonData));

    const existingConfig = salonData.contextConfig || buildContextConfig(currentNiche);

    const updatedConfig: ContextConfig = {
      niche: currentNiche,
      nicheLabel: NICHE_DEFAULT_CONFIGS[currentNiche]?.nicheLabel || existingConfig.nicheLabel,
      vocabulary: {
        ...(NICHE_DEFAULT_CONFIGS[currentNiche]?.vocabulary || existingConfig.vocabulary),
        ...(customOverrides || {})
      },
      uiPreferences: {
        ...(NICHE_DEFAULT_CONFIGS[currentNiche]?.uiPreferences || existingConfig.uiPreferences),
        ...(uiPreferences || {})
      },
      customOverrides: {
        ...(existingConfig.customOverrides || {}),
        ...(customOverrides || {})
      },
      updatedAt: Date.now()
    };

    await salonRef.update({
      contextConfig: updatedConfig,
      updatedAt: Date.now()
    });

    return res.json({
      success: true,
      message: "Configurações de vocabulário e contexto atualizadas com sucesso!",
      contextConfig: updatedConfig
    });
  } catch (error: any) {
    console.error("[ContextConfig PUT] Erro:", error);
    return res.status(500).json({ error: error.message || "Erro ao atualizar contexto." });
  }
});
