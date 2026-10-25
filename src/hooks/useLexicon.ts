import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { SEGMENTS, detectBusinessSegment, BusinessSegment, SegmentLexicon, SegmentConfig } from '../config/segments';
import { ContextConfig, NicheType, VocabularyConfig, UiPreferences } from '../types';

export function useLexicon() {
  const { salonData } = useAuth();

  const segment: BusinessSegment = useMemo(() => {
    return detectBusinessSegment(salonData);
  }, [salonData?.segment, salonData?.businessType, salonData?.name]);

  const segmentConfig: SegmentConfig = useMemo(() => {
    return SEGMENTS[segment] || SEGMENTS.beauty;
  }, [segment]);

  // Identificação do nicho: Se já configurado no contextConfig, respeitar; senão, derivar do segmento/managementMode
  const niche: NicheType = useMemo(() => {
    if (salonData?.contextConfig?.niche) {
      return salonData.contextConfig.niche;
    }
    if (salonData?.managementMode === 'liberal') return 'freelancer';
    if (salonData?.businessType === 'clinic' || segment === 'health') return 'clinic';
    if (salonData?.businessType === 'studio') return 'studio';
    if (salonData?.businessType === 'agency' || segment === 'agency') return 'agency';
    if (salonData?.businessType === 'consulting' || segment === 'consulting') return 'consulting';
    return 'salon';
  }, [salonData?.contextConfig?.niche, salonData?.managementMode, salonData?.businessType, segment]);

  // Vocabulário dinâmico baseado em ContextConfig ou nos padrões do nicho/segmento
  const contextConfig: ContextConfig | null = useMemo(() => {
    return salonData?.contextConfig || null;
  }, [salonData?.contextConfig]);

  const vocabulary: VocabularyConfig = useMemo(() => {
    if (contextConfig?.vocabulary) {
      return {
        ...contextConfig.vocabulary,
        ...(contextConfig.customOverrides || {})
      };
    }

    // Padrões por nicho caso o salão ainda não tenha executado a inicialização
    switch (niche) {
      case 'clinic':
        return {
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
        };
      case 'studio':
        return {
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
        };
      case 'freelancer':
        return {
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
        };
      case 'agency':
        return {
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
        };
      case 'consulting':
        return {
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
        };
      case 'salon':
      default:
        return {
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
        };
    }
  }, [contextConfig, niche]);

  const uiPreferences: UiPreferences = useMemo(() => {
    if (contextConfig?.uiPreferences) {
      return contextConfig.uiPreferences;
    }
    return {
      themeBadge: segmentConfig.badge,
      defaultView: niche === 'salon' ? 'flow' : 'calendar',
      primaryIcon: niche === 'salon' ? 'Scissors' : (niche === 'clinic' ? 'Activity' : 'Briefcase'),
      enableComandasFlow: niche === 'salon',
      enableWorkstations: niche === 'salon' || niche === 'clinic' || niche === 'studio',
      enableClientPortal: niche === 'agency',
      enableMedicalRecords: niche === 'clinic'
    };
  }, [contextConfig?.uiPreferences, segmentConfig.badge, niche]);

  // Mesclar com SegmentLexicon para retrocompatibilidade
  const lexicon: SegmentLexicon = useMemo(() => {
    return {
      ...segmentConfig.lexicon,
      company: vocabulary.workplaceTerm,
      companyPlural: vocabulary.workplaceTermPlural,
      client: vocabulary.clientTerm,
      clients: vocabulary.clientTermPlural,
      professional: vocabulary.professionalTerm,
      professionals: vocabulary.professionalTermPlural,
      service: vocabulary.serviceTerm,
      services: vocabulary.serviceTermPlural,
      appointment: vocabulary.appointmentTerm,
      appointments: vocabulary.appointmentTermPlural
    };
  }, [segmentConfig.lexicon, vocabulary]);

  const isModuleEnabled = (moduleId: keyof SegmentConfig['defaultModules']): boolean => {
    if (!salonData) return true;
    if (salonData.enabledModules && typeof salonData.enabledModules[moduleId] === 'boolean') {
      return salonData.enabledModules[moduleId];
    }
    return segmentConfig.defaultModules[moduleId] !== false;
  };

  const t = (key: keyof SegmentLexicon, fallback?: string): string => {
    return lexicon[key] || fallback || key;
  };

  return {
    segment,
    segmentConfig,
    niche,
    nicheLabel: contextConfig?.nicheLabel || (niche === 'clinic' ? 'Clínica & Saúde' : niche === 'studio' ? 'Estúdio Criativo' : niche === 'freelancer' ? 'Profissional Liberal' : segmentConfig.name),
    contextConfig,
    vocabulary,
    uiPreferences,
    lexicon,
    lex: lexicon,
    t,
    isModuleEnabled,
    // Termos diretos para desestruturação ágil
    clientTerm: vocabulary.clientTerm,
    clientTermPlural: vocabulary.clientTermPlural,
    workstationTerm: vocabulary.workstationTerm,
    workstationTermPlural: vocabulary.workstationTermPlural,
    professionalTerm: vocabulary.professionalTerm,
    professionalTermPlural: vocabulary.professionalTermPlural,
    serviceTerm: vocabulary.serviceTerm,
    serviceTermPlural: vocabulary.serviceTermPlural,
    appointmentTerm: vocabulary.appointmentTerm,
    appointmentTermPlural: vocabulary.appointmentTermPlural,
    workplaceTerm: vocabulary.workplaceTerm,
    workplaceTermPlural: vocabulary.workplaceTermPlural,
    flowItemTerm: vocabulary.flowItemTerm,
    flowItemTermPlural: vocabulary.flowItemTermPlural,
    // Flags de nicho
    isClinic: niche === 'clinic',
    isStudio: niche === 'studio',
    isFreelancer: niche === 'freelancer',
    isSalon: niche === 'salon',
    isAgency: niche === 'agency',
    isConsulting: niche === 'consulting',
    isHealth: niche === 'clinic' || segment === 'health',
    isBeauty: niche === 'salon' || segment === 'beauty'
  };
}
