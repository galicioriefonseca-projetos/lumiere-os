export interface ServiceTemplate {
  name: string;
  category: string;
  price: number;
  priceType: 'fixed' | 'from' | 'variable';
  durationMinutes: number;
  description?: string;
  isRecurring?: boolean;
  isOnline?: boolean;
  segment?: 'beauty' | 'agency' | 'consulting' | 'health' | 'services';
}

export const BEAUTY_CATEGORIES = [
  'Cortes',
  'Escovas e Finalizações',
  'Coloração',
  'Maquiagem',
  'Sobrancelhas e Depilação',
  'Manicure e Pedicure',
  'Tratamentos',
  'Higienização Especial',
  'Progressivas e Botox',
  'Penteado',
  'Mega Hair',
  'Bebidas e Drinks'
];

export const AGENCY_CATEGORIES = [
  'Google Meu Negócio & SEO Local',
  'Instagram & Redes Sociais',
  'Landing Pages & Sites',
  'WhatsApp Business & Automações',
  'Tráfego Pago & Performance',
  'Consultoria & Gestão Empresarial',
  'Design & Identidade Visual',
  'Vídeo & Roteirização'
];

export const CONSULTING_CATEGORIES = [
  'Diagnóstico Empresarial',
  'Mentorias & Alinhamentos',
  'Finanças & DRE',
  'Planejamento Estratégico',
  'Processos & Operações'
];

export const HEALTH_CATEGORIES = [
  'Consultas & Avaliações',
  'Sessões & Tratamentos',
  'Planos & Acompanhamentos',
  'Exames & Procedimentos'
];

export const SERVICES_CATEGORIES = [
  'Atendimento & Diagnóstico',
  'Projetos & Execução',
  'Contratos & Manutenção',
  'Consultoria Especializada'
];

export const INITIAL_CATEGORIES = BEAUTY_CATEGORIES;

export const INITIAL_CATEGORIES_BY_SEGMENT: Record<string, string[]> = {
  beauty: BEAUTY_CATEGORIES,
  agency: AGENCY_CATEGORIES,
  consulting: CONSULTING_CATEGORIES,
  health: HEALTH_CATEGORIES,
  services: SERVICES_CATEGORIES
};

// Templates da Agência de Marketing & Digital (Google Meu Negócio, Instagram, Sites, WhatsApp, Gestão)
export const AGENCY_SERVICE_TEMPLATES: ServiceTemplate[] = [
  // Google Meu Negócio & SEO Local
  {
    name: 'Gestão e Otimização de Google Meu Negócio (Mensal)',
    category: 'Google Meu Negócio & SEO Local',
    price: 650,
    priceType: 'fixed',
    durationMinutes: 60,
    isRecurring: true,
    segment: 'agency',
    description: 'Otimização contínua do perfil, fotos geo-taggeadas, postagens semanais, gestão de avaliações 5 estrelas e SEO Local para o Google Maps.'
  },
  {
    name: 'Configuração e Verificação de Perfil Google Meu Negócio',
    category: 'Google Meu Negócio & SEO Local',
    price: 450,
    priceType: 'fixed',
    durationMinutes: 60,
    segment: 'agency',
    description: 'Criação, recuperação, padronização e verificação oficial da ficha do Google Perfil de Empresa.'
  },
  {
    name: 'Gestão de Avaliações e Reputação Google 5 Estrelas',
    category: 'Google Meu Negócio & SEO Local',
    price: 350,
    priceType: 'fixed',
    durationMinutes: 45,
    isRecurring: true,
    segment: 'agency',
    description: 'Monitoramento, resposta humanizada a todos os comentários e campanhas ativas para geração de novas avaliações positivas.'
  },

  // Instagram & Redes Sociais
  {
    name: 'Gestão Completa de Instagram & Redes Sociais (Mensal)',
    category: 'Instagram & Redes Sociais',
    price: 1500,
    priceType: 'fixed',
    durationMinutes: 60,
    isRecurring: true,
    segment: 'agency',
    description: 'Estratégia de conteúdo mensal, 12 posts/carrosséis, roteiros para Reels, bios estratégica e monitoramento de engajamento.'
  },
  {
    name: 'Produção de Conteúdo & Carrosséis Estratégicos',
    category: 'Instagram & Redes Sociais',
    price: 850,
    priceType: 'fixed',
    durationMinutes: 60,
    segment: 'agency',
    description: 'Pack de 8 carrosséis e artes autorais com copywriting persuasivo voltado para atração e conversão de seguidores em clientes.'
  },
  {
    name: 'Roteirização e Edição de Reels / Vídeos Curtos',
    category: 'Instagram & Redes Sociais',
    price: 950,
    priceType: 'fixed',
    durationMinutes: 90,
    segment: 'agency',
    description: 'Roteiros envolventes com gancho forte, direcionamento de gravação e edição dinâmica de vídeos verticais.'
  },
  {
    name: 'Identidade Visual para Redes Sociais (Feed, Bio & Destaques)',
    category: 'Design & Identidade Visual',
    price: 750,
    priceType: 'fixed',
    durationMinutes: 120,
    segment: 'agency',
    description: 'Paleta de cores, tipografia, capas de destaques padronizadas e templates editáveis para o cliente.'
  },

  // Landing Pages & Sites
  {
    name: 'Criação de Landing Page de Alta Conversão',
    category: 'Landing Pages & Sites',
    price: 1800,
    priceType: 'fixed',
    durationMinutes: 120,
    isOnline: true,
    segment: 'agency',
    description: 'Página focada em captação de leads e vendas, design exclusivo, copywriting persuasivo, carregamento ultrarrápido e integração com WhatsApp e Pixel.'
  },
  {
    name: 'Criação de Site Institucional Completo e Responsivo',
    category: 'Landing Pages & Sites',
    price: 3200,
    priceType: 'fixed',
    durationMinutes: 180,
    isOnline: true,
    segment: 'agency',
    description: 'Site institucional moderno, multi-páginas, responsivo para celular e desktop, otimizado para os motores de busca (SEO).'
  },
  {
    name: 'Manutenção e Hospedagem Mensal de Site/Página',
    category: 'Landing Pages & Sites',
    price: 250,
    priceType: 'fixed',
    durationMinutes: 30,
    isRecurring: true,
    segment: 'agency',
    description: 'Suporte técnico, atualizações de segurança, backups automáticos e hospedagem de alta performance.'
  },

  // WhatsApp Business & Automações
  {
    name: 'Estruturação de WhatsApp Business & Funil de Atendimento',
    category: 'WhatsApp Business & Automações',
    price: 800,
    priceType: 'fixed',
    durationMinutes: 90,
    segment: 'agency',
    description: 'Configuração completa de perfil comercial, catálogo de produtos/serviços com preços, mensagens automáticas de saudação/ausência e etiquetas.'
  },
  {
    name: 'Automação de Agendamentos & Atendimento Inteligente',
    category: 'WhatsApp Business & Automações',
    price: 1200,
    priceType: 'fixed',
    durationMinutes: 120,
    segment: 'agency',
    description: 'Configuração de fluxo conversacional automatizado para tirar dúvidas frequentes e direcionar agendamentos rápidos.'
  },

  // Tráfego Pago & Performance
  {
    name: 'Gestão de Tráfego Pago (Meta Ads & Google Ads)',
    category: 'Tráfego Pago & Performance',
    price: 1800,
    priceType: 'fixed',
    durationMinutes: 60,
    isRecurring: true,
    segment: 'agency',
    description: 'Criação, otimização diária e escala de campanhas de anúncios para atrair clientes qualificados pelo WhatsApp e site.'
  },

  // Consultoria & Gestão Empresarial
  {
    name: 'Consultoria e Diagnóstico de Gestão Empresarial (Mensal)',
    category: 'Consultoria & Gestão Empresarial',
    price: 2200,
    priceType: 'fixed',
    durationMinutes: 60,
    isRecurring: true,
    segment: 'agency',
    description: 'Reuniões quinzenais de alinhamento executivo, análise de metas, funil de vendas, precificação de serviços e planejamento de crescimento.'
  },
  {
    name: 'Análise de Métricas, Funil de Vendas e Relatório Executivo',
    category: 'Consultoria & Gestão Empresarial',
    price: 600,
    priceType: 'fixed',
    durationMinutes: 60,
    segment: 'agency',
    description: 'Relatório detalhado de ROI, custo por cliente, taxa de conversão e plano de ação tático para o próximo mês.'
  }
];

// Templates de Consultoria & Gestão Empresarial
export const CONSULTING_SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    name: 'Diagnóstico Empresarial & Mapeamento de Processos',
    category: 'Diagnóstico Empresarial',
    price: 1500,
    priceType: 'fixed',
    durationMinutes: 90,
    segment: 'consulting',
    description: 'Análise minuciosa de fluxos, gargalos operacionais, liderança e capacidade produtiva.'
  },
  {
    name: 'Mentoria Executiva Quinzenal (Mensal)',
    category: 'Mentorias & Alinhamentos',
    price: 2500,
    priceType: 'fixed',
    durationMinutes: 60,
    isRecurring: true,
    segment: 'consulting',
    description: 'Duas sessões estratégicas por mês para acompanhamento de metas, governança e tomada de decisões.'
  },
  {
    name: 'Assessoria de Finanças, Precificação & DRE',
    category: 'Finanças & DRE',
    price: 1800,
    priceType: 'fixed',
    durationMinutes: 60,
    isRecurring: true,
    segment: 'consulting',
    description: 'Estruturação do fluxo de caixa, margem de contribuição, tabela de preços e análise de lucratividade real.'
  },
  {
    name: 'Planejamento Estratégico Semestral / Anual',
    category: 'Planejamento Estratégico',
    price: 3500,
    priceType: 'fixed',
    durationMinutes: 180,
    segment: 'consulting',
    description: 'Definição de objetivos SMART, metas de equipe, plano de investimento e OKRs para o próximo ciclo.'
  }
];

// Templates de Saúde & Clínicas
export const HEALTH_SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    name: 'Consulta Inicial com Avaliação Completa',
    category: 'Consultas & Avaliações',
    price: 250,
    priceType: 'fixed',
    durationMinutes: 60,
    segment: 'health',
    description: 'Anamnese detalhada, avaliação clínica e direcionamento de protocolo de tratamento.'
  },
  {
    name: 'Sessão de Acompanhamento e Retorno',
    category: 'Sessões & Tratamentos',
    price: 180,
    priceType: 'fixed',
    durationMinutes: 50,
    segment: 'health',
    description: 'Acompanhamento periódico da evolução do paciente e ajustes no plano de cuidados.'
  },
  {
    name: 'Pacote Mensal de Tratamento (4 Sessões)',
    category: 'Planos & Acompanhamentos',
    price: 650,
    priceType: 'fixed',
    durationMinutes: 50,
    isRecurring: true,
    segment: 'health',
    description: 'Tratamento intensivo com quatro sessões mensais e suporte direto.'
  }
];

// Templates de Serviços Gerais & Profissionais Liberais
export const GENERAL_SERVICE_TEMPLATES: ServiceTemplate[] = [
  {
    name: 'Atendimento / Visita Técnica de Diagnóstico',
    category: 'Atendimento & Diagnóstico',
    price: 150,
    priceType: 'fixed',
    durationMinutes: 60,
    segment: 'services',
    description: 'Visita presencial ou remota para levantamento técnico de requisitos e orçamento.'
  },
  {
    name: 'Execução de Projeto Sob Medida',
    category: 'Projetos & Execução',
    price: 1200,
    priceType: 'from',
    durationMinutes: 180,
    segment: 'services',
    description: 'Entrega técnica personalizada com escopo definido e garantia de entrega.'
  },
  {
    name: 'Contrato de Manutenção / Suporte Mensal',
    category: 'Contratos & Manutenção',
    price: 500,
    priceType: 'fixed',
    durationMinutes: 60,
    isRecurring: true,
    segment: 'services',
    description: 'Atendimento preventivo e suporte contínuo para manter a operação em pleno funcionamento.'
  }
];

// Templates de Beleza & Estética (100% dos dados originais preservados)
export const BEAUTY_SERVICE_TEMPLATES: ServiceTemplate[] = [
  // Cortes
  { name: 'Corte feminino', category: 'Cortes', price: 200, priceType: 'fixed', durationMinutes: 60, description: 'Corte de cabelo feminino premium', segment: 'beauty' },
  { name: 'Corte masculino', category: 'Cortes', price: 80, priceType: 'fixed', durationMinutes: 45, description: 'Corte de cabelo masculino premium com lavagem', segment: 'beauty' },
  { name: 'Corte infantil', category: 'Cortes', price: 80, priceType: 'fixed', durationMinutes: 45, description: 'Corte de cabelo infantil', segment: 'beauty' },
  { name: 'Corte de franja', category: 'Cortes', price: 40, priceType: 'fixed', durationMinutes: 30, description: 'Aparo de franja específico', segment: 'beauty' },

  // Escovas e Finalizações
  { name: 'Escova P', category: 'Escovas e Finalizações', price: 70, priceType: 'from', durationMinutes: 45, description: 'Cabelos curtos', segment: 'beauty' },
  { name: 'Escova premium P', category: 'Escovas e Finalizações', price: 100, priceType: 'from', durationMinutes: 60, description: 'Escova com tratamento de hidratação rápido em cabelos curtos', segment: 'beauty' },
  { name: 'Escova M', category: 'Escovas e Finalizações', price: 80, priceType: 'from', durationMinutes: 45, description: 'Cabelos médios', segment: 'beauty' },
  { name: 'Escova premium M', category: 'Escovas e Finalizações', price: 110, priceType: 'from', durationMinutes: 60, description: 'Escova com tratamento de hidratação rápido em cabelos médios', segment: 'beauty' },
  { name: 'Escova G', category: 'Escovas e Finalizações', price: 90, priceType: 'from', durationMinutes: 65, description: 'Cabelos longos', segment: 'beauty' },
  { name: 'Escova premium G', category: 'Escovas e Finalizações', price: 120, priceType: 'from', durationMinutes: 80, description: 'Escova com tratamento de hidratação rápido em cabelos longos', segment: 'beauty' },
  { name: 'Escova Extralongo', category: 'Escovas e Finalizações', price: 110, priceType: 'from', durationMinutes: 80, description: 'Cabelos extralongos', segment: 'beauty' },
  { name: 'Escova Premium Extralongo', category: 'Escovas e Finalizações', price: 140, priceType: 'from', durationMinutes: 90, description: 'Tratamento premium para cabelos extralongos', segment: 'beauty' },
  { name: 'Escova com Mega Hair', category: 'Escovas e Finalizações', price: 110, priceType: 'from', durationMinutes: 90, description: 'Escova profissional adaptada para mega hair', segment: 'beauty' },
  { name: 'Escova Premium com Mega Hair', category: 'Escovas e Finalizações', price: 170, priceType: 'from', durationMinutes: 100, segment: 'beauty' },
  { name: 'Combo P', category: 'Escovas e Finalizações', price: 100, priceType: 'from', durationMinutes: 60, segment: 'beauty' },
  { name: 'Combo M', category: 'Escovas e Finalizações', price: 140, priceType: 'from', durationMinutes: 75, segment: 'beauty' },
  { name: 'Combo G', category: 'Escovas e Finalizações', price: 160, priceType: 'from', durationMinutes: 90, segment: 'beauty' },
  { name: 'Combo Extralongo', category: 'Escovas e Finalizações', price: 180, priceType: 'from', durationMinutes: 100, segment: 'beauty' },
  { name: 'Combo Mega Hair', category: 'Escovas e Finalizações', price: 180, priceType: 'from', durationMinutes: 100, segment: 'beauty' },
  { name: 'Babyliss ou Piastra P', category: 'Escovas e Finalizações', price: 60, priceType: 'from', durationMinutes: 30, segment: 'beauty' },
  { name: 'Babyliss ou Piastra M', category: 'Escovas e Finalizações', price: 80, priceType: 'from', durationMinutes: 40, segment: 'beauty' },
  { name: 'Babyliss ou Piastra G', category: 'Escovas e Finalizações', price: 90, priceType: 'from', durationMinutes: 45, segment: 'beauty' },
  { name: 'Babyliss ou Piastra Extralongo', category: 'Escovas e Finalizações', price: 100, priceType: 'from', durationMinutes: 50, segment: 'beauty' },
  { name: 'Babyliss ou Piastra Mega Hair', category: 'Escovas e Finalizações', price: 120, priceType: 'from', durationMinutes: 60, segment: 'beauty' },

  // Coloração
  { name: 'Coloração até 1/2 tubo', category: 'Coloração', price: 180, priceType: 'fixed', durationMinutes: 90, segment: 'beauty' },
  { name: 'Coloração até 1 tubo', category: 'Coloração', price: 255, priceType: 'fixed', durationMinutes: 90, segment: 'beauty' },
  { name: 'Coloração até 1 tubo e meio', category: 'Coloração', price: 370, priceType: 'fixed', durationMinutes: 105, segment: 'beauty' },
  { name: 'Coloração até 2 tubos', category: 'Coloração', price: 520, priceType: 'fixed', durationMinutes: 120, segment: 'beauty' },
  { name: 'Coloração Gloss até 1/2 tubo', category: 'Coloração', price: 360, priceType: 'fixed', durationMinutes: 90, segment: 'beauty' },
  { name: 'Coloração Gloss até 1 tubo', category: 'Coloração', price: 500, priceType: 'fixed', durationMinutes: 100, segment: 'beauty' },
  { name: 'Coloração Gloss até 1 tubo e meio', category: 'Coloração', price: 650, priceType: 'fixed', durationMinutes: 120, segment: 'beauty' },
  { name: 'Matização até 1/2 tubo', category: 'Coloração', price: 160, priceType: 'fixed', durationMinutes: 60, segment: 'beauty' },
  { name: 'Matização até 1 tubo', category: 'Coloração', price: 224, priceType: 'fixed', durationMinutes: 60, segment: 'beauty' },
  { name: 'Mechas ou Iluminado', category: 'Coloração', price: 900, priceType: 'from', durationMinutes: 240, description: 'Mechas premium com plex protetor', segment: 'beauty' },
  { name: 'Descoloração Masculino', category: 'Coloração', price: 350, priceType: 'from', durationMinutes: 120, segment: 'beauty' },

  // Maquiagem
  { name: 'Make social', category: 'Maquiagem', price: 200, priceType: 'fixed', durationMinutes: 60, description: 'Maquiagem social de alta fixação', segment: 'beauty' },
  { name: 'Make express', category: 'Maquiagem', price: 150, priceType: 'fixed', durationMinutes: 40, description: 'Maquiagem rápida e pontual', segment: 'beauty' },
  { name: 'Make noiva', category: 'Maquiagem', price: 750, priceType: 'fixed', durationMinutes: 150, description: 'Produção completa de noiva com assessoria exclusiva', segment: 'beauty' },

  // Sobrancelhas e Depilação
  { name: 'Brow lamination', category: 'Sobrancelhas e Depilação', price: 180, priceType: 'fixed', durationMinutes: 60, segment: 'beauty' },
  { name: 'Design de sobrancelha', category: 'Sobrancelhas e Depilação', price: 50, priceType: 'fixed', durationMinutes: 30, segment: 'beauty' },
  { name: 'Design com tintura ou henna', category: 'Sobrancelhas e Depilação', price: 70, priceType: 'fixed', durationMinutes: 45, segment: 'beauty' },
  { name: 'Design nutritivo', category: 'Sobrancelhas e Depilação', price: 60, priceType: 'fixed', durationMinutes: 40, segment: 'beauty' },
  { name: 'Buço', category: 'Sobrancelhas e Depilação', price: 25, priceType: 'fixed', durationMinutes: 15, segment: 'beauty' },
  { name: 'Nariz', category: 'Sobrancelhas e Depilação', price: 25, priceType: 'fixed', durationMinutes: 15, segment: 'beauty' },
  { name: 'Meia face', category: 'Sobrancelhas e Depilação', price: 50, priceType: 'fixed', durationMinutes: 30, segment: 'beauty' },
  { name: 'Face inteira', category: 'Sobrancelhas e Depilação', price: 70, priceType: 'fixed', durationMinutes: 45, segment: 'beauty' },

  // Manicure e Pedicure
  { name: 'Manicure', category: 'Manicure e Pedicure', price: 45, priceType: 'fixed', durationMinutes: 40, segment: 'beauty' },
  { name: 'Pedicure', category: 'Manicure e Pedicure', price: 45, priceType: 'fixed', durationMinutes: 45, segment: 'beauty' },
  { name: 'Manicure + pedicure', category: 'Manicure e Pedicure', price: 80, priceType: 'fixed', durationMinutes: 80, segment: 'beauty' },
  { name: 'Esmaltação comum', category: 'Manicure e Pedicure', price: 35, priceType: 'fixed', durationMinutes: 30, segment: 'beauty' },
  { name: 'Esmaltação em gel com cutilagem', category: 'Manicure e Pedicure', price: 120, priceType: 'fixed', durationMinutes: 60, segment: 'beauty' },
  { name: 'Esmaltação em gel sem cutilagem', category: 'Manicure e Pedicure', price: 80, priceType: 'fixed', durationMinutes: 45, segment: 'beauty' },
  { name: 'Retirada de esmaltação', category: 'Manicure e Pedicure', price: 50, priceType: 'fixed', durationMinutes: 30, segment: 'beauty' },
  { name: 'SPA dos pés com pedicure', category: 'Manicure e Pedicure', price: 90, priceType: 'fixed', durationMinutes: 65, segment: 'beauty' },
  { name: 'Detox dos pés', category: 'Manicure e Pedicure', price: 50, priceType: 'fixed', durationMinutes: 40, segment: 'beauty' },
  { name: 'Unha de fibra unidade', category: 'Manicure e Pedicure', price: 20, priceType: 'fixed', durationMinutes: 30, segment: 'beauty' },

  // Tratamentos
  { name: 'Protocolo Kérastase', category: 'Tratamentos', price: 350, priceType: 'fixed', durationMinutes: 60, description: 'Rituais Kérastase com fusiodose e massagem', segment: 'beauty' },
  { name: 'Mask Kérastase', category: 'Tratamentos', price: 280, priceType: 'fixed', durationMinutes: 50, segment: 'beauty' },
  { name: 'Fusio Dose Kérastase', category: 'Tratamentos', price: 320, priceType: 'fixed', durationMinutes: 45, segment: 'beauty' },
  { name: 'Joico K-Pak', category: 'Tratamentos', price: 350, priceType: 'fixed', durationMinutes: 60, segment: 'beauty' },
  { name: 'Joico Blonde Life', category: 'Tratamentos', price: 240, priceType: 'fixed', durationMinutes: 60, segment: 'beauty' },
  { name: 'Joico Recovery', category: 'Tratamentos', price: 240, priceType: 'fixed', durationMinutes: 60, segment: 'beauty' },
  { name: 'Wella Nutri Enrich ou Elements', category: 'Tratamentos', price: 200, priceType: 'fixed', durationMinutes: 50, segment: 'beauty' },
  { name: 'Wella Ultimate Repair', category: 'Tratamentos', price: 260, priceType: 'fixed', durationMinutes: 60, segment: 'beauty' },
  { name: 'Wella Lux Oil', category: 'Tratamentos', price: 260, priceType: 'fixed', durationMinutes: 50, segment: 'beauty' },
  { name: 'Wella Fusion', category: 'Tratamentos', price: 220, priceType: 'fixed', durationMinutes: 50, segment: 'beauty' },
  { name: 'Oil Reflection', category: 'Tratamentos', price: 220, priceType: 'fixed', durationMinutes: 50, segment: 'beauty' },
  { name: 'Sebastian Dark Oil', category: 'Tratamentos', price: 260, priceType: 'fixed', durationMinutes: 50, segment: 'beauty' },
  { name: 'Sebastian Penetraitt', category: 'Tratamentos', price: 260, priceType: 'fixed', durationMinutes: 60, segment: 'beauty' },
  { name: 'Keune', category: 'Tratamentos', price: 280, priceType: 'fixed', durationMinutes: 60, segment: 'beauty' },
  { name: 'R-Two', category: 'Tratamentos', price: 280, priceType: 'fixed', durationMinutes: 60, segment: 'beauty' },
  { name: 'Hidrocicatrização', category: 'Tratamentos', price: 370, priceType: 'fixed', durationMinutes: 70, segment: 'beauty' },
  { name: 'Detox Mirra', category: 'Tratamentos', price: 220, priceType: 'fixed', durationMinutes: 60, segment: 'beauty' },
  { name: 'Maison Luxury', category: 'Tratamentos', price: 220, priceType: 'fixed', durationMinutes: 60, segment: 'beauty' },
  { name: 'Tratamento Express EXO ampola', category: 'Tratamentos', price: 180, priceType: 'fixed', durationMinutes: 45, segment: 'beauty' },
  { name: 'Acidificação', category: 'Tratamentos', price: 70, priceType: 'fixed', durationMinutes: 30, segment: 'beauty' },
  { name: 'Metal Detox', category: 'Tratamentos', price: 70, priceType: 'fixed', durationMinutes: 30, segment: 'beauty' },
  { name: 'Liquid Hair', category: 'Tratamentos', price: 70, priceType: 'fixed', durationMinutes: 30, segment: 'beauty' },

  // Higienização Especial
  { name: 'Kérastase', category: 'Higienização Especial', price: 50, priceType: 'fixed', durationMinutes: 15, segment: 'beauty' },
  { name: 'Joico', category: 'Higienização Especial', price: 50, priceType: 'fixed', durationMinutes: 15, segment: 'beauty' },
  { name: 'Keune', category: 'Higienização Especial', price: 50, priceType: 'fixed', durationMinutes: 15, segment: 'beauty' },
  { name: 'Wella', category: 'Higienização Especial', price: 50, priceType: 'fixed', durationMinutes: 15, segment: 'beauty' },
  { name: 'Sebastian', category: 'Higienização Especial', price: 50, priceType: 'fixed', durationMinutes: 15, segment: 'beauty' },
  { name: 'Higienização comum', category: 'Higienização Especial', price: 50, priceType: 'fixed', durationMinutes: 10, segment: 'beauty' },

  // Progressivas e Botox
  { name: 'Progressiva raiz com formol', category: 'Progressivas e Botox', price: 300, priceType: 'from', durationMinutes: 120, segment: 'beauty' },
  { name: 'Progressiva cabelo inteiro com formol', category: 'Progressivas e Botox', price: 400, priceType: 'from', durationMinutes: 180, segment: 'beauty' },
  { name: 'Progressiva raiz sem formol', category: 'Progressivas e Botox', price: 350, priceType: 'from', durationMinutes: 125, segment: 'beauty' },
  { name: 'Progressiva cabelo inteiro sem formol', category: 'Progressivas e Botox', price: 450, priceType: 'from', durationMinutes: 180, segment: 'beauty' },
  { name: 'Botox', category: 'Progressivas e Botox', price: 250, priceType: 'from', durationMinutes: 90, segment: 'beauty' },
  { name: 'Progressiva ou botox masculino com formol', category: 'Progressivas e Botox', price: 100, priceType: 'from', durationMinutes: 60, segment: 'beauty' },
  { name: 'Progressiva ou botox masculino sem formol', category: 'Progressivas e Botox', price: 150, priceType: 'from', durationMinutes: 90, segment: 'beauty' },

  // Penteado
  { name: 'Penteado Social', category: 'Penteado', price: 220, priceType: 'fixed', durationMinutes: 60, segment: 'beauty' },
  { name: 'Penteado Noiva', category: 'Penteado', price: 750, priceType: 'fixed', durationMinutes: 150, segment: 'beauty' },

  // Mega Hair
  { name: 'Mega hair em faixa colocação', category: 'Mega Hair', price: 400, priceType: 'from', durationMinutes: 120, segment: 'beauty' },
  { name: 'Mega hair adesivo colocação', category: 'Mega Hair', price: 400, priceType: 'from', durationMinutes: 90, segment: 'beauty' },
  { name: 'Mega hair fio a fio colocação', category: 'Mega Hair', price: 500, priceType: 'from', durationMinutes: 180, segment: 'beauty' },
  { name: 'Mega hair em faixa manutenção', category: 'Mega Hair', price: 500, priceType: 'from', durationMinutes: 150, segment: 'beauty' },
  { name: 'Mega hair adesivo manutenção', category: 'Mega Hair', price: 500, priceType: 'from', durationMinutes: 120, segment: 'beauty' },
  { name: 'Mega hair fio a fio manutenção', category: 'Mega Hair', price: 600, priceType: 'from', durationMinutes: 240, segment: 'beauty' },
  { name: 'Retirada de mega hair', category: 'Mega Hair', price: 400, priceType: 'from', durationMinutes: 60, segment: 'beauty' },

  // Bebidas e Drinks
  { name: 'Água com gás', category: 'Bebidas e Drinks', price: 6.5, priceType: 'fixed', durationMinutes: 5, segment: 'beauty' },
  { name: 'Coca-Cola', category: 'Bebidas e Drinks', price: 6.5, priceType: 'fixed', durationMinutes: 5, segment: 'beauty' },
  { name: 'Coca-Cola Zero', category: 'Bebidas e Drinks', price: 6.5, priceType: 'fixed', durationMinutes: 5, segment: 'beauty' },
  { name: 'Guaraná Antarctica', category: 'Bebidas e Drinks', price: 6, priceType: 'fixed', durationMinutes: 5, segment: 'beauty' },
  { name: 'Guaraná Antarctica Zero', category: 'Bebidas e Drinks', price: 6, priceType: 'fixed', durationMinutes: 5, segment: 'beauty' },
  { name: 'Imperio Ultra', category: 'Bebidas e Drinks', price: 12, priceType: 'fixed', durationMinutes: 5, segment: 'beauty' },
  { name: 'Budweiser', category: 'Bebidas e Drinks', price: 12, priceType: 'fixed', durationMinutes: 5, segment: 'beauty' },
  { name: 'Heineken', category: 'Bebidas e Drinks', price: 15, priceType: 'fixed', durationMinutes: 5, segment: 'beauty' },
  { name: 'Mini Chandon', category: 'Bebidas e Drinks', price: 54, priceType: 'fixed', durationMinutes: 10, segment: 'beauty' },
  { name: 'Suco Del Valle Sabores', category: 'Bebidas e Drinks', price: 5, priceType: 'fixed', durationMinutes: 5, segment: 'beauty' },
  { name: 'Smirnoff Ice', category: 'Bebidas e Drinks', price: 15, priceType: 'fixed', durationMinutes: 5, segment: 'beauty' }
];

export const SERVICE_TEMPLATES_BY_SEGMENT: Record<string, ServiceTemplate[]> = {
  beauty: BEAUTY_SERVICE_TEMPLATES,
  agency: AGENCY_SERVICE_TEMPLATES,
  consulting: CONSULTING_SERVICE_TEMPLATES,
  health: HEALTH_SERVICE_TEMPLATES,
  services: GENERAL_SERVICE_TEMPLATES
};

// Global merged list for full backwards compatibility
export const SERVICE_TEMPLATES: ServiceTemplate[] = [
  ...BEAUTY_SERVICE_TEMPLATES,
  ...AGENCY_SERVICE_TEMPLATES,
  ...CONSULTING_SERVICE_TEMPLATES,
  ...HEALTH_SERVICE_TEMPLATES,
  ...GENERAL_SERVICE_TEMPLATES
];

export function getServiceTemplatesForSegment(segment?: string): ServiceTemplate[] {
  if (!segment || !SERVICE_TEMPLATES_BY_SEGMENT[segment]) {
    return BEAUTY_SERVICE_TEMPLATES;
  }
  return SERVICE_TEMPLATES_BY_SEGMENT[segment];
}

export function getCategoriesForSegment(segment?: string): string[] {
  if (!segment || !INITIAL_CATEGORIES_BY_SEGMENT[segment]) {
    return BEAUTY_CATEGORIES;
  }
  return INITIAL_CATEGORIES_BY_SEGMENT[segment];
}
