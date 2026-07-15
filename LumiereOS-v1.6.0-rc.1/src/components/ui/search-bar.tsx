import * as React from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export interface SearchBarProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  containerClassName?: string;
  showClearText?: boolean;
}

export function SearchBar({
  value,
  onChange,
  placeholder = "Buscar...",
  className,
  containerClassName,
  showClearText = false,
  ...props
}: SearchBarProps) {
  return (
    <div className={cn("relative", containerClassName)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("pl-9", value ? (showClearText ? "pr-14" : "pr-9") : "pr-4", className)}
        {...props}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground flex items-center justify-center p-1 rounded-sm"
        >
          {showClearText ? "Limpar" : <X className="w-3.5 h-3.5" />}
        </button>
      )}
    </div>
  );
}
