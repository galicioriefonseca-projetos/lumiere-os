import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db, auth } from '@/lib/firebase';
import { collection, query, onSnapshot, doc, setDoc, updateDoc, where, Timestamp, deleteDoc } from 'firebase/firestore';
import { Professional } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchBar } from '@/components/ui/search-bar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Loader2, Plus, Edit2, Power, PowerOff, UserMinus, Link2, Copy, Trash2, Check, Share2, MessageSquare,
  ChevronDown, ChevronUp, Search, Filter, Mail, Phone, Calendar, Sparkles
} from 'lucide-react';
import { PROFESSIONAL_SPECIALTIES } from '../../data/professionalSpecialties';
import { TeamInsightsCard } from '../../components/TeamInsightsCard';

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
  inviteType: 'manager' | 'receptionist' | 'attendant' | 'professional' | 'function_link' | 'team_public_link';
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

  // Team public link states
  const [teamInviteLink, setTeamInviteLink] = useState('');
  const [isTeamDialogOpen, setIsTeamDialogOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    role: '',
    phone: '',
    email: '',
  });

  const [primaryFunction, setPrimaryFunction] = useState('');
  const [customPrimary, setCustomPrimary] = useState('');
  const [additionalFunctions, setAdditionalFunctions] = useState<string[]>([]);
  const [customAdicional, setCustomAdicional] = useState('');

  const [inviteFormData, setInviteFormData] = useState({
    inviteType: 'professional' as Invite['inviteType'],
    category: '',
    email: '',
  });
  const [generatedLink, setGeneratedLink] = useState('');
  const [copiedLink, setCopiedLink] = useState('');

  // Premium collapse & filtration states
  const [isInvitesCollapsed, setIsInvitesCollapsed] = useState(() => localStorage.getItem('lumiere_invites_section_collapsed') === 'true');
  const [filterType, setFilterType] = useState<'all' | 'active' | 'inactive' | 'manager' | 'professional'>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

    const allowedLimit = salonData.plan === 'founder' ? Math.max(salonData.professionalsLimit || 0, 22) : salonData.professionalsLimit;
    if (!editingProf && !isAdmin && professionals.length >= allowedLimit) {
      toast.error(`Você atingiu o limite de ${allowedLimit} profissionais do seu plano.`);
      return;
    }

    const finalPrimary = (primaryFunction === 'Outro' ? customPrimary.trim() : primaryFunction) || 'Função não definida';
    
    // Cleanup functions and avoid duplicates
    let rawExtras: string[] = [];
    additionalFunctions.forEach((f) => {
      if (f === 'Outro') {
        customAdicional.split(',').forEach(part => {
          const trimmed = part.trim();
          if (trimmed) rawExtras.push(trimmed);
        });
      } else {
        rawExtras.push(f);
      }
    });

    const cleanExtras = Array.from(new Set(rawExtras))
      .filter(f => f && f !== finalPrimary);

    const allSpecialties = Array.from(new Set([finalPrimary, ...cleanExtras])).filter(Boolean);

    try {
      if (editingProf) {
        const profRef = doc(db, `salons/${salonData.id}/professionals`, editingProf.id);
        const updatePayload = {
          name: formData.name,
          phone: formData.phone,
          email: formData.email,
          updatedAt: Date.now(),
          
          primaryFunction: finalPrimary,
          professionalFunction: finalPrimary,
          professionalCategory: finalPrimary,
          category: finalPrimary,
          specialty: finalPrimary,
          additionalFunctions: cleanExtras,
          specialties: allSpecialties
        };

        await updateDoc(profRef, updatePayload);

        // Try to update users/{uid} as well (since the professional has a corresponding account of the same ID)
        try {
          const userRef = doc(db, 'users', editingProf.id);
          await updateDoc(userRef, {
            fullName: formData.name,
            phone: formData.phone,
            email: formData.email,
            primaryFunction: finalPrimary,
            professionalFunction: finalPrimary,
            professionalCategory: finalPrimary,
            category: finalPrimary,
            specialty: finalPrimary,
            additionalFunctions: cleanExtras,
            specialties: allSpecialties,
            updatedAt: Date.now()
          });
        } catch (err) {
          console.log("Ignored: corresponding usersDoc not existing or no permission to update root users.", err);
        }

        toast.success('Profissional atualizado!');
      } else {
        const profRef = doc(collection(db, `salons/${salonData.id}/professionals`));
        await setDoc(profRef, {
          id: profRef.id,
          name: formData.name,
          role: 'professional',
          phone: formData.phone,
          email: formData.email || null,
          isActive: true,
          status: 'active',
          
          primaryFunction: finalPrimary,
          professionalFunction: finalPrimary,
          professionalCategory: finalPrimary,
          category: finalPrimary,
          specialty: finalPrimary,
          additionalFunctions: cleanExtras,
          specialties: allSpecialties,
          
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        toast.success('Profissional adicionado!');
      }
      setIsDialogOpen(false);
      setFormData({ name: '', role: '', phone: '', email: '' });
      setPrimaryFunction('');
      setCustomPrimary('');
      setAdditionalFunctions([]);
      setCustomAdicional('');
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

  const handleGetOrCreateTeamLink = async () => {
    if (!salonData) return;
    try {
      const activeLink = invites.find(
        i => i.inviteType === 'team_public_link' && i.status === 'pending'
      );
      
      let finalInviteId = '';
      if (activeLink) {
        finalInviteId = activeLink.id;
      } else {
        const salonId = userData?.salonId || salonData?.id;
        const invitedByUserId = userData?.id || currentUser?.uid || auth.currentUser?.uid;
        if (!invitedByUserId) {
          throw new Error('Identificador do usuário convidante não encontrado (undefined invitedByUserId).');
        }

        const invitedByName = userData?.fullName || currentUser?.displayName || 'Administrador';
        const invitedByEmail = userData?.email || currentUser?.email || '';

        const inviteId = doc(collection(db, 'invites')).id;
        const expiresAtDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365); // 1 year
        const expiresAt = Timestamp.fromDate(expiresAtDate);

        const inviteDoc = {
          id: inviteId,
          salonId,
          salonName: salonData.name,
          role: 'professional',
          inviteType: "team_public_link",
          status: "pending",
          maxUses: 9999,
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
        finalInviteId = inviteId;
      }

      const link = `${window.location.origin}/cadastro-profissional?invite=${finalInviteId}`;
      setTeamInviteLink(link);
      setIsTeamDialogOpen(true);
    } catch (err: any) {
      console.error("Erro ao obter/criar link de equipe:", err);
      toast.error('Erro ao processar link único de equipe: ' + (err.message || ''));
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
    setFormData({ name: prof.name, role: prof.role || 'professional', phone: prof.phone || '', email: prof.email || '' });

    // Fallback sequence: primaryFunction -> professionalFunction -> specialty -> category -> fallback
    const primary = prof.primaryFunction || prof.professionalFunction || prof.specialty || prof.category || '';
    
    if (primary) {
      if (PROFESSIONAL_SPECIALTIES.includes(primary)) {
        setPrimaryFunction(primary);
        setCustomPrimary('');
      } else {
        setPrimaryFunction('Outro');
        setCustomPrimary(primary);
      }
    } else {
      setPrimaryFunction('');
      setCustomPrimary('');
    }

    const extras = prof.additionalFunctions || [];
    const standardExtras = extras.filter(e => PROFESSIONAL_SPECIALTIES.includes(e));
    const customExtras = extras.filter(e => !PROFESSIONAL_SPECIALTIES.includes(e));

    const finalExtrasList = [...standardExtras];
    if (customExtras.length > 0) {
      finalExtrasList.push('Outro');
      setCustomAdicional(customExtras.join(', '));
    } else {
      setCustomAdicional('');
    }
    setAdditionalFunctions(finalExtrasList);

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
      <TeamInsightsCard professionals={professionals} />

      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-heading font-light">Equipe</h2>
          <p className="text-muted-foreground text-sm">
            {professionals.length} de {salonData?.plan === 'founder' ? Math.max(salonData?.professionalsLimit || 0, 22) : salonData?.professionalsLimit} profissionais cadastrados ({activeCount} ativos).
          </p>
        </div>
        
        <div className="flex gap-2 flex-wrap sm:flex-nowrap">
          <Button 
            onClick={handleGetOrCreateTeamLink}
            className="bg-gradient-to-r from-amber-500 to-yellow-600 hover:from-amber-600 hover:to-yellow-700 text-black font-bold rounded-xl h-10 px-4 text-xs shadow-[0_0_15px_rgba(212,175,55,0.15)] transition-all active:scale-[0.98] flex items-center gap-1.5 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-black" /> Link Único da Equipe
          </Button>

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
            if (!open) { 
              setEditingProf(null); 
              setFormData({ name: '', role: '', phone: '', email: '' }); 
              setPrimaryFunction('');
              setCustomPrimary('');
              setAdditionalFunctions([]);
              setCustomAdicional('');
            }
          }}>
            <DialogTrigger asChild>
              <Button 
                 className="bg-primary hover:bg-gold-500 text-black font-semibold h-10 rounded-xl px-4 text-xs cursor-pointer"
                 disabled={!salonData || (!isAdmin && professionals.length >= (salonData?.plan === 'founder' ? Math.max(salonData?.professionalsLimit || 0, 22) : (salonData?.professionalsLimit || 0)))}
                 title={!isAdmin && professionals.length >= (salonData?.plan === 'founder' ? Math.max(salonData?.professionalsLimit || 0, 22) : (salonData?.professionalsLimit || 0)) ? "Limite do plano atingido" : ""}
              >
                <Plus className="w-4 h-4 mr-2" /> Novo Profissional (Direto)
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] bg-card border-border">
              <DialogHeader>
                <DialogTitle className="font-heading">{editingProf ? 'Editar Profissional' : 'Novo Profissional'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome Completo</Label>
                  <Input id="name" required value={formData.name} onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))} className="bg-background" />
                </div>

                {/* Primary Function Selection */}
                <div className="space-y-2">
                  <Label htmlFor="primarySelectModal" className="text-xs font-semibold text-zinc-300">Função Principal <span className="text-[#D4AF37]">*</span></Label>
                  <div className="relative">
                    <select
                      id="primarySelectModal"
                      value={primaryFunction}
                      onChange={(e) => setPrimaryFunction(e.target.value)}
                      required
                      className="w-full bg-zinc-950 border border-white/10 text-white rounded-xl h-10 px-3 text-sm focus:outline-none focus:border-primary appearance-none cursor-pointer"
                    >
                      <option value="">-- Selecione a função principal --</option>
                      {PROFESSIONAL_SPECIALTIES.map((spec) => (
                        <option key={spec} value={spec}>{spec}</option>
                      ))}
                    </select>
                    <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-zinc-500">
                      ▼
                    </div>
                  </div>

                  {primaryFunction === 'Outro' && (
                    <div className="pt-2 animate-fadeIn">
                      <Label htmlFor="customPrimaryInputModal" className="text-[11px] text-zinc-300">Escreva a função principal:</Label>
                      <Input
                        id="customPrimaryInputModal"
                        value={customPrimary}
                        onChange={(e) => setCustomPrimary(e.target.value)}
                        placeholder="Ex: Designer de Cílios Sênior"
                        className="bg-zinc-950 h-10 rounded-xl mt-1 border-primary/30 focus:border-primary"
                        required
                      />
                    </div>
                  )}
                </div>

                {/* Additional Functions Selection */}
                <div className="space-y-2 pt-1">
                  <Label className="text-xs font-semibold text-zinc-300">Funções Extras / Adicionais (Opcional)</Label>
                  <p className="text-[10px] text-zinc-400 font-light">Selecione outras habilidades que o profissional realiza no salão.</p>
                  
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto p-3 bg-zinc-950/70 border border-white/5 rounded-xl scrollbar-thin">
                    {PROFESSIONAL_SPECIALTIES.filter(s => s !== primaryFunction).map((spec) => {
                      const isChecked = additionalFunctions.includes(spec);
                      return (
                        <button
                          key={spec}
                          type="button"
                          onClick={() => {
                            setAdditionalFunctions(prev =>
                              prev.includes(spec) ? prev.filter(p => p !== spec) : [...prev, spec]
                            );
                          }}
                          className={`flex items-center gap-2 p-1.5 rounded-lg text-left text-xs transition-all border ${
                            isChecked 
                              ? 'bg-primary/10 border-primary/40 text-primary font-medium' 
                              : 'bg-black/30 border-white/5 text-zinc-400 hover:border-white/10 hover:text-zinc-200'
                          }`}
                        >
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[10px] ${isChecked ? 'bg-primary border-primary text-black' : 'border-zinc-500'}`}>
                            {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                          </div>
                          <span className="truncate">{spec}</span>
                        </button>
                      );
                    })}
                  </div>

                  {additionalFunctions.includes('Outro') && (
                    <div className="pt-2 animate-fadeIn">
                      <Label htmlFor="customAdicionalInputModal" className="text-[11px] text-zinc-300">Escreva outras funções (separe por vírgula):</Label>
                      <Input
                        id="customAdicionalInputModal"
                        value={customAdicional}
                        onChange={(e) => setCustomAdicional(e.target.value)}
                        placeholder="Ex: Designer de Cílios, Depiladora"
                        className="bg-zinc-950 h-10 rounded-xl mt-1"
                        required
                      />
                    </div>
                  )}
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

          {/* New Team Link Dialog */}
          <Dialog open={isTeamDialogOpen} onOpenChange={setIsTeamDialogOpen}>
            <DialogContent className="sm:max-w-[480px] bg-zinc-950 border border-[#D4AF37]/20 text-white rounded-3xl p-6 shadow-2xl">
              <DialogHeader>
                <DialogTitle className="font-heading font-normal text-white flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" /> Link Único de Equipe (Essenza)
                </DialogTitle>
                <CardDescription className="text-xs text-zinc-400">
                  Envie este link único no WhatsApp do grupo. Cada profissional poderá escolher sua função principal e secundárias por conta própria.
                </CardDescription>
              </DialogHeader>

              <div className="space-y-4 pt-4">
                <div className="flex items-center gap-2 bg-black border border-white/5 p-3 rounded-xl select-all min-w-0">
                  <span className="text-xs font-mono text-primary truncate flex-1">{teamInviteLink}</span>
                  <Button
                    size="icon"
                    onClick={() => copyToClipboard(teamInviteLink)}
                    className="h-7 w-7 bg-primary text-black hover:bg-gold-500 rounded-lg shrink-0"
                  >
                    {copiedLink === teamInviteLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  </Button>
                </div>

                <div className="p-3.5 bg-zinc-900/50 border border-white/5 rounded-2xl space-y-2">
                  <p className="text-[11px] uppercase tracking-wider font-bold text-primary">Mensagem Sugerida para Grupos:</p>
                  <pre className="text-[11.5px] font-sans text-zinc-300 leading-relaxed whitespace-pre-wrap select-all max-h-36 overflow-y-auto">
                    {`Pessoal, segue o link para cadastro no LumiereOS do ${salonData?.name || 'nosso salão'}. Acesse com sua conta Google, escolha sua função principal e marque também as funções extras que você realiza no salão.\n\n${teamInviteLink}`}
                  </pre>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2">
                  <Button
                    type="button"
                    onClick={() => {
                      const msg = `Pessoal, segue o link para cadastro no LumiereOS do ${salonData?.name || 'nosso salão'}. Acesse com sua conta Google, escolha sua função principal e marque também as funções extras que você realiza no salão.\n\n${teamInviteLink}`;
                      navigator.clipboard.writeText(msg);
                      toast.success('Mensagem formatada copiada!');
                    }}
                    variant="outline"
                    className="border-white/10 hover:border-primary/20 hover:text-primary rounded-xl h-10 px-4 text-xs font-semibold flex items-center justify-center gap-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" /> Copiar Mensagem
                  </Button>

                  <a
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                      `Pessoal, segue o link para cadastro no LumiereOS do ${salonData?.name || 'nosso salão'}. Acesse com sua conta Google, escolha sua função principal e marque também as funções extras que você realiza no salão.\n\n${teamInviteLink}`
                    )}`}
                    target="_blank"
                    rel="noreferrer"
                    className="bg-[#25D366] hover:bg-[#128C7E] border border-transparent rounded-xl h-10 px-4 text-xs font-semibold flex items-center justify-center gap-1.5 text-white transition-colors duration-200"
                  >
                    <Share2 className="w-3.5 h-3.5" /> Enviar WhatsApp
                  </a>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Convites Ativos List */}
      {invites.filter(i => i.status === 'pending').length > 0 && (
        <Card className="border border-[#D4AF37]/20 bg-zinc-950/60 rounded-2xl shadow-lg transition-all duration-300 overflow-hidden">
          <CardHeader 
            onClick={() => {
              const nextVal = !isInvitesCollapsed;
              setIsInvitesCollapsed(nextVal);
              localStorage.setItem('lumiere_invites_section_collapsed', String(nextVal));
            }}
            className="pb-3 flex flex-row items-center justify-between gap-4 select-none hover:bg-white/[0.02] active:bg-[#D4AF37]/5 transition-colors duration-200 cursor-pointer"
          >
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-heading font-normal flex items-center gap-2 text-primary">
                  <Link2 className="w-4 h-4 text-[#D4AF37]" /> Links de Convite Ativos
                </CardTitle>
                <span className="text-[10px] bg-[#D4AF37]/10 text-[#D4AF37] px-2 py-0.5 rounded border border-[#D4AF37]/20 uppercase tracking-wider font-mono font-bold">
                  {invites.filter(i => i.status === 'pending').length} ativos
                </span>
              </div>
              <CardDescription className="text-xs mt-0.5 hidden sm:block text-zinc-400">
                Copie e envie para novos profissionais ou gerentes se registrarem em sua equipe do Essenza.
              </CardDescription>
            </div>
            
            <div className="flex items-center gap-2">
              {invites.some(i => i.inviteType === 'function_link' && i.status === 'pending') && (
                <Button 
                  onClick={(e) => {
                    e.stopPropagation();
                    copyGroupMessage();
                  }}
                  variant="outline"
                  size="sm"
                  className="w-full sm:w-auto border-[#D4AF37]/20 hover:border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10 bg-transparent rounded-xl h-9 px-3 text-xs font-semibold flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" /> 
                  <span className="hidden md:inline">Copiar Links Grupo (WA)</span>
                  <span className="md:hidden">Copiar Grupo</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  const nextVal = !isInvitesCollapsed;
                  setIsInvitesCollapsed(nextVal);
                  localStorage.setItem('lumiere_invites_section_collapsed', String(nextVal));
                }}
                className="text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl h-9 px-3 text-xs font-medium flex items-center gap-1 cursor-pointer"
              >
                {isInvitesCollapsed ? (
                  <>
                    <ChevronDown className="w-4 h-4 text-[#D4AF37]" /> Expandir
                  </>
                ) : (
                  <>
                    <ChevronUp className="w-4 h-4 text-[#D4AF37]" /> Ocultar
                  </>
                )}
              </Button>
            </div>
          </CardHeader>
          {!isInvitesCollapsed && (
            <CardContent className="space-y-3 p-4 border-t border-white/5 bg-black/20">
              {invites.filter(i => i.status === 'pending').map((invite) => {
                const link = `${window.location.origin}/cadastro-profissional?invite=${invite.id}`;
                const isCopied = copiedLink === link;
                const isFunctionLink = invite.inviteType === 'function_link';

                const roleDisplay = roleTranslations[invite.role] || invite.role;
                const specialtyDisplay = invite.specialty || invite.category || roleDisplay;

                return (
                  <div key={invite.id} className="flex flex-col sm:flex-row items-shrink sm:items-center justify-between p-3 bg-[#0d0d11] border border-white/5 rounded-xl gap-3 hover:border-[#D4AF37]/20 transition-all duration-300">
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
                        {specialtyDisplay} 
                        <span className="text-[9px] uppercase bg-[#D4AF37]/10 border border-[#D4AF37]/20 text-[#D4AF37] px-2 py-0.5 rounded font-bold font-mono">
                          {isFunctionLink ? `Link por Função` : (roleTranslations[invite.inviteType] || invite.inviteType)}
                        </span>
                      </p>
                      <p className="text-[10px] text-zinc-400 truncate">
                        {isFunctionLink 
                          ? `Acessos: ${invite.usesCount || 0}/${invite.maxUses || 1} • Expira em: ${invite.expiresAt?.toDate ? invite.expiresAt.toDate().toLocaleDateString('pt-BR') : 'N/A'}`
                          : (invite.email ? `Exclusivo para: ${invite.email}` : 'Qualquer e-mail')
                        }
                      </p>
                    </div>
                    
                    <div className="flex gap-1.5 self-stretch sm:self-auto shrink-0 flex-wrap justify-end">
                      <Button 
                        onClick={() => copyToClipboard(link)}
                        className="bg-[#D4AF37] hover:bg-[#b08f2e] text-black flex items-center gap-1 h-7.5 rounded-lg text-xs px-2.5 font-bold transition-all"
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
                            className="border-white/10 text-white hover:bg-white/5 flex items-center gap-1 h-7.5 rounded-lg text-xs px-2.5"
                          >
                            <MessageSquare className="w-3.5 h-3.5 text-[#D4AF37]" />
                            Mensagem
                          </Button>

                          <a 
                            href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                              `Você recebeu um convite para acessar o LumiereOS do ${salonData?.name} como ${invite.specialty || invite.role}. Acesse o link e conclua seu cadastro: ${link}`
                            )}`}
                            target="_blank"
                            rel="noreferrer"
                            className="bg-[#25D366] hover:bg-[#128C7E] flex items-center gap-1 h-7.5 rounded-lg text-xs px-2.5 text-white transition-colors duration-200"
                          >
                            <Share2 className="w-3 h-3" />
                            WhatsApp
                          </a>
                        </>
                      )}

                      <Button 
                        variant="ghost" 
                        onClick={() => cancelInvite(invite.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7.5 w-7.5 p-0 rounded-md flex items-center justify-center transition-colors"
                        title="Cancelar"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          )}
        </Card>
      )}

      {/* Filtros e Busca */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-zinc-950/40 p-4 border border-white/5 rounded-2xl">
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Buscar por nome, e-mail ou especialidade..."
          containerClassName="flex-1 max-w-md"
          className="h-10 bg-black/40 border-white/10 focus:border-[#D4AF37]/50 rounded-xl text-xs text-white"
          showClearText={true}
        />

        <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === 'all' 
                ? 'bg-[#D4AF37] text-black font-bold' 
                : 'bg-white/[0.02] border border-white/5 text-zinc-300 hover:bg-white/5'
            }`}
          >
            Todos ({professionals.length})
          </button>
          <button
            onClick={() => setFilterType('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === 'active' 
                ? 'bg-[#D4AF37] text-black font-bold' 
                : 'bg-white/[0.02] border border-white/5 text-zinc-300 hover:bg-white/5'
            }`}
          >
            Ativos ({professionals.filter(p => p.isActive).length})
          </button>
          <button
            onClick={() => setFilterType('inactive')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === 'inactive' 
                ? 'bg-[#D4AF37] text-black font-bold' 
                : 'bg-white/[0.02] border border-white/5 text-zinc-300 hover:bg-white/5'
            }`}
          >
            Inativos ({professionals.filter(p => !p.isActive).length})
          </button>
          <button
            onClick={() => setFilterType('manager')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === 'manager' 
                ? 'bg-[#D4AF37] text-black font-bold' 
                : 'bg-white/[0.02] border border-white/5 text-zinc-300 hover:bg-white/5'
            }`}
          >
            Gerentes ({professionals.filter(p => p.role === 'manager').length})
          </button>
          <button
            onClick={() => setFilterType('professional')}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
              filterType === 'professional' 
                ? 'bg-[#D4AF37] text-black font-bold' 
                : 'bg-white/[0.02] border border-white/5 text-zinc-300 hover:bg-white/5'
            }`}
          >
            Profissionais ({professionals.filter(p => p.role === 'professional').length})
          </button>
        </div>
      </div>

      {/* Grid de Profissionais */}
      {(() => {
        // Apply filters
        const filteredProfs = professionals.filter(prof => {
          if (filterType === 'active' && !prof.isActive) return false;
          if (filterType === 'inactive' && prof.isActive) return false;
          if (filterType === 'manager' && prof.role !== 'manager') return false;
          if (filterType === 'professional' && prof.role !== 'professional') return false;

          if (!searchQuery.trim()) return true;
          const queryLower = searchQuery.toLowerCase();

          // Search matches across all primary and additional professional functions
          const allFuncs = [
            prof.primaryFunction,
            prof.professionalFunction,
            prof.specialty,
            prof.category,
            ...(prof.additionalFunctions || []),
            ...(prof.specialties || []),
            prof.role
          ].filter(Boolean).map(f => f!.toLowerCase());

          const queryMatch = allFuncs.some(f => f.includes(queryLower));

          return (
            prof.name.toLowerCase().includes(queryLower) ||
            (prof.email || '').toLowerCase().includes(queryLower) ||
            (prof.phone || '').includes(queryLower) ||
            queryMatch
          );
        });

        if (filteredProfs.length === 0) {
          return (
            <Card className="border-white/5 bg-[#09090b]/40 rounded-2xl">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-zinc-800/60 flex items-center justify-center mb-4 border border-white/5">
                  <UserMinus className="w-6 h-6 text-zinc-400" />
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">Nenhum profissional correspondente</h3>
                <p className="text-zinc-400 text-xs max-w-sm font-light">Tente redefinir seus termos de busca ou filtros selecionados na página.</p>
              </CardContent>
            </Card>
          );
        }

        return (
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {filteredProfs.map((prof) => {
              // Priority for display function
              const displayFunction = 
                prof.professionalFunction || 
                prof.specialty || 
                (prof as any).professionalCategory || 
                prof.category || 
                (prof as any).title || 
                roleTranslations[prof.role] || 
                prof.role || 
                'Função não definida';

              // User access profile badge translations
              const getAccessProfileLabel = (r: string) => {
                const map: Record<string, string> = {
                  owner: 'Proprietário',
                  manager: 'Gerente',
                  professional: 'Profissional',
                  attendant: 'Atendente',
                  receptionist: 'Recepcionista',
                  platform_admin: 'Admin Geral'
                };
                return map[r] || roleTranslations[r] || rDisplay(r);
              };

              function rDisplay(str: string) {
                if (!str) return 'Profissional';
                return str.charAt(0).toUpperCase() + str.slice(1);
              }

              // Determine initials for Avatar
              const getInitials = (nameStr: string) => {
                const parts = nameStr.trim().split(/\s+/);
                if (parts.length === 0 || !parts[0]) return 'E';
                if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
                return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
              };

              // Determine Origin label
              const getOriginLabel = (p: typeof prof) => {
                if (p.joinedByInvite) {
                  const linkedInvite = invites.find(inv => inv.id === p.inviteId);
                  if (linkedInvite?.inviteType === 'function_link') {
                    return 'Link por Função';
                  }
                  return 'Convite E-mail';
                }
                return 'Cadastro Direto';
              };

              return (
                <Card 
                  key={prof.id} 
                  className={`relative bg-gradient-to-b from-zinc-900/80 to-black hover:from-black hover:to-zinc-950 border rounded-2xl p-5 transition-all duration-300 shadow-[0_4px_30px_rgba(0,0,0,0.4)] overflow-hidden group flex flex-col justify-between ${
                    prof.isActive 
                      ? 'border-[#D4AF37]/20 hover:border-[#D4AF37]/80 hover:shadow-[0_0_20px_rgba(212,175,55,0.06)]' 
                      : 'border-white/5 opacity-60 grayscale shadow-none'
                  }`}
                >
                  <div>
                    {/* Header: Avatar, Info, Actions */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      {/* Avatar + Name / Specialties */}
                      <div className="flex items-center gap-3">
                        <div className="w-13 h-13 rounded-full bg-gradient-to-br from-zinc-950 to-zinc-900 border-2 border-[#D4AF37]/30 group-hover:border-[#D4AF37]/80 flex items-center justify-center text-[#D4AF37] font-bold text-sm shadow-md shrink-0 select-none transition-all duration-300 transform group-hover:scale-105">
                          {getInitials(prof.name)}
                        </div>
                        <div className="space-y-1 min-w-0">
                          <h4 className="text-[15px] font-semibold text-white leading-tight font-sans truncate pr-8 group-hover:text-[#D4AF37] transition-all" title={prof.name}>
                            {prof.name}
                          </h4>
                          <div className="flex flex-col gap-1 items-start">
                            {/* Real function badge (Gold style) */}
                            <span className="text-[10px] uppercase font-bold text-[#D4AF37] tracking-wider leading-none">
                              {displayFunction}
                            </span>
                            
                            {/* Additional Functions (max 3, plus +N badge) */}
                            {prof.additionalFunctions && prof.additionalFunctions.length > 0 && (
                              <div className="flex items-center flex-wrap gap-1 mt-1 leading-normal max-w-full">
                                <span className="font-semibold text-[8px] uppercase text-zinc-400 tracking-wider">Também:</span>
                                {prof.additionalFunctions.slice(0, 3).map((func) => (
                                  <span key={func} className="text-[8.5px] bg-zinc-950 border border-white/5 text-zinc-300 font-medium px-1.5 py-0.5 rounded">
                                    {func}
                                  </span>
                                ))}
                                {prof.additionalFunctions.length > 3 && (
                                  <span className="text-[9.5px] font-bold text-primary">
                                    +{prof.additionalFunctions.length - 3}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Deletion requested indicator badge */}
                            {(((prof as any).status === 'deletion_requested') || (prof as any).accountDeletionRequested) && (
                              <span className="mt-1 text-[9px] uppercase font-bold text-red-400 bg-red-950/40 border border-red-900/30 px-1.5 py-0.5 rounded leading-none select-none">
                                Solicitou Exclusão
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Top Right Action Button Cluster */}
                      <div className="absolute top-4 right-4 flex gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => openEdit(prof)} 
                          className="h-8 w-8 text-zinc-400 hover:text-[#D4AF37] hover:bg-[#D4AF37]/10 rounded-lg transition-all" 
                          title="Editar cadastro"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => toggleStatus(prof)} 
                          className={`h-8 w-8 rounded-lg transition-all ${
                            prof.isActive 
                              ? 'text-zinc-400 hover:text-red-400 hover:bg-red-500/10' 
                              : 'text-[#D4AF37] hover:text-[#D4AF37] hover:bg-[#D4AF37]/10'
                          }`} 
                          title={prof.isActive ? "Inativar do salão" : "Ativar no salão"}
                        >
                          {prof.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteClick(prof)} 
                          className="h-8 w-8 text-zinc-400 hover:text-red-500 hover:bg-red-500/15 rounded-lg transition-all" 
                          title="Excluir do LumiereOS"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Body Info: Access profile, Contact, Origin, Entry Date */}
                    <div className="space-y-2.5 pt-1 border-t border-white/[0.03]">
                      {/* Access profile badge */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-400 font-light font-sans">Nível de Acesso:</span>
                        <span className="text-[10px] font-medium bg-zinc-900 border border-white/5 text-zinc-300 px-2 py-0.5 rounded-full select-none">
                          {getAccessProfileLabel(prof.role)}
                        </span>
                      </div>

                      {/* Phone metadata */}
                      <div className="flex items-center gap-2 text-xs text-zinc-300 font-sans">
                        <Phone className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="truncate select-all select-none">{prof.phone || 'Telefone não informado'}</span>
                      </div>

                      {/* Email metadata */}
                      <div className="flex items-center gap-2 text-xs text-zinc-300 font-sans">
                        <Mail className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="truncate select-all select-none" title={prof.email}>{prof.email || 'E-mail não informado'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer Status section */}
                  <div className="mt-4 pt-3 border-t border-white/[0.03] flex items-center justify-between gap-2.5">
                    {/* Status indicator badge */}
                    <span className={`text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border ${
                      prof.isActive 
                        ? 'bg-emerald-500/5 text-emerald-400 border-emerald-500/10' 
                        : 'bg-zinc-800/40 text-zinc-400 border-white/5'
                    }`}>
                      {prof.isActive ? 'Ativo' : 'Inativo'}
                    </span>

                    {/* Origin & entry dates metrics */}
                    <div className="flex items-center gap-2.5">
                      <span className="text-[9px] uppercase tracking-widest bg-zinc-900 text-zinc-400 border border-white/5 px-2 py-0.5 rounded font-mono font-bold">
                        {getOriginLabel(prof)}
                      </span>
                      {prof.createdAt && (
                        <span className="text-[9px] text-zinc-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-[#D4AF37]/50" />
                          {new Date(prof.createdAt).toLocaleDateString('pt-BR')}
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
