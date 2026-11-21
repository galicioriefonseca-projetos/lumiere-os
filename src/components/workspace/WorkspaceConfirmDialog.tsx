import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle, CheckCircle2, Loader2, ShieldAlert } from 'lucide-react';

export interface WorkspaceConfirmDetails {
  title: string;
  description: string;
  targetLabel?: string;
  targetName: string;
  subTargetLabel?: string;
  sheetTabName?: string;
  affectedCountLabel?: string;
  warningText?: string;
  confirmLabel: string;
  destructive?: boolean;
}

interface WorkspaceConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  details: WorkspaceConfirmDetails | null;
  loading?: boolean;
  onConfirm: () => Promise<void> | void;
}

export function WorkspaceConfirmDialog({
  open,
  onOpenChange,
  details,
  loading = false,
  onConfirm,
}: WorkspaceConfirmDialogProps) {
  if (!details) return null;

  const isDestructive = Boolean(details.destructive);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!loading) onOpenChange(nextOpen);
      }}
    >
      <DialogContent className="sm:max-w-[460px] bg-white border border-[#E5E2DC] text-[#171717] shadow-2xl">
        <DialogHeader>
          <DialogTitle className="font-heading font-semibold text-[#171717] flex items-center gap-2">
            {isDestructive ? (
              <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-[#9F844A] shrink-0" />
            )}
            {details.title}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-sm text-[#171717]">
          <p className="text-[#4A4A4A] leading-relaxed">{details.description}</p>

          <div className="rounded-xl border border-[#E5E2DC] bg-[#FAF9F7] p-3.5 space-y-1.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[#6B6B6B] font-medium">
                {details.targetLabel || 'Planilha:'}
              </span>
              <span className="font-semibold text-[#171717] truncate max-w-[260px]">
                {details.targetName}
              </span>
            </div>
            {details.sheetTabName && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#6B6B6B] font-medium">
                  {details.subTargetLabel || 'Aba de destino:'}
                </span>
                <span className="font-semibold text-[#8A6D36] truncate max-w-[260px]">
                  {details.sheetTabName}
                </span>
              </div>
            )}
            {details.affectedCountLabel && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[#6B6B6B] font-medium">Registros afetados:</span>
                <span className="font-semibold text-[#171717]">
                  {details.affectedCountLabel}
                </span>
              </div>
            )}
          </div>

          {details.warningText && (
            <div
              className={`rounded-lg border p-3 text-xs flex items-start gap-2 ${
                isDestructive
                  ? 'bg-red-50 border-red-200 text-red-700'
                  : 'bg-[#F5F1E9] border-[#D8C79F] text-[#8A6D36]'
              }`}
            >
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{details.warningText}</span>
            </div>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => onOpenChange(false)}
            className="border-[#E5E2DC] bg-white text-[#171717] hover:bg-[#F5F1E9]"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={() => void onConfirm()}
            className={
              isDestructive
                ? 'bg-red-600 hover:bg-red-700 text-white font-semibold gap-2'
                : 'bg-[#171717] hover:bg-[#2B2B2B] text-white font-semibold gap-2'
            }
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                {details.confirmLabel}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
