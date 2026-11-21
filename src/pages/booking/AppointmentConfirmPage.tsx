import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  Scissors,
  User,
  MapPin,
  Loader2,
  Sparkles,
  Phone,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  getPublicConfirmInfo,
  PublicConfirmInfo,
  submitPublicConfirmation,
} from '@/services/appointmentsService';
import { formatBRL } from '@/lib/utils';

function formatDatePtBR(ymd?: string): string {
  if (!ymd) return '-';
  const parts = ymd.substring(0, 10).split('-');
  if (parts.length !== 3) return ymd;
  const dateObj = new Date(`${ymd.substring(0, 10)}T12:00:00`);
  const weekday = !isNaN(dateObj.getTime())
    ? dateObj.toLocaleDateString('pt-BR', { weekday: 'long' })
    : '';
  return `${weekday ? `${weekday}, ` : ''}${parts[2]}/${parts[1]}/${parts[0]}`;
}

export default function AppointmentConfirmPage() {
  const [searchParams] = useSearchParams();
  const salonId = searchParams.get('salon') || '';
  const appointmentId = searchParams.get('id') || '';
  const token = searchParams.get('token') || '';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<PublicConfirmInfo | null>(null);
  const [showCancelReason, setShowCancelReason] = useState(false);
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!salonId || !appointmentId || !token) {
        setError('Link de confirmação incompleto ou inválido.');
        setLoading(false);
        return;
      }
      try {
        const res = await getPublicConfirmInfo(salonId, appointmentId, token);
        if (active) setInfo(res);
      } catch (err: unknown) {
        if (active) {
          setError(err instanceof Error ? err.message : 'Agendamento não localizado.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [salonId, appointmentId, token]);

  const handleDecision = async (decision: 'confirm' | 'cancel') => {
    if (!info) return;
    try {
      setSubmitting(true);
      const res = await submitPublicConfirmation({
        salonId,
        appointmentId,
        token,
        decision,
        reason: decision === 'cancel' ? cancelReason.trim() || undefined : undefined,
      });
      setInfo({
        ...info,
        status: res.status,
        confirmationStatus: res.confirmationStatus,
        confirmedAt: decision === 'confirm' ? Date.now() : info.confirmedAt,
      });
      setShowCancelReason(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao registrar resposta.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F6F5F2] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white border border-[#E5E2DC] rounded-3xl shadow-sm overflow-hidden">
        <div className="bg-[#FAF9F7] border-b border-[#E5E2DC] px-6 py-5 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-[#8A6D36] font-semibold">
              <Sparkles className="w-3.5 h-3.5" />
              Confirmação de Horário
            </div>
            <h1 className="text-lg font-heading font-semibold text-[#171717] mt-1">
              {info?.salonName || 'LumièreOS'}
            </h1>
          </div>
          {info?.status === 'confirmed' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 border border-emerald-300 text-emerald-800 text-xs font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Confirmado
            </span>
          )}
          {info?.status === 'canceled' && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 border border-rose-300 text-rose-800 text-xs font-semibold">
              <XCircle className="w-3.5 h-3.5" /> Cancelado
            </span>
          )}
        </div>

        <div className="p-6 space-y-5">
          {loading ? (
            <div className="py-12 flex flex-col items-center gap-3 text-[#6B6B6B]">
              <Loader2 className="w-8 h-8 animate-spin text-[#B89B5E]" />
              <p className="text-sm">Carregando detalhes do seu horário...</p>
            </div>
          ) : error ? (
            <div className="py-8 text-center space-y-3">
              <XCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <p className="text-sm font-medium text-[#171717]">{error}</p>
              <p className="text-xs text-[#6B6B6B]">
                Caso precise de ajuda, entre em contato diretamente com o estabelecimento pelo WhatsApp.
              </p>
            </div>
          ) : info ? (
            <>
              <div className="space-y-1">
                <p className="text-sm text-[#6B6B6B]">
                  Olá, <span className="font-semibold text-[#171717]">{info.clientFirstName}</span>!
                </p>
                <p className="text-xs text-[#6B6B6B]">
                  Confira abaixo os dados do seu atendimento e confirme sua presença com um toque.
                </p>
              </div>

              <div className="bg-[#FAF9F7] border border-[#E5E2DC] rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <Calendar className="w-4 h-4 text-[#8A6D36] mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-[#6B6B6B] block">Data</span>
                    <span className="text-sm font-semibold text-[#171717] capitalize">
                      {formatDatePtBR(info.date)}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clock className="w-4 h-4 text-[#8A6D36] mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-[#6B6B6B] block">Horário</span>
                    <span className="text-sm font-semibold text-[#171717] tabular-nums">
                      {info.time} ({info.durationMinutes} min)
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Scissors className="w-4 h-4 text-[#8A6D36] mt-0.5 shrink-0" />
                  <div className="flex-1 flex items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] uppercase tracking-wider text-[#6B6B6B] block">Serviço</span>
                      <span className="text-sm font-semibold text-[#171717]">{info.serviceName}</span>
                    </div>
                    {typeof info.price === 'number' && info.price > 0 && (
                      <span className="text-xs font-semibold text-[#8A6D36] tabular-nums">
                        {formatBRL(info.price)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-[#8A6D36] mt-0.5 shrink-0" />
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-[#6B6B6B] block">Profissional</span>
                    <span className="text-sm font-semibold text-[#171717]">{info.professionalName}</span>
                  </div>
                </div>

                {info.salonAddress && (
                  <div className="flex items-start gap-3 pt-2 border-t border-[#E5E2DC]">
                    <MapPin className="w-4 h-4 text-[#6B6B6B] mt-0.5 shrink-0" />
                    <span className="text-xs text-[#6B6B6B]">{info.salonAddress}</span>
                  </div>
                )}
              </div>

              {info.status === 'confirmed' ? (
                <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-4 text-center space-y-1.5">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                  <p className="text-sm font-semibold text-emerald-950">
                    Presença confirmada com sucesso!
                  </p>
                  <p className="text-xs text-emerald-800">
                    Sua reserva já aparece confirmada em tempo real para o(a) profissional. Até logo!
                  </p>
                </div>
              ) : info.status === 'canceled' ? (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center space-y-1.5">
                  <XCircle className="w-8 h-8 text-rose-600 mx-auto" />
                  <p className="text-sm font-semibold text-rose-950">Atendimento cancelado</p>
                  <p className="text-xs text-rose-800">
                    O estabelecimento já foi notificado. Caso queira remarcar, entre em contato conosco.
                  </p>
                </div>
              ) : info.status === 'completed' ? (
                <div className="bg-[#EEF5F1] border border-[#9CC3B0] rounded-2xl p-4 text-center">
                  <p className="text-sm font-semibold text-[#133A29]">Este atendimento já foi concluído.</p>
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <Button
                    type="button"
                    disabled={submitting}
                    onClick={() => handleDecision('confirm')}
                    className="w-full h-12 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-sm"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    Confirmar Meu Horário
                  </Button>

                  {!showCancelReason ? (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={submitting}
                      onClick={() => setShowCancelReason(true)}
                      className="w-full h-10 rounded-xl border-[#E5E2DC] text-[#6B6B6B] hover:text-rose-700 hover:border-rose-300 text-xs font-medium"
                    >
                      Não poderei comparecer
                    </Button>
                  ) : (
                    <div className="bg-[#FAF9F7] border border-[#E5E2DC] rounded-2xl p-3 space-y-2.5">
                      <Input
                        value={cancelReason}
                        onChange={(e) => setCancelReason(e.target.value)}
                        placeholder="Motivo opcional (ex: imprevisto, prefiro outro dia)"
                        className="bg-white border-[#E5E2DC] text-xs h-9"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          onClick={() => setShowCancelReason(false)}
                          className="flex-1 h-9 text-xs"
                        >
                          Voltar
                        </Button>
                        <Button
                          type="button"
                          disabled={submitting}
                          onClick={() => handleDecision('cancel')}
                          className="flex-1 h-9 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                        >
                          Confirmar Cancelamento
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {info.salonPhone && (
                <div className="pt-2 border-t border-[#E5E2DC] flex items-center justify-center gap-1.5 text-xs text-[#6B6B6B]">
                  <Phone className="w-3.5 h-3.5 text-[#8A6D36]" />
                  <span>Contato do salão: {info.salonPhone}</span>
                </div>
              )}
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
