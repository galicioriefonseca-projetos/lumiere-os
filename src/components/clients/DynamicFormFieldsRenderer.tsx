import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ClientCustomField, ClientFormResponseValue } from '@/types';
import { cn } from '@/lib/utils';

interface DynamicFormFieldsRendererProps {
  fields: ClientCustomField[];
  values: Record<string, ClientFormResponseValue>;
  onChange: (slug: string, value: ClientFormResponseValue) => void;
  disabled?: boolean;
  theme?: 'dark' | 'light';
}

export const DynamicFormFieldsRenderer: React.FC<DynamicFormFieldsRendererProps> = ({
  fields,
  values,
  onChange,
  disabled = false,
  theme = 'dark',
}) => {
  const isLight = theme === 'light';
  const inputCls = isLight
    ? 'bg-white border-[#E5E2DC] text-[#171717] rounded-lg'
    : 'bg-[#121215] border-zinc-800 text-zinc-100 rounded-lg';
  const labelCls = isLight ? 'text-xs font-medium text-[#171717]' : 'text-xs font-medium text-zinc-200';
  const textareaCls = isLight
    ? 'w-full rounded-lg border border-[#E5E2DC] bg-white p-3 text-xs text-[#171717] focus:outline-none focus:border-[#B89B5E]'
    : 'w-full rounded-lg border border-zinc-800 bg-[#121215] p-3 text-sm text-zinc-100 focus:outline-none focus:border-[#D4AF37]/60';

  const activeFields = fields.filter((f) => f.isActive !== false);

  return (
    <div className="space-y-4">
      {activeFields.map((field) => {
        const currentRaw = values[field.slug] ?? field.defaultValue ?? '';
        const stringVal = String(currentRaw ?? '');

        return (
          <div key={field.id} className="space-y-1.5">
            <Label className={cn(labelCls, 'flex items-center gap-1')}>
              <span>{field.label}</span>
              {field.required && <span className="text-rose-500">*</span>}
            </Label>

            {field.type === 'text' && (
              <Input
                value={stringVal}
                disabled={disabled}
                required={field.required}
                placeholder={field.placeholder || 'Digite a resposta...'}
                onChange={(e) => onChange(field.slug, e.target.value)}
                className={inputCls}
              />
            )}

            {field.type === 'textarea' && (
              <textarea
                rows={3}
                value={stringVal}
                disabled={disabled}
                required={field.required}
                placeholder={field.placeholder || 'Descreva os detalhes...'}
                onChange={(e) => onChange(field.slug, e.target.value)}
                className={textareaCls}
              />
            )}

            {field.type === 'number' && (
              <Input
                type="number"
                value={stringVal}
                disabled={disabled}
                required={field.required}
                placeholder={field.placeholder || '0'}
                onChange={(e) => onChange(field.slug, e.target.value)}
                className={cn(inputCls, 'tabular-nums')}
              />
            )}

            {field.type === 'date' && (
              <Input
                type="date"
                value={stringVal}
                disabled={disabled}
                required={field.required}
                onChange={(e) => onChange(field.slug, e.target.value)}
                className={inputCls}
              />
            )}

            {field.type === 'select' && (
              <Select
                disabled={disabled}
                value={stringVal || '__empty__'}
                onValueChange={(val) => onChange(field.slug, val === '__empty__' ? '' : val)}
              >
                <SelectTrigger className={inputCls}>
                  <SelectValue placeholder="Selecione uma opção..." />
                </SelectTrigger>
                <SelectContent
                  className={
                    isLight
                      ? 'bg-white border-[#E5E2DC] text-[#171717]'
                      : 'bg-[#121215] border-zinc-800 text-zinc-100'
                  }
                >
                  <SelectItem value="__empty__">Selecione...</SelectItem>
                  {(field.options || []).map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {field.type === 'boolean' && (
              <div className="grid grid-cols-2 gap-2">
                {[
                  { val: true, label: 'Sim' },
                  { val: false, label: 'Não' },
                ].map((opt) => {
                  const boolCurrent =
                    currentRaw === true || currentRaw === 'true' || currentRaw === 'Sim';
                  const isSelected =
                    currentRaw !== '' && currentRaw !== undefined && boolCurrent === opt.val;
                  return (
                    <button
                      key={String(opt.val)}
                      type="button"
                      disabled={disabled}
                      onClick={() => onChange(field.slug, opt.val)}
                      className={cn(
                        'h-9 rounded-lg border text-xs font-semibold transition-colors cursor-pointer',
                        isSelected
                          ? isLight
                            ? 'bg-[#171717] border-[#171717] text-white'
                            : 'bg-[#D4AF37]/15 border-[#D4AF37] text-[#D4AF37]'
                          : isLight
                            ? 'bg-white border-[#E5E2DC] text-[#6B6B6B] hover:text-[#171717]'
                            : 'bg-[#121215] border-zinc-800 text-zinc-400 hover:text-zinc-200'
                      )}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
