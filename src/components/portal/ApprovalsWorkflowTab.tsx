import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  ExternalLink, 
  Sparkles, 
  Instagram, 
  Globe, 
  MapPin, 
  FileText, 
  MessageSquare, 
  ThumbsUp, 
  RotateCcw,
  Eye,
  Filter
} from 'lucide-react';
import { ClientApproval } from '@/types';

interface ApprovalsWorkflowTabProps {
  approvals: ClientApproval[];
  onApprovalUpdated?: () => void;
  currentUser: any;
  agencyName: string;
}

export default function ApprovalsWorkflowTab({ 
  approvals = [], 
  onApprovalUpdated,
  currentUser,
  agencyName
}: ApprovalsWorkflowTabProps) {
  const [selectedItem, setSelectedItem] = useState<ClientApproval | null>(null);
  const [reviewAction, setReviewAction] = useState<'approved' | 'revisions_requested' | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const handleOpenReview = (item: ClientApproval, action: 'approved' | 'revisions_requested') => {
    setSelectedItem(item);
    setReviewAction(action);
    setFeedbackText('');
  };

  const handleSubmitReview = async () => {
    if (!selectedItem || !reviewAction) return;

    if (reviewAction === 'revisions_requested' && !feedbackText.trim()) {
      toast.error('Por favor, descreva as alterações que você gostaria de ver.');
      return;
    }

    try {
      setSubmitting(true);
      const idToken = await currentUser?.getIdToken?.();
      const res = await fetch(`/api/client-portal/approvals/${selectedItem.id}/review`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          status: reviewAction,
          clientFeedback: feedbackText.trim()
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao registrar revisão.');

      toast.success(
        reviewAction === 'approved' 
          ? 'Conteúdo aprovado com sucesso! A agência dará seguimento à publicação.' 
          : 'Solicitação de alteração enviada para a equipe da agência!'
      );
      setSelectedItem(null);
      setReviewAction(null);
      if (onApprovalUpdated) onApprovalUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao processar revisão.');
    } finally {
      setSubmitting(false);
    }
  };

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'instagram_post':
        return (
          <Badge className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 text-pink-300 border-pink-500/30 gap-1 text-[11px]">
            <Instagram className="w-3 h-3" /> Instagram
          </Badge>
        );
      case 'gmn_post':
        return (
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 gap-1 text-[11px]">
            <MapPin className="w-3 h-3" /> Google Meu Negócio
          </Badge>
        );
      case 'landing_page':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30 gap-1 text-[11px]">
            <Globe className="w-3 h-3" /> Site & Landing Page
          </Badge>
        );
      default:
        return (
          <Badge className="bg-zinc-500/20 text-zinc-300 border-zinc-500/30 gap-1 text-[11px]">
            <FileText className="w-3 h-3" /> Conteúdo
          </Badge>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 gap-1 text-[11px]">
            <CheckCircle2 className="w-3 h-3" /> Aprovado
          </Badge>
        );
      case 'revisions_requested':
        return (
          <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 gap-1 text-[11px]">
            <RotateCcw className="w-3 h-3" /> Alteração Solicitada
          </Badge>
        );
      case 'pending':
      default:
        return (
          <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 gap-1 text-[11px] animate-pulse">
            <Clock className="w-3 h-3" /> Aguardando Sua Aprovação
          </Badge>
        );
    }
  };

  const filteredApprovals = approvals.filter(item => {
    if (filterType !== 'all' && item.type !== filterType) return false;
    if (filterStatus !== 'all' && item.status !== filterStatus) return false;
    return true;
  });

  const pendingCount = approvals.filter(a => a.status === 'pending').length;

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-[#0A261E] border border-[#17473A] p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs text-[#DFC498] font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Central de Aprovações & Workflow
          </div>
          <h3 className="text-xl font-bold text-white">Aprovação de Peças e Campanhas</h3>
          <p className="text-xs text-[#8FAEA2] max-w-xl leading-relaxed">
            Revise as publicações de Instagram, novidades do Google Meu Negócio e seções de Landing Pages preparadas pela <strong className="text-white">{agencyName}</strong>. Aprove com 1 clique ou solicite ajustes com observações auditadas.
          </p>
        </div>

        {pendingCount > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 px-4 py-2.5 rounded-xl text-amber-300 text-xs font-medium flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>Você tem <strong>{pendingCount}</strong> item(ns) aguardando sua revisão.</span>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#082019] p-3 rounded-xl border border-white/5">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-[#8FAEA2] flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filtrar por Serviço:
          </span>
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterType === 'all' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
            }`}
          >
            Todos ({approvals.length})
          </button>
          <button
            onClick={() => setFilterType('instagram_post')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterType === 'instagram_post' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
            }`}
          >
            Instagram
          </button>
          <button
            onClick={() => setFilterType('gmn_post')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterType === 'gmn_post' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
            }`}
          >
            Google Meu Negócio
          </button>
          <button
            onClick={() => setFilterType('landing_page')}
            className={`px-3 py-1 rounded-lg transition-colors ${
              filterType === 'landing_page' ? 'bg-[#DFC498] text-[#04140F] font-bold' : 'bg-white/5 text-[#8FAEA2] hover:text-white'
            }`}
          >
            Site & Landing Page
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#8FAEA2]">Status:</span>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
            className="bg-black/40 border border-white/10 rounded-lg text-white px-2.5 py-1 text-xs"
          >
            <option value="all">Todos os Status</option>
            <option value="pending">Aguardando Aprovação</option>
            <option value="approved">Aprovados</option>
            <option value="revisions_requested">Com Alteração Solicitada</option>
          </select>
        </div>
      </div>

      {/* Grid of Approvals */}
      {filteredApprovals.length === 0 ? (
        <Card className="bg-[#0A261E]/60 border-[#17473A] text-center py-12">
          <CardContent className="space-y-3">
            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-[#8FAEA2]">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-bold text-white">Nenhum item de aprovação no momento</h4>
            <p className="text-xs text-[#8FAEA2] max-w-sm mx-auto">
              Assim que a equipe da agência preparar novos posts de Instagram, novidades de Google Meu Negócio ou páginas, eles aparecerão aqui para sua validação.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {filteredApprovals.map(item => (
            <Card key={item.id} className="bg-[#0A261E]/95 border-[#17473A] hover:border-[#DFC498]/40 transition-all flex flex-col justify-between shadow-xl">
              <CardHeader className="space-y-3 pb-3">
                <div className="flex items-center justify-between gap-2">
                  {getTypeBadge(item.type)}
                  {getStatusBadge(item.status)}
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-white leading-snug">
                    {item.title}
                  </CardTitle>
                  <CardDescription className="text-xs text-[#8FAEA2] mt-1">
                    Enviado em {new Date(item.createdAt).toLocaleDateString('pt-BR')}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent className="space-y-4 pt-0">
                {/* Visual Preview / Media */}
                {item.mediaUrl && (
                  <div className="rounded-xl overflow-hidden border border-white/10 bg-black/40 max-h-56 relative group">
                    <img
                      src={item.mediaUrl}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {item.previewUrl && (
                      <a
                        href={item.previewUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 text-white font-medium text-xs transition-opacity"
                      >
                        <ExternalLink className="w-4 h-4 text-[#DFC498]" /> Abrir Prévia Externa
                      </a>
                    )}
                  </div>
                )}

                {/* Copy Text Preview */}
                {item.copyText && (
                  <div className="bg-black/30 p-3.5 rounded-xl border border-white/5 space-y-1">
                    <span className="text-[10px] font-semibold text-[#DFC498] uppercase tracking-wider block">
                      Texto / Legenda / Copy:
                    </span>
                    <p className="text-xs text-[#E1EDE8] leading-relaxed whitespace-pre-line line-clamp-4">
                      {item.copyText}
                    </p>
                  </div>
                )}

                {/* Client Feedback if any */}
                {item.clientFeedback && (
                  <div className={`p-3 rounded-xl border text-xs space-y-1 ${
                    item.status === 'approved' 
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                      : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
                  }`}>
                    <span className="text-[10px] uppercase font-bold block">
                      {item.status === 'approved' ? 'Observação de Aprovação:' : 'Ajuste Solicitado:'}
                    </span>
                    <p className="italic">"{item.clientFeedback}"</p>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="pt-2">
                  {item.status === 'pending' ? (
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        onClick={() => handleOpenReview(item, 'revisions_requested')}
                        variant="outline"
                        className="border-amber-500/30 text-amber-300 hover:bg-amber-500/10 text-xs h-9 rounded-xl gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Solicitar Ajuste
                      </Button>
                      <Button
                        onClick={() => handleOpenReview(item, 'approved')}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs h-9 rounded-xl gap-1.5 shadow-md"
                      >
                        <ThumbsUp className="w-3.5 h-3.5" /> Aprovar Agora
                      </Button>
                    </div>
                  ) : item.status === 'approved' ? (
                    <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center text-xs text-emerald-400 font-medium flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4" /> Peça Aprovada & Homologada para Publicação
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center text-xs text-amber-300 font-medium flex items-center justify-center gap-1.5">
                      <RotateCcw className="w-4 h-4" /> Equipe da agência revisando as alterações solicitadas
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* MODAL DE REVISÃO / CONFIRMAÇÃO */}
      <Dialog open={!!selectedItem && !!reviewAction} onOpenChange={open => !open && setSelectedItem(null)}>
        <DialogContent className="bg-[#0A261E] border-[#17473A] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              {reviewAction === 'approved' ? (
                <>
                  <ThumbsUp className="w-5 h-5 text-emerald-400" />
                  Aprovar Conteúdo
                </>
              ) : (
                <>
                  <RotateCcw className="w-5 h-5 text-amber-400" />
                  Solicitar Ajustes na Peça
                </>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8FAEA2]">
              {selectedItem?.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {reviewAction === 'approved' ? (
              <p className="text-xs text-[#8FAEA2] leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5">
                Ao clicar em confirmar, você autoriza a agência <strong className="text-white">{agencyName}</strong> a programar e publicar esta peça no canal oficial. Se desejar, adicione uma nota opcional abaixo:
              </p>
            ) : (
              <p className="text-xs text-[#8FAEA2] leading-relaxed bg-black/20 p-3 rounded-xl border border-white/5">
                Descreva detalhadamente o que você gostaria de mudar (ex: trocar imagem, ajustar texto da oferta, alterar data ou chamada para ação):
              </p>
            )}

            <div className="space-y-1.5">
              <label className="text-xs text-[#8FAEA2] block">
                {reviewAction === 'approved' ? 'Observações (Opcional)' : 'Instruções para a equipe de criação *'}
              </label>
              <Textarea
                rows={4}
                value={feedbackText}
                onChange={e => setFeedbackText(e.target.value)}
                placeholder={reviewAction === 'approved' ? 'Ex: Ficou ótimo, aprovado sem ressalvas!' : 'Ex: Gostaria de alterar a cor de destaque e trocar a frase do título para...'}
                className="bg-black/40 border-white/10 text-white rounded-xl text-xs focus:border-[#DFC498] resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                variant="outline"
                onClick={() => setSelectedItem(null)}
                className="flex-1 border-white/10 text-white hover:bg-white/5 rounded-xl h-10 text-xs"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmitReview}
                disabled={submitting}
                className={`flex-1 font-bold text-xs h-10 rounded-xl shadow-lg ${
                  reviewAction === 'approved'
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                }`}
              >
                {submitting ? 'Salvando...' : reviewAction === 'approved' ? 'Confirmar Aprovação' : 'Enviar Ajustes'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
