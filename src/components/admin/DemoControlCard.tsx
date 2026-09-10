import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Database, RefreshCcw, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type Props = { salonId?: string };

export default function DemoControlCard({ salonId }: Props) {
  const { currentUser } = useAuth();
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any | null>(null);
  const [error, setError] = useState('');

  const runSeed = async () => {
    if (!currentUser) return;
    if (!salonId) {
      setError('A conta Lumiere Beauty não foi localizada.');
      return;
    }

    setRunning(true);
    setError('');
    setResult(null);
    try {
      const token = await currentUser.getIdToken(true);
      const response = await fetch('/api/admin/seed-demo-salon', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ salonId }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Não foi possível atualizar a demonstração.');
      }
      setResult(data);
    } catch (err: any) {
      console.error('Demo seed error:', err);
      setError(err?.message || 'Erro ao atualizar a demonstração.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border-[#D4AF37]/30 bg-gradient-to-br from-[#D4AF37]/10 via-black/40 to-black/60">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2 text-xl text-[#D4AF37]">
                <Database className="w-5 h-5" /> Demonstração — Lumiere Beauty Studio
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                Ambiente demonstrativo com dados 100% fictícios para apresentações e gravação de vídeos.
              </p>
            </div>
            <Badge className="w-fit bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30">
              <ShieldCheck className="w-3 h-3 mr-1" /> Protegido por Platform Admin
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border border-border bg-black/30 p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Conta</p>
              <p className="font-semibold text-white mt-1">Lumiere Beauty Studio</p>
              <p className="text-xs text-muted-foreground mt-1">Dados fictícios e isolados</p>
            </div>
            <div className="rounded-xl border border-border bg-black/30 p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Salão</p>
              <p className="font-mono text-sm text-white mt-1 break-all">{salonId || 'não localizado'}</p>
            </div>
            <div className="rounded-xl border border-border bg-black/30 p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Ação</p>
              <p className="text-sm text-white mt-1">Popular / atualizar demonstração</p>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <Button
              onClick={runSeed}
              disabled={running || !salonId}
              className="bg-[#D4AF37] text-black hover:bg-[#D4AF37]/90 font-semibold"
            >
              {running ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCcw className="w-4 h-4 mr-2" />}
              {running ? 'Atualizando demonstração...' : 'Popular / Atualizar Lumiere Beauty'}
            </Button>
            <span className="text-xs text-muted-foreground">
              A operação é idempotente: atualizar novamente não deve criar registros duplicados.
            </span>
          </div>

          {result && (
            <div className="rounded-xl border border-green-500/20 bg-green-500/10 p-4 flex gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-green-300">Demonstração atualizada com sucesso.</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {result.writes ?? 0} operações de dados foram processadas no ambiente demonstrativo.
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 flex gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-300">Não foi possível atualizar a demonstração.</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
              </div>
            </div>
          )}

          <div className="text-xs text-muted-foreground border-t border-border/50 pt-4">
            O seeder preenche os módulos disponíveis no modelo de demonstração, incluindo equipe, clientes, serviços,
            agenda, histórico, financeiro, estoque, metas, avaliações, gamificação, notificações e auditoria.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
