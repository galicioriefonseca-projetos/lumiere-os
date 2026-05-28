export interface ChangelogItem {
  version: string;
  date: string;
  title: string;
  description: string;
  highlights: string[];
  isNew?: boolean;
}

export const CHANGELOG: ChangelogItem[] = [
  {
    version: '1.4.2',
    date: 'Maio de 2026',
    title: 'Painel de Equipe Premium & Central de Atualizações',
    description: 'Nesta versão elevamos o nível de personalização da equipe com cards premium e implementamos a Central de Atualizações LumiereOS.',
    highlights: [
      'Visual Premium Dark/Gold com acabamentos refinados em dourado, combinando com a identidade visual do Essenza Studio.',
      'Melhoria na página de Equipe com filtros tabulares por cargo e status ativo/inativo.',
      'Busca dinâmica em tempo real para profissionais por nome, e-mail e funções.',
      'Identificação da função real com base na ordem de campos customizados.',
      'Status de convites recolhível preservado no navegador para otimizar espaço de trabalho.',
      'Origem com indicação clara se o membro entrou via link de função, convite ou direto.',
      'Rodapé institucional integrado com termo de versão do sistema e desenvolvedora.'
    ],
    isNew: true
  },
  {
    version: '1.4.0',
    date: 'Abril de 2026',
    title: 'Checklist Essenza & Otimizações de Fluxo',
    description: 'Implementado o Checklist Essenza para gestão operacional do estúdio e geração de relatórios de conformidade.',
    highlights: [
      'Geração de relatórios PDF executivos das tarefas concluídas do checklist do salão.',
      'Histórico persistente das auditorias de tarefas operacionais.',
      'Lembretes proativos e alertas visuais no vencimento de planos e trials.'
    ],
    isNew: false
  },
  {
    version: '1.3.0',
    date: 'Março de 2026',
    title: 'Convidar Equipe por Função Especializada',
    description: 'Revolucionamos o cadastro de profissionais do estabelecimento através de links dedicados por cargo e links baseados em especialidades.',
    highlights: [
      'Geração de links de convite únicos restritos por email com expirações customizáveis.',
      'Criação de links por função aceitando usos simultâneos por múltiplos profissionais.',
      'Preenchimento automático da categoria e especialidades durante a adesão do funcionário.'
    ],
    isNew: false
  }
];
