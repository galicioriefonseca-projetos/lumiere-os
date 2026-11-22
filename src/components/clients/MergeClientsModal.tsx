import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import {
  AlertCircle,
  ArrowLeftRight,
  CheckCircle2,
  GitMerge,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type { Client } from '@/types';
import {
  DuplicateClientPair,
  mergeClientsApi,
} from '@/services/clientsService';
import { cn } from '@/lib/utils';

interface MergeClientsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  salonId: string;
  clients: Client[];
  duplicatePairs: DuplicateClientPair[];
}

export const MergeClientsModal: React.FC<MergeClientsModalProps> = ({
  open,
  onOpenChange,
  salonId,
  clients,
  duplicatePairs,
}) => {
  const activeClients = useMemo(
    () =>
      clients
        .filter((c) => !c.deletedAt && !c.archived && c.status !== 'inactive')
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [clients]
  );

  const [primaryId, setPrimaryId] = useState('');
  const [secondaryId, setSecondaryId] = useState('');
  const [merging, setMerging] = useState(false);

  // Field choices: 'primary' | 'secondary' | 'combine' (for notes)
  const [pickName, setPickName] = useState<'primary' | 'secondary'>('primary');
  const [pickPhone, setPickPhone] = useState<'primary' | 'secondary'>('primary');
  const [pickEmail, setPickEmail] = useState<'primary' | 'secondary'>('primary');
  const [pickBirthDate, setPickBirthDate] = useState<'primary' | 'secondary'>('primary');
  const [pickCpf, setPickCpf] = useState<'primary' | 'secondary'>('primary');

  useEffect(() => {
    if (!open) return;
    if (duplicatePairs.length > 0) {
      setPrimaryId(duplicatePairs[0].primary.id);
      setSecondaryId(duplicatePairs[0].secondary.id);
    } else {
      setPrimaryId('');
      setSecondaryId('');
    }
    setPickName('primary');
    setPickPhone('primary');
    setPickEmail('primary');
    setPickBirthDate('primary');
    setPickCpf('primary');
  }, [open, duplicatePairs]);

  const primaryClient = useMemo(
    () => activeClients.find((c) => c.id === primaryId) || null,
    [activeClients, primaryId]
  );
  const secondaryClient = useMemo(
    () => activeClients.find((c) => c.id === secondaryId) || null,
    [activeClients, secondaryId]
  );

  const handleSwap = () => {
    setPrimaryId(secondaryId);
    setSecondaryId(primaryId);
  };

  const handleLoadPair = (pair: DuplicateClientPair) => {
    setPrimaryId(pair.primary.id);
    setSecondaryId(pair.secondary.id);
    setPickName('primary');
    setPickPhone(pair.primary.phone ? 'primary' : 'secondary');
    setPickEmail(pair.primary.email ? 'primary' : 'secondary');
    setPickBirthDate(pair.primary.birthDate ? 'primary' : 'secondary');
    setPickCpf(pair.primary.cpf ? 'primary' : 'secondary');
  };

  const handleMerge = async () => {
    if (!salonId || !primaryClient || !secondaryClient) {
      toast.error('Selecione os dois cadastros para unificar.');
      return;
    }
    if (primaryClient.id === secondaryClient.id) {
      toast.error('Selecione dois cadastros diferentes.');
      return;
    }

    const chosenName =
      (pickName === 'primary' ? primaryClient.name : secondaryClient.name) || primaryClient.name;
    const chosenPhone =
      (pickPhone === 'primary' ? primaryClient.phone : secondaryClient.phone) ||
      primaryClient.phone ||
      secondaryClient.phone ||
      '';
    const otherPhone = chosenPhone === primaryClient.phone ? secondaryClient.phone : primaryClient.phone;
    const secondaryPhone =
      primaryClient.secondaryPhone ||
      secondaryClient.secondaryPhone ||
      (otherPhone && otherPhone !== chosenPhone ? otherPhone : '');
    const chosenEmail =
      (pickEmail === 'primary' ? primaryClient.email : secondaryClient.email) ||
      primaryClient.email ||
      secondaryClient.email ||
      '';
    const chosenBirthDate =
      (pickBirthDate === 'primary' ? primaryClient.birthDate : secondaryClient.birthDate) ||
      primaryClient.birthDate ||
      secondaryClient.birthDate ||
      '';
    const chosenCpf =
      (pickCpf === 'primary' ? primaryClient.cpf : secondaryClient.cpf) ||
      primaryClient.cpf ||
      secondaryClient.cpf ||
      '';

    const combinedNotes = [primaryClient.notes?.trim(), secondaryClient.notes?.trim()]
      .filter((v, idx, arr) => Boolean(v) && arr.indexOf(v) === idx)
      .join('\n---\n');

    setMerging(true);
    try {
      const res = await mergeClientsApi(
        {
          salonId,
          primaryClientId: primaryClient.id,
          secondaryClientId: secondaryClient.id,
          resolvedFields: {
            name: chosenName,
            phone: chosenPhone,
            secondaryPhone,
            email: chosenEmail,
            gender: primaryClient.gender || secondaryClient.gender || '',
            birthDate: chosenBirthDate,
            cpf: chosenCpf,
            rg: primaryClient.rg || secondaryClient.rg || '',
            notes: combinedNotes,
            address: {
              ...(secondaryClient.address || {}),
              ...(primaryClient.address || {}),
            },
          },
        },
        clients
      );

      toast.success(
        `Cadastros unificados! ${res.migratedAppointments} agendamento(s) e ${res.migratedComandas} comanda(s) vinculados ao perfil principal.`
      );
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao unificar cadastros.');
    } finally {
      setMerging(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[740px] bg-[#0c0c0e] border border-zinc-800 text-zinc-100 p-0 overflow-hidden shadow-2xl max-h-[92vh] flex flex-col">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-zinc-800 bg-[#121215] shrink-0">
          <DialogTitle className="font-heading text-lg font-medium text-white flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-[#D4AF37]" />
            Unificação Inteligente de Cadastros Duplicados
          </DialogTitle>
          <p className="text-xs text-zinc-400 mt-1">
            Mescle fichas repetidas preservando histórico de agendamentos, comandas, prontuário, anamnese e saldo do cliente.
          </p>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Automatic duplicate radar */}
          {duplicatePairs.length > 0 && (
            <div className="bg-[#121215] border border-[#D4AF37]/30 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#D4AF37] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  Radar Automático: {duplicatePairs.length}{' '}
                  {duplicatePairs.length === 1
                    ? 'possível duplicidade encontrada'
                    : 'possíveis duplicidades encontradas'}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto pr-1">
                {duplicatePairs.slice(0, 8).map((pair) => {
                  const isCurrent =
                    (primaryId === pair.primary.id && secondaryId === pair.secondary.id) ||
                    (primaryId === pair.secondary.id && secondaryId === pair.primary.id);
                  return (
                    <button
                      key={pair.id}
                      type="button"
                      onClick={() => handleLoadPair(pair)}
                      className={cn(
                        'text-left p-2.5 rounded-lg border transition-colors cursor-pointer',
                        isCurrent
                          ? 'bg-[#D4AF37]/15 border-[#D4AF37] text-white'
                          : 'bg-[#0c0c0e] border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      )}
                    >
                      <div className="text-xs font-semibold truncate">
                        {pair.primary.name} ↔ {pair.secondary.name}
                      </div>
                      <div className="text-[11px] text-zinc-400 mt-0.5 truncate">
                        {pair.reasons.join(' · ')}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Primary & Secondary selector row */}
          <div className="grid grid-cols-1 sm:grid-cols-11 gap-3 items-end">
            <div className="sm:col-span-5 space-y-1.5">
              <Label className="text-xs text-emerald-400 font-semibold">
                Cadastro Principal (Será mantido)
              </Label>
              <Select value={primaryId} onValueChange={setPrimaryId}>
                <SelectTrigger className="bg-[#121215] border-zinc-800 text-white text-xs">
                  <SelectValue placeholder="Selecione o cadastro principal" />
                </SelectTrigger>
                <SelectContent className="bg-[#121215] border-zinc-800 text-white max-h-72">
                  {activeClients.map((c) => (
                    <SelectItem key={c.id} value={c.id} disabled={c.id === secondaryId}>
                      {c.name} {c.phone ? `· ${c.phone}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="sm:col-span-1 flex justify-center">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleSwap}
                disabled={!primaryId || !secondaryId}
                className="border-zinc-800 bg-[#121215] hover:bg-zinc-800 text-zinc-300 h-9 w-9"
                title="Inverter principal e secundário"
              >
                <ArrowLeftRight className="w-4 h-4" />
              </Button>
            </div>

            <div className="sm:col-span-5 space-y-1.5">
              <Label className="text-xs text-amber-400 font-semibold">
                Cadastro Secundário (Será mesclado)
              </Label>
              <Select value={secondaryId} onValueChange={setSecondaryId}>
                <SelectTrigger className="bg-[#121215] border-zinc-800 text-white text-xs">
                  <SelectValue placeholder="Selecione o cadastro duplicado" />
                </SelectTrigger>
                <SelectContent className="bg-[#121215] border-zinc-800 text-white max-h-72">
                  {activeClients.map((c) => (
                    <SelectItem key={c.id} value={c.id} disabled={c.id === primaryId}>
                      {c.name} {c.phone ? `· ${c.phone}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Side-by-side comparison */}
          {primaryClient && secondaryClient && (
            <div className="border border-zinc-800 rounded-xl overflow-hidden bg-[#121215]">
              <div className="px-4 py-2.5 bg-[#18181c] border-b border-zinc-800 text-xs font-semibold text-zinc-300 flex items-center justify-between">
                <span>Escolha qual informação prevalece no cadastro unificado</span>
                <span className="text-[11px] text-zinc-400">
                  Agendamentos, comandas e histórico serão somados
                </span>
              </div>

              <div className="divide-y divide-zinc-800/70 text-xs">
                {(
                  [
                    {
                      label: 'Nome Completo',
                      pVal: primaryClient.name || '—',
                      sVal: secondaryClient.name || '—',
                      state: pickName,
                      setter: setPickName,
                    },
                    {
                      label: 'Celular Principal',
                      pVal: primaryClient.phone || '—',
                      sVal: secondaryClient.phone || '—',
                      state: pickPhone,
                      setter: setPickPhone,
                    },
                    {
                      label: 'E-mail',
                      pVal: primaryClient.email || '—',
                      sVal: secondaryClient.email || '—',
                      state: pickEmail,
                      setter: setPickEmail,
                    },
                    {
                      label: 'Aniversário',
                      pVal: primaryClient.birthDate || '—',
                      sVal: secondaryClient.birthDate || '—',
                      state: pickBirthDate,
                      setter: setPickBirthDate,
                    },
                    {
                      label: 'CPF',
                      pVal: primaryClient.cpf || '—',
                      sVal: secondaryClient.cpf || '—',
                      state: pickCpf,
                      setter: setPickCpf,
                    },
                  ] as const
                ).map((row) => (
                  <div key={row.label} className="grid grid-cols-12 items-center p-3 gap-2">
                    <div className="col-span-3 text-zinc-400 font-medium">{row.label}</div>
                    <button
                      type="button"
                      onClick={() => row.setter('primary')}
                      className={cn(
                        'col-span-4 text-left px-2.5 py-1.5 rounded-lg border truncate cursor-pointer transition-colors',
                        row.state === 'primary'
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200 font-semibold'
                          : 'bg-[#0c0c0e] border-zinc-800 text-zinc-400'
                      )}
                    >
                      {row.pVal}
                    </button>
                    <div className="col-span-1 text-center text-zinc-600">vs</div>
                    <button
                      type="button"
                      onClick={() => row.setter('secondary')}
                      className={cn(
                        'col-span-4 text-left px-2.5 py-1.5 rounded-lg border truncate cursor-pointer transition-colors',
                        row.state === 'secondary'
                          ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200 font-semibold'
                          : 'bg-[#0c0c0e] border-zinc-800 text-zinc-400'
                      )}
                    >
                      {row.sVal}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-200 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <span>
              Após confirmar, o cadastro secundário será desativado e todas as visitas, comandas, observações e tags passarão automaticamente para o cadastro principal.
            </span>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-zinc-800 bg-[#121215] flex justify-end gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            disabled={merging}
            onClick={() => onOpenChange(false)}
            className="border-zinc-800 text-zinc-300 hover:bg-zinc-800"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={merging || !primaryClient || !secondaryClient}
            onClick={handleMerge}
            className="bg-[#D4AF37] hover:bg-[#D4AF37]/90 text-black font-semibold px-6"
          >
            {merging ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                Unificando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-1.5" />
                Salvar Unificação
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
