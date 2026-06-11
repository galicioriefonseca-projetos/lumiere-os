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
    version: '1.6.1-founder',
    date: 'Junho de 2026',
    title: 'CRM de Clientes e Funil Visível',
    description: 'Transformação completa da seção de Clientes em um CRM moderno, prático e visual. Fluxo Kanban integrado com arrastar-e-soltar, acompanhamento de próximas ações e histórico cronológico.',
    highlights: [
      'Quadro Kanban interativo contendo 7 colunas estratégicas de agendamentos e retornos futuros com suporte a drag-and-drop.',
      'Histórico do Cliente: rastreabilidade total de ações, contatos e alterações salvos como linha do tempo cronológica.',
      'Próxima Ação: sistema de agendamento de retorno com alertas visuais integrados para tarefas em atraso.',
      'WhatsApp integrado para contato em um clique diretamente dos cards do funil.',
      'Filtros avançados de pesquisa, equipe, responsável técnico e marcadores personalizados.',
      'Segurança e acessibilidade: equipe operacional move e gerencia leads, enquanto faturamento e LTV permanecem protegidos por nível de acesso.'
    ],
    isNew: true
  },
  {
    version: '1.5.9-founder',
    date: 'Junho de 2026',
    title: 'Atualização automática e cache seguro',
    description: 'Estratégia avançada de controle PWA, permitindo atualizações automáticas silenciosas e detecção dinâmica de bundles em cache antigo.',
    highlights: [
      'PWA agora detecta nova versão e limpa cache antigo de forma silenciosa.',
      'Reduzido significativamente o risco de erro por bundle antigo no celular.',
      'Botão Limpar Cache e Recarregar agora executa limpeza real de caches e Service Workers antigos.',
      'Service Worker ajustado para atualização automática.',
      'Fallback preventivo para erros de carregamento de chunk (ChunkLoadError) e arquivos antigos.'
    ],
    isNew: false
  },
  {
    version: '1.5.8-founder',
    date: 'Junho de 2026',
    title: 'Correções Críticas de Estabilidade e PWA',
    description: 'Atualização crítica para resolver a tela de erro (Ops! Algo deu errado) em dispositivos móveis, além de recursos adicionais de debug e suporte para profissionais.',
    highlights: [
      'Correção do erro crítico React #310 de acesso pelo celular (iPhone/PWA).',
      'Proteção contra renderização incorreta para usuários e recepcionistas.',
      'Melhoria na exibição do ErrorBoundary em modo de produção (com recurso ?debug=true).',
      'Gerenciamento robusto de cache persistente PWA (Service Workers, Limpeza Automática).',
      'Habilitação temporária de debug com sourcemaps para rastreabilidade de código.'
    ],
    isNew: false
  },
  {
    version: '1.5.0-founder',
    date: 'Junho de 2026',
    title: 'Integração Mercado Pago Assinaturas',
    description: 'Nova opção de assinatura recorrente via Mercado Pago, integrada de forma segura e progressiva.',
    highlights: [
      'Nova opção de assinatura recorrente via Mercado Pago.',
      'Área Minha Assinatura preparada para ativação de cobrança recorrente.',
      'Webhook Mercado Pago para atualização de status.',
      'Sistema continua liberado sem bloqueio automático financeiro.',
      'Stripe preservado no código para uso futuro, mas removido do fluxo visual principal.'
    ],
    isNew: false
  },
  {
    version: '1.4.8-founder',
    date: 'Junho de 2026',
    title: 'Liberação operacional do MVP',
    description: 'Ajuste de fluxo operacional liberando o sistema de bloqueios de assinatura obrigatória e cobranças automáticas para uso piloto sem fricção.',
    highlights: [
      'Sistema liberado para uso sem bloqueios automáticos de assinatura.',
      'Área Minha Assinatura mantida apenas como consulta.',
      'Botões de assinatura removidos do dashboard principal.',
      'Cobrança passa a ser acompanhada manualmente nesta fase piloto.',
      'Fluxo Stripe preservado no código para ativação futura.'
    ],
    isNew: false
  },
  {
    version: '1.4.7-founder',
    date: 'Junho de 2026',
    title: 'Painel de acompanhamento de metas',
    description: 'Evolução do painel de metas para acompanhamento detalhado de progresso faturado, com médias diárias necessárias e derivações temporais seguras.',
    highlights: [
      'Metas existentes agora exibem progresso, realizado, falta e média diária necessária.',
      'As metas já cadastradas foram preservadas operando com fallbacks robustos de leitura.',
      'Acompanhamento mensal, semanal e diário integrado de forma fluida.',
      'Aba de visualização analítica por profissional e painel de progresso coletivo.',
      'Atualização manual do realizado sem alterar ou afetar a meta definida pela liderança.'
    ],
    isNew: false
  },
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
    isNew: false
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
