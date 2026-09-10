import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { Professional, PlanType } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { PROFESSIONAL_SPECIALTIES } from '../../data/professionalSpecialties';
import { usePlans } from '../../hooks/usePlans';
import { toast } from 'sonner';
import { Loader2, UserPlus, Trash2, Edit2, Phone, Mail, Sparkles, UserCheck, Scissors } from 'lucide-react';

export default function OnboardingTeam() {
  const { getPlan } = usePlans();

  const { salonData } = useAuth();
  const navigate = useNavigate();
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProf, setEditingProf] = useState<Professional | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [primaryFunction, setPrimaryFunction] = useState('Cabeleireira');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!salonData?.id) return;

    const q = query(collection(db, `salons/${salonData.id}/professionals`));
    const unsub = onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Professional[];
        setProfessionals(list);
        setLoading(false);
      },
      (err) => {
        console.error('Erro de sincronização de equipe no onboarding:', err);
        toast.error('Erro ao conectar com a base de dados de profissionais.');
        setLoading(false);
      }
    );

    return () => unsub();
  }, [salonData?.id]);

  const openAddDialog = () => {
    setEditingProf(null);
    setName('');
    setPhone('');
    setEmail('');
    setPrimaryFunction('Cabeleireira');
    setIsDialogOpen(true);
  };

  const openEditDialog = (p: Professional) => {
    setEditingProf(p);
    setName(p.name);
    setPhone(p.phone || '');
    setEmail(p.email || '');
    setPrimaryFunction(p.primaryFunction || p.role || 'Cabeleireira');
    setIsDialogOpen(true);
  };

  const saveProfessional = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData?.id) return;
    if (!name.trim()) {
      toast.error('O nome do profissional é obrigatório.');
      return;
    }

    // Verificar se atingiu o limite de profissionais permitido pelo plano
    const currentPlan = salonData.plan || 'start';
    const planConfig = getPlan(currentPlan);
    const maxProfessionals = planConfig?.maxProfessionals || 5;

    if (!editingProf && professionals.length >= maxProfessionals) {
      toast.error(`Seu plano atual (${planConfig.name}) permite cadastrar no máximo ${maxProfessionals} profissionais. Faça um upgrade ou remova algum para continuar.`);
      return;
    }

    setSaving(true);
    try {
      const pId = editingProf ? editingProf.id : doc(collection(db, `salons/${salonData.id}/professionals`)).id;
      const pRef = doc(db, `salons/${salonData.id}/professionals`, pId);

      await setDoc(pRef, {
        id: pId,
        name: name.trim(),
        role: 'professional', // matching default role
        phone: phone.trim(),
        email: email.trim() || null,
        primaryFunction: primaryFunction,
        isActive: true,
        createdAt: editingProf ? editingProf.createdAt : Date.now(),
        updatedAt: Date.now(),
      });

      toast.success(editingProf ? 'Profissional editado com sucesso!' : 'Profissional adicionado à equipe!');
      setIsDialogOpen(false);
    } catch (err) {
      console.error('Erro ao salvar profissional:', err);
      toast.error('Erro ao salvar profissional. Verifique sua conexão.');
    } finally {
      setSaving(false);
    }
  };

  const deleteProfessional = async (pId: string) => {
    if (!salonData?.id) return;
    if (!confirm('Deseja realmente remover este profissional da equipe?')) return;

    try {
      const pRef = doc(db, `salons/${salonData.id}/professionals`, pId);
      await deleteDoc(pRef);
      toast.success('Profissional removido com sucesso.');
    } catch (err) {
      console.error('Erro ao deletar profissional:', err);
      toast.error('Não foi possível remover o profissional.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-12 h-12 bg-[#D4AF37]/10 rounded-full border border-[#D4AF37]/20 flex items-center justify-center mb-1">
          <UserPlus className="w-5 h-5 text-[#D4AF37]" />
        </div>
        <h2 className="text-2xl font-heading text-white">Sua Equipe</h2>
        <p className="text-muted-foreground text-sm max-w-lg mx-auto">
          Adicione os profissionais que farão parte do seu salão de beleza no LumièreOS. Você poderá agendar horários e acompanhar o faturamento de cada um.
        </p>
      </div>

      <div className="flex justify-between items-center pt-2">
        <span className="text-xs font-mono uppercase tracking-widest text-[#D4AF37]">
          {professionals.length} {professionals.length === 1 ? 'Profissional Cadastrada' : 'Profissionais Cadastrados'}
        </span>
        <Button
          id="onboarding-btn-add-team"
          type="button"
          onClick={openAddDialog}
          className="bg-primary hover:bg-gold-400 text-black font-semibold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5"
        >
          <UserPlus className="w-4 h-4" />
          Adicionar Profissional
        </Button>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#D4AF37]" />
          <p className="text-xs text-muted-foreground font-mono">Buscando equipe...</p>
        </div>
      ) : professionals.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-white/5 rounded-2xl bg-white/[0.005] space-y-4">
          <Scissors className="w-8 h-8 mx-auto text-muted-foreground/50" />
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-300">Nenhum profissional cadastrado</p>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Seu salão precisa de pelo menos 1 profissional para ativar a agenda e checklists diários.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={openAddDialog}
            className="border-white/10 hover:border-[#D4AF37]/45 text-slate-300 text-xs h-9 px-4 rounded-xl"
          >
            Começar Adicionando
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {professionals.map((p) => (
            <div
              key={p.id}
              className="bg-[#0c0c0f] border border-white/5 rounded-2xl p-4 flex justify-between items-start hover:border-[#D4AF37]/20 transition duration-200"
            >
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-primary/15 text-primary text-xs font-bold rounded-lg flex items-center justify-center">
                    {p.name.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white leading-none">{p.name}</h4>
                    <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full inline-block mt-1">
                      {p.primaryFunction || p.role || 'Profissional'}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 text-xs text-muted-foreground font-light pl-9">
                  {p.phone && (
                    <div className="flex items-center gap-1.5 h-4">
                      <Phone className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0" />
                      <span>{p.phone}</span>
                    </div>
                  )}
                  {p.email && (
                    <div className="flex items-center gap-1.5 h-4">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground/60 shrink-0 animate-fade-in" />
                      <span className="truncate max-w-[170px]">{p.email}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  id={`edit-prof-${p.id}`}
                  onClick={() => openEditDialog(p)}
                  variant="ghost"
                  className="w-8 h-8 rounded-lg p-0 text-muted-foreground hover:text-white"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button
                  id={`del-prof-${p.id}`}
                  onClick={() => deleteProfessional(p.id)}
                  variant="ghost"
                  className="w-8 h-8 rounded-lg p-0 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-between items-center pt-6 border-t border-white/5 mt-8">
        <p className="text-[11px] text-muted-foreground font-light flex items-center gap-1 leading-none">
          <Sparkles className="w-3 h-3 text-primary animate-pulse" /> Passo 1 de 4 • Próximo passo: Nossos Serviços
        </p>
        <Button
          id="onboarding-btn-continue"
          onClick={() => navigate('/onboarding/servicos')}
          className="bg-primary hover:bg-gold-400 text-black font-semibold h-10 px-6 rounded-xl text-xs"
        >
          Continuar
        </Button>
      </div>

      {/* Add / Edit Professional Modal */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-[#0b0b0d] border border-white/10 rounded-2xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-lg font-heading text-white">
              {editingProf ? 'Editar Profissional' : 'Adicionar Profissional'}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {editingProf
                ? 'Atualize os dados cadastrais do seu colaborador.'
                : 'Insira as informações do novo profissional do seu salão.'}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={saveProfessional} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-slate-350" htmlFor="prof-name">Nome Completo</Label>
              <Input
                id="prof-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Marina Silva"
                className="bg-black/60 border-white/10 rounded-xl h-10 text-xs focus:border-primary"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-slate-350" htmlFor="prof-function">Função Principal</Label>
              <select
                id="prof-function"
                value={primaryFunction}
                onChange={(e) => setPrimaryFunction(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl h-10 text-xs text-slate-200 px-3 py-2 outline-none focus:border-primary"
              >
                {PROFESSIONAL_SPECIALTIES.map((spec) => (
                  <option key={spec} value={spec} className="bg-[#0b0b0d]">
                    {spec}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-slate-350" htmlFor="prof-phone">WhatsApp/Celular</Label>
                <Input
                  id="prof-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Ex. (11) 99999-9999"
                  className="bg-black/60 border-white/10 rounded-xl h-10 text-xs focus:border-primary"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-slate-350" htmlFor="prof-email">E-mail (opcional)</Label>
                <Input
                  id="prof-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Ex. marina@lumiere.com"
                  className="bg-black/60 border-white/10 rounded-xl h-10 text-xs focus:border-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2.5 pt-4 border-t border-white/5">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="border-white/10 hover:border-slate-800 text-slate-300 text-xs h-9 px-4 rounded-xl"
              >
                Cancelar
              </Button>
              <Button
                id="prof-save-btn"
                type="submit"
                disabled={saving}
                className="bg-primary hover:bg-gold-400 text-black font-semibold text-xs h-9 px-4 rounded-xl flex items-center gap-1.5"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editingProf ? 'Salvar Alterações' : 'Adicionar Membro'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
