import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db, auth } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, where, Timestamp, deleteDoc } from 'firebase/firestore';
import { Professional } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Edit2, Power, PowerOff, UserMinus, Link2, Copy, Trash2, Check, Share2, MessageSquare } from 'lucide-react';
import { PROFESSIONAL_SPECIALTIES } from '../../data/professionalSpecialties';

const roleTranslations: Record<string, string> = {
  manager: 'Gerente',
  receptionist: 'Recepcionista',
  attendant: 'Atendente',
  professional: 'Profissional',
};

interface Invite {
  id: string;
  salonId: string;
  salonName: string;
  invitedByUserId: string;
  invitedByName: string;
  invitedByEmail: string;
  inviteType: 'manager' | 'receptionist' | 'attendant' | 'professional' | 'function_link';
  role: string;
  category: string | null;
  specialty?: string | null;
  professionalFunction?: string | null;
  maxUses?: number;
  usesCount?: number;
  email: string | null;
  status: 'pending' | 'accepted' | 'expired' | 'canceled';
  expiresAt: any;
  createdAt: number;
  updatedAt: number;
}

export default function ProfessionalsPage() {
  const { salonData, userData, isPlatformAdmin, currentUser } = useAuth();
  const isAdmin = isPlatformAdmin;
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [editingProf, setEditingProf] = useState<Professional | null>(null);
  const [deletingProf, setDeletingProf] = useState<Professional | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  // States for Functional links
  const [isFunctionDialogOpen, setIsFunctionDialogOpen] = useState(false);
  const [functionGeneratedLink, setFunctionGeneratedLink] = useState('');
  const [functionFormData, setFunctionFormData] = useState({
    role: 'professional',
    specialty: '',
    customSpecialty: '',
    maxUses: 10,
    validityDays: 7,
  });

  const [formData, setFormData] = useState({
    name: '',
    role: '',
    phone: '',
    email: '',
  });

  const [inviteFormData, setInviteFormData] = useState({
    inviteType: 'professional' as Invite['inviteType'],
    category: '',
    email: '',
  });
  const [generatedLink, setGeneratedLink] = useState('');
  const [copiedLink, setCopiedLink] = useState('');

  useEffect(() => {
    if (!salonData) return;

    const q = query(collection(db, `salons/${salonData.id}/professionals`));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const profs: Professional[] = [];
      snapshot.forEach((doc) => {
        profs.push({ id: doc.id, ...doc.data() } as Professional);
      });
      setProfessionals(profs.sort((a, b) => b.createdAt - a.createdAt));
      setLoading(false);
    }, (error) => {
      console.error(error);
      toast.error('Erro ao carregar equipe.');
      setLoading(false);
    });

    // Subscribing to Invites
    const qInvites = query(collection(db, 'invites'), where('salonId', '==', salonData.id));
    const unsubInvites = onSnapshot(qInvites, (snapshot) => {
      const invs: Invite[] = [];
      snapshot.forEach((doc) => {
        invs.push({ id: doc.id, ...doc.data() } as Invite);
      });
      setInvites(invs.sort((a, b) => b.createdAt - a.createdAt));
    }, (err) => {
      console.error(err);
    });

    return () => {
      unsubscribe();
      unsubInvites();
    };
  }, [salonData]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;

    if (!editingProf && !isAdmin && professionals.length >= salonData.professionalsLimit) {
      toast.error(`Você atingiu o limite de ${salonData.professionalsLimit} profissionais do seu plano.`);
      return;
    }

    try {
      if (editingProf) {
        const profRef = doc(db, `salons/${salonData.id}/professionals`, editingProf.id);
        await updateDoc(profRef, {
          ...formData,
          updatedAt: Date.now(),
        });
        toast.success('Profissional atualizado!');
      } else {
        const profRef = doc(collection(db, `salons/${salonData.id}/professionals`));
        await setDoc(profRef, {
          id: profRef.id,
          ...formData,
          isActive: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        toast.success('Profissional adicionado!');
      }
      setIsDialogOpen(false);
      setFormData({ name: '', role: '', phone: '', email: '' });
      setEditingProf(null);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao salvar profissional.');
    }
  };

  const handleGenerateInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData || !userData) {
      toast.error('Erro de autenticação ou salão inválido. Tente fazer login novamente.');
      return;
    }

    try {
      const salonId = userData.salonId || salonData.id;
      if (!salonId) {
        throw new Error('Identificador do salão não encontrado (undefined salonId).');
      }

      const invitedByUserId = userData.id || currentUser?.uid || auth.currentUser?.uid;
      if (!invitedByUserId) {
        throw new Error('Identificador do usuário convidante não encontrado (undefined invitedByUserId).');
      }

      const invitedByName = userData.fullName || currentUser?.displayName || 'Administrador';
      const invitedByEmail = userData.email || currentUser?.email || '';

      const inviteId = doc(collection(db, 'invites')).id;
      const expiresAtDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 days
      const expiresAt = Timestamp.fromDate(expiresAtDate);

      // Normalize role - must be exactly one of: manager, receptionist, attendant, professional
      const selectedRole = inviteFormData.inviteType; 
      if (!['manager', 'receptionist', 'attendant', 'professional'].includes(selectedRole)) {
        throw new Error('Função selecionada inválida.');
      }

      // Handle optional fields - convert empty to null, never send undefined
      const categoryValue = inviteFormData.category?.trim() || null;
      const emailValue = inviteFormData.email?.trim() || null;

      const inviteDoc: Invite = {
        id: inviteId,
        salonId,
        salonName: salonData.name,
        invitedByUserId,
        invitedByName,
        invitedByEmail,
        inviteType: selectedRole,
        role: selectedRole, // MUST be technical role identifier for security rules
        category: categoryValue,
        email: emailValue,
        status: 'pending',
        expiresAt,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      await setDoc(doc(db, 'invites', inviteId), inviteDoc);
      
      const link = `${window.location.origin}/cadastro-profissional?invite=${inviteId}`;
      setGeneratedLink(link);
      toast.success('Link de convite gerado!');
    } catch (err: any) {
      console.error("Erro ao gerar convite:", err);
      const errMsg = err?.message || '';
      if (err?.code === 'permission-denied' || errMsg.includes('permission-denied') || errMsg.includes('Permission denied')) {
        toast.error('Você não tem permissão para gerar convites. Apenas proprietário ou gerente podem convidar.');
      } else if (errMsg.includes('undefined') || JSON.stringify(err).includes('undefined')) {
        toast.error('Erro interno: dados obrigatórios do convite não foram preenchidos.');
      } else {
        toast.error('Erro ao gerar convite. Tente novamente.');
      }
    }
  };

  const handleFunctionRoleChange = (selectedRole: string) => {
    let spec = '';
    let max = 10;
    if (selectedRole === 'manager') {
      spec = 'Gerente';
      max = 1;
    } else if (selectedRole === 'receptionist') {
      spec = 'Recepcionista';
      max = 2;
    } else if (selectedRole === 'attendant') {
      spec = 'Atendente';
      max = 3;
    } else {
      spec = '';
      max = 10;
    }
    setFunctionFormData(prev => ({
      ...prev,
      role: selectedRole,
      specialty: spec,
      maxUses: max,
    }));
  };

  const handleGenerateFunctionInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData || !userData) {
      toast.error('Erro de autenticação ou salão inválido. Tente fazer login novamente.');
      return;
    }

    const role = functionFormData.role;
    if (!role) {
      toast.error("Por favor, selecione a Função de Acesso.");
      return;
    }

    const finalSpecialty = functionFormData.specialty === 'Outro' 
      ? functionFormData.customSpecialty.trim() 
      : functionFormData.specialty.trim();

    if (role === 'professional' && !finalSpecialty) {
      toast.error("Por favor, preencha ou selecione a Especialidade.");
      return;
    }
    if (functionFormData.specialty === 'Outro' && !functionFormData.customSpecialty.trim()) {
      toast.error("Por favor, digite a especialidade manual.");
      return;
    }
    if (!functionFormData.maxUses || functionFormData.maxUses < 1) {
      toast.error("O limite de cadastros deve ser de pelo menos 1.");
      return;
    }

    try {
      const salonId = userData.salonId || salonData.id;
      const invitedByUserId = userData.id || currentUser?.uid || auth.currentUser?.uid;
      if (!invitedByUserId) {
        throw new Error('Identificador do usuário convidante não encontrado (undefined invitedByUserId).');
      }

      const invitedByName = userData.fullName || currentUser?.displayName || 'Administrador';
      const invitedByEmail = userData.email || currentUser?.email || '';

      const inviteId = doc(collection(db, 'invites')).id;
      const expiresAtDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * (functionFormData.validityDays || 7));
      const expiresAt = Timestamp.fromDate(expiresAtDate);

      const inviteDoc = {
        id: inviteId,
        salonId,
        salonName: salonData.name,
        role: role,
        category: finalSpecialty,
        specialty: finalSpecialty,
        professionalFunction: finalSpecialty,
        inviteType: "function_link",
        status: "pending",
        maxUses: Number(functionFormData.maxUses),
        usesCount: 0,
        invitedByUserId,
        invitedByName,
        invitedByEmail,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        expiresAt,
        email: null,
        invitedName: null,
        invitedPhone: null
      };

      await setDoc(doc(db, 'invites', inviteId), inviteDoc);
      
      const link = `${window.location.origin}/cadastro-profissional?invite=${inviteId}`;
      setFunctionGeneratedLink(link);
      toast.success('Link por função gerado com sucesso!');
    } catch (err: any) {
      console.error("Erro ao gerar link por função:", err);
      toast.error('Erro ao gerar convite por função: ' + (err.message || ''));
    }
  };

  const copyGroupMessage = () => {
    const functionLinks = invites.filter(i => i.inviteType === 'function_link' && i.status === 'pending');
    if (functionLinks.length === 0) {
      toast.error("Nenhum link por função ativo para copiar.");
      return;
    }
    let message = `Pessoal, seguem os links de acesso ao LumiereOS do ${salonData?.name}.\n\n`;
    functionLinks.forEach(link => {
      const fullLink = `${window.location.origin}/cadastro-profissional?invite=${link.id}`;
      message += `${link.specialty || roleTranslations[link.role] || link.role}:\n${fullLink}\n\n`;
    });
    message += `Cada pessoa deve acessar o link referente à sua função e concluir o cadastro com nome, e-mail e WhatsApp.`;
    navigator.clipboard.writeText(message);
    toast.success("Mensagem de grupo copiada!");
  };

  const cancelInvite = async (inviteId: string) => {
    try {
      await updateDoc(doc(db, 'invites', inviteId), {
        status: 'canceled',
        updatedAt: Date.now()
      });
      toast.success('Convite cancelado.');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao cancelar convite.');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLink(text);
    toast.success('Link copiado!');
    setTimeout(() => setCopiedLink(''), 2000);
  };

  const toggleStatus = async (prof: Professional) => {
    if (!salonData) return;
    try {
      const profRef = doc(db, `salons/${salonData.id}/professionals`, prof.id);
      await updateDoc(profRef, {
        isActive: !prof.isActive,
        updatedAt: Date.now(),
      });
      toast.success(`Profissional ${!prof.isActive ? 'ativado' : 'inativado'}.`);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao alterar status.');
    }
  };

  const openEdit = (prof: Professional) => {
    setEditingProf(prof);
    setFormData({ name: prof.name, role: prof.role, phone: prof.phone, email: prof.email || '' });
    setIsDialogOpen(true);
  };

  const handleDeleteClick = (prof: Professional) => {
    setDeletingProf(prof);
    setIsConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!salonData || !deletingProf) return;
    try {
      const profRef = doc(db, `salons/${salonData.id}/professionals`, deletingProf.id);
      await deleteDoc(profRef);
      toast.success(`Profissional ${deletingProf.name} excluído definitivamente.`);
      setIsConfirmOpen(false);
      setDeletingProf(null);
    } catch (error) {
      console.error(error);
      toast.error('Erro ao excluir profissional.');
    }
  };

  if (loading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  const activeCount = professionals.filter(p => p.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-heading font-light">Equipe</h2>
          <p className="text-muted-foreground text-sm">
            {professionals.length} de {salonData?.professionalsLimit} profissionais cadastrados ({activeCount} ativos).
          </p>
        </div>
        
        <div className="flex gap-2">
          {/* Gerar Link por Função Dialog Trigger */}
          <Dialog open={isFunctionDialogOpen} onOpenChange={(open) => {
            setIsFunctionDialogOpen(open);
            if (!open) {
              setFunctionGeneratedLink('');
              setFunctionFormData({
                role: 'professional',
                specialty: '',
                customSpecialty: '',
                maxUses: 10,
                validityDays: 7,
              });
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-primary/20 hover:border-primary/50 text-primary hover:bg-primary/5 bg-transparent rounded-xl h-10 px-4 text-xs font-semibold">
                <Link2 className="w-4.5 h-4.5 mr-1.5" /> Gerar link por função
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px] bg-card border-border">
              <DialogHeader>
                <DialogTitle className="font-heading font-normal">Gerar Link de Cadastro por Função</DialogTitle>
                <CardDescription className="text-xs">Crie um link de cadastro multiuso para uma especialidade ou função específica.</CardDescription>
              </DialogHeader>
              
              {!functionGeneratedLink ? (
                <form onSubmit={handleGenerateFunctionInvite} className="space-y-4 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="funcRole">Função de Acesso</Label>
                    <select 
                      id="funcRole"
                      value={functionFormData.role}
                      onChange={(e) => handleFunctionRoleChange(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-white/10 bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="professional">Profissional (Professional)</option>
                      <option value="manager">Gerente (Manager)</option>
                      <option value="receptionist">Recepcionista (Receptionist)</option>
                      <option value="attendant">Atendente (Attendant)</option>
                    </select>
                  </div>

                  {functionFormData.role === 'professional' ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="funcSpecialty">Especialidade / Função de beleza</Label>
                      <select
                        id="funcSpecialty"
                        value={functionFormData.specialty}
                        onChange={(e) => setFunctionFormData(prev => ({ ...prev, specialty: e.target.value }))}
                        className="w-full h-10 px-3 rounded-lg border border-white/10 bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Selecione...</option>
                        {PROFESSIONAL_SPECIALTIES.map(spec => (
                          <option key={spec} value={spec}>{spec}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      <Label htmlFor="funcSpecialtyFixed">Especialidade / Função de beleza</Label>
                      <Input
                        id="funcSpecialtyFixed"
                        disabled
                        value={functionFormData.specialty}
                        className="bg-background/50 h-10 disabled:opacity-80"
                      />
                    </div>
                  )}

                  {functionFormData.specialty === 'Outro' && (
                    <div className="space-y-1.5">
                      <Label htmlFor="customSpecialty">Especifique a Especialidade</Label>
                      <Input
                        id="customSpecialty"
                        placeholder="Digite a especialidade manual..."
                        value={functionFormData.customSpecialty}
                        onChange={(e) => setFunctionFormData(prev => ({ ...prev, customSpecialty: e.target.value }))}
                        className="bg-background h-10"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="funcMaxUses">Limite de Cadastros</Label>
                      <Input 
                        id="funcMaxUses"
                        type="number"
                        min="1"
                        value={functionFormData.maxUses}
                        onChange={(e) => setFunctionFormData(prev => ({ ...prev, maxUses: parseInt(e.target.value) || 0 }))}
                        className="bg-background h-10"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="funcValidity">Validade em dias</Label>
                      <Input 
                        id="funcValidity"
                        type="number"
                        min="1"
                        value={functionFormData.validityDays}
                        onChange={(e) => setFunctionFormData(prev => ({ ...prev, validityDays: parseInt(e.target.value) || 0 }))}
                        className="bg-background h-10"
                      />
                    </div>
                  </div>

                  <Button type="submit" className="w-full bg-primary hover:bg-gold-500 text-black font-semibold h-10 rounded-xl mt-4">
                    Gerar Link por Função
                  </Button>
                </form>
              ) : (
                <div className="space-y-4 pt-4 text-center">
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-xl space-y-1 text-left">
                    <p className="text-xs font-semibold text-primary">Link Gerado com Sucesso!</p>
                    <span className="text-[11px] font-mono select-all truncate block text-foreground break-all">{functionGeneratedLink}</span>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => copyToClipboard(functionGeneratedLink)} 
                        className="flex-1 bg-primary hover:bg-gold-500 text-black font-semibold rounded-xl h-10 text-xs flex items-center justify-center gap-1.5"
                      >
                        {copiedLink === functionGeneratedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                        {copiedLink === functionGeneratedLink ? 'Copiado!' : 'Copiar Link'}
                      </Button>
                      
                      <Button 
                        onClick={() => {
                          const specStr = functionFormData.specialty === 'Outro' ? functionFormData.customSpecialty : functionFormData.specialty;
                          const msg = `Você recebeu um convite para acessar o LumiereOS do ${salonData?.name} como ${specStr}. Acesse o link e conclua seu cadastro: ${functionGeneratedLink}`;
                          navigator.clipboard.writeText(msg);
                          toast.success('Mensagem individual copiada!');
                        }}
                        variant="outline"
                        className="flex-1 border-white/10 text-white hover:bg-white/5 rounded-xl h-10 text-xs flex items-center justify-center gap-1.5"
                      >
                        <MessageSquare className="w-4 h-4 text-primary" />
                        Copiar Mensagem
                      </Button>
                    </div>

                    <a 
                      href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                        `Você recebeu um convite para acessar o LumiereOS do ${salonData?.name} como ${functionFormData.specialty === 'Outro' ? functionFormData.customSpecialty : functionFormData.specialty}. Acesse o link e conclua seu cadastro: ${functionGeneratedLink}`
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="w-full bg-[#25D366] hover:bg-[#128C7E] border border-transparent text-white font-semibold rounded-xl h-10 text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Share2 className="w-4 h-4" />
                      Enviar no WhatsApp
                    </a>

                    <Button 
                      variant="ghost"
                      onClick={() => setFunctionGeneratedLink('')}
                      className="text-xs text-muted-foreground hover:text-white"
                    >
                      Gerar Outro Link por Função
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Create Invite Link Dialog Trigger */}
          <Dialog open={isInviteDialogOpen} onOpenChange={(open) => {
            setIsInviteDialogOpen(open);
            if (!open) {
              setGeneratedLink('');
              setInviteFormData({ inviteType: 'professional', category: '', email: '' });
            }
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="border-primary/20 hover:border-primary/50 text-primary hover:bg-primary/5 bg-transparent rounded-xl h-10 px-4 text-xs font-semibold">
                <Link2 className="w-4.5 h-4.5 mr-1.5" /> Convidar via E-mail
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[450px] bg-card border-border">
              <DialogHeader>
                <DialogTitle className="font-heading font-normal">Convidar por E-mail (Individual)</DialogTitle>
                <CardDescription className="text-xs">Crie um convite elegível por link. O convidado se cadastrará no sistema auto-vinculado ao seu salão.</CardDescription>
              </DialogHeader>
              
              {!generatedLink ? (
                <form onSubmit={handleGenerateInvite} className="space-y-4 pt-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="inviteType">Função de Acesso</Label>
                    <select 
                      id="inviteType"
                      value={inviteFormData.inviteType}
                      onChange={(e: any) => setInviteFormData(prev => ({...prev, inviteType: e.target.value}))}
                      className="w-full h-10 px-3 rounded-lg border border-white/10 bg-background text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    >
                      <option value="professional">Profissional (Professional)</option>
                      <option value="manager">Gerente (Manager)</option>
                      <option value="attendant">Atendente (Attendant)</option>
                      <option value="receptionist">Recepcionista (Receptionist)</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="category">Alocação / Categoria ou Especialidade (Opcional)</Label>
                    <Input 
                      id="category" 
                      placeholder="Ex: Cabeleireira, Manicure, Barbeiro..." 
                      value={inviteFormData.category} 
                      onChange={(e) => setInviteFormData(prev => ({...prev, category: e.target.value}))} 
                      className="bg-background h-10" 
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="inviteEmail">E-mail Específico (Opcional)</Label>
                    <Input 
                      id="inviteEmail" 
                      type="email" 
                      placeholder="Convidado só poderá usar este e-mail" 
                      value={inviteFormData.email} 
                      onChange={(e) => setInviteFormData(prev => ({...prev, email: e.target.value}))} 
                      className="bg-background h-10" 
                    />
                  </div>

                  <Button type="submit" className="w-full bg-primary hover:bg-gold-500 text-black font-semibold h-10 rounded-xl mt-4">
                    Gerar Link de Convite
                  </Button>
                </form>
              ) : (
                <div className="space-y-4 pt-4 text-center">
                  <div className="h-12 bg-primary/10 border border-primary/20 rounded-xl flex items-center justify-center p-2.5">
                    <span className="text-[11px] font-mono text-primary select-all truncate max-w-full">{generatedLink}</span>
                  </div>
                  
                  <div className="flex gap-2 justify-center">
                    <Button 
                      onClick={() => copyToClipboard(generatedLink)} 
                      className="bg-primary hover:bg-gold-500 text-black font-semibold rounded-xl h-10 px-5 text-xs flex items-center gap-1.5"
                    >
                      {copiedLink === generatedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                      {copiedLink === generatedLink ? 'Copiado!' : 'Copiar Link'}
                    </Button>
                    <Button 
                      variant="outline"
                      onClick={() => setGeneratedLink('')}
                      className="border-white/10 text-white hover:bg-white/5 rounded-xl h-10 text-xs"
                    >
                      Gerar Outro
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            setIsDialogOpen(open);
            if (!open) { setEditingProf(null); setFormData({ name: '', role: '', phone: '', email: '' }); }
          }}>
            <DialogTrigger asChild>
              <Button 
                 className="bg-primary hover:bg-gold-500 text-black font-semibold h-10 rounded-xl px-4 text-xs"
                 disabled={!salonData || (!isAdmin && professionals.length >= salonData.professionalsLimit)}
                 title={!isAdmin && professionals.length >= (salonData?.professionalsLimit || 0) ? "Limite do plano atingido" : ""}
              >
                <Plus className="w-4 h-4 mr-2" /> Novo Profissional (Direto)
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-card border-border">
              <DialogHeader>
                <DialogTitle className="font-heading">{editingProf ? 'Editar Profissional' : 'Novo Profissional'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input id="name" required value={formData.name} onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))} className="bg-background-accent bg-background" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Função / Especialidade</Label>
                  <Input id="role" required value={formData.role} onChange={(e) => setFormData(prev => ({...prev, role: e.target.value}))} className="bg-background" placeholder="Ex: Cabeleireiro Sênior" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Celular</Label>
                  <Input id="phone" required value={formData.phone} onChange={(e) => setFormData(prev => ({...prev, phone: e.target.value}))} className="bg-background" />
                </div>
                 <div className="space-y-2">
                  <Label htmlFor="email">E-mail (Opcional)</Label>
                  <Input id="email" type="email" value={formData.email} onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))} className="bg-background" />
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-gold-500 text-black">
                  {editingProf ? 'Salvar Alterações' : 'Cadastrar Profissional'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          {/* Exclusão Confirm Dialog */}
          <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
            <DialogContent className="sm:max-w-[400px] bg-card border-border">
              <DialogHeader>
                <DialogTitle className="font-heading font-normal flex items-center gap-2 text-destructive">
                  <Trash2 className="w-5 h-5" /> Excluir Profissional
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-3">
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Tem certeza que deseja excluir o(a) profissional <strong className="text-white">{deletingProf?.name}</strong>?
                </p>
                <div className="text-xs text-red-400 bg-red-950/20 p-3 rounded-lg border border-red-900/30 font-medium">
                  Esta ação é permanente e removerá por completo todas as configurações e alocações de equipe associadas a este profissional no LumiereOS.
                </div>
                <div className="flex gap-2 justify-end pt-2">
                  <Button 
                    variant="outline" 
                    onClick={() => {
                      setIsConfirmOpen(false);
                      setDeletingProf(null);
                    }}
                    className="rounded-xl border-white/10 text-white hover:bg-white/5 h-10 px-4 text-xs font-semibold"
                  >
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleDeleteConfirm}
                    className="bg-destructive hover:bg-destructive/90 text-white rounded-xl h-10 px-4 text-xs font-semibold"
                  >
                    Excluir Definitivamente
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Convites Ativos List */}
      {invites.filter(i => i.status === 'pending').length > 0 && (
        <Card className="border border-[#d4af37]/20 bg-[#d4af37]/5 rounded-2xl shadow-lg">
          <CardHeader className="pb-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-sm font-heading font-normal flex items-center gap-2 text-primary">
                <Link2 className="w-4 h-4" /> Links de Convite Ativos
              </CardTitle>
              <CardDescription className="text-xs">Copie e envie para novos profissionais ou gerentes se registrarem em sua equipe.</CardDescription>
            </div>
            {invites.some(i => i.inviteType === 'function_link' && i.status === 'pending') && (
              <Button 
                onClick={copyGroupMessage}
                variant="outline"
                className="w-full sm:w-auto border-primary/20 hover:border-primary/50 text-primary hover:bg-primary/5 bg-transparent rounded-xl h-9 px-3 text-xs font-semibold flex items-center gap-1.5"
              >
                <Copy className="w-3.5 h-3.5" /> Copiar Links Grupo (WA)
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-3 p-4">
            {invites.filter(i => i.status === 'pending').map((invite) => {
              const link = `${window.location.origin}/cadastro-profissional?invite=${invite.id}`;
              const isCopied = copiedLink === link;
              const isFunctionLink = invite.inviteType === 'function_link';

              const roleDisplay = roleTranslations[invite.role] || invite.role;
              const specialtyDisplay = invite.specialty || invite.category || roleDisplay;

              return (
                <div key={invite.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 bg-black/40 border border-white/5 rounded-xl gap-3">
                  <div className="space-y-0.5 min-w-0">
                    <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                      {specialtyDisplay} 
                      <span className="text-[10px] uppercase bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold font-mono">
                        {isFunctionLink ? `Link por Função` : (roleTranslations[invite.inviteType] || invite.inviteType)}
                      </span>
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {isFunctionLink 
                        ? `Acessos: ${invite.usesCount || 0}/${invite.maxUses || 1} • Expira em: ${invite.expiresAt?.toDate ? invite.expiresAt.toDate().toLocaleDateString() : 'N/A'}`
                        : (invite.email ? `Exclusivo para: ${invite.email}` : 'Qualquer e-mail')
                      }
                    </p>
                  </div>
                  
                  <div className="flex gap-1.5 self-end sm:self-auto shrink-0 flex-wrap">
                    <Button 
                      onClick={() => copyToClipboard(link)}
                      className="bg-primary hover:bg-gold-500 text-black flex items-center gap-1 h-7 rounded-md text-xs px-2.5 font-semibold"
                    >
                      {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {isCopied ? 'Copiado!' : 'Copiar Link'}
                    </Button>

                    {isFunctionLink && (
                      <>
                        <Button 
                          onClick={() => {
                            const specStr = invite.specialty || invite.role;
                            const msg = `Você recebeu um convite para acessar o LumiereOS do ${salonData?.name} como ${specStr}. Acesse o link e conclua seu cadastro: ${link}`;
                            navigator.clipboard.writeText(msg);
                            toast.success('Mensagem individual copiada!');
                          }}
                          variant="outline"
                          className="border-white/10 text-white hover:bg-white/5 flex items-center gap-1 h-7 rounded-md text-xs px-2.5"
                        >
                          <MessageSquare className="w-3.5 h-3.5 text-primary" />
                          Mensagem
                        </Button>

                        <a 
                          href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                            `Você recebeu um convite para acessar o LumiereOS do ${salonData?.name} como ${invite.specialty || invite.role}. Acesse o link e conclua seu cadastro: ${link}`
                          )}`}
                          target="_blank"
                          rel="noreferrer"
                          className="bg-[#25D366] hover:bg-[#128C7E] flex items-center gap-1 h-7 rounded-md text-xs px-2.5 text-white transition-colors"
                        >
                          <Share2 className="w-3 h-3" />
                          WhatsApp
                        </a>
                      </>
                    )}

                    <Button 
                      variant="ghost" 
                      onClick={() => cancelInvite(invite.id)}
                      className="text-destructive hover:bg-destructive/10 h-7 rounded-md px-2"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {professionals.length === 0 ? (
        <Card className="border-border bg-card/40">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <UserMinus className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-medium mb-1">Nenhum profissional</h3>
            <p className="text-muted-foreground text-sm">Cadastre sua equipe para iniciar os agendamentos ou envie links de convites corporativos.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {professionals.map((prof) => (
            <Card key={prof.id} className={`border-border transition-colors ${!prof.isActive && 'opacity-60 grayscale'}`}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground font-bold shrink-0">
                      {prof.name.charAt(0).toUpperCase()}
                   </div>
                   <div>
                      <CardTitle className="text-base font-medium leading-tight">
                        {prof.name}
                      </CardTitle>
                      <p className="text-xs text-primary mt-0.5">{prof.role}</p>
                   </div>
                </div>
                
                <div className="flex gap-1 -mr-2">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(prof)} className="h-8 w-8 text-muted-foreground hover:text-primary" title="Editar">
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => toggleStatus(prof)} className={`h-8 w-8 ${prof.isActive ? 'text-destructive hover:bg-destructive/10' : 'text-primary hover:bg-primary/10'}`} title={prof.isActive ? "Desativar" : "Ativar"}>
                    {prof.isActive ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => handleDeleteClick(prof)} className="h-8 w-8 text-destructive hover:bg-destructive/10" title="Excluir Definitivamente">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="text-sm mt-2 text-muted-foreground space-y-1">
                   <p>{prof.phone}</p>
                   {prof.email && <p>{prof.email}</p>}
                </div>
                <div className="mt-4 flex justify-between items-center">
                   <span className={`text-xs px-2 py-0.5 rounded-full ${prof.isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                     {prof.isActive ? 'Ativo' : 'Inativo'}
                   </span>
                   {prof.joinedByInvite && (
                     <span className="text-[10px] text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/10 uppercase tracking-wider font-bold">Via Convite</span>
                   )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
