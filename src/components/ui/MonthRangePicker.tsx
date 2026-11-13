import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, X, Check, Clock, Filter, Sparkles } from 'lucide-react';
import { Button } from './button';

export interface MonthRange {
  startMonth: string; // YYYY-MM
  endMonth: string;   // YYYY-MM
  preset?: 'all' | 'current' | 'previous' | 'last3' | 'last6' | 'year' | 'custom';
}

interface MonthRangePickerProps {
  value: MonthRange;
  onChange: (range: MonthRange) => void;
  availableMonths?: string[]; // array of YYYY-MM that have data/reports
  className?: string;
  theme?: 'dark' | 'emerald' | 'gold';
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'
];

const MONTH_NAMES_FULL = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

export function formatMonthYearLabel(ym: string): string {
  if (!ym) return '';
  const parts = ym.split('-');
  if (parts.length < 2) return ym;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthName = MONTH_NAMES_SHORT[monthIdx] || parts[1];
  return `${monthName}/${year}`;
}

export function formatMonthFullLabel(ym: string): string {
  if (!ym) return '';
  const parts = ym.split('-');
  if (parts.length < 2) return ym;
  const year = parts[0];
  const monthIdx = parseInt(parts[1], 10) - 1;
  const monthName = MONTH_NAMES_FULL[monthIdx] || parts[1];
  return `${monthName} de ${year}`;
}

export default function MonthRangePicker({
  value,
  onChange,
  availableMonths = [],
  className = '',
  theme = 'emerald'
}: MonthRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Current year being viewed in the calendar modal
  const initialYear = useMemo(() => {
    if (value.startMonth) {
      return parseInt(value.startMonth.split('-')[0], 10) || new Date().getFullYear();
    }
    return new Date().getFullYear();
  }, [value.startMonth]);

  const [viewYear, setViewYear] = useState<number>(initialYear);

  // Temporary selection while modal is open
  const [tempStart, setTempStart] = useState<string>(value.startMonth || '');
  const [tempEnd, setTempEnd] = useState<string>(value.endMonth || '');

  // Synchronize when value changes externally
  useEffect(() => {
    setTempStart(value.startMonth || '');
    setTempEnd(value.endMonth || '');
  }, [value.startMonth, value.endMonth]);

  // Click outside listener
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Helper to calculate YYYY-MM
  const getYm = (year: number, monthIndex: number) => {
    return `${year}-${String(monthIndex + 1).padStart(2, '0')}`;
  };

  // Quick preset actions
  const applyPreset = (preset: 'all' | 'current' | 'previous' | 'last3' | 'last6' | 'year') => {
    const today = new Date();
    const currYear = today.getFullYear();
    const currMonth = today.getMonth(); // 0-11

    if (preset === 'all') {
      onChange({ startMonth: '', endMonth: '', preset: 'all' });
      setIsOpen(false);
      return;
    }

    if (preset === 'current') {
      const ym = getYm(currYear, currMonth);
      onChange({ startMonth: ym, endMonth: ym, preset: 'current' });
      setViewYear(currYear);
      setIsOpen(false);
      return;
    }

    if (preset === 'previous') {
      const prevDate = new Date(currYear, currMonth - 1, 1);
      const ym = getYm(prevDate.getFullYear(), prevDate.getMonth());
      onChange({ startMonth: ym, endMonth: ym, preset: 'previous' });
      setViewYear(prevDate.getFullYear());
      setIsOpen(false);
      return;
    }

    if (preset === 'last3') {
      const startD = new Date(currYear, currMonth - 2, 1);
      const startYm = getYm(startD.getFullYear(), startD.getMonth());
      const endYm = getYm(currYear, currMonth);
      onChange({ startMonth: startYm, endMonth: endYm, preset: 'last3' });
      setViewYear(currYear);
      setIsOpen(false);
      return;
    }

    if (preset === 'last6') {
      const startD = new Date(currYear, currMonth - 5, 1);
      const startYm = getYm(startD.getFullYear(), startD.getMonth());
      const endYm = getYm(currYear, currMonth);
      onChange({ startMonth: startYm, endMonth: endYm, preset: 'last6' });
      setViewYear(currYear);
      setIsOpen(false);
      return;
    }

    if (preset === 'year') {
      const startYm = `${currYear}-01`;
      const endYm = `${currYear}-12`;
      onChange({ startMonth: startYm, endMonth: endYm, preset: 'year' });
      setViewYear(currYear);
      setIsOpen(false);
      return;
    }
  };

  // Month cell click handling
  const handleMonthClick = (ym: string) => {
    // If no start selected, or both start and end were selected: start a fresh selection
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(ym);
      setTempEnd('');
      return;
    }

    // If start was selected and no end:
    if (tempStart && !tempEnd) {
      if (ym < tempStart) {
        // user clicked an earlier month: make it the start
        setTempEnd(tempStart);
        setTempStart(ym);
      } else {
        setTempEnd(ym);
      }
    }
  };

  const handleApply = () => {
    let finalStart = tempStart;
    let finalEnd = tempEnd;

    // If only one was clicked, treat it as a single month range
    if (finalStart && !finalEnd) {
      finalEnd = finalStart;
    } else if (!finalStart && finalEnd) {
      finalStart = finalEnd;
    }

    onChange({
      startMonth: finalStart,
      endMonth: finalEnd,
      preset: 'custom'
    });
    setIsOpen(false);
  };

  const handleClear = () => {
    setTempStart('');
    setTempEnd('');
    onChange({
      startMonth: '',
      endMonth: '',
      preset: 'all'
    });
    setIsOpen(false);
  };

  // Display label on the button
  const triggerLabel = useMemo(() => {
    if (!value.startMonth && !value.endMonth) {
      return 'Todos os Meses (Geral)';
    }
    if (value.startMonth && (!value.endMonth || value.startMonth === value.endMonth)) {
      return formatMonthFullLabel(value.startMonth);
    }
    if (value.startMonth && value.endMonth) {
      return `${formatMonthYearLabel(value.startMonth)} — ${formatMonthYearLabel(value.endMonth)}`;
    }
    return 'Selecionar Período';
  }, [value.startMonth, value.endMonth]);

  // Color theme adjustments
  const isEmerald = theme === 'emerald';
  const accentColor = isEmerald ? '#DFC498' : '#D4AF37';

  return (
    <div className={`relative inline-block ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all shadow-sm ${
          isOpen
            ? 'border-[#DFC498] bg-[#0A261E] text-white ring-2 ring-[#DFC498]/20'
            : 'border-[#17473A] bg-[#061A14] text-white hover:border-[#DFC498]/60 hover:bg-[#0A261E]'
        }`}
      >
        <CalendarIcon className="w-4 h-4 text-[#DFC498] shrink-0" />
        <span className="truncate max-w-[210px] sm:max-w-[260px]">{triggerLabel}</span>
        {(value.startMonth || value.endMonth) && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="p-0.5 rounded-md hover:bg-white/10 text-[#8FAEA2] hover:text-white ml-1"
            title="Limpar filtro de data"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {/* Popover Calendar Modal */}
      {isOpen && (
        <div className="absolute left-0 sm:left-auto right-auto sm:right-0 mt-2 z-50 w-[320px] sm:w-[360px] bg-[#061A14] border border-[#17473A] rounded-2xl shadow-[0_12px_45px_rgba(0,0,0,0.85)] p-4 text-white animate-in fade-in zoom-in-95 duration-200">
          {/* Quick Presets row */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-3 border-b border-[#17473A]/80 scrollbar-none">
            <button
              type="button"
              onClick={() => applyPreset('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition shrink-0 ${
                !value.startMonth && !value.endMonth ? 'bg-[#DFC498] text-black font-bold' : 'bg-white/5 text-[#8FAEA2] hover:bg-white/10 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              type="button"
              onClick={() => applyPreset('current')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/5 text-[#8FAEA2] hover:bg-white/10 hover:text-white transition shrink-0"
            >
              Este Mês
            </button>
            <button
              type="button"
              onClick={() => applyPreset('last3')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/5 text-[#8FAEA2] hover:bg-white/10 hover:text-white transition shrink-0"
            >
              Últimos 3
            </button>
            <button
              type="button"
              onClick={() => applyPreset('last6')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/5 text-[#8FAEA2] hover:bg-white/10 hover:text-white transition shrink-0"
            >
              Últimos 6
            </button>
            <button
              type="button"
              onClick={() => applyPreset('year')}
              className="px-2.5 py-1 rounded-lg text-[11px] font-medium bg-white/5 text-[#8FAEA2] hover:bg-white/10 hover:text-white transition shrink-0"
            >
              Ano Todo
            </button>
          </div>

          {/* Year Switcher Header */}
          <div className="flex items-center justify-between px-2 mb-3">
            <button
              type="button"
              onClick={() => setViewYear(viewYear - 1)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-[#8FAEA2] hover:text-white transition"
              title="Ano anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-heading font-bold text-base tracking-wide text-[#DFC498]">
              {viewYear}
            </span>
            <button
              type="button"
              onClick={() => setViewYear(viewYear + 1)}
              className="p-1.5 rounded-lg hover:bg-white/10 text-[#8FAEA2] hover:text-white transition"
              title="Próximo ano"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* 12 Months Grid */}
          <div className="grid grid-cols-3 gap-2 mb-4">
            {MONTH_NAMES_SHORT.map((name, idx) => {
              const cellYm = getYm(viewYear, idx);
              const isStart = tempStart === cellYm;
              const isEnd = tempEnd === cellYm;
              const isInRange = tempStart && tempEnd && cellYm > tempStart && cellYm < tempEnd;
              const hasData = availableMonths.includes(cellYm);
              const isSelected = isStart || isEnd;

              return (
                <button
                  key={cellYm}
                  type="button"
                  onClick={() => handleMonthClick(cellYm)}
                  className={`relative py-2.5 px-2 rounded-xl text-xs font-semibold transition flex flex-col items-center justify-center ${
                    isSelected
                      ? 'bg-[#DFC498] text-[#051611] font-bold shadow-md scale-102'
                      : isInRange
                      ? 'bg-[#DFC498]/20 text-[#DFC498] border border-[#DFC498]/40'
                      : 'bg-black/30 text-zinc-300 hover:bg-white/10 hover:text-white border border-transparent'
                  }`}
                >
                  <span>{name}</span>
                  {/* Indicator dot if data exists for this month */}
                  {hasData && (
                    <span
                      className={`w-1.5 h-1.5 rounded-full mt-1 ${
                        isSelected ? 'bg-[#051611]' : 'bg-[#DFC498]'
                      }`}
                      title="Possui relatórios/dados computados"
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Current Selection Summary & Actions */}
          <div className="pt-3 border-t border-[#17473A]/80 flex items-center justify-between text-xs">
            <div className="text-[11px] text-[#8FAEA2] truncate pr-2">
              {tempStart && !tempEnd && (
                <span>Início: <strong className="text-white">{formatMonthYearLabel(tempStart)}</strong> (clique no fim)</span>
              )}
              {tempStart && tempEnd && tempStart === tempEnd && (
                <span>Mês: <strong className="text-white">{formatMonthYearLabel(tempStart)}</strong></span>
              )}
              {tempStart && tempEnd && tempStart !== tempEnd && (
                <span>De <strong className="text-white">{formatMonthYearLabel(tempStart)}</strong> até <strong className="text-white">{formatMonthYearLabel(tempEnd)}</strong></span>
              )}
              {!tempStart && !tempEnd && (
                <span className="italic text-zinc-400">Clique para selecionar o mês</span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-7 text-[11px] text-zinc-400 hover:text-white px-2"
              >
                Limpar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleApply}
                className="h-7 text-[11px] bg-[#DFC498] hover:bg-[#C5A880] text-black font-bold px-3 rounded-lg"
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
