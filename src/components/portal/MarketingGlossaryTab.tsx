import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { 
  BookOpen, 
  Search, 
  MapPin, 
  Globe, 
  Instagram, 
  TrendingUp, 
  DollarSign, 
  Target, 
  Sparkles,
  HelpCircle,
  BarChart3
} from 'lucide-react';

interface GlossaryItem {
  term: string;
  category: 'google_meu_negocio' | 'site_landing_page' | 'instagram' | 'geral';
  shortDefinition: string;
  detailedExplanation: string;
  whyItMatters: string;
}

const GLOSSARY_DATA: GlossaryItem[] = [
  // Google Meu Negócio
  {
    term: "SEO Local & Google Maps",
    category: "google_meu_negocio",
    shortDefinition: "Otimização para sua empresa aparecer entre as primeiras quando alguém pesquisa serviços na sua cidade.",
    detailedExplanation: "Conjunto de práticas no perfil do Google (palavras-chave no título/descrição, categorização primária precisa, fotos semanais e atualizações constantes) que indicam ao algoritmo que seu negócio é a melhor resposta na região.",
    whyItMatters: "Garante clientes qualificados exatamente no momento em que estão com urgência para contratar."
  },
  {
    term: "Local 3-Pack",
    category: "google_meu_negocio",
    shortDefinition: "O bloco de destaque com mapa e apenas 3 empresas que o Google exibe no topo da busca.",
    detailedExplanation: "Quando um usuário busca por 'dentista perto de mim' ou 'clínica estética em São Paulo', o Google exibe um mapa com 3 empresas em evidência antes de qualquer link comum. Estar nesse top 3 gera até 70% dos cliques locais.",
    whyItMatters: "É a posição mais cobiçada do Google sem pagar por anúncio por clique."
  },
  {
    term: "Ações do Perfil (GMN)",
    category: "google_meu_negocio",
    shortDefinition: "Cliques no site, ligações diretas e pedidos de rotas feitos pelos clientes dentro do Google.",
    detailedExplanation: "Métricas reais de interesse: quantas pessoas clicaram para ligar para a recepção, quantas abriram o Waze/Google Maps para ir até o endereço e quantas visitaram sua Landing Page.",
    whyItMatters: "Mostra o impacto direto do Google no fluxo de clientes físicos e contatos."
  },
  {
    term: "Avaliações 5 Estrelas & NAP",
    category: "google_meu_negocio",
    shortDefinition: "Nota média de depoimentos e consistência do Nome, Endereço e Telefone da empresa em toda a internet.",
    detailedExplanation: "O Google prioriza perfis que recebem avaliações com frequência e cujos dados (Nome, Endereço, Telefone) estão 100% idênticos no site, Instagram e guias comerciais.",
    whyItMatters: "Aumenta a confiança do paciente e alavanca o posicionamento orgânico."
  },

  // Site & Landing Page
  {
    term: "Landing Page de Alta Conversão",
    category: "site_landing_page",
    shortDefinition: "Página focada em um único objetivo: transformar visitantes em contatos no WhatsApp ou agendamentos.",
    detailedExplanation: "Diferente de um site institucional confuso com muitos menus, a Landing Page tem uma narrativa persuasiva (Copywriting), depoimentos, explicação clara dos diferenciais e botões diretos para ação.",
    whyItMatters: "Multiplica o retorno dos seus anúncios ao evitar que o visitante se perca e saia sem falar com você."
  },
  {
    term: "Taxa de Conversão (CR)",
    category: "site_landing_page",
    shortDefinition: "Porcentagem de visitantes da página que realmente enviaram mensagem ou agendaram.",
    detailedExplanation: "Se 1.000 pessoas acessam sua Landing Page e 100 clicam no WhatsApp, sua taxa de conversão é de 10%. Otimizamos a página continuamente para elevar essa taxa ao máximo.",
    whyItMatters: "Quanto maior sua conversão, mais clientes você atende sem precisar gastar mais em anúncios."
  },
  {
    term: "PageSpeed & Mobile-First",
    category: "site_landing_page",
    shortDefinition: "Velocidade de carregamento da página no celular.",
    detailedExplanation: "Mais de 85% dos cliques em anúncios vêm de smartphones. Se a página demorar mais de 3 segundos para abrir, metade dos visitantes desiste antes mesmo de ver sua oferta.",
    whyItMatters: "Garante que você não desperdice verba de anúncio com páginas lentas."
  },
  {
    term: "Pixel de Rastreamento (Meta & Google)",
    category: "site_landing_page",
    shortDefinition: "Código inteligente instalado na página que avisa os anúncios quem realmente virou lead.",
    detailedExplanation: "Permite que os algoritmos do Instagram e Google aprendam o perfil exato das pessoas que clicam no WhatsApp, fazendo com que as próximas campanhas sejam entregues para pessoas ainda mais parecidas com seus melhores clientes.",
    whyItMatters: "Inteligência artificial que reduz o custo por cliente ao longo dos meses."
  },

  // Instagram & Tráfego Pago
  {
    term: "ROAS (Retorno sobre Investimento em Anúncios)",
    category: "instagram",
    shortDefinition: "Quantas vezes a receita gerada superou o valor investido nas campanhas.",
    detailedExplanation: "Calculado dividindo o faturamento obtido pelo valor investido em mídia. Um ROAS de 5.0 significa que para cada R$ 1.000 investidos em anúncios, a empresa gerou R$ 5.000 em vendas ou procedimentos.",
    whyItMatters: "É a métrica definitiva para saber se a estratégia de marketing está trazendo lucro real para o caixa."
  },
  {
    term: "CPL (Custo por Lead)",
    category: "instagram",
    shortDefinition: "Quanto custou, em média, para colocar uma nova pessoa interessada conversando com a sua equipe.",
    detailedExplanation: "Se foram investidos R$ 1.500 no mês e gerados 75 contatos qualificados no WhatsApp, o CPL é de R$ 20,00 por contato.",
    whyItMatters: "Permite prever com precisão quantos clientes novos você terá de acordo com a verba investida."
  },
  {
    term: "CTR (Click-Through Rate / Taxa de Cliques)",
    category: "instagram",
    shortDefinition: "A porcentagem de pessoas que viram seu anúncio e se interessaram a ponto de clicar nele.",
    detailedExplanation: "Mede o poder de atração do criativo e do vídeo. Um CTR acima de 1.5% a 2.0% indica que a arte/vídeo conectou com o público certo.",
    whyItMatters: "Criativos com alto CTR têm custo por clique mais barato e geram mais oportunidades."
  },
  {
    term: "Retenção de Vídeo nos Reels",
    category: "instagram",
    shortDefinition: "Porcentagem do vídeo que as pessoas assistem antes de passar para o próximo.",
    detailedExplanation: "O algoritmo do Instagram prioriza e distribui organicamente os vídeos que prendem a atenção nos primeiros 3 segundos (gancho) e mantêm as pessoas assistindo até o final.",
    whyItMatters: "Garante que o conteúdo da sua empresa atinja novas pessoas sem custo de anúncio."
  }
];

export default function MarketingGlossaryTab() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const filteredItems = GLOSSARY_DATA.filter(item => {
    if (selectedCategory !== 'all' && item.category !== selectedCategory) return false;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        item.term.toLowerCase().includes(q) ||
        item.shortDefinition.toLowerCase().includes(q) ||
        item.detailedExplanation.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'google_meu_negocio':
        return (
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 gap-1 text-[10px]">
            <MapPin className="w-3 h-3" /> Google Meu Negócio
          </Badge>
        );
      case 'site_landing_page':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 gap-1 text-[10px]">
            <Globe className="w-3 h-3" /> Site & Landing Page
          </Badge>
        );
      case 'instagram':
        return (
          <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30 gap-1 text-[10px]">
            <Instagram className="w-3 h-3" /> Instagram & Tráfego
          </Badge>
        );
      default:
        return (
          <Badge className="bg-zinc-500/20 text-zinc-300 border-zinc-500/30 text-[10px]">
            Geral
          </Badge>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-[#0A261E] border border-[#17473A] p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs text-[#DFC498] font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Guia Educacional para o Cliente
          </div>
          <h3 className="text-xl font-bold text-white">Glossário Prático de Marketing</h3>
          <p className="text-xs text-[#8FAEA2] max-w-xl leading-relaxed">
            Entenda de forma simples e direta o significado de cada sigla e indicador dos seus relatórios de Google Meu Negócio, Landing Pages e Instagram.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-xs text-[#DFC498] font-medium flex items-center gap-2 shrink-0">
          <BookOpen className="w-4 h-4" /> {GLOSSARY_DATA.length} Conceitos Estratégicos
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#082019] p-3 rounded-xl border border-white/5 text-xs">
        <div className="relative w-full sm:w-72">
          <Search className="w-3.5 h-3.5 text-[#8FAEA2] absolute left-3 top-3" />
          <Input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar termo (ex: ROAS, CPL, SEO)..."
            className="pl-8 bg-black/40 border-white/10 text-white rounded-lg h-8 text-xs focus:border-[#DFC498]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              selectedCategory === 'all' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
            }`}
          >
            Todos ({GLOSSARY_DATA.length})
          </button>
          <button
            onClick={() => setSelectedCategory('google_meu_negocio')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              selectedCategory === 'google_meu_negocio' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
            }`}
          >
            Google Meu Negócio
          </button>
          <button
            onClick={() => setSelectedCategory('site_landing_page')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              selectedCategory === 'site_landing_page' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
            }`}
          >
            Site & Landing Page
          </button>
          <button
            onClick={() => setSelectedCategory('instagram')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              selectedCategory === 'instagram' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
            }`}
          >
            Instagram & Tráfego
          </button>
        </div>
      </div>

      {/* Grid of Glossary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredItems.map(item => (
          <Card key={item.term} className="bg-[#0A261E] border-[#17473A] hover:border-[#DFC498]/40 transition-all flex flex-col justify-between shadow-lg">
            <CardHeader className="space-y-2 pb-3">
              <div className="flex items-center justify-between gap-2">
                {getCategoryBadge(item.category)}
              </div>
              <CardTitle className="text-base font-bold text-white">
                {item.term}
              </CardTitle>
              <CardDescription className="text-xs text-[#DFC498] font-medium leading-relaxed">
                "{item.shortDefinition}"
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-3 pt-0 text-xs">
              <div className="bg-black/20 p-3 rounded-xl border border-white/5 space-y-1">
                <span className="text-[10px] uppercase font-bold text-[#8FAEA2] block">
                  Como Funciona na Prática:
                </span>
                <p className="text-[#E1EDE8] leading-relaxed">
                  {item.detailedExplanation}
                </p>
              </div>

              <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20 space-y-1">
                <span className="text-[10px] uppercase font-bold text-emerald-400 block flex items-center gap-1">
                  <TrendingUp className="w-3 h-3" /> Por que isso importa para o seu negócio:
                </span>
                <p className="text-emerald-200/90 leading-relaxed">
                  {item.whyItMatters}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
