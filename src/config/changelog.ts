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
    version: '1.4.5-founder',
    date: 'Junho de 2026',
    title: 'Assinatura Recorrente via Stripe',
    description: 'Integração de pagamento recorrente automatizado por cartão de crédito e conciliação eletrônica via webhooks seguros.',
    highlights: [
      'Implementado Stripe Checkout oficial para registro de cartão sem trânsito de dados sensíveis.',
      'Configurado Stripe Customer Portal para autogestão de assinaturas e histórico de faturas.',
      'Fluxo de webhook automatizado para criação de assinaturas, processamento mensal de cobranças e cancelamentos.',
      'Avisos e painéis informativos de faturamento dinâmicos no DashboardHome.',
      'Painel Master estendido com visualização de IDs e status de transação vinculados diretamente à conta administrativa do Stripe.'
    ],
    isNew: true
  },
  {
    version: '1.4.4-founder',
    date: 'Maio de 2026',
    title: 'Fluxo de Pagamentos Manuais',
    description: 'Sistema de gestão financeira interno integrado.',
    highlights: [
      'Adicionado pagamento manual por PIX.',
      'Cliente pode informar pagamento pelo dashboard.',
      'Painel Master agora permite confirmar pagamentos e controlar vencimentos.',
      'Preparação para futura integração com gateway.'
    ],
    isNew: false
  },
  {
    version: '1.4.3-founder',
    date: 'Maio de 2026',
    title: 'Ambiente de Demonstração & Seletor de Perfil Seguro',
    description: 'Implementado o ambiente oficial demo/tutorial do LumiereOS com seletor de perfil e seed automatizado para simulações e treinamentos.',
    highlights: [
      'Ambiente demo dedicado e seguro para leandropfonseca20@gmail.com operando no salão exclusivo Lumiere Beauty Studio - Demo.',
      'Sincronização de 10 profissionais fictícios com nomes bíblicos, metas mensais de faturamento realistas e agendamentos distribuídos no tempo.',
      'Histórico completo do Checklist Essenza avaliando os profissionais ativos no mesmo dia.',
      'Seletor de perfis inteligente (DemoRoleSwitcher) que permite alternar a visualização como Proprietário, Gerente, Recepcionista, Atendente ou Profissional.',
      'Simulação de permissões operada estritamente em memória/localStorage sem alterar privilégios reais dos usuários e totalmente oculto de clientes normais.',
      'Ocultação de utilitários de criação de instâncias demo normais no Painel Master.'
    ],
    isNew: true
  },
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
    isNew: false
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
