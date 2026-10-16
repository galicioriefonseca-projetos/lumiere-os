import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Sparkles, 
  MapPin, 
  Globe, 
  Instagram, 
  CheckCircle2, 
  ArrowRight, 
  Loader2, 
  Check, 
  DollarSign, 
  MessageSquare,
  ShieldCheck,
  Zap
} from 'lucide-react';

interface AdditionalService {
  id: string;
  name: string;
  category: 'google_meu_negocio' | 'site_landing_page' | 'instagram';
  tagline: string;
  description: string;
  deliverables: string[];
  estimatedDelivery: string;
}

const SERVICES_CATALOG: AdditionalService[] = [
  // Google Meu Negócio
  {
    id: 'gmn_seo_local',
    category: 'google_meu_negocio',
    name: 'Otimização Avançada de SEO Local & Ranqueamento',
    tagline: 'Apareça no Top 3 do Google Maps quando buscarem pelos seus serviços',
    description: 'Auditoria técnica completa do perfil, inclusão de palavras-chave estratégicas no catálogo de serviços, padronização de dados NAP e configuração de atributos de conversão.',
    deliverables: [
      'Estruturação completa de categorias primárias e secundárias',
      'Cadastro de até 20 serviços/procedimentos com descrições otimizadas',
      'Link direto para WhatsApp e agendamentos no perfil',
      'Relatório de posicionamento antes e depois da otimização'
    ],
    estimatedDelivery: '5 a 7 dias úteis'
  },
  {
    id: 'gmn_reviews_gestao',
    category: 'google_meu_negocio',
    name: 'Gestão de Avaliações & Reputação Local',
    tagline: 'Conquiste mais avaliações 5 estrelas e confiança imediata',
    description: 'Criação de link encurtado inteligente e arte para QR Code de balcão, além de roteiro para a recepção solicitar depoimentos de pacientes e respostas profissionais.',
    deliverables: [
      'Link direto para avaliação e QR Code personalizado para recepção',
      'Roteiro de abordagem para WhatsApp pós-atendimento',
      'Respostas estratégicas humanizadas para avaliações recebidas',
      'Monitoramento de comentários para prevenção de crises'
    ],
    estimatedDelivery: 'Ativação em até 3 dias úteis'
  },
  {
    id: 'gmn_fotos_tour',
    category: 'google_meu_negocio',
    name: 'Curadoria Visual & Fotos Comerciais para o Google',
    tagline: 'Perfis com fotos profissionais recebem 42% mais rotas no Maps',
    description: 'Tratamento e upload estratégico de imagens em alta resolução da fachada, recepção, consultórios, equipe e diferenciais tecnológicos para encantar o paciente antes mesmo da visita.',
    deliverables: [
      'Upload e georreferenciamento de até 25 fotos comerciais de alta qualidade',
      'Definição da foto de capa e logotipo com especificações perfeitas do Google',
      'Fotos de equipe e estrutura com legendas descritivas',
      'Atualização de horários e comodidades visuais'
    ],
    estimatedDelivery: '3 a 5 dias úteis'
  },

  // Site & Landing Page
  {
    id: 'site_landing_page_nova',
    category: 'site_landing_page',
    name: 'Nova Landing Page de Alta Conversão',
    tagline: 'Página exclusiva focada em transformar visitantes em contatos no WhatsApp',
    description: 'Desenvolvimento de uma Landing Page moderna, ultra-rápida e persuasiva para um novo procedimento ou serviço específico da sua empresa.',
    deliverables: [
      'Copywriting persuasivo focado em destacar autoridade e diferenciais',
      'Design exclusivo 100% responsivo para celulares e computadores',
      'Botões inteligentes de WhatsApp com mensagem personalizada pré-pronta',
      'Instalação de Pixel Meta e Google Tag Manager com rastreamento completo'
    ],
    estimatedDelivery: '10 a 14 dias úteis'
  },
  {
    id: 'site_manutencao_performance',
    category: 'site_landing_page',
    name: 'Manutenção Contínua & Otimização de Performance Web',
    tagline: 'Página sempre rápida, segura e atualizada com as novidades da sua marca',
    description: 'Monitoramento semanal de tempo de carregamento, pequenas alterações de textos ou imagens promocionais e garantia de funcionamento ininterrupto.',
    deliverables: [
      'Garantia de carregamento rápido (<2 segundos)',
      'Ajustes mensais de banners, textos ou preços sem custo adicional',
      'Renovação de certificados de segurança SSL',
      'Backup periódico de arquivos e banco de dados'
    ],
    estimatedDelivery: 'Recorrência mensal'
  },
  {
    id: 'site_rastreamento_pixel',
    category: 'site_landing_page',
    name: 'Rastreamento Avançado de Eventos (Pixel & GA4)',
    tagline: 'Descubra exatamente qual anúncio traz os melhores clientes',
    description: 'Configuração cirúrgica de eventos de conversão no site para que o Google Ads e Meta Ads aprendam quem realmente converte no WhatsApp e telefone.',
    deliverables: [
      'Configuração de tags no Google Tag Manager (GTM)',
      'Disparo de evento personalizado ao clicar no WhatsApp',
      'Rastreamento de formulários preenchidos e ligações telefônicas',
      'Verificação de domínio e parâmetros da API de Conversões da Meta'
    ],
    estimatedDelivery: '3 a 4 dias úteis'
  },

  // Instagram
  {
    id: 'insta_pacote_reels',
    category: 'instagram',
    name: 'Pacote Extra de 8 Reels com Edição Dinâmica',
    tagline: 'Vídeos com roteiros de alta retenção para expandir o alcance da sua marca',
    description: 'Roteiros persuasivos com gancho nos primeiros 3 segundos, orientação de gravação e edição moderna com cortes rápidos, legendas dinâmicas e trilha sonora em alta.',
    deliverables: [
      '8 roteiros detalhados com gancho, desenvolvimento e chamada para ação',
      'Edição com legendas dinâmicas coloridas e efeitos sonoros',
      'Tratamento de áudio e correção de cores',
      'Capas personalizadas para o feed alinhadas à sua identidade'
    ],
    estimatedDelivery: 'Entregas semanais ou quinzenais'
  },
  {
    id: 'insta_redesign_feed',
    category: 'instagram',
    name: 'Redesign de Identidade Visual para Feed & Destaques',
    tagline: 'Transforme o Instagram da sua empresa em uma vitrine de autoridade',
    description: 'Criação de paleta de cores institucional, novos ícones de destaques e templates exclusivos para posts informativos e depoimentos.',
    deliverables: [
      'Até 8 capas padronizadas para os Destaques dos Stories',
      'Design da foto de perfil profissional',
      'Templates reutilizáveis no Canva para avisos e novidades rápidas',
      'Manual básico de aplicação de cores e fontes da marca'
    ],
    estimatedDelivery: '5 a 7 dias úteis'
  },
  {
    id: 'insta_trafego_hiperlocal',
    category: 'instagram',
    name: 'Campanhas de Tráfego Hiperlocal para Reels & Feed',
    tagline: 'Seja visto por milhares de pessoas que moram ou trabalham perto de você',
    description: 'Configuração de campanhas de anúncios com raio geográfico específico ao redor do seu endereço para impactar o público local com maior poder aquisitivo.',
    deliverables: [
      'Segmentação avançada por raio de 3km a 15km do seu endereço',
      'Filtragem por interesses, gênero, idade e poder de compra',
      'Criação de testes A/B de públicos e criativos',
      'Relatório de custo por contato e novos seguidores qualificados'
    ],
    estimatedDelivery: 'Setup em 3 a 5 dias úteis'
  }
];

interface AdditionalServicesTabProps {
  currentUser: any;
  agencyName: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
}

export default function AdditionalServicesTab({
  currentUser,
  agencyName,
  clientName,
  clientEmail,
  clientPhone
}: AdditionalServicesTabProps) {
  const [selectedService, setSelectedService] = useState<AdditionalService | null>(null);
  const [requestNotes, setRequestNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');

  const handleOpenModal = (service: AdditionalService) => {
    setSelectedService(service);
    setRequestNotes('');
  };

  const handleSendRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService) return;

    try {
      setSubmitting(true);
      const idToken = await currentUser?.getIdToken?.();
      const res = await fetch('/api/client-portal/service-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          serviceId: selectedService.id,
          serviceName: selectedService.name,
          category: selectedService.category,
          notes: requestNotes.trim(),
          clientName: clientName || currentUser?.displayName || 'Cliente',
          clientEmail: clientEmail || currentUser?.email || '',
          clientPhone: clientPhone || ''
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao registrar solicitação.');

      toast.success(`Solicitação de "${selectedService.name}" enviada para a equipe da agência! Entraremos em contato para os próximos passos.`);
      setSelectedService(null);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar pedido de serviço.');
    } finally {
      setSubmitting(false);
    }
  };

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
            <Instagram className="w-3 h-3" /> Instagram
          </Badge>
        );
      default:
        return null;
    }
  };

  const filteredServices = SERVICES_CATALOG.filter(s => {
    if (filterCategory !== 'all' && s.category !== filterCategory) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-[#0A261E] border border-[#17473A] p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs text-[#DFC498] font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Catálogo Oficial de Soluções Extras
          </div>
          <h3 className="text-xl font-bold text-white">Serviços Adicionais & Otimizações</h3>
          <p className="text-xs text-[#8FAEA2] max-w-xl leading-relaxed">
            Deseja acelerar seus resultados? Adicione serviços pontuais ou complementares de Google Meu Negócio, Landing Pages e Instagram diretamente com a sua agência <strong className="text-white">{agencyName}</strong>.
          </p>
        </div>

        <div className="bg-white/5 border border-white/10 px-4 py-2.5 rounded-xl text-xs text-[#DFC498] font-medium flex items-center gap-2 shrink-0">
          <ShieldCheck className="w-4 h-4 text-emerald-400" /> Atendimento Personalizado
        </div>
      </div>

      {/* Category Filter */}
      <div className="flex flex-wrap items-center gap-2 bg-[#082019] p-3 rounded-xl border border-white/5 text-xs">
        <span className="text-[#8FAEA2]">Filtrar por Especialidade:</span>
        <button
          onClick={() => setFilterCategory('all')}
          className={`px-3 py-1 rounded-lg transition-colors ${
            filterCategory === 'all' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
          }`}
        >
          Todos os Serviços ({SERVICES_CATALOG.length})
        </button>
        <button
          onClick={() => setFilterCategory('google_meu_negocio')}
          className={`px-3 py-1 rounded-lg transition-colors ${
            filterCategory === 'google_meu_negocio' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
          }`}
        >
          Google Meu Negócio
        </button>
        <button
          onClick={() => setFilterCategory('site_landing_page')}
          className={`px-3 py-1 rounded-lg transition-colors ${
            filterCategory === 'site_landing_page' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
          }`}
        >
          Site & Landing Page
        </button>
        <button
          onClick={() => setFilterCategory('instagram')}
          className={`px-3 py-1 rounded-lg transition-colors ${
            filterCategory === 'instagram' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
          }`}
        >
          Instagram
        </button>
      </div>

      {/* Grid of Services */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredServices.map(service => (
          <Card
            key={service.id}
            className="bg-[#0A261E] border-[#17473A] hover:border-[#DFC498]/40 transition-all flex flex-col justify-between shadow-xl"
          >
            <CardHeader className="space-y-2 pb-3">
              <div className="flex items-center justify-between gap-2">
                {getCategoryBadge(service.category)}
                <span className="text-[10px] text-[#8FAEA2] font-mono">
                  {service.estimatedDelivery}
                </span>
              </div>
              <CardTitle className="text-base font-bold text-white leading-snug">
                {service.name}
              </CardTitle>
              <CardDescription className="text-xs text-[#DFC498] font-medium leading-relaxed">
                {service.tagline}
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-4 pt-0">
              <p className="text-xs text-[#8FAEA2] leading-relaxed">
                {service.description}
              </p>

              <div className="space-y-1.5 bg-black/25 p-3 rounded-xl border border-white/5 text-xs">
                <span className="text-[10px] font-bold uppercase tracking-wider text-white block">
                  O que está incluso:
                </span>
                <ul className="space-y-1 text-[#8FAEA2] text-[11px]">
                  {service.deliverables.map((d, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{d}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <Button
                onClick={() => handleOpenModal(service)}
                className="w-full bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold text-xs h-9 rounded-xl gap-2 shadow"
              >
                Solicitar Orçamento / Ativação <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* MODAL: SOLICITAR SERVIÇO */}
      <Dialog open={!!selectedService} onOpenChange={open => !open && setSelectedService(null)}>
        <DialogContent className="bg-[#0A261E] border-[#17473A] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Zap className="w-5 h-5 text-[#DFC498]" />
              Solicitar Serviço: {selectedService?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8FAEA2]">
              Sua agência entrará em contato para apresentar a proposta e alinhar prazos.
            </DialogDescription>
          </DialogHeader>

          {selectedService && (
            <form onSubmit={handleSendRequest} className="space-y-3.5 pt-2">
              <div className="p-3 bg-black/30 rounded-xl border border-white/5 space-y-1 text-xs">
                <span className="text-[10px] text-[#8FAEA2] uppercase block font-semibold">Resumo do Serviço</span>
                <p className="text-white font-medium">{selectedService.tagline}</p>
                <span className="text-[11px] text-[#DFC498] block">Prazo estimado de entrega: {selectedService.estimatedDelivery}</span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-[#8FAEA2]">Detalhes / Necessidades Específicas (Opcional)</Label>
                <Textarea
                  rows={3}
                  value={requestNotes}
                  onChange={e => setRequestNotes(e.target.value)}
                  placeholder="Ex: Gostaria de priorizar a divulgação do tratamento de clareamento a laser para o próximo mês..."
                  className="bg-black/30 border-white/10 text-white rounded-xl text-xs focus:border-[#DFC498] resize-none"
                />
              </div>

              <div className="p-2.5 rounded-xl bg-white/5 border border-white/10 text-[11px] text-[#8FAEA2] space-y-0.5">
                <p>• Contato registrado: <strong className="text-white">{clientName || 'Cliente'}</strong></p>
                {clientEmail && <p>• E-mail: <strong className="text-white">{clientEmail}</strong></p>}
                {clientPhone && <p>• Telefone: <strong className="text-white">{clientPhone}</strong></p>}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setSelectedService(null)}
                  className="flex-1 border-white/10 text-white hover:bg-white/5 rounded-xl h-10 text-xs"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold text-xs h-10 rounded-xl shadow-lg"
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Confirmar Envio'}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
