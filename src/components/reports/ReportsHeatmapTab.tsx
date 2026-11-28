import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Flame, Sparkles } from 'lucide-react';
import { formatBRL } from '@/lib/utils';
import {
  computeAgendaHeatmap,
  type HeatmapCell,
  type HeatmapFilters,
} from '@/services/reportsEngine';
import type { Appointment, Professional, Service } from '@/types';

interface ReportsHeatmapTabProps {
  appointments: Appointment[];
  professionals: Professional[];
  services: Service[];
  defaultStartDate: string;
  defaultEndDate: string;
}

function getThermalCellStyle(intensity: number, isZero: boolean): { bg: string; text: string } {
  if (isZero || intensity <= 0) {
    return { bg: '#FAF9F7', text: '#6B6B6B' };
  }
  if (intensity < 0.25) {
    return { bg: '#E6F4EA', text: '#14532D' };
  }
  if (intensity < 0.5) {
    return { bg: '#FEF3C7', text: '#78350F' };
  }
  if (intensity < 0.75) {
    return { bg: '#FDBA74', text: '#7C2D12' };
  }
  return { bg: '#DC2626', text: '#FFFFFF' };
}

export function ReportsHeatmapTab({
  appointments,
  professionals,
  services,
  defaultStartDate,
  defaultEndDate,
}: ReportsHeatmapTabProps) {
  const [filters, setFilters] = useState<HeatmapFilters>({
    startDate: defaultStartDate,
    endDate: defaultEndDate,
    professionalId: 'all',
    serviceId: 'all',
    metric: 'count',
    intervalMinutes: 60,
  });
  const [selectedCell, setSelectedCell] = useState<HeatmapCell | null>(null);

  const heatmap = useMemo(
    () => computeAgendaHeatmap(appointments, services, filters),
    [appointments, services, filters]
  );

  return (
    <div className="space-y-5">
      {/* Filters Bar */}
      <div className="rounded-xl border border-[#E5E2DC] bg-white p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-[11px] font-medium text-[#6B6B6B] mb-1">
              Data Início
            </label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((f) => ({ ...f, startDate: e.target.value }))}
              className="w-full h-10 rounded-lg border border-[#E5E2DC] bg-white px-2.5 text-xs text-[#171717] tabular-nums"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#6B6B6B] mb-1">
              Data Fim
            </label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((f) => ({ ...f, endDate: e.target.value }))}
              className="w-full h-10 rounded-lg border border-[#E5E2DC] bg-white px-2.5 text-xs text-[#171717] tabular-nums"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#6B6B6B] mb-1">
              Profissional
            </label>
            <select
              value={filters.professionalId}
              onChange={(e) => setFilters((f) => ({ ...f, professionalId: e.target.value }))}
              className="w-full h-10 rounded-lg border border-[#E5E2DC] bg-white px-2.5 text-xs text-[#171717]"
            >
              <option value="all">Todos</option>
              {professionals.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#6B6B6B] mb-1">
              Serviço
            </label>
            <select
              value={filters.serviceId}
              onChange={(e) => setFilters((f) => ({ ...f, serviceId: e.target.value }))}
              className="w-full h-10 rounded-lg border border-[#E5E2DC] bg-white px-2.5 text-xs text-[#171717]"
            >
              <option value="all">Todos</option>
              {services.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#6B6B6B] mb-1">
              Tipo de Métrica
            </label>
            <select
              value={filters.metric}
              onChange={(e) =>
                setFilters((f) => ({ ...f, metric: e.target.value as 'count' | 'revenue' }))
              }
              className="w-full h-10 rounded-lg border border-[#E5E2DC] bg-white px-2.5 text-xs text-[#171717]"
            >
              <option value="count">Número de Agendamentos</option>
              <option value="revenue">Faturamento (R$)</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#6B6B6B] mb-1">
              Intervalo
            </label>
            <select
              value={filters.intervalMinutes}
              onChange={(e) =>
                setFilters((f) => ({
                  ...f,
                  intervalMinutes: Number(e.target.value) === 30 ? 30 : 60,
                }))
              }
              className="w-full h-10 rounded-lg border border-[#E5E2DC] bg-white px-2.5 text-xs text-[#171717]"
            >
              <option value={60}>60 minutos</option>
              <option value={30}>30 minutos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Executive Insights Strip: Peaks & Idle Windows */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#E5E2DC] bg-white p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-[#171717] flex items-center gap-1.5">
              <Flame className="w-4 h-4 text-[#DC2626]" />
              Top 3 Horários de Pico
            </h3>
            <span className="text-[11px] text-[#6B6B6B] tabular-nums">
              {heatmap.totalCount} agendamento(s) · {formatBRL(heatmap.totalRevenue)}
            </span>
          </div>
          {heatmap.topPeakSlots.length === 0 ? (
            <p className="text-xs text-[#6B6B6B]">
              Sem movimentação suficiente para identificar picos neste intervalo.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {heatmap.topPeakSlots.map((slot) => (
                <div
                  key={slot.label}
                  className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] px-3 py-2"
                >
                  <p className="text-xs font-semibold text-[#171717]">{slot.label}</p>
                  <p className="text-[11px] text-[#4A4A4A] tabular-nums">
                    {slot.count} agend. · {formatBRL(slot.revenue)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#E5E2DC] bg-white p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-[#171717]">
              Janelas Ociosas (Ter–Sex · 09h às 18h)
            </h3>
            <Link
              to="/dashboard/lumi-ia"
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#8A6D36] hover:underline"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Criar Promoção na Lumi IA
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {heatmap.idleWindows.map((slot) => (
              <div
                key={slot.label}
                className="rounded-lg border border-[#E5E2DC] bg-[#FAF9F7] px-3 py-2"
              >
                <p className="text-xs font-semibold text-[#171717]">{slot.label}</p>
                <p className="text-[11px] text-[#6B6B6B] tabular-nums">
                  {slot.count} {slot.count === 1 ? 'horário' : 'horários'}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend + Selected Cell Inspection */}
      <div className="rounded-xl border border-[#E5E2DC] bg-white p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-[#6B6B6B]">
            <span>Intensidade:</span>
            <span className="px-2 py-0.5 rounded bg-[#FAF9F7] border border-[#E5E2DC] text-[#6B6B6B]">
              0
            </span>
            <span className="px-2 py-0.5 rounded bg-[#E6F4EA] text-[#14532D]">Baixa</span>
            <span className="px-2 py-0.5 rounded bg-[#FEF3C7] text-[#78350F]">Média</span>
            <span className="px-2 py-0.5 rounded bg-[#FDBA74] text-[#7C2D12]">Alta</span>
            <span className="px-2 py-0.5 rounded bg-[#DC2626] text-white">Pico</span>
          </div>

          {selectedCell && (
            <p className="text-xs text-[#171717] tabular-nums">
              Selecionado:{' '}
              <strong>
                {heatmap.days[selectedCell.dayIndex]?.fullLabel} às {selectedCell.slot}
              </strong>{' '}
              · {selectedCell.count} agendamento(s) · {formatBRL(selectedCell.revenue)}
            </p>
          )}
        </div>

        {/* Thermal Grid Matrix */}
        <div className="overflow-x-auto border border-[#E5E2DC] rounded-lg">
          <table className="w-full min-w-[680px] border-collapse text-xs">
            <thead className="bg-[#FAF9F7] border-b border-[#E5E2DC]">
              <tr>
                <th className="sticky left-0 z-10 bg-[#FAF9F7] py-2.5 px-3 text-left font-semibold text-[#6B6B6B] border-r border-[#E5E2DC] w-20">
                  Horário
                </th>
                {heatmap.days.map((day) => (
                  <th
                    key={day.index}
                    className="py-2.5 px-2 text-center font-semibold text-[#171717]"
                  >
                    {day.shortLabel}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E2DC]">
              {heatmap.slots.map((slot) => (
                <tr key={slot}>
                  <td className="sticky left-0 z-10 bg-[#FAF9F7] py-2 px-3 font-mono font-semibold text-[#4A4A4A] border-r border-[#E5E2DC] tabular-nums">
                    {slot}
                  </td>
                  {heatmap.days.map((day) => {
                    const cell = heatmap.cells[`${day.index}_${slot}`];
                    const isZero = !cell || cell.value <= 0;
                    const style = getThermalCellStyle(cell?.intensity || 0, isZero);
                    const displayValue = isZero
                      ? '0'
                      : filters.metric === 'revenue'
                        ? `R$${Math.round(cell.revenue)}`
                        : String(cell.count);

                    return (
                      <td key={day.index} className="p-1">
                        <button
                          type="button"
                          onClick={() => cell && setSelectedCell(cell)}
                          title={`${day.fullLabel} ${slot} · ${cell?.count || 0} agendamentos · ${formatBRL(
                            cell?.revenue || 0
                          )}`}
                          style={{ backgroundColor: style.bg, color: style.text }}
                          className="w-full min-h-[34px] rounded px-1.5 py-1 text-center font-semibold tabular-nums transition-opacity hover:opacity-85"
                        >
                          {displayValue}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
