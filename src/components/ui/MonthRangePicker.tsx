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
        className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl border text-xs font-semibold transition-all shadow-xs ${
          isOpen
            ? 'border-[#B89B5E] bg-[#F5F1E9] text-[#171717] ring-2 ring-[#B89B5E]/20'
            : 'border-[#E5E2DC] bg-white text-[#171717] hover:border-[#B89B5E]/60 hover:bg-[#FAF9F7]'
        }`}
      >
        <CalendarIcon className="w-4 h-4 text-[#8A6D36] shrink-0" />
        <span className="truncate max-w-[190px] sm:max-w-[260px]">{triggerLabel}</span>
        {(value.startMonth || value.endMonth) && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              handleClear();
            }}
            className="p-0.5 rounded-md hover:bg-[#E5E2DC]/60 text-[#6B6B6B] hover:text-[#171717] ml-1"
            title="Limpar filtro de data"
          >
            <X className="w-3.5 h-3.5" />
          </span>
        )}
      </button>

      {/* Popover / Mobile Bottom Sheet */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/30 z-40 sm:hidden"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed inset-x-3 bottom-4 z-50 sm:bottom-auto sm:inset-x-auto sm:absolute sm:right-0 sm:mt-2 w-auto sm:w-[360px] bg-white border border-[#E5E2DC] rounded-2xl shadow-2xl p-4 text-[#171717] animate-in fade-in zoom-in-95 duration-200">
            {/* Quick Presets row */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-3 mb-3 border-b border-[#E5E2DC] scrollbar-none">
              <button
                type="button"
                onClick={() => applyPreset('all')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition shrink-0 ${
                  !value.startMonth && !value.endMonth ? 'bg-[#171717] text-white font-bold' : 'bg-[#FAF9F7] text-[#6B6B6B] hover:bg-[#F5F1E9] hover:text-[#171717] border border-[#E5E2DC]'
                }`}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => applyPreset('current')}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-[#FAF9F7] text-[#6B6B6B] hover:bg-[#F5F1E9] hover:text-[#171717] border border-[#E5E2DC] transition shrink-0"
              >
                Este Mês
              </button>
              <button
                type="button"
                onClick={() => applyPreset('last3')}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-[#FAF9F7] text-[#6B6B6B] hover:bg-[#F5F1E9] hover:text-[#171717] border border-[#E5E2DC] transition shrink-0"
              >
                Últimos 3
              </button>
              <button
                type="button"
                onClick={() => applyPreset('last6')}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-[#FAF9F7] text-[#6B6B6B] hover:bg-[#F5F1E9] hover:text-[#171717] border border-[#E5E2DC] transition shrink-0"
              >
                Últimos 6
              </button>
              <button
                type="button"
                onClick={() => applyPreset('year')}
                className="px-2.5 py-1.5 rounded-lg text-[11px] font-medium bg-[#FAF9F7] text-[#6B6B6B] hover:bg-[#F5F1E9] hover:text-[#171717] border border-[#E5E2DC] transition shrink-0"
              >
                Ano Todo
              </button>
            </div>

            {/* Year Switcher Header */}
            <div className="flex items-center justify-between px-2 mb-3">
              <button
                type="button"
                onClick={() => setViewYear(viewYear - 1)}
                className="p-2 rounded-lg hover:bg-[#F5F1E9] text-[#6B6B6B] hover:text-[#171717] transition"
                title="Ano anterior"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-heading font-bold text-base tracking-wide text-[#8A6D36] tabular-nums">
                {viewYear}
              </span>
              <button
                type="button"
                onClick={() => setViewYear(viewYear + 1)}
                className="p-2 rounded-lg hover:bg-[#F5F1E9] text-[#6B6B6B] hover:text-[#171717] transition"
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
                        ? 'bg-[#171717] text-white font-bold shadow-xs'
                        : isInRange
                        ? 'bg-[#F5F1E9] text-[#8A6D36] border border-[#B89B5E]/40'
                        : 'bg-[#FAF9F7] text-[#171717] hover:bg-[#F5F1E9] border border-[#E5E2DC]'
                    }`}
                  >
                    <span>{name}</span>
                    {hasData && (
                      <span
                        className={`w-1.5 h-1.5 rounded-full mt-1 ${
                          isSelected ? 'bg-[#D8C79F]' : 'bg-[#B89B5E]'
                        }`}
                        title="Possui relatórios/dados computados"
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Current Selection Summary & Actions */}
            <div className="pt-3 border-t border-[#E5E2DC] flex items-center justify-between gap-2 text-xs">
              <div className="text-[11px] text-[#6B6B6B] truncate pr-1">
                {tempStart && !tempEnd && (
                  <span>Início: <strong className="text-[#171717]">{formatMonthYearLabel(tempStart)}</strong> (clique no fim)</span>
                )}
                {tempStart && tempEnd && tempStart === tempEnd && (
                  <span>Mês: <strong className="text-[#171717]">{formatMonthYearLabel(tempStart)}</strong></span>
                )}
                {tempStart && tempEnd && tempStart !== tempEnd && (
                  <span>De <strong className="text-[#171717]">{formatMonthYearLabel(tempStart)}</strong> até <strong className="text-[#171717]">{formatMonthYearLabel(tempEnd)}</strong></span>
                )}
                {!tempStart && !tempEnd && (
                  <span className="italic text-[#6B6B6B]">Clique para selecionar o mês</span>
                )}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="h-8 text-[11px] text-[#6B6B6B] hover:text-[#171717] px-2.5"
                >
                  Limpar
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={handleApply}
                  className="h-8 text-[11px] bg-[#171717] hover:bg-[#2B2B2B] text-white font-bold px-3 rounded-lg"
                >
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
