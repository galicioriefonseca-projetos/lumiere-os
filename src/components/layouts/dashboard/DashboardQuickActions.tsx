import { BookUser, Calendar as CalendarIcon, HelpCircle, Mail, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DashboardQuickActionsProps {
  onOpenGuide: () => void;
  onOpenRoadmap: () => void;
  onOpenGmail?: () => void;
  onOpenGoogleCalendar?: () => void;
  onOpenGoogleContacts?: () => void;
}

export function DashboardQuickActions({
  onOpenGuide,
  onOpenRoadmap,
  onOpenGmail,
  onOpenGoogleCalendar,
  onOpenGoogleContacts,
}: DashboardQuickActionsProps) {
  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      {/* WhatsApp Integration Status badge */}
      <div className="hidden lg:flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 font-sans text-[11px] font-bold rounded-xl h-8.5 shrink-0 select-none">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
        WhatsApp Conectado
      </div>

      {/* Google Calendar Quick Access Button */}
      {onOpenGoogleCalendar && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onOpenGoogleCalendar}
          aria-label="Abrir Google Agenda"
          className="text-xs h-8.5 border-[#D4AF37]/25 hover:border-[#D4AF37]/60 text-[#8A6D36] hover:bg-[#F5F1E9] transition-all font-semibold rounded-xl bg-white flex items-center gap-1.5 shrink-0 px-2 sm:px-3"
        >
          <CalendarIcon className="w-4 h-4 text-[#8A6D36]" />
          <span className="hidden sm:inline">Agenda</span>
        </Button>
      )}

      {/* Gmail Quick Access Button */}
      {onOpenGmail && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onOpenGmail}
          aria-label="Abrir Gmail"
          className="text-xs h-8.5 border-[#D4AF37]/25 hover:border-[#D4AF37]/60 text-[#8A6D36] hover:bg-[#F5F1E9] transition-all font-semibold rounded-xl bg-white flex items-center gap-1.5 shrink-0 px-2 sm:px-3"
        >
          <Mail className="w-4 h-4 text-[#8A6D36]" />
          <span className="hidden sm:inline">Gmail</span>
        </Button>
      )}

      {/* Google Contacts Quick Access Button */}
      {onOpenGoogleContacts && (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onOpenGoogleContacts}
          aria-label="Abrir Google Contatos"
          className="text-xs h-8.5 border-[#D4AF37]/25 hover:border-[#D4AF37]/60 text-[#8A6D36] hover:bg-[#F5F1E9] transition-all font-semibold rounded-xl bg-white flex items-center gap-1.5 shrink-0 px-2 sm:px-3"
        >
          <BookUser className="w-4 h-4 text-[#8A6D36]" />
          <span className="hidden sm:inline">Contatos</span>
        </Button>
      )}

      {/* Guia do Sistema Button */}
      <Button
        id="lumiere-guide-trigger"
        size="sm"
        variant="outline"
        onClick={onOpenGuide}
        className="text-xs h-8.5 border-[#D4AF37]/20 hover:border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all font-semibold rounded-xl bg-white/[0.02] hidden sm:flex items-center gap-1.5 shrink-0 px-3"
      >
        <HelpCircle className="w-4 h-4 text-[#D4AF37]" />
        <span className="hidden sm:inline">Guia do Sistema</span>
        <span className="sm:hidden">Ajuda</span>
      </Button>

      {/* Próximas Atualizações Button */}
      <Button
        size="sm"
        variant="outline"
        onClick={onOpenRoadmap}
        className="text-xs h-8.5 border-[#D4AF37]/20 hover:border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all font-semibold rounded-xl bg-white/[0.02] hidden sm:flex items-center gap-1.5 shrink-0 px-3"
      >
        <Sparkles className="w-4 h-4 text-[#D4AF37]" />
        <span className="hidden sm:inline">Próximas Atualizações</span>
        <span className="sm:hidden">Roadmap</span>
      </Button>
    </div>
  );
}
