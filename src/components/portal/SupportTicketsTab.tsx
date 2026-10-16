import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  MessageSquare, 
  Plus, 
  Send, 
  CheckCircle2, 
  Clock, 
  AlertCircle, 
  Instagram, 
  MapPin, 
  Globe, 
  HelpCircle,
  User,
  Shield,
  Loader2,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { ClientTicket, ClientTicketMessage } from '@/types';

interface SupportTicketsTabProps {
  tickets: ClientTicket[];
  onTicketUpdated?: () => void;
  currentUser: any;
  agencyName: string;
  clientName: string;
}

export default function SupportTicketsTab({
  tickets = [],
  onTicketUpdated,
  currentUser,
  agencyName,
  clientName
}: SupportTicketsTabProps) {
  const [selectedTicket, setSelectedTicket] = useState<ClientTicket | null>(null);
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [sendingReply, setSendingReply] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);

  // New ticket form
  const [newTicketForm, setNewTicketForm] = useState({
    subject: '',
    category: 'google_meu_negocio' as ClientTicket['category'],
    priority: 'media' as ClientTicket['priority'],
    initialMessage: ''
  });

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case 'instagram':
        return (
          <Badge className="bg-pink-500/20 text-pink-300 border-pink-500/30 gap-1 text-[10px]">
            <Instagram className="w-3 h-3" /> Instagram
          </Badge>
        );
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
      default:
        return (
          <Badge className="bg-zinc-500/20 text-zinc-300 border-zinc-500/30 gap-1 text-[10px]">
            <HelpCircle className="w-3 h-3" /> Geral
          </Badge>
        );
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'resolved':
      case 'closed':
        return (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">
            Resolvido
          </Badge>
        );
      case 'in_progress':
        return (
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px]">
            Em Atendimento
          </Badge>
        );
      case 'open':
      default:
        return (
          <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-[10px]">
            Aberto
          </Badge>
        );
    }
  };

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketForm.subject.trim() || !newTicketForm.initialMessage.trim()) {
      toast.error('Preencha o assunto e a descrição da sua solicitação.');
      return;
    }

    try {
      setCreatingTicket(true);
      const idToken = await currentUser?.getIdToken?.();
      const res = await fetch('/api/client-portal/tickets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          subject: newTicketForm.subject.trim(),
          category: newTicketForm.category,
          priority: newTicketForm.priority,
          initialMessage: newTicketForm.initialMessage.trim(),
          senderName: clientName || currentUser?.displayName || 'Cliente'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao abrir chamado.');

      toast.success('Solicitação aberta com sucesso! A equipe da agência foi notificada.');
      setIsNewTicketModalOpen(false);
      setNewTicketForm({
        subject: '',
        category: 'google_meu_negocio',
        priority: 'media',
        initialMessage: ''
      });
      if (onTicketUpdated) onTicketUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao criar ticket.');
    } finally {
      setCreatingTicket(false);
    }
  };

  const handleSendReply = async () => {
    if (!selectedTicket || !replyText.trim()) return;

    try {
      setSendingReply(true);
      const idToken = await currentUser?.getIdToken?.();
      const res = await fetch(`/api/client-portal/tickets/${selectedTicket.id}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`
        },
        body: JSON.stringify({
          text: replyText.trim(),
          senderName: clientName || currentUser?.displayName || 'Cliente'
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar mensagem.');

      // Update local ticket messages
      setSelectedTicket(prev => {
        if (!prev) return null;
        return {
          ...prev,
          messages: [...(prev.messages || []), data.message],
          status: data.status || prev.status
        };
      });

      setReplyText('');
      toast.success('Mensagem enviada com sucesso!');
      if (onTicketUpdated) onTicketUpdated();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao enviar mensagem.');
    } finally {
      setSendingReply(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Banner */}
      <div className="bg-[#0A261E] border border-[#17473A] p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 text-xs text-[#DFC498] font-semibold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            Canal Direto de Alinhamento
          </div>
          <h3 className="text-xl font-bold text-white">Tickets de Suporte & Demandas</h3>
          <p className="text-xs text-[#8FAEA2] max-w-xl leading-relaxed">
            Centralize suas dúvidas operacionais, pedidos de ajustes em Google Meu Negócio, alterações de Landing Page ou ideias de posts para o Instagram sem se perder em e-mails soltos.
          </p>
        </div>

        <Button
          onClick={() => setIsNewTicketModalOpen(true)}
          className="bg-gradient-to-r from-[#DFC498] to-[#C5A880] hover:from-[#C5A880] hover:to-[#B0926A] text-[#04140F] font-bold text-xs h-10 rounded-xl shadow-lg gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" />
          Abrir Nova Solicitação
        </Button>
      </div>

      {/* Main View: List or Detail Thread */}
      {!selectedTicket ? (
        <div>
          {tickets.length === 0 ? (
            <Card className="bg-[#0A261E]/60 border-[#17473A] text-center py-12">
              <CardContent className="space-y-3">
                <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center mx-auto text-[#8FAEA2]">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-white">Nenhum chamado aberto no momento</h4>
                <p className="text-xs text-[#8FAEA2] max-w-sm mx-auto">
                  Precisa de um ajuste de campanha, novidade no Google Meu Negócio ou alteração de site? Abra uma solicitação acima.
                </p>
                <Button
                  onClick={() => setIsNewTicketModalOpen(true)}
                  className="bg-[#DFC498] text-[#04140F] font-bold text-xs h-9 rounded-xl"
                >
                  Abrir Primeira Solicitação
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tickets.map(ticket => (
                <Card
                  key={ticket.id}
                  onClick={() => setSelectedTicket(ticket)}
                  className="bg-[#0A261E] border-[#17473A] hover:border-[#DFC498]/40 cursor-pointer transition-all shadow-md flex flex-col justify-between"
                >
                  <CardHeader className="pb-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        {getCategoryBadge(ticket.category)}
                        {getStatusBadge(ticket.status)}
                      </div>
                      <span className="text-[10px] text-[#8FAEA2]">
                        {new Date(ticket.createdAt).toLocaleDateString('pt-BR')}
                      </span>
                    </div>

                    <CardTitle className="text-sm font-bold text-white hover:text-[#DFC498] transition-colors">
                      {ticket.subject}
                    </CardTitle>

                    {ticket.messages && ticket.messages.length > 0 && (
                      <CardDescription className="text-xs text-[#8FAEA2] line-clamp-2">
                        Última mensagem: {ticket.messages[ticket.messages.length - 1].text}
                      </CardDescription>
                    )}
                  </CardHeader>

                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-xs text-[#DFC498] font-medium border-t border-white/5 pt-2.5">
                      <span className="text-[#8FAEA2] text-[11px]">
                        {ticket.messages?.length || 0} mensagem(ns) no histórico
                      </span>
                      <span className="hover:underline flex items-center gap-1">
                        Ver Conversa <MessageSquare className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* TICKET DETAIL THREAD VIEW */
        <Card className="bg-[#0A261E] border-[#17473A] shadow-2xl">
          <CardHeader className="border-b border-[#17473A]/80 pb-4">
            <div className="flex items-center justify-between gap-4">
              <Button
                onClick={() => setSelectedTicket(null)}
                variant="outline"
                size="sm"
                className="border-white/10 text-white hover:bg-white/5 rounded-xl text-xs h-8 gap-1.5"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> Voltar para Lista
              </Button>

              <div className="flex items-center gap-2">
                {getCategoryBadge(selectedTicket.category)}
                {getStatusBadge(selectedTicket.status)}
              </div>
            </div>

            <div className="pt-2">
              <CardTitle className="text-lg font-bold text-white">
                {selectedTicket.subject}
              </CardTitle>
              <CardDescription className="text-xs text-[#8FAEA2]">
                Iniciado em {new Date(selectedTicket.createdAt).toLocaleDateString('pt-BR')} às {new Date(selectedTicket.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </CardDescription>
            </div>
          </CardHeader>

          <CardContent className="p-6 space-y-6">
            {/* Messages Thread */}
            <div className="space-y-4 max-h-[480px] overflow-y-auto pr-2">
              {(selectedTicket.messages || []).map((msg, index) => {
                const isClient = msg.senderRole === 'client';
                return (
                  <div
                    key={msg.id || index}
                    className={`flex flex-col ${isClient ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-[#8FAEA2] mb-1 px-1">
                      {isClient ? <User className="w-3 h-3" /> : <Shield className="w-3 h-3 text-[#DFC498]" />}
                      <span>{msg.senderName}</span>
                      <span>•</span>
                      <span>{new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>

                    <div
                      className={`max-w-[85%] rounded-2xl p-4 text-xs leading-relaxed ${
                        isClient
                          ? 'bg-[#124234] text-white rounded-tr-none border border-emerald-500/20'
                          : 'bg-black/40 text-[#E1EDE8] rounded-tl-none border border-white/10'
                      }`}
                    >
                      {msg.text}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Reply Input Box */}
            <div className="border-t border-[#17473A] pt-4 space-y-2">
              <Textarea
                rows={3}
                value={replyText}
                onChange={e => setReplyText(e.target.value)}
                placeholder="Digite sua resposta ou nova dúvida para a agência..."
                className="bg-black/40 border-white/10 text-white rounded-xl text-xs focus:border-[#DFC498] resize-none"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSendReply}
                  disabled={sendingReply || !replyText.trim()}
                  className="bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold text-xs h-9 rounded-xl gap-2 shadow"
                >
                  {sendingReply ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  Enviar Resposta
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* MODAL: NOVO TICKET */}
      <Dialog open={isNewTicketModalOpen} onOpenChange={setIsNewTicketModalOpen}>
        <DialogContent className="bg-[#0A261E] border-[#17473A] text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-[#DFC498]" />
              Abrir Solicitação para a Agência
            </DialogTitle>
            <DialogDescription className="text-xs text-[#8FAEA2]">
              Sua equipe de marketing receberá o chamado diretamente no painel.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTicket} className="space-y-3.5 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-[#8FAEA2]">Assunto da Solicitação *</Label>
              <Input
                required
                value={newTicketForm.subject}
                onChange={e => setNewTicketForm(prev => ({ ...prev, subject: e.target.value }))}
                placeholder="Ex: Atualização de fotos no perfil do Google Meu Negócio"
                className="bg-black/30 border-white/10 text-white rounded-xl h-10 text-xs focus:border-[#DFC498]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-[#8FAEA2]">Canal / Serviço</Label>
                <select
                  value={newTicketForm.category}
                  onChange={e => setNewTicketForm(prev => ({ ...prev, category: e.target.value as any }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl text-white px-3 h-10 text-xs"
                >
                  <option value="google_meu_negocio">Google Meu Negócio</option>
                  <option value="site_landing_page">Site & Landing Page</option>
                  <option value="instagram">Instagram</option>
                  <option value="geral">Dúvidas Gerais / Outros</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-[#8FAEA2]">Prioridade</Label>
                <select
                  value={newTicketForm.priority}
                  onChange={e => setNewTicketForm(prev => ({ ...prev, priority: e.target.value as any }))}
                  className="w-full bg-black/40 border border-white/10 rounded-xl text-white px-3 h-10 text-xs"
                >
                  <option value="baixa">Baixa (Rotina)</option>
                  <option value="media">Média (Padrão)</option>
                  <option value="alta">Alta (Urgente)</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-[#8FAEA2]">Descrição Detalhada *</Label>
              <Textarea
                required
                rows={4}
                value={newTicketForm.initialMessage}
                onChange={e => setNewTicketForm(prev => ({ ...prev, initialMessage: e.target.value }))}
                placeholder="Descreva o que você precisa que seja feito ou a sua dúvida..."
                className="bg-black/30 border-white/10 text-white rounded-xl text-xs focus:border-[#DFC498] resize-none"
              />
            </div>

            <Button
              type="submit"
              disabled={creatingTicket}
              className="w-full bg-[#DFC498] hover:bg-[#C5A880] text-[#04140F] font-bold text-xs h-10 rounded-xl mt-2"
            >
              {creatingTicket ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Registrar Solicitação'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
