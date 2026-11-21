import type { ClientGender } from '@/types';

export const CLIENT_GENDER_OPTIONS: ReadonlyArray<{
  value: ClientGender;
  label: string;
}> = [
  { value: 'female', label: 'Feminino' },
  { value: 'male', label: 'Masculino' },
  { value: 'other', label: 'Outro' },
  { value: 'prefer_not_to_say', label: 'Prefere não informar' },
];

export function normalizeClientGender(raw?: string | null): ClientGender | '' {
  if (!raw) return '';
  const cleaned = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

  if (!cleaned) return '';

  if (
    cleaned === 'f' ||
    cleaned === 'fem' ||
    cleaned.includes('feminin') ||
    cleaned.includes('female') ||
    cleaned.includes('mulher')
  ) {
    return 'female';
  }

  if (
    cleaned === 'm' ||
    cleaned === 'masc' ||
    cleaned.includes('masculin') ||
    cleaned.includes('male') ||
    cleaned.includes('homem')
  ) {
    return 'male';
  }

  if (
    cleaned.includes('prefere nao') ||
    cleaned.includes('nao informar') ||
    cleaned.includes('prefer_not') ||
    cleaned.includes('nao informado')
  ) {
    return 'prefer_not_to_say';
  }

  if (
    cleaned === 'o' ||
    cleaned.includes('outro') ||
    cleaned.includes('other') ||
    cleaned.includes('nao bin') ||
    cleaned.includes('non-bin') ||
    cleaned.includes('divers')
  ) {
    return 'other';
  }

  return '';
}

export function getClientGenderLabel(gender?: string | null): string {
  if (!gender) return '-';
  switch (gender) {
    case 'female':
      return 'Feminino';
    case 'male':
      return 'Masculino';
    case 'other':
      return 'Outro';
    case 'prefer_not_to_say':
      return 'Prefere não informar';
    default: {
      const normalized = normalizeClientGender(gender);
      if (normalized) return getClientGenderLabel(normalized);
      return gender.trim() || '-';
    }
  }
}

export function getClientGenderBadgeClasses(gender?: string | null): string {
  switch (gender) {
    case 'female':
      return 'bg-pink-500/10 border-pink-500/25 text-pink-600 dark:text-pink-400';
    case 'male':
      return 'bg-sky-500/10 border-sky-500/25 text-sky-600 dark:text-sky-400';
    case 'other':
      return 'bg-purple-500/10 border-purple-500/25 text-purple-600 dark:text-purple-400';
    case 'prefer_not_to_say':
      return 'bg-zinc-500/10 border-zinc-500/25 text-zinc-500 dark:text-zinc-400';
    default:
      return 'bg-zinc-500/5 border-zinc-500/15 text-zinc-500';
  }
}
