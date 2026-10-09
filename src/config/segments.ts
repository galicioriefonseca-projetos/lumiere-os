export type BusinessSegment = 'beauty' | 'agency' | 'consulting' | 'health' | 'services';

export interface SegmentLexicon {
  company: string;
  companyPlural: string;
  client: string;
  clients: string;
  professional: string;
  professionals: string;
  service: string;
  services: string;
  appointment: string;
  appointments: string;
  checklists: string;
  pricing: string;
  inventory: string;
  goals: string;
  commissions: string;
}

export interface SegmentConfig {
  id: BusinessSegment;
  name: string;
  badge: string;
  description: string;
  lexicon: SegmentLexicon;
  defaultModules: {
    appointments: boolean;
    clients: boolean;
    financial: boolean;
    services: boolean;
    team: boolean;
    checklists: boolean;
    goals: boolean;
    inventory: boolean;
    commissions: boolean;
    pricing: boolean;
    gamification: boolean;
  };
  sampleServices: Array<{
    name: string;
    category: string;
    price: number;
    durationMinutes: number;
    description: string;
    isRecurring?: boolean;
    isOnline?: boolean;
  }>;
}

export const SEGMENTS: Record<BusinessSegment, SegmentConfig> = {
  beauty: {
    id: 'beauty',
    name: 'Beleza & Estética',
    badge: 'Salões, Clínicas e Barbearias',
    description: 'Gestão completa para salões de beleza, barbearias, clínicas de estética, esmalterias e spas.',
    lexicon: {
      company: 'Salão / Estúdio',
      companyPlural: 'Salões & Estúdios',
      client: 'Cliente',
      clients: 'Clientes',
      professional: 'Profissional / Especialista',
      professionals: 'Profissionais',
      service: 'Serviço / Procedimento',
      services: 'Serviços & Produtos',
      appointment: 'Agendamento',
      appointments: 'Agenda de Atendimentos',
      checklists: 'Checklists de Qualidade',
      pricing: 'Precificação de Serviços',
      inventory: 'Controle de Estoque',
      goals: 'Metas do Salão',
      commissions: 'Comissões da Equipe'
    },
    defaultModules: {
      appointments: true,
      clients: true,
      financial: true,
      services: true,
      team: true,
      checklists: true,
      goals: true,
      inventory: true,
      commissions: true,
      pricing: true,
      gamification: true
    },
    sampleServices: [
      { name: 'Corte e Escova', category: 'Cabelo', price: 120, durationMinutes: 60, description: 'Corte personalizado e finalização profissional com escova modeladora.' },
      { name: 'Coloração / Mechas', category: 'Química', price: 350, durationMinutes: 180, description: 'Transformação de cor com produtos de alta performance e tratamento reconstrutor.' },
      { name: 'Manicure & Pedicure', category: 'Unhas', price: 75, durationMinutes: 60, description: 'Cuidado completo das unhas com esmaltação premium.' }
    ]
  },
  agency: {
    id: 'agency',
    name: 'Agência de Marketing & Digital',
    badge: 'Marketing Digital, Tráfego & Web',
    description: 'Ideal para agências de marketing, gestores de tráfego, social media, criadores de landing pages e especialistas em Google Meu Negócio.',
    lexicon: {
      company: 'Agência / Empresa',
      companyPlural: 'Agências & Empresas',
      client: 'Cliente / Conta',
      clients: 'Clientes & Contas',
      professional: 'Especialista / Membro',
      professionals: 'Equipe & Especialistas',
      service: 'Serviço / Projeto / Contrato',
      services: 'Serviços & Entregas',
      appointment: 'Reunião / Alinhamento',
      appointments: 'Agenda & Reuniões',
      checklists: 'Checklists de Entregas & Onboarding',
      pricing: 'Precificação de Projetos & Fee',
      inventory: 'Insumos & Ferramentas',
      goals: 'Metas de MRR & Faturamento',
      commissions: 'Comissões & Parcerias'
    },
    defaultModules: {
      appointments: true,
      clients: true,
      financial: true,
      services: true,
      team: true,
      checklists: true,
      goals: true,
      inventory: false,
      commissions: true,
      pricing: true,
      gamification: true
    },
    sampleServices: [
      { name: 'Gestão de Google Meu Negócio (Mensal)', category: 'SEO Local', price: 650, durationMinutes: 60, isRecurring: true, description: 'Otimização contínua de perfil, fotos, produtos, postagens semanais e gestão de avaliações.' },
      { name: 'Gestão de Redes Sociais & Conteúdo (Instagram)', category: 'Social Media', price: 1500, durationMinutes: 60, isRecurring: true, description: 'Estratégia de conteúdo, criação de posts/carrosséis, roteiros de Reels e monitoramento mensal.' },
      { name: 'Criação de Landing Page de Alta Conversão', category: 'Web & Páginas', price: 1800, durationMinutes: 120, isOnline: true, description: 'Design exclusivo, copywriting focado em conversão, integração com WhatsApp e Meta Pixel.' },
      { name: 'Criação de Site Institucional Completo', category: 'Desenvolvimento Web', price: 3200, durationMinutes: 180, isOnline: true, description: 'Site institucional moderno, responsivo, otimizado para SEO e painel administrativo.' },
      { name: 'Estruturação de WhatsApp Business & Automações', category: 'Comunicação', price: 800, durationMinutes: 90, isOnline: true, description: 'Catálogo de produtos, respostas rápidas, mensagens automáticas e funil de atendimento.' },
      { name: 'Consultoria de Gestão & Tráfego Pago (Mensal)', category: 'Consultoria', price: 2200, durationMinutes: 60, isRecurring: true, isOnline: true, description: 'Gestão de campanhas Meta Ads / Google Ads e reuniões quinzenais de análise de métricas e ROI.' }
    ]
  },
  consulting: {
    id: 'consulting',
    name: 'Consultoria & Gestão Empresarial',
    badge: 'Consultores, Mentores e Assessores',
    description: 'Gestão de clientes, contratos recorrentes, reuniões de diagnóstico e honorários para consultores empresariais e financeiros.',
    lexicon: {
      company: 'Consultoria / Escritório',
      companyPlural: 'Consultorias & Escritórios',
      client: 'Cliente / Contratante',
      clients: 'Clientes / Contratantes',
      professional: 'Consultor / Assessor',
      professionals: 'Consultores & Assessores',
      service: 'Consultoria / Diagnóstico',
      services: 'Serviços & Honorários',
      appointment: 'Sessão / Reunião de Alinhamento',
      appointments: 'Agenda & Sessões',
      checklists: 'Checklists de Diagnóstico & Processos',
      pricing: 'Precificação de Honorários',
      inventory: 'Materiais & Manuais',
      goals: 'Metas de Clientes & MRR',
      commissions: 'Honorários de Parcerias'
    },
    defaultModules: {
      appointments: true,
      clients: true,
      financial: true,
      services: true,
      team: true,
      checklists: true,
      goals: true,
      inventory: false,
      commissions: true,
      pricing: true,
      gamification: false
    },
    sampleServices: [
      { name: 'Diagnóstico de Gestão & Processos', category: 'Diagnóstico', price: 1500, durationMinutes: 90, isOnline: true, description: 'Mapeamento completo dos processos operacionais, financeiros e comerciais da empresa.' },
      { name: 'Mentoria Executiva Mensal (2x/mês)', category: 'Mentoria', price: 2500, durationMinutes: 60, isRecurring: true, isOnline: true, description: 'Sessões quinzenais de planejamento estratégico e acompanhamento de indicadores (KPIs).' },
      { name: 'Assessoria de Finanças & DRE', category: 'Finanças', price: 1800, durationMinutes: 60, isRecurring: true, isOnline: true, description: 'Estruturação de fluxo de caixa, precificação de produtos/serviços e relatórios DRE.' }
    ]
  },
  health: {
    id: 'health',
    name: 'Saúde & Terapias',
    badge: 'Nutricionistas, Terapeutas e Clínicas',
    description: 'Para psicólogos, nutricionistas, fisioterapeutas, dentistas, fonoaudiólogos e profissionais de saúde e bem-estar.',
    lexicon: {
      company: 'Clínica / Consultório',
      companyPlural: 'Clínicas & Consultórios',
      client: 'Paciente',
      clients: 'Pacientes',
      professional: 'Especialista / Terapeuta',
      professionals: 'Especialistas & Terapeutas',
      service: 'Consulta / Sessão',
      services: 'Consultas & Tratamentos',
      appointment: 'Consulta / Atendimento',
      appointments: 'Agenda de Consultas',
      checklists: 'Checklists Clínicos & Procedimentos',
      pricing: 'Tabela de Consultas & Planos',
      inventory: 'Insumos Clínicos',
      goals: 'Metas de Atendimento',
      commissions: 'Repasses & Comissões'
    },
    defaultModules: {
      appointments: true,
      clients: true,
      financial: true,
      services: true,
      team: true,
      checklists: true,
      goals: true,
      inventory: true,
      commissions: true,
      pricing: true,
      gamification: true
    },
    sampleServices: [
      { name: 'Consulta Inicial com Avaliação', category: 'Consulta', price: 250, durationMinutes: 60, description: 'Anamnese completa, avaliação de necessidades e plano de acompanhamento.' },
      { name: 'Sessão de Acompanhamento', category: 'Sessão', price: 180, durationMinutes: 50, description: 'Sessão periódica de acompanhamento e ajustes na evolução do paciente.' },
      { name: 'Pacote Mensal de Tratamento (4 sessões)', category: 'Pacotes', price: 650, durationMinutes: 50, isRecurring: true, description: 'Quatro sessões mensais com suporte e relatórios de progresso contínuo.' }
    ]
  },
  services: {
    id: 'services',
    name: 'Prestador de Serviços Geral',
    badge: 'Profissionais Liberais & Empresas',
    description: 'Para fotógrafos, arquitetos, designers, estúdios de tatuagem, assistência técnica e prestadores de serviços em geral.',
    lexicon: {
      company: 'Empresa / Escritório',
      companyPlural: 'Empresas & Escritórios',
      client: 'Cliente',
      clients: 'Clientes',
      professional: 'Profissional / Especialista',
      professionals: 'Equipe de Profissionais',
      service: 'Serviço / Projeto',
      services: 'Serviços & Produtos',
      appointment: 'Agendamento / Visita',
      appointments: 'Agenda de Serviços',
      checklists: 'Checklists Operacionais',
      pricing: 'Precificação de Serviços',
      inventory: 'Controle de Materiais',
      goals: 'Metas do Negócio',
      commissions: 'Comissões de Vendas',
    },
    defaultModules: {
      appointments: true,
      clients: true,
      financial: true,
      services: true,
      team: true,
      checklists: true,
      goals: true,
      inventory: true,
      commissions: true,
      pricing: true,
      gamification: true
    },
    sampleServices: [
      { name: 'Atendimento / Visita Técnica', category: 'Atendimento', price: 150, durationMinutes: 60, description: 'Visita presencial ou atendimento inicial com diagnóstico.' },
      { name: 'Execução de Projeto Personalizado', category: 'Projetos', price: 1200, durationMinutes: 180, description: 'Entrega de serviço sob medida com garantia de qualidade.' }
    ]
  }
};

export function detectBusinessSegment(salonData: any): BusinessSegment {
  if (!salonData) return 'beauty';
  
  if (salonData.segment && SEGMENTS[salonData.segment as BusinessSegment]) {
    return salonData.segment as BusinessSegment;
  }

  const name = String(salonData.name || '').toLowerCase();
  const segmentRaw = String(salonData.businessType || salonData.segment || '').toLowerCase();

  if (segmentRaw === 'agency' || /agencia|agência|marketing|mídia|midia|trafego|tráfego|web|publicidade|gf\s*marketing/i.test(name)) {
    return 'agency';
  }
  if (segmentRaw === 'consulting' || /consultor|consultoria|gestao|gestão|assessoria|mentor/i.test(name)) {
    return 'consulting';
  }
  if (segmentRaw === 'health' || segmentRaw === 'clinic' || /clinica|clínica|terapia|psico|nutri|fisio|odonto|saude|saúde/i.test(name)) {
    return 'health';
  }
  if (segmentRaw === 'services' || /design|foto|arquitetura|estudio|estúdio|tatuagem/i.test(name)) {
    return 'services';
  }

  return 'beauty';
}
