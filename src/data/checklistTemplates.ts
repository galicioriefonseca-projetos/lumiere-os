import { ChecklistItemTemplate, ClassificationRule } from '../types';

export interface PredefinedTemplate {
  title: string;
  description?: string;
  type?: 'standard' | 'professional_daily_evaluation';
  checklistGroup?: 'operational' | 'professional_evaluation';
  scoringMode?: 'checkbox' | 'rating_1_5';
  scoreBy?: 'item' | 'category';
  maxScore?: number;
  categories?: string[];
  items: Omit<ChecklistItemTemplate, 'id'>[];
  classificationRules?: ClassificationRule[];
  scale?: Record<number, string>;
  segment?: 'beauty' | 'agency' | 'consulting' | 'health' | 'services' | 'all';
}

export const predefinedTemplates: PredefinedTemplate[] = [
  // Templates para Agência de Marketing, Tráfego e Gestão Digital
  {
    title: 'Onboarding de Novo Cliente — Agência & Marketing',
    description: 'Etapas essenciais para recepcionar um novo cliente, coletar acessos e iniciar a operação.',
    type: 'standard',
    checklistGroup: 'operational',
    scoringMode: 'checkbox',
    segment: 'agency',
    items: [
      { label: 'Criar grupo de WhatsApp do cliente com a equipe da agência', required: true },
      { label: 'Enviar formulário de Briefing e Coleta de Informações', required: true },
      { label: 'Solicitar acesso de Administrador no Gerenciador de Negócios (Meta Business)', required: true },
      { label: 'Solicitar acesso de Administrador no Google Perfil de Empresa (Google Meu Negócio)', required: true },
      { label: 'Solicitar acesso ao Instagram e páginas de redes sociais', required: true },
      { label: 'Configurar ou validar conta de WhatsApp Business (catálogo, horário e recados)', required: true },
      { label: 'Configurar forma de faturamento recorrente (Asaas / Pix) e enviar contrato', required: true },
      { label: 'Realizar Reunião de Alinhamento Inicial (Kickoff) via Google Meet', required: true }
    ]
  },
  {
    title: 'Otimização Mensal — Google Meu Negócio',
    description: 'Rotina periódica de SEO local para ranquear o cliente nas primeiras posições do Google Maps.',
    type: 'standard',
    checklistGroup: 'operational',
    scoringMode: 'checkbox',
    segment: 'agency',
    items: [
      { label: 'Conferir e atualizar horário de funcionamento e feriados', required: true },
      { label: 'Adicionar 3 a 5 novas fotos de alta qualidade do espaço/serviços com geo-tags', required: true },
      { label: 'Publicar postagem de novidade/oferta semanal no perfil', required: true },
      { label: 'Atualizar lista de produtos e serviços com valores e descrições com palavras-chave', required: true },
      { label: 'Responder todas as novas avaliações de clientes de forma personalizada', required: true },
      { label: 'Enviar link de solicitação de novas avaliações de 5 estrelas para clientes recentes', required: true },
      { label: 'Analisar relatório de visualizações, rotas e chamadas geradas no mês', required: true }
    ]
  },
  {
    title: 'Planejamento & Postagens Semanais — Redes Sociais',
    description: 'Esteira de produção, aprovação e publicação de conteúdo para Instagram/TikTok.',
    type: 'standard',
    checklistGroup: 'operational',
    scoringMode: 'checkbox',
    segment: 'agency',
    items: [
      { label: 'Mapear pautas e temas da semana alinhados aos objetivos comerciais do cliente', required: true },
      { label: 'Criar designs, carrosséis e artes no padrão visual da marca', required: true },
      { label: 'Redigir legendas atraentes com CTAs (chamadas para ação) e hashtags estratégicas', required: true },
      { label: 'Enviar prévia para aprovação do cliente com antecedência', required: true },
      { label: 'Agendar publicações nos melhores horários de audiência', required: true },
      { label: 'Monitorar e responder mensagens do Direct e comentários nas primeiras horas', required: true }
    ]
  },
  {
    title: 'Lançamento de Site / Landing Page',
    description: 'Checklist rigoroso de qualidade para publicação de sites e páginas de alta conversão.',
    type: 'standard',
    checklistGroup: 'operational',
    scoringMode: 'checkbox',
    segment: 'agency',
    items: [
      { label: 'Apontar DNS do domínio e validar certificado SSL (HTTPS)', required: true },
      { label: 'Instalar e testar Meta Pixel (Facebook Ads) e Google Tag Manager', required: true },
      { label: 'Testar botão de WhatsApp e links de conversão em computadores e celulares', required: true },
      { label: 'Testar velocidade de carregamento (PageSpeed / Lighthouse)', required: true },
      { label: 'Validar formulários de contato e recebimento de leads por e-mail/WhatsApp', required: true },
      { label: 'Conferir títulos SEO, meta descriptions e favicon do site', required: true }
    ]
  },
  {
    title: 'Consultoria de Gestão & Alinhamento Empresarial',
    description: 'Checklist para condução de reuniões de diagnóstico e análise de resultados com clientes.',
    type: 'standard',
    checklistGroup: 'operational',
    scoringMode: 'checkbox',
    segment: 'consulting',
    items: [
      { label: 'Levantar faturamento, número de clientes e ticket médio do período', required: true },
      { label: 'Analisar funil de vendas (Leads recebidos vs Agendamentos vs Fechamentos)', required: true },
      { label: 'Apresentar relatório de ROI de marketing e crescimento de presença online', required: true },
      { label: 'Identificar gargalos operacionais e oportunidades de novos serviços/produtos', required: true },
      { label: 'Definir 3 metas estratégicas prioritárias para os próximos 30 dias', required: true },
      { label: 'Registrar ata de reunião e encaminhar plano de ação no grupo do cliente', required: true }
    ]
  },

  // Templates de Beleza & Estética (Preservados integralmente para salões como o Essenza)
  {
    title: 'Avaliação Diária do Profissional — Lumière',
    type: 'professional_daily_evaluation',
    checklistGroup: 'professional_evaluation',
    scoringMode: 'rating_1_5',
    scoreBy: 'category',
    maxScore: 40,
    segment: 'beauty',
    categories: [
      'Apresentação Pessoal',
      'Pontualidade e Organização',
      'Atendimento à Cliente',
      'Qualidade do Serviço',
      'Organização do Ambiente',
      'Colaboração com a Equipe',
      'Responsabilidades do Dia',
      'Desempenho Comercial'
    ],
    description: 'Checklist para avaliação diária da postura, atendimento, organização, qualidade técnica e desempenho comercial dos profissionais do salão.',
    items: [
      { label: 'Uniforme adequado / boa apresentação', required: true, category: 'Apresentação Pessoal' },
      { label: 'Cabelo e aparência alinhados ao padrão do salão', required: true, category: 'Apresentação Pessoal' },
      { label: 'Postura profissional durante o atendimento', required: true, category: 'Apresentação Pessoal' },
      { label: 'Chegou no horário', required: true, category: 'Pontualidade e Organização' },
      { label: 'Preparou sua estação de trabalho', required: true, category: 'Pontualidade e Organização' },
      { label: 'Cumpriu horários dos atendimentos', required: true, category: 'Pontualidade e Organização' },
      { label: 'Recepção cordial da cliente', required: true, category: 'Atendimento à Cliente' },
      { label: 'Escuta ativa das necessidades da cliente', required: true, category: 'Atendimento à Cliente' },
      { label: 'Explicação clara sobre o procedimento', required: true, category: 'Atendimento à Cliente' },
      { label: 'Encaminhamento adequado para recepção/pagamento', required: true, category: 'Atendimento à Cliente' },
      { label: 'Técnica bem executada', required: true, category: 'Qualidade do Serviço' },
      { label: 'Atenção aos detalhes', required: true, category: 'Qualidade do Serviço' },
      { label: 'Cliente satisfeita ao final do atendimento', required: true, category: 'Qualidade do Serviço' },
      { label: 'Bancada, espelhos, carrinho e chão limpos após atendimento', required: true, category: 'Organização do Ambiente' },
      { label: 'Materiais higienizados', required: true, category: 'Organização do Ambiente' },
      { label: 'Descarte correto de resíduos', required: true, category: 'Organização do Ambiente' },
      { label: 'Organização da estação de trabalho', required: true, category: 'Organização do Ambiente' },
      { label: 'Respeito com colegas', required: true, category: 'Colaboração com a Equipe' },
      { label: 'Cooperação com a equipe', required: true, category: 'Colaboração com a Equipe' },
      { label: 'Postura positiva no ambiente de trabalho', required: true, category: 'Colaboração com a Equipe' },
      { label: 'Cumpriu sua função do cronograma de organização', required: true, category: 'Responsabilidades do Dia' },
      { label: 'Participou da manutenção do salão', required: true, category: 'Responsabilidades do Dia' },
      { label: 'Sugeriu serviços adicionais', required: true, category: 'Desempenho Comercial' },
      { label: 'Indicou produtos', required: true, category: 'Desempenho Comercial' },
      { label: 'Incentivou retorno da cliente', required: true, category: 'Desempenho Comercial' }
    ],
    classificationRules: [
      { min: 35, max: 40, label: 'Excelência' },
      { min: 30, max: 34, label: 'Muito bom' },
      { min: 25, max: 29, label: 'Bom' },
      { min: 20, max: 24, label: 'Atenção' },
      { min: 0, max: 19, label: 'Precisa de alinhamento' }
    ],
    scale: { 5: 'Excelente', 4: 'Muito bom', 3: 'Bom', 2: 'Precisa melhorar', 1: 'Inadequado' }
  },
  {
    title: 'Checklist de Abertura do Salão',
    description: 'Tarefas essenciais para preparar o salão para os clientes.',
    type: 'standard',
    checklistGroup: 'operational',
    scoringMode: 'checkbox',
    segment: 'beauty',
    items: [
      { label: 'Conferir limpeza geral', required: true },
      { label: 'Ligar equipamentos necessários', required: true },
      { label: 'Conferir agenda do dia', required: true },
      { label: 'Organizar recepção', required: true },
      { label: 'Conferir produtos e materiais', required: true },
      { label: 'Preparar estações de atendimento', required: true }
    ]
  },
  {
    title: 'Checklist de Fechamento do Salão',
    description: 'Organização e segurança ao encerrar as atividades.',
    type: 'standard',
    checklistGroup: 'operational',
    scoringMode: 'checkbox',
    segment: 'beauty',
    items: [
      { label: 'Limpar bancadas e espelhos', required: true },
      { label: 'Higienizar materiais', required: true },
      { label: 'Conferir descarte de resíduos', required: true },
      { label: 'Organizar estoque', required: true },
      { label: 'Fechar caixa ou conferir pagamentos', required: true },
      { label: 'Desligar equipamentos', required: true },
      { label: 'Conferir portas e segurança', required: true }
    ]
  },
  {
    title: 'Checklist de Atendimento Premium',
    description: 'Garantir padrão de excelência em cada atendimento.',
    type: 'standard',
    checklistGroup: 'operational',
    scoringMode: 'checkbox',
    segment: 'beauty',
    items: [
      { label: 'Recepcionar cliente com cordialidade', required: true },
      { label: 'Confirmar procedimento agendado', required: true },
      { label: 'Explicar etapas do atendimento', required: true },
      { label: 'Oferecer produto ou serviço complementar', required: true },
      { label: 'Confirmar satisfação ao final', required: true },
      { label: 'Incentivar retorno ou próximo agendamento', required: true }
    ]
  },
  {
    title: 'Checklist de Limpeza e Organização',
    description: 'Rotina de manutenção do ambiente.',
    type: 'standard',
    checklistGroup: 'operational',
    scoringMode: 'checkbox',
    segment: 'beauty',
    items: [
      { label: 'Limpar recepção', required: true },
      { label: 'Limpar banheiro', required: true },
      { label: 'Organizar bancadas', required: true },
      { label: 'Higienizar carrinhos', required: true },
      { label: 'Repor materiais', required: true },
      { label: 'Conferir descarte correto', required: true }
    ]
  },
  {
    title: 'Checklist de Manutenção de Equipamentos',
    description: 'Conservação de equipamentos e controle de validade de produtos.',
    type: 'standard',
    checklistGroup: 'operational',
    scoringMode: 'checkbox',
    segment: 'beauty',
    items: [
      { label: 'Verificar validade de produtos', required: true },
      { label: 'Limpar equipamentos', required: true },
      { label: 'Organizar área de trabalho', required: true },
      { label: 'Conferir funcionamento de autoclaves e secadores', required: true }
    ]
  }
];
