import { InventoryItem, StockLocation } from '@/types';

export const STOCK_LOCATION_OPTIONS: Array<{ value: StockLocation; label: string }> = [
  { value: 'resale', label: 'Revenda / Home Care' },
  { value: 'internal_use', label: 'Uso Técnico / Lavatório' },
  { value: 'warehouse', label: 'Almoxarifado Central' },
  { value: 'mixed', label: 'Uso Misto (Técnico e Revenda)' },
];

export const STOCK_LOCATION_LABELS: Record<StockLocation, string> = {
  resale: 'Revenda / Home Care',
  internal_use: 'Uso Técnico / Lavatório',
  warehouse: 'Almoxarifado',
  mixed: 'Uso Misto',
};

export const PRODUCT_CATEGORIES: string[] = [
  'Uso Técnico Clínico',
  'Home Care / Revenda',
  'Coloração e Química',
  'Tratamento Capilar',
  'Estética e Pele',
  'Manicure e Unhas',
  'Descartáveis e Higiene',
  'Equipamentos e Acessórios',
];

export const PRODUCT_UNITS: string[] = ['un', 'ml', 'g', 'kg', 'L', 'cx', 'par', 'kit'];

export type ExpirationHealth = 'none' | 'expired' | 'expiring_soon' | 'valid';

export function getExpirationHealth(dateStr?: string): {
  status: ExpirationHealth;
  daysLeft: number | null;
  label: string;
} {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
    return { status: 'none', daysLeft: null, label: 'Sem validade' };
  }
  const clean = dateStr.substring(0, 10);
  const [y, m, d] = clean.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const formatted = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;

  if (diffDays < 0) {
    return { status: 'expired', daysLeft: diffDays, label: `Vencido (${formatted})` };
  }
  if (diffDays <= 30) {
    return { status: 'expiring_soon', daysLeft: diffDays, label: `Vence em ${diffDays}d (${formatted})` };
  }
  return { status: 'valid', daysLeft: diffDays, label: formatted };
}

export function getStockHealth(item: InventoryItem): {
  status: 'out' | 'critical' | 'ok';
  suggestedOrderQty: number;
} {
  const qty = Number(item.quantity || 0);
  const min = Number(item.minQuantity || 0);
  const ideal = Number(item.idealQuantity || Math.max(min * 2, min + 5));
  const suggestedOrderQty = qty <= min ? Math.max(1, ideal - qty) : 0;

  if (qty <= 0) {
    return { status: 'out', suggestedOrderQty };
  }
  if (qty <= min) {
    return { status: 'critical', suggestedOrderQty };
  }
  return { status: 'ok', suggestedOrderQty: 0 };
}

export function formatDateBR(dateStr?: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return '-';
  const [y, m, d] = dateStr.substring(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
