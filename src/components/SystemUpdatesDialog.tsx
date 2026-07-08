import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { APP_INFO } from '../config/appInfo';
import { CHANGELOG } from '../config/changelog';
import { Button } from '@/components/ui/button';
import { Sparkles, Calendar, Check, ExternalLink, Award } from 'lucide-react';
import { toast } from 'sonner';

interface SystemUpdatesDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onMarkAsSeen?: () => void;
}

export default function SystemUpdatesDialog({ isOpen, onClose, onMarkAsSeen }: SystemUpdatesDialogProps) {
  const handleMarkAsSeen = () => {
    localStorage.setItem('lumiere_last_seen_version', APP_INFO.version);
    toast.success('Você viu as novidades da versão!', {
      description: 'Obrigado por utilizar o LumiereOS.',
      duration: 3000
    });
    if (onMarkAsSeen) {
      onMarkAsSeen();
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-xl bg-zinc-950 border border-[#D4AF37]/30 text-white rounded-2xl shadow-2xl p-6 overflow-hidden max-h-[90vh] flex flex-col">
        <DialogHeader className="pb-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] px-2.5 py-1 rounded border border-[#D4AF37]/20 uppercase tracking-widest font-mono font-bold">
              Versão {APP_INFO.version}
            </span>
            <span className="text-[10px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/25 id-premium-active font-bold uppercase font-mono">
              Premium Ativa
            </span>
          </div>
          <DialogTitle className="text-xl font-heading font-normal tracking-tight text-[#D4AF37] flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-[#D4AF37]" /> Novidades do LumiereOS
          </DialogTitle>
          <DialogDescription className="text-xs text-zinc-400 mt-1 max-w-md">
            Descubra as novidades preparadas para otimizar a experiência premium e a gestão do seu salão de beleza.
          </DialogDescription>
        </DialogHeader>

        {/* Scrollable update history */}
        <div className="flex-1 overflow-y-auto py-4 space-y-6 pr-1">
          {CHANGELOG.map((item, idx) => (
            <div 
              key={item.version} 
              className={`p-4 rounded-xl border transition-all ${
                idx === 0 
                  ? 'bg-[#D4AF37]/5 border-[#D4AF37]/25 shadow-lg shadow-[#D4AF37]/2' 
                  : 'bg-zinc-900/30 border-white/5 opacity-85'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <h3 className="text-sm font-semibold text-white flex items-center gap-1.5">
                  {item.title}
                  {idx === 0 && (
                    <span className="text-[8px] bg-[#D4AF37] text-black px-1.5 py-0.5 rounded font-mono font-bold uppercase tracking-wider">
                      Novo
                    </span>
                  )}
                </h3>
                <span className="text-[10px] text-[#D4AF37]/80 flex items-center gap-1 font-mono">
                  <Calendar className="w-3 h-3" /> {item.date}
                </span>
              </div>
              <p className="text-xs text-zinc-300 mb-3.5 leading-relaxed font-light">
                {item.description}
              </p>
              
              <div className="space-y-2">
                <span className="text-[9px] uppercase tracking-wider font-bold text-zinc-400 block font-mono">Destaques da Atualização:</span>
                <ul className="space-y-1.5">
                  {item.highlights.map((highlight, hIdx) => (
                    <li key={hIdx} className="text-xs text-[#e4e4e7] flex items-start gap-2 leading-relaxed">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#D4AF37] mt-1.5 shrink-0" />
                      <span>{highlight}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>

        {/* Footer info & cta */}
        <div className="pt-4 border-t border-white/5 shrink-0 space-y-4 bg-zinc-950">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[11px] text-zinc-400 bg-black/40 p-3 rounded-xl border border-white/5">
            <div>
              <span className="text-zinc-500">Desenvolvido com carinho por:</span>
              <p className="font-semibold text-white mt-0.5 tracking-tight flex items-center gap-1">
                {APP_INFO.company}
              </p>
            </div>
            <a 
              href={APP_INFO.website}
              target="_blank"
              rel="noreferrer"
              className="text-[#D4AF37] hover:text-amber-400 flex items-center gap-1 font-bold transition-all sm:self-center shrink-0"
            >
              Visitar Website <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-[10px] text-zinc-500 font-sans flex items-center gap-1">
              <Award className="w-3.5 h-3.5 text-[#D4AF37]/70" /> Lumière Studio Partner
            </span>
            <div className="flex gap-2">
              <Button 
                onClick={handleMarkAsSeen}
                className="bg-[#D4AF37] hover:bg-[#b08f2e] text-black font-extrabold h-9 text-xs rounded-xl px-5 transition-all shadow-[0_2px_10px_rgba(212,175,55,0.15)] flex items-center gap-1.5"
              >
                <Check className="w-3.5 h-3.5" /> Entendi, ótimo!
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
