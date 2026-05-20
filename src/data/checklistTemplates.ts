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
}

export const predefinedTemplates: PredefinedTemplate[] = [
  {
    title: 'Avaliação Diária do Profissional — Essenza',
    type: 'professional_daily_evaluation',
    checklistGroup: 'professional_evaluation',
    scoringMode: 'rating_1_5',
    scoreBy: 'category',
    maxScore: 40,
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
    items: [
      { label: 'Limpar recepção', required: true },
      { label: 'Limpar banheiro', required: true },
      { label: 'Organizar bancadas', required: true },
      { label: 'Higienizar carrinhos', required: true },
      { label: 'Repor materiais', required: true },
      { label: 'Conferir descarte correto', required: true }
    ]
  }
];
