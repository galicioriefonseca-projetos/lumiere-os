import React, { useState } from 'react';
import { Client } from '../../types';
import { Button } from '@/components/ui/button';
import { Phone, Calendar, Mail, Edit2, AlertCircle, Clock, Trash2, Archive, UserCheck, MessageSquare, Plus, Tag } from 'lucide-react';
import { format } from 'date-fns';

const CRM_STAGES = [
  { id: 'new', label: 'Novo contato', color: 'border-blue-500/20 text-blue-400 bg-blue-500/5 hover:bg-blue-500/10' },
  { id: 'in_service', label: 'Em atendimento', color: 'border-yellow-500/20 text-yellow-400 bg-yellow-500/5 hover:bg-yellow-500/10' },
  { id: 'scheduled', label: 'Agendado', color: 'border-purple-500/20 text-purple-400 bg-purple-500/5 hover:bg-purple-500/10' },
  { id: 'follow_up', label: 'Em acompanhamento', color: 'border-indigo-500/20 text-indigo-400 bg-indigo-500/5 hover:bg-[#D4AF37]/10' },
  { id: 'future_return', label: 'Retorno futuro', color: 'border-teal-500/20 text-teal-400 bg-teal-500/5 hover:bg-teal-500/10' },
  { id: 'active', label: 'Cliente ativo', color: 'border-emerald-500/20 text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10' },
  { id: 'inactive_lost', label: 'Inativo / Perdido', color: 'border-[#F87171]/20 text-[#F87171] bg-red-500/5 hover:bg-red-500/10' }
] as const;

interface KanbanBoardProps {
  clients: Client[];
  userRole: string;
  onMoveClient: (clientId: string, targetStage: Client['crmStage']) => void;
  onSelectClient: (client: Client) => void;
  onQuickAddClient: (stage: Client['crmStage']) => void;
  onArchiveClient: (client: Client) => void;
}

export default function KanbanBoard({
  clients,
  userRole,
  onMoveClient,
  onSelectClient,
  onQuickAddClient,
  onArchiveClient
}: KanbanBoardProps) {
  const [activeDragOverStage, setActiveDragOverStage] = useState<string | null>(null);
  const [mobileActiveStage, setMobileActiveStage] = useState<Client['crmStage']>('new');

  const canUserMove = userRole !== 'professional';
  const isProfessionalRole = userRole === 'professional';
  const todayStr = new Date().toISOString().split('T')[0];

  // Helper to format WhatsApp Link
  const formatWhatsAppLink = (phone: string) => {
    const clean = phone.replace(/\D/g, '');
    if (!clean) return '';
    if (clean.length === 10 || clean.length === 11) {
      return `https://wa.me/55${clean}`;
    }
    return `https://wa.me/${clean}`;
  };

  // Helper to get client's stage or fallback
  const getClientStage = (c: Client): string => {
    return c.crmStage || 'new';
  };

  // Native drag & drop event handlers
  const handleDragStart = (e: React.DragEvent, client: Client) => {
    if (!canUserMove) {
      e.preventDefault();
      return;
    }
    e.dataTransfer.setData('text/plain', client.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (canUserMove && activeDragOverStage !== stageId) {
      setActiveDragOverStage(stageId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, stageId: string) => {
    // Prevent accidental flashing
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    // Check if mouse is actually outside column boundary
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
      setActiveDragOverStage(null);
    }
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setActiveDragOverStage(null);
    if (!canUserMove) return;

    const clientId = e.dataTransfer.getData('text/plain');
    if (clientId) {
      const client = clients.find(c => c.id === clientId);
      if (client && getClientStage(client) !== stageId) {
        onMoveClient(clientId, stageId as Client['crmStage']);
      }
    }
  };

  // Sort and filter clients logic
  const getClientsInStage = (stageId: string) => {
    return clients.filter(c => getClientStage(c) === stageId);
  };

  return (
    <div className="space-y-4">
      {/* Mobile column selection badges */}
      <div className="flex md:hidden gap-1.5 overflow-x-auto pb-2 scrollbar-none select-none">
        {CRM_STAGES.map((s) => {
          const count = getClientsInStage(s.id).length;
          const isActive = s.id === mobileActiveStage;
          return (
            <button
              key={s.id}
              onClick={() => setMobileActiveStage(s.id as Client['crmStage'])}
              className={`p-2 py-1.5 text-xs font-semibold rounded-full border transition whitespace-nowrap shrink-0 flex items-center gap-1.5 ${
                isActive 
                  ? 'border-amber-400 bg-[#141417] text-amber-400' 
                  : 'border-zinc-800 bg-[#0e0e11] text-zinc-400 hover:text-white'
              }`}
            >
              <span>{s.label}</span>
              <span className="bg-zinc-800 text-[10px] text-zinc-300 w-4 h-4 rounded-full flex items-center justify-center">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Desktop side-by-side / Mobile single-column Kanban Grid */}
      <div className="overflow-x-auto pb-4 select-none scrollbar-thin">
        <div className="flex gap-4 min-w-[1240px] md:min-w-0 md:grid md:grid-cols-7">
          {CRM_STAGES.map((stage) => {
            const list = getClientsInStage(stage.id);
            const isHovered = activeDragOverStage === stage.id;
            const showOnMobile = stage.id === mobileActiveStage;

            return (
              <div
                key={stage.id}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={(e) => handleDragLeave(e, stage.id)}
                onDrop={(e) => handleDrop(e, stage.id)}
                className={`flex-1 min-w-[240px] md:min-w-0 md:flex md:flex-col bg-[#0b0b0d] border border-zinc-800/60 rounded-xl max-h-[80vh] flex flex-col p-3 transition-colors duration-300 ${
                  isHovered ? 'bg-[#121217]/60 border-amber-400/40' : ''
                } ${showOnMobile ? 'flex' : 'hidden md:flex'}`}
              >
                {/* Column Header */}
                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-1.5 grow">
                    <span className="w-2.5 h-2.5 rounded-full bg-current" style={{ color: stage.id === 'inactive_lost' ? '#EF4444' : stage.id === 'active' ? '#10B981' : stage.id === 'scheduled' ? '#A78BFA' : '#FBBF24' }} />
                    <h4 className="text-xs font-semibold tracking-tight text-zinc-200 uppercase truncate">
                      {stage.label}
                    </h4>
                  </div>
                  <span className="text-[10px] font-bold text-zinc-400 bg-[#121215] border border-zinc-800 rounded px-1.5 py-0.5">
                    {list.length}
                  </span>
                </div>

                {/* Quick Add Client at stage header */}
                <Button
                  onClick={() => onQuickAddClient(stage.id as Client['crmStage'])}
                  variant="ghost"
                  className="w-full text-xs hover:bg-[#121215] border border-dashed border-zinc-800 text-zinc-500 hover:text-zinc-300 py-1 h-8 rounded-lg mb-3"
                  disabled={userRole === 'professional'}
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar
                </Button>

                {/* Cards Container */}
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[60vh] pr-1 scrollbar-thin">
                  {list.length === 0 ? (
                    <div className="text-center py-8 text-[11px] text-zinc-600 border border-dashed border-zinc-800/10 rounded-lg">
                      Arrastar ou adicionar
                    </div>
                  ) : (
                    list.map((c) => {
                      const isOverdue = c.nextActionAt && c.nextActionAt < todayStr;
                      const hasNext = !!c.nextActionAt;

                      return (
                        <div
                          key={c.id}
                          draggable={canUserMove}
                          onDragStart={(e) => handleDragStart(e, c)}
                          onClick={() => onSelectClient(c)}
                          className={`bg-[#121215]/80 hover:bg-[#15151a] border rounded-lg p-3 cursor-pointer shadow-md group relative transition-all duration-200 ${
                            canUserMove ? 'active:cursor-grabbing hover:scale-[1.01]' : ''
                          } ${
                            isOverdue 
                              ? 'border-red-500/20 shadow-red-500/[0.01]' 
                              : hasNext 
                                ? 'border-[#D4AF37]/15' 
                                : 'border-zinc-800/80 hover:border-zinc-700/80'
                          }`}
                        >
                          <div className="space-y-2">
                            {/* Card Top Title */}
                            <div className="flex justify-between items-start gap-1">
                              <span className="font-semibold text-xs text-white leading-tight break-words pr-4 grow group-hover:text-[#D4AF37] transition">
                                {c.name}
                              </span>
                              {!isProfessionalRole && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onArchiveClient(c);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 absolute right-2.5 top-2.5 text-zinc-500 hover:text-red-400 p-0.5 rounded transition"
                                  title="Arquivar cliente"
                                >
                                  <Archive className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* phone */}
                            {c.phone && (
                              <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                                <span>📱</span>
                                <span className="font-mono">{c.phone}</span>
                              </div>
                            )}

                            {/* Tags list */}
                            {c.tags && c.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1">
                                {c.tags.slice(0, 3).map((t) => (
                                  <span
                                    key={t}
                                    className="text-[9px] bg-zinc-900 border border-zinc-800/80 text-amber-500 px-1 py-0.5 rounded capitalize"
                                  >
                                    #{t}
                                  </span>
                                ))}
                                {c.tags.length > 3 && (
                                  <span className="text-[9px] bg-zinc-900 text-zinc-500 px-1 py-0.5 rounded">
                                    +{c.tags.length - 3}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Responsible professional name */}
                            {c.responsibleId && c.responsibleName && (
                              <div className="text-[10px] text-zinc-500 border-t border-zinc-800/40 pt-1.5 flex items-center justify-between">
                                <span className="truncate">Resp: <strong>{c.responsibleName}</strong></span>
                              </div>
                            )}

                            {/* Next contact action warning */}
                            {c.nextActionAt && (
                              <div className={`mt-1.5 p-1.5 rounded text-[10px] border flex items-center justify-between ${
                                isOverdue 
                                  ? 'bg-[#EF4444]/5 border-red-500/20 text-[#EF4444]' 
                                  : 'bg-[#D4AF37]/5 border-amber-500/10 text-amber-400'
                              }`}>
                                <span className="flex items-center gap-1 font-semibold">
                                  {isOverdue ? <AlertCircle className="w-3 h-3 text-red-400" /> : <Clock className="w-3 h-3 text-[#D4AF37]" />}
                                  {c.nextActionType === 'whatsapp' ? 'WhatsApp' : 
                                   c.nextActionType === 'call' ? 'Telefonar' : 'Visita'}
                                </span>
                                <span>
                                  {c.nextActionAt.split('-').reverse().slice(0, 2).join('/')}
                                  {isOverdue ? ' ⚠️' : ''}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
