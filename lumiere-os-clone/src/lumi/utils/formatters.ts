/**
 * Formats a numeric value into Brazilian Real (BRL).
 */
export function formatBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formats a decimal percentage to standard display string.
 */
export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}

/**
 * Determines a high-contrast premium Tailwind color grade based on Health Score ranges.
 */
export function getHealthScoreColor(score: number): {
  bg: string;
  text: string;
  border: string;
  fill: string;
} {
  if (score >= 85) {
    return {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-400',
      border: 'border-emerald-500/20',
      fill: 'stroke-emerald-500',
    };
  }
  if (score >= 70) {
    return {
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/20',
      fill: 'stroke-amber-500',
    };
  }
  if (score >= 50) {
    return {
      bg: 'bg-orange-500/10',
      text: 'text-orange-400',
      border: 'border-orange-500/20',
      fill: 'stroke-orange-500',
    };
  }
  return {
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/20',
    fill: 'stroke-rose-500',
  };
}

/**
 * Returns a high-end corporate description for a Health Score level.
 */
export function getHealthScoreLabel(score: number): string {
  if (score >= 85) return 'Excelente (Operação Otimizada)';
  if (score >= 70) return 'Estável (Ritmo Constante)';
  if (score >= 50) return 'Atenção (Gargalos Identificados)';
  return 'Crítico (Ação Urgente Necessária)';
}
