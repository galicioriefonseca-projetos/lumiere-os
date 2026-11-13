import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { db, auth } from '@/lib/firebase';
import { updateProfile } from 'firebase/auth';
import { collection, query, onSnapshot, getDocs, orderBy, limit, doc, updateDoc } from 'firebase/firestore';
import { AuditLog } from '../../types';
import { 
  User, 
  MapPin, 
  Phone, 
  CreditCard, 
  Users, 
  CheckCircle,
  Gem,
  Database,
  Building,
  Mail,
  ShieldAlert,
  Crown,
  Sparkles,
  CalendarDays,
  ListTodo,
  History,
  Activity,
  Trash2,
  Calendar,
  Link as LinkIcon,
  Edit3,
  Loader2,
  Save,
  Camera,
  Instagram,
  Linkedin,
  Globe,
  MessageCircle,
  CheckCircle2,
  Hash,
  ExternalLink,
  Plus,
  X as XIcon,
  Quote
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatBRL } from '@/lib/utils';
import { toast } from 'sonner';
import { useLexicon } from '../../hooks/useLexicon';
import { SEGMENTS, BusinessSegment } from '../../config/segments';
import AvatarUpload from '@/components/ui/AvatarUpload';
import PwaIconSettingsCard from '@/components/pwa/PwaIconSettingsCard';

export default function AccountPage() {
  const { salonData, userData, currentUser, refreshUserData } = useAuth();
  const { segment, segmentConfig, lexicon, t } = useLexicon();

  // User Profile Editing State (Rede Social & Bio)
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [tagInput, setTagInput] = useState('');
  const [userForm, setUserForm] = useState({
    fullName: '',
    phone: '',
    photoURL: '',
    bio: '',
    headline: '',
    instagram: '',
    linkedin: '',
    whatsapp: '',
    website: '',
    specialties: [] as string[]
  });

  const SUGGESTED_SPECIALTIES = [
    'Mechas & Loiros',
    'Colorimetria',
    'Cortes & Visagismo',
    'Mega Hair',
    'Tratamentos & Terapia',
    'Barba & Navalha',
    'Estética Facial',
    'Unhas & Nail Art',
    'Gestão & Negócios',
    'Atendimento VIP'
  ];

  useEffect(() => {
    if (userData || currentUser) {
      setUserForm({
        fullName: userData?.fullName || currentUser?.displayName || '',
        phone: userData?.phone || '',
        photoURL: userData?.photoURL || (userData as any)?.avatarUrl || currentUser?.photoURL || '',
        bio: (userData as any)?.bio || '',
        headline: (userData as any)?.headline || '',
        instagram: (userData as any)?.instagram || '',
        linkedin: (userData as any)?.linkedin || '',
        whatsapp: (userData as any)?.whatsapp || userData?.phone || '',
        website: (userData as any)?.website || '',
        specialties: Array.isArray((userData as any)?.specialties) ? (userData as any).specialties : []
      });
    }
  }, [userData, currentUser]);

  const handleAddTag = (tag: string) => {
    const clean = tag.trim().replace(/^#/, '');
    if (!clean) return;
    if (userForm.specialties.includes(clean)) return;
    setUserForm(prev => ({ ...prev, specialties: [...prev.specialties, clean] }));
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setUserForm(prev => ({
      ...prev,
      specialties: prev.specialties.filter(t => t !== tagToRemove)
    }));
  };

  const handleSaveUserProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!userForm.fullName.trim()) {
      toast.error('O nome completo é obrigatório.');
      return;
    }

    try {
      setSavingUser(true);
      const cleanName = userForm.fullName.trim();
      const cleanPhone = userForm.phone.trim();
      const cleanPhoto = userForm.photoURL || '';
      const cleanBio = (userForm.bio || '').trim();
      const cleanHeadline = (userForm.headline || '').trim();
      const cleanInstagram = (userForm.instagram || '').trim().replace(/^@/, '');
      const cleanLinkedin = (userForm.linkedin || '').trim();
      const cleanWhatsapp = (userForm.whatsapp || '').trim();
      const cleanWebsite = (userForm.website || '').trim();

      // 1. Atualizar documento do usuário no Firestore
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        fullName: cleanName,
        phone: cleanPhone,
        photoURL: cleanPhoto,
        avatarUrl: cleanPhoto,
        bio: cleanBio,
        headline: cleanHeadline,
        instagram: cleanInstagram,
        linkedin: cleanLinkedin,
        whatsapp: cleanWhatsapp,
        website: cleanWebsite,
        specialties: userForm.specialties || [],
        updatedAt: Date.now()
      });

      // 2. Atualizar perfil no Firebase Auth
      try {
        if (auth?.currentUser) {
          await updateProfile(auth.currentUser, {
            displayName: cleanName,
            photoURL: cleanPhoto || null
          });
        }
      } catch (authErr) {
        console.warn('Falha ao sincronizar auth profile:', authErr);
      }

      // 3. Se for proprietário, sincronizar ownerName na empresa
      if (salonData?.id && (userData?.role === 'owner' || salonData.ownerId === currentUser.uid)) {
        try {
          const salonRef = doc(db, 'salons', salonData.id);
          await updateDoc(salonRef, {
            ownerName: cleanName,
            updatedAt: Date.now()
          });
        } catch (salonErr) {
          console.warn('Falha ao sincronizar ownerName na empresa:', salonErr);
        }
      }

      // 4. Se o usuário estiver vinculado a um registro de profissional, sincronizar dados
      if (salonData?.id && userData?.professionalId) {
        try {
          const profRef = doc(db, 'salons', salonData.id, 'professionals', userData.professionalId);
          await updateDoc(profRef, {
            name: cleanName,
            phone: cleanPhone,
            photoURL: cleanPhoto,
            avatarUrl: cleanPhoto,
            bio: cleanBio,
            headline: cleanHeadline,
            instagram: cleanInstagram,
            specialties: userForm.specialties || [],
            updatedAt: Date.now()
          });
        } catch (profErr) {
          console.warn('Falha ao sincronizar profissional:', profErr);
        }
      }

      // 5. Atualizar contexto da aplicação
      await refreshUserData();
      toast.success('Perfil e "Sobre" atualizados com sucesso!');
      setIsEditingUser(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || 'Erro ao salvar alterações do perfil.');
    } finally {
      setSavingUser(false);
    }
  };

  // Company Profile Editing State
  const [isEditingSalon, setIsEditingSalon] = useState(false);
  const [savingSalon, setSavingSalon] = useState(false);
  const [salonForm, setSalonForm] = useState({
    name: '',
    segment: 'beauty' as BusinessSegment,
    phone: '',
    city: '',
    state: ''
  });

  const [bookingEnabled, setBookingEnabled] = useState(false);
  const [slug, setSlug] = useState('');
  const [bookingMessage, setBookingMessage] = useState('');
  const [workingHours, setWorkingHours] = useState<any>({
    mon: { open: true, start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' },
    tue: { open: true, start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' },
    wed: { open: true, start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' },
    thu: { open: true, start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' },
    fri: { open: true, start: '09:00', end: '18:00', breakStart: '12:00', breakEnd: '13:00' },
    sat: { open: true, start: '09:00', end: '16:00', breakStart: '', breakEnd: '' },
    sun: { open: false, start: '09:00', end: '13:00', breakStart: '', breakEnd: '' },
  });
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    if (salonData) {
      setBookingEnabled(salonData.bookingEnabled || false);
      setSlug(salonData.slug || '');
      setBookingMessage(salonData.bookingMessage || '');
      if (salonData.workingHours) {
        setWorkingHours(salonData.workingHours);
      }
      setSalonForm({
        name: salonData.name || '',
        segment: (salonData.segment as BusinessSegment) || segment || 'beauty',
        phone: salonData.phone || '',
        city: salonData.city || '',
        state: salonData.state || ''
      });
    }
  }, [salonData, segment]);

  const handleSaveSalonDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;
    if (!salonForm.name.trim()) {
      toast.error('O nome da empresa é obrigatório.');
      return;
    }

    try {
      setSavingSalon(true);
      const ref = doc(db, 'salons', salonData.id);
      const defaultModules = SEGMENTS[salonForm.segment]?.defaultModules || SEGMENTS.beauty.defaultModules;
      await updateDoc(ref, {
        name: salonForm.name.trim(),
        segment: salonForm.segment,
        businessType: salonForm.segment === 'agency' ? 'agency' : salonForm.segment === 'consulting' ? 'consulting' : salonForm.segment === 'health' ? 'clinic' : salonForm.segment === 'services' ? 'services' : 'salon',
        enabledModules: defaultModules,
        phone: salonForm.phone.trim(),
        city: salonForm.city.trim(),
        state: salonForm.state.trim().toUpperCase(),
        updatedAt: Date.now()
      });
      toast.success('Dados da empresa, ferramentas e linguagem atualizados com sucesso!');
      setIsEditingSalon(false);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar dados da empresa.');
    } finally {
      setSavingSalon(false);
    }
  };

  const handleSaveBookingConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!salonData) return;
    try {
      setSavingConfig(true);
      const cleanedSlug = slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '');
      const ref = doc(db, 'salons', salonData.id);
      await updateDoc(ref, {
        bookingEnabled,
        slug: cleanedSlug,
        bookingMessage,
        workingHours,
        updatedAt: Date.now()
      });
      toast.success('Configurações de agendamento salvas com sucesso!');
    } catch (err) {
      console.error(err);
      toast.error('Erro ao salvar as configurações.');
    } finally {
      setSavingConfig(false);
    }
  };
  
  // Loading counters to show real usage statistics
  const [stats, setStats] = useState({
    professionalsCount: 0,
    servicesCount: 0,
    clientsCount: 0,
    appointmentsCount: 0,
    checklistsRunCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(true);

  useEffect(() => {
    if (!salonData) return;

    const fetchStats = async () => {
      try {
        const salonId = salonData.id;
        
        // Fetch counters asynchronously
        const qp = query(collection(db, `salons/${salonId}/professionals`));
        const qs = query(collection(db, `salons/${salonId}/services`));
        const qc = query(collection(db, `salons/${salonId}/clients`));
        const qa = query(collection(db, `salons/${salonId}/appointments`));
        const qck = query(collection(db, `salons/${salonId}/checklistRuns`));

        const [pSnap, sSnap, cSnap, aSnap, ckSnap] = await Promise.all([
          getDocs(qp),
          getDocs(qs),
          getDocs(qc),
          getDocs(qa),
          getDocs(qck)
        ]);

        // Filter active only for professionals
        const activeProfs = pSnap.docs.map(d => d.data()).filter(p => p.isActive !== false).length;

        setStats({
          professionalsCount: activeProfs,
          servicesCount: sSnap.size,
          clientsCount: cSnap.size,
          appointmentsCount: aSnap.size,
          checklistsRunCount: ckSnap.size
        });
      } catch (err) {
        console.error("Erro ao carregar métricas da conta:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [salonData]);

  useEffect(() => {
    if (!salonData) return;

    setLoadingAudits(true);
    const salonId = salonData.id;
    const q = query(
      collection(db, `salons/${salonId}/auditLogs`),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logs: AuditLog[] = [];
      snapshot.forEach((doc) => {
        logs.push(doc.data() as AuditLog);
      });
      setAuditLogs(logs);
      setLoadingAudits(false);
    }, (error) => {
      console.error("Erro ao carregar logs de auditoria:", error);
      setLoadingAudits(false);
    });

    return () => unsubscribe();
  }, [salonData]);

  const getRoleBadge = (role: string | undefined) => {
    switch (role) {
      case 'owner':
        return <span className="text-xs bg-[#D4AF37]/25 text-[#D4AF37] border border-[#D4AF37]/35 font-bold px-3 py-1 rounded-full flex items-center gap-1.5"><Crown className="w-3.5 h-3.5 text-[#D4AF37]" /> Proprietário</span>;
      case 'platform_admin':
        return <span className="text-xs bg-red-500/20 text-red-400 border border-red-500/30 font-bold px-3 py-1 rounded-full">Super Admin</span>;
      case 'manager':
        return <span className="text-xs bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 font-bold px-3 py-1 rounded-full">Gerente</span>;
      default:
        return <span className="text-xs bg-zinc-800 text-zinc-300 font-bold px-3 py-1 rounded-full">{role || 'Colaborador'}</span>;
    }
  };

  const currentPlanLabel = salonData?.plan === 'founder' ? 'Plano Founder' : 'Plano Premium Dev';
  const maxProfessionalsSeat = salonData?.plan === 'founder' ? 'Ilimitado' : '5 Colaboradores';

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div>
        <h2 className="text-2xl font-heading font-light tracking-tight text-white flex items-center gap-2">
          <Building className="w-6 h-6 text-[#D4AF37]" />
          Configurações da Conta
        </h2>
        <p className="text-zinc-500 text-xs">
          Acompanhe todos os limites, detalhes do salão, licenças ativas e informações do seu perfil de proprietário.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Profile overview & salon information */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Owner / User Profile Card */}
          <Card className="bg-zinc-950 border-zinc-900 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-6 opacity-5 select-none pointer-events-none">
              <User className="w-32 h-32 text-white" />
            </div>
            
            <CardHeader className="border-b border-zinc-900/50 pb-5">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg font-heading font-light text-white flex items-center gap-2">
                    <User className="w-4 h-4 text-[#D4AF37]" />
                    Meu Perfil Social & Identidade
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">
                    Sua biografia ("Sobre"), redes sociais, fotos e especialidades visíveis no LumièreOS.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {getRoleBadge(userData?.role)}
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditingUser(!isEditingUser)}
                    className="border-zinc-800 text-xs text-zinc-300 hover:text-white hover:bg-zinc-900 h-8 gap-1.5"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-[#D4AF37]" />
                    {isEditingUser ? 'Cancelar' : 'Editar Perfil & Sobre'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="p-6">
              {isEditingUser ? (
                <form onSubmit={handleSaveUserProfile} className="space-y-5">
                  <div className="bg-zinc-900/30 p-4 rounded-2xl border border-zinc-900">
                    <AvatarUpload
                      value={userForm.photoURL}
                      onChange={url => setUserForm(prev => ({ ...prev, photoURL: url }))}
                      name={userForm.fullName || userData?.fullName}
                      size="xl"
                      label="Foto de Perfil"
                      description="Envie uma foto profissional. O sistema ajusta e compacta automaticamente."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 uppercase font-mono font-bold">
                        Nome Completo <span className="text-[#D4AF37]">*</span>
                      </label>
                      <input
                        required
                        value={userForm.fullName}
                        onChange={e => setUserForm(prev => ({ ...prev, fullName: e.target.value }))}
                        placeholder="Seu nome completo"
                        className="w-full h-10 rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 text-sm text-white outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 uppercase font-mono font-bold">
                        Headline / Cargo de Destaque
                      </label>
                      <input
                        value={userForm.headline}
                        onChange={e => setUserForm(prev => ({ ...prev, headline: e.target.value }))}
                        placeholder="Ex: Master Hair Stylist & Educador"
                        className="w-full h-10 rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 text-sm text-white outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    {/* Campo SOBRE / BIOGRAFIA */}
                    <div className="space-y-1 sm:col-span-2">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] text-zinc-400 uppercase font-mono font-bold flex items-center gap-1.5">
                          <Quote className="w-3 h-3 text-[#D4AF37]" /> Sobre Mim (Biografia no Perfil Social)
                        </label>
                        <span className="text-[10px] font-mono text-zinc-500">
                          {userForm.bio.length} / 500 caracteres
                        </span>
                      </div>
                      <textarea
                        rows={4}
                        maxLength={500}
                        value={userForm.bio}
                        onChange={e => setUserForm(prev => ({ ...prev, bio: e.target.value }))}
                        placeholder="Conte um pouco sobre sua trajetória, seu estilo de trabalho, formações e o que seus clientes e colegas mais admiram em você..."
                        className="w-full rounded-xl bg-zinc-900 border border-zinc-800 p-3.5 text-xs text-white outline-none focus:border-[#D4AF37] leading-relaxed resize-none"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 uppercase font-mono font-bold flex items-center gap-1">
                        <Instagram className="w-3 h-3 text-pink-400" /> Instagram (@usuario)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3.5 top-2.5 text-zinc-500 text-sm">@</span>
                        <input
                          value={userForm.instagram}
                          onChange={e => setUserForm(prev => ({ ...prev, instagram: e.target.value.replace(/^@/, '') }))}
                          placeholder="seuperfil"
                          className="w-full h-10 rounded-xl bg-zinc-900 border border-zinc-800 pl-8 pr-3.5 text-sm text-white outline-none focus:border-[#D4AF37]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 uppercase font-mono font-bold flex items-center gap-1">
                        <MessageCircle className="w-3 h-3 text-emerald-400" /> WhatsApp de Contato
                      </label>
                      <input
                        value={userForm.whatsapp}
                        onChange={e => setUserForm(prev => ({ ...prev, whatsapp: e.target.value }))}
                        placeholder="(00) 00000-0000"
                        className="w-full h-10 rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 text-sm text-white outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-400 uppercase font-mono font-bold flex items-center gap-1">
                        <Linkedin className="w-3 h-3 text-sky-400" /> LinkedIn (Opcional)
                      </label>
                      <input
                        value={userForm.linkedin}
                        onChange={e => setUserForm(prev => ({ ...prev, linkedin: e.target.value }))}
                        placeholder="linkedin.com/in/seuperfil"
                        className="w-full h-10 rounded-xl bg-zinc-900 border border-zinc-800 px-3.5 text-sm text-white outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 uppercase font-mono font-bold">
                        E-mail de Acesso (Não alterável)
                      </label>
                      <input
                        disabled
                        value={currentUser?.email || userData?.email || ''}
                        className="w-full h-10 rounded-xl bg-zinc-950 border border-zinc-900 px-3.5 text-sm text-zinc-500 cursor-not-allowed outline-none"
                      />
                    </div>

                    {/* Especialidades e Tags */}
                    <div className="space-y-2 sm:col-span-2 pt-2 border-t border-zinc-900">
                      <label className="text-[10px] text-zinc-400 uppercase font-mono font-bold flex items-center gap-1">
                        <Hash className="w-3 h-3 text-[#D4AF37]" /> Especialidades & Tags de Destaque
                      </label>
                      
                      {/* Tags selecionadas */}
                      <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 bg-zinc-900/40 rounded-xl border border-zinc-900">
                        {userForm.specialties.length === 0 ? (
                          <span className="text-xs text-zinc-500 italic p-1">Nenhuma tag adicionada. Escolha as sugestões abaixo ou digite.</span>
                        ) : (
                          userForm.specialties.map(tag => (
                            <span
                              key={tag}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#D4AF37]/15 text-[#D4AF37] border border-[#D4AF37]/30"
                            >
                              #{tag}
                              <button
                                type="button"
                                onClick={() => handleRemoveTag(tag)}
                                className="hover:text-white ml-0.5"
                              >
                                <XIcon className="w-3 h-3" />
                              </button>
                            </span>
                          ))
                        )}
                      </div>

                      {/* Input para adicionar nova tag */}
                      <div className="flex gap-2">
                        <input
                          value={tagInput}
                          onChange={e => setTagInput(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddTag(tagInput);
                            }
                          }}
                          placeholder="Digite uma especialidade (ex: Colorimetria, Loiros, Gestão) e clique em Adicionar"
                          className="flex-1 h-9 rounded-xl bg-zinc-900 border border-zinc-800 px-3 text-xs text-white outline-none focus:border-[#D4AF37]"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddTag(tagInput)}
                          className="h-9 text-xs border-zinc-800 text-zinc-300 hover:text-white"
                        >
                          <Plus className="w-3.5 h-3.5 mr-1 text-[#D4AF37]" /> Adicionar
                        </Button>
                      </div>

                      {/* Sugestões rápidas */}
                      <div className="flex flex-wrap gap-1 pt-1">
                        <span className="text-[10px] text-zinc-500 mr-1 self-center">Sugestões:</span>
                        {SUGGESTED_SPECIALTIES.map(s => {
                          const isAdded = userForm.specialties.includes(s);
                          return (
                            <button
                              key={s}
                              type="button"
                              onClick={() => isAdded ? handleRemoveTag(s) : handleAddTag(s)}
                              className={`text-[10px] px-2 py-0.5 rounded-md border transition ${
                                isAdded 
                                  ? 'bg-[#D4AF37] text-black font-bold border-[#D4AF37]' 
                                  : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700 hover:text-white'
                              }`}
                            >
                              {isAdded ? `✓ ${s}` : `+ ${s}`}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t border-zinc-900">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setIsEditingUser(false)}
                      className="text-xs text-zinc-400"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={savingUser}
                      className="bg-[#D4AF37] hover:bg-[#c49f2c] text-black font-bold text-xs gap-1.5"
                    >
                      {savingUser ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {savingUser ? 'Salvando...' : 'Salvar Perfil & Sobre'}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-5">
                  {/* Banner Decorativo de Fundo Social */}
                  <div className="relative h-28 w-full bg-gradient-to-r from-emerald-950/70 via-[#132c22] to-[#08120d] rounded-2xl overflow-hidden border border-zinc-800/80 shadow-inner">
                    <div className="absolute top-0 right-0 p-4 opacity-15 pointer-events-none">
                      <Crown className="w-24 h-24 text-[#D4AF37]" />
                    </div>
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#D4AF37]/10 via-transparent to-transparent pointer-events-none" />
                    <div className="absolute bottom-3 right-4 flex items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-black/60 backdrop-blur-md text-[#D4AF37] border border-[#D4AF37]/30 shadow-sm">
                        <Sparkles className="w-3 h-3 text-[#D4AF37]" /> Membro Oficial
                      </span>
                    </div>
                  </div>

                  {/* Foto de Perfil Sobreposta e Informações Principais */}
                  <div className="flex flex-col md:flex-row items-center md:items-start gap-5 px-1 -mt-16 md:-mt-14 relative z-10">
                    <div className="relative shrink-0">
                      <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-[#D4AF37] bg-zinc-950 shadow-2xl flex items-center justify-center ring-4 ring-black">
                        {userData?.photoURL || (userData as any)?.avatarUrl || currentUser?.photoURL ? (
                          <img 
                            src={userData?.photoURL || (userData as any)?.avatarUrl || currentUser?.photoURL || ''} 
                            alt={userData?.fullName || 'Avatar'} 
                            className="w-full h-full object-cover" 
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-zinc-900 to-black flex items-center justify-center text-[#D4AF37] font-bold text-2xl">
                            {userData?.fullName?.charAt(0).toUpperCase() || 'U'}
                          </div>
                        )}
                      </div>
                      <span className="absolute bottom-1 right-1 w-4 h-4 bg-emerald-500 border-2 border-black rounded-full" title="Conta ativa" />
                    </div>

                    <div className="flex-1 w-full space-y-3 text-center md:text-left">
                      <div>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                          <h3 className="text-xl font-bold text-white tracking-tight">
                            {userData?.fullName || currentUser?.displayName || 'Membro Lumière'}
                          </h3>
                          {getRoleBadge(userData?.role)}
                        </div>
                        <p className="text-sm text-[#D4AF37] font-medium mt-0.5">
                          {(userData as any)?.headline || (userData?.role === 'owner' ? 'Proprietário & Gestor Executivo' : 'Profissional da Beleza')}
                        </p>
                      </div>

                      {/* Box do "Sobre Mim" (Bio) */}
                      <div className="bg-zinc-900/40 p-4 rounded-2xl border border-zinc-800/80 text-left">
                        <div className="flex items-center gap-1.5 text-[10px] uppercase font-mono font-bold text-zinc-400 mb-1.5">
                          <Quote className="w-3 h-3 text-[#D4AF37]" /> Sobre Mim
                        </div>
                        {(userData as any)?.bio ? (
                          <p className="text-xs text-zinc-200 leading-relaxed whitespace-pre-line">
                            {(userData as any).bio}
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-500 italic">
                            Nenhum "Sobre" adicionado ainda. Clique em "Editar Perfil & Sobre" para descrever sua assinatura de trabalho e encantar seus clientes e equipe!
                          </p>
                        )}
                      </div>

                      {/* Redes Sociais Integradas */}
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 pt-1">
                        {(userData as any)?.instagram && (
                          <a
                            href={`https://instagram.com/${(userData as any).instagram.replace(/^@/, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pink-500/10 hover:bg-pink-500/20 text-pink-300 border border-pink-500/25 text-xs font-semibold transition"
                          >
                            <Instagram className="w-3.5 h-3.5" />
                            @{(userData as any).instagram.replace(/^@/, '')}
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        )}

                        {((userData as any)?.whatsapp || userData?.phone) && (
                          <a
                            href={`https://wa.me/55${((userData as any)?.whatsapp || userData?.phone || '').replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/25 text-xs font-semibold transition"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            {((userData as any)?.whatsapp || userData?.phone)}
                          </a>
                        )}

                        {(userData as any)?.linkedin && (
                          <a
                            href={(userData as any).linkedin.startsWith('http') ? (userData as any).linkedin : `https://${(userData as any).linkedin}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/25 text-xs font-semibold transition"
                          >
                            <Linkedin className="w-3.5 h-3.5" />
                            LinkedIn
                            <ExternalLink className="w-3 h-3 opacity-60" />
                          </a>
                        )}
                      </div>

                      {/* Tags & Especialidades */}
                      {Array.isArray((userData as any)?.specialties) && (userData as any).specialties.length > 0 && (
                        <div className="space-y-1.5 text-left pt-1">
                          <span className="text-[10px] uppercase font-mono font-bold text-zinc-500 block">
                            Especialidades & Tags
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            {(userData as any).specialties.map((spec: string, i: number) => (
                              <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-[#D4AF37]/10 text-[#D4AF37] border border-[#D4AF37]/25">
                                <Hash className="w-3 h-3 opacity-60" /> {spec}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Dados Básicos de Registro */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-zinc-900 text-left">
                        <div className="space-y-0.5 bg-zinc-900/30 p-2.5 rounded-xl border border-zinc-900">
                          <span className="text-[10px] text-zinc-500 uppercase font-mono flex items-center gap-1">
                            <Mail className="w-3 h-3" /> E-mail de Registro
                          </span>
                          <span className="text-xs font-medium text-white truncate block">{currentUser?.email || userData?.email}</span>
                        </div>
                        <div className="space-y-0.5 bg-zinc-900/30 p-2.5 rounded-xl border border-zinc-900">
                          <span className="text-[10px] text-zinc-500 uppercase font-mono flex items-center gap-1">
                            <Building className="w-3 h-3" /> Empresa Vinculada
                          </span>
                          <span className="text-xs font-medium text-white truncate block">{salonData?.name || 'LumièreOS'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Salon Details Card */}
          <Card className="bg-zinc-950 border-zinc-900">
            <CardHeader className="border-b border-zinc-900/50 pb-5">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg font-heading font-light text-white flex items-center gap-2">
                    <Building className="w-4 h-4 text-[#D4AF37]" />
                    Cadastro & Segmento da Empresa
                  </CardTitle>
                  <CardDescription className="text-xs text-zinc-500">Dados cadastrais e nicho de atuação do seu negócio no LumièreOS.</CardDescription>
                </div>
                {['owner', 'platform_admin'].includes(userData?.role || '') && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setIsEditingSalon(!isEditingSalon)}
                    className="border-zinc-800 text-xs text-zinc-300 hover:text-white hover:bg-zinc-900 h-8"
                  >
                    {isEditingSalon ? 'Cancelar' : 'Editar Dados'}
                  </Button>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="p-6 space-y-4">
              {isEditingSalon ? (
                <form onSubmit={handleSaveSalonDetails} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[10px] text-zinc-500 uppercase font-mono">Nome da Empresa / Estabelecimento</label>
                      <input
                        required
                        value={salonForm.name}
                        onChange={e => setSalonForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Ex: Agência Digital ou Salão Elegance"
                        className="w-full h-10 rounded-xl bg-zinc-900 border border-zinc-800 px-3 text-sm text-white outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    <div className="space-y-1 sm:col-span-2">
                      <label className="text-[10px] text-zinc-500 uppercase font-mono">Segmento de Atuação</label>
                      <select
                        value={salonForm.segment}
                        onChange={e => setSalonForm(prev => ({ ...prev, segment: e.target.value as BusinessSegment }))}
                        className="w-full h-10 rounded-xl bg-zinc-900 border border-zinc-800 px-3 text-sm text-white outline-none focus:border-[#D4AF37]"
                      >
                        <option value="agency">Agência de Marketing & Digital (Redes Sociais, Google, Sites, WhatsApp)</option>
                        <option value="consulting">Consultoria & Gestão Empresarial</option>
                        <option value="beauty">Beleza & Estética (Salões, Barbearias, Clínicas)</option>
                        <option value="health">Saúde & Terapias (Consultórios, Clínicas)</option>
                        <option value="services">Prestador de Serviços Geral & Profissionais Liberais</option>
                      </select>
                      <p className="text-[11px] text-zinc-500 mt-1">
                        O segmento adapta automaticamente os termos, relatórios, templates e atalhos do sistema.
                      </p>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] text-zinc-500 uppercase font-mono">Telefone / WhatsApp</label>
                      <input
                        value={salonForm.phone}
                        onChange={e => setSalonForm(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="(00) 00000-0000"
                        className="w-full h-10 rounded-xl bg-zinc-900 border border-zinc-800 px-3 text-sm text-white outline-none focus:border-[#D4AF37]"
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="text-[10px] text-zinc-500 uppercase font-mono">Cidade</label>
                          <input
                            value={salonForm.city}
                            onChange={e => setSalonForm(prev => ({ ...prev, city: e.target.value }))}
                            placeholder="Cidade"
                            className="w-full h-10 rounded-xl bg-zinc-900 border border-zinc-800 px-3 text-sm text-white outline-none focus:border-[#D4AF37]"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-zinc-500 uppercase font-mono">UF</label>
                          <input
                            value={salonForm.state}
                            maxLength={2}
                            onChange={e => setSalonForm(prev => ({ ...prev, state: e.target.value.toUpperCase() }))}
                            placeholder="UF"
                            className="w-full h-10 rounded-xl bg-zinc-900 border border-zinc-800 px-3 text-sm text-white outline-none focus:border-[#D4AF37] uppercase"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 border-t border-zinc-900">
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setIsEditingSalon(false)}
                      className="text-xs text-zinc-400"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="submit"
                      disabled={savingSalon}
                      className="bg-[#D4AF37] hover:bg-[#c49f2c] text-black font-bold text-xs"
                    >
                      {savingSalon ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-mono">Nome da Empresa</span>
                    <span className="text-sm font-semibold text-white block mt-0.5 border-b border-zinc-900 pb-1.5">{salonData?.name || 'Não cadastrado'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-mono">Segmento Atual</span>
                    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#D4AF37] bg-[#D4AF37]/10 px-2.5 py-1 rounded-full border border-[#D4AF37]/25 mt-0.5">
                      <Sparkles className="w-3 h-3" />
                      {segmentConfig?.name || 'Beleza & Estética'}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-mono flex items-center gap-1"><Phone className="w-3 h-3" /> Telefone de Contato</span>
                    <span className="text-sm font-semibold text-white block mt-0.5 border-b border-zinc-900 pb-1.5">{salonData?.phone || 'Não cadastrado'}</span>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase font-mono flex items-center gap-1"><MapPin className="w-3 h-3" /> Cidade / Estado</span>
                    <span className="text-sm font-semibold text-white block mt-0.5 border-b border-zinc-900 pb-1.5">{salonData?.city ? `${salonData.city} - ${salonData.state || 'MG'}` : 'Belo Horizonte - MG'}</span>
                  </div>
                  <div className="sm:col-span-2 bg-zinc-900/30 p-3 rounded-xl border border-zinc-900 text-xs text-zinc-400 leading-relaxed">
                    <strong className="text-zinc-300 block mb-0.5">{segmentConfig?.badge}</strong>
                    {segmentConfig?.description}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Configurações de Agendamento Online e Link Comercial */}
          <Card className="bg-zinc-950 border-zinc-900">
            <CardHeader className="border-b border-zinc-900/50 pb-5">
              <CardTitle className="text-lg font-heading font-light text-white flex items-center gap-2">
                <Calendar className="w-4 h-4 text-[#D4AF37]" />
                Agendamento Online & Link Comercial
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">
                Configure as regras do seu portal público para captação direta de clientes via link no Instagram ou WhatsApp.
              </CardDescription>
            </CardHeader>

            <CardContent className="p-6">
              <form onSubmit={handleSaveBookingConfig} className="space-y-6">
                <fieldset disabled={!['owner', 'manager', 'platform_admin'].includes(userData?.role || '')} className="space-y-6 border-none p-0 m-0">
                  
                  {/* Ativar/Desativar */}
                  <div className="flex items-center justify-between p-4 bg-zinc-900/20 border border-zinc-900 rounded-2xl">
                    <div className="space-y-0.5">
                      <label className="text-sm font-bold text-white block">Ativar Agendamento Online</label>
                      <span className="text-xs text-zinc-500">Permitir que clientes agendem serviços sem precisar de login.</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBookingEnabled(!bookingEnabled)}
                      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                        bookingEnabled ? 'bg-emerald-500' : 'bg-zinc-800'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          bookingEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </div>

                  {/* slug */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-300 font-mono uppercase">URL do Portal de Agendamento</label>
                    <div className="flex rounded-xl shadow-sm">
                      <span className="inline-flex items-center px-3 rounded-l-xl border border-r-0 border-zinc-800 bg-zinc-900 text-zinc-500 font-mono text-xs">
                        lumiereos.com/agendar/
                      </span>
                      <input
                        required
                        type="text"
                        placeholder="slug-unico-do-salao"
                        value={slug}
                        onChange={(e) => setSlug(e.target.value)}
                        className="flex-1 bg-zinc-950 border border-zinc-800 focus:border-zinc-700 min-w-0 rounded-r-xl px-3 py-2 text-xs focus:outline-none placeholder-zinc-500 text-white font-mono font-bold"
                      />
                    </div>
                    {slug && bookingEnabled && (
                      <p className="text-xs text-zinc-500 flex items-center gap-1 mt-1.5">
                        <LinkIcon className="w-3.5 h-3.5 text-zinc-400" />
                        Seu link ativo: 
                        <a 
                          href={`/agendar/${slug.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer" 
                          className="text-emerald-400 hover:text-emerald-300 font-mono font-semibold underline ml-1"
                        >
                          abrir link em nova guia
                        </a>
                      </p>
                    )}
                  </div>

                  {/* Boas-vindas bookingMessage */}
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-zinc-300 font-mono uppercase">Mensagem de Boas-Vindas</label>
                    <textarea
                      rows={3}
                      placeholder="Seja bem-vindo ao portal de agendamentos! Reserve seu horário..."
                      value={bookingMessage}
                      onChange={(e) => setBookingMessage(e.target.value)}
                      className="w-full bg-zinc-905 border border-zinc-800 focus:border-zinc-700 rounded-xl px-3 py-2 text-xs focus:outline-none placeholder-zinc-500 text-white leading-relaxed resize-none"
                    />
                  </div>

                  {/* Working Hours */}
                  <div className="space-y-4">
                    <div className="border-b border-zinc-900 pb-2">
                      <label className="text-xs font-bold text-zinc-300 font-mono uppercase">Dias de Funcionamento & Almoço</label>
                      <p className="text-[11px] text-zinc-500 mt-0.5">Configure os dias de trabalho, horários de expediente e o intervalo de almoço.</p>
                    </div>

                    <div className="grid gap-3.5">
                      {Object.keys(workingHours).map((dayKey) => {
                        const wh = workingHours[dayKey];
                        const dayLabels: { [key: string]: string } = {
                          mon: 'Segunda-feira',
                          tue: 'Terça-feira',
                          wed: 'Quarta-feira',
                          thu: 'Quinta-feira',
                          fri: 'Sexta-feira',
                          sat: 'Sábado',
                          sun: 'Domingo'
                        };

                        return (
                          <div 
                            key={dayKey} 
                            className={`p-3.5 rounded-xl border transition flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                              wh.open 
                                ? 'bg-zinc-900/40 border-zinc-900' 
                                : 'bg-transparent border-zinc-900/50 opacity-40'
                            }`}
                          >
                            <div className="flex items-center gap-2.5">
                              <input
                                type="checkbox"
                                checked={wh.open}
                                onChange={(e) => {
                                  setWorkingHours((p: any) => ({
                                    ...p,
                                    [dayKey]: { ...p[dayKey], open: e.target.checked }
                                  }));
                                }}
                                className="w-4 h-4 rounded border-zinc-800 bg-zinc-950 text-white focus:ring-0 cursor-pointer"
                              />
                              <span className="text-xs font-bold text-white">{dayLabels[dayKey]}</span>
                            </div>

                            {wh.open && (
                              <div className="flex flex-wrap items-center gap-3 text-xs">
                                <div className="flex items-center gap-1.5 bg-zinc-950 p-1.5 rounded-lg border border-zinc-900">
                                  <span className="text-[10px] text-zinc-500 font-mono uppercase">Expediente:</span>
                                  <input 
                                    type="time" 
                                    value={wh.start} 
                                    onChange={(e) => {
                                      setWorkingHours((p: any) => ({
                                        ...p,
                                        [dayKey]: { ...p[dayKey], start: e.target.value }
                                      }));
                                    }}
                                    className="bg-transparent text-white font-mono max-w-[70px] outline-none border-none p-0 focus:ring-0 text-center"
                                  />
                                  <span className="text-zinc-500">as</span>
                                  <input 
                                    type="time" 
                                    value={wh.end} 
                                    onChange={(e) => {
                                      setWorkingHours((p: any) => ({
                                        ...p,
                                        [dayKey]: { ...p[dayKey], end: e.target.value }
                                      }));
                                    }}
                                    className="bg-transparent text-white font-mono max-w-[70px] outline-none border-none p-0 focus:ring-0 text-center"
                                  />
                                </div>

                                <div className="flex items-center gap-1.5 bg-zinc-950 p-1.5 rounded-lg border border-zinc-900">
                                  <span className="text-[10px] text-zinc-500 font-mono uppercase">Almoço:</span>
                                  <input 
                                    type="time" 
                                    value={wh.breakStart || ''} 
                                    placeholder="Sem"
                                    onChange={(e) => {
                                      setWorkingHours((p: any) => ({
                                        ...p,
                                        [dayKey]: { ...p[dayKey], breakStart: e.target.value }
                                      }));
                                    }}
                                    className="bg-transparent text-white font-mono max-w-[70px] outline-none border-none p-0 focus:ring-0 text-center placeholder-zinc-500"
                                  />
                                  <span className="text-zinc-500">as</span>
                                  <input 
                                    type="time" 
                                    value={wh.breakEnd || ''} 
                                    placeholder="Sem"
                                    onChange={(e) => {
                                      setWorkingHours((p: any) => ({
                                        ...p,
                                        [dayKey]: { ...p[dayKey], breakEnd: e.target.value }
                                      }));
                                    }}
                                    className="bg-transparent text-white font-mono max-w-[70px] outline-none border-none p-0 focus:ring-0 text-center placeholder-zinc-500"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Apenas donos e gerentes veem e salvam */}
                  {['owner', 'manager', 'platform_admin'].includes(userData?.role || '') ? (
                    <Button 
                      type="submit" 
                      disabled={savingConfig}
                      className="w-full bg-white hover:bg-zinc-100 text-black h-11 font-semibold rounded-xl transition flex items-center justify-center gap-2 text-xs"
                    >
                      {savingConfig ? 'Gravando Alterações...' : 'Salvar Configurações de Agendamento'}
                    </Button>
                  ) : (
                    <div className="p-3 bg-zinc-900/20 border border-zinc-900 text-zinc-500 rounded-xl text-center text-xs">
                      Apenas administradores (proprietários/gerentes) podem editar as configurações de agendamento online.
                    </div>
                  )}

                </fieldset>
              </form>
            </CardContent>
          </Card>

          {/* Configuração & Customização do Ícone PWA */}
          <PwaIconSettingsCard />
        </div>

        {/* Right column: Subscription Plan, seats, and database usage */}
        <div className="space-y-6">
          
          {/* Subscription and active seats limit */}
          <Card className="bg-zinc-950 border-zinc-900 overflow-hidden relative">
            <div className="absolute -top-4 -right-4 w-20 h-20 bg-[#D4AF37]/5 rounded-full blur-xl" />
            
            <CardHeader className="border-b border-zinc-900/50 pb-5">
              <CardTitle className="text-md font-heading font-light text-white flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[#D4AF37]" />
                Inscrição & Licenciamento
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">Status atual do seu plano Lumière e limites operacionais.</CardDescription>
            </CardHeader>

            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-3 bg-[#D4AF37]/5 border border-[#D4AF37]/20 p-4 rounded-xl">
                <Crown className="w-5 h-5 text-[#D4AF37] shrink-0" />
                <div>
                  <h4 className="text-sm font-extrabold text-[#D4AF37]">{currentPlanLabel}</h4>
                  <p className="text-[10px] text-zinc-400">Assinatura Digital Ativa e Segura</p>
                </div>
              </div>

              <div className="space-y-1 hover:bg-zinc-900/10 p-2.5 rounded-xl transition-all">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-zinc-400 font-medium">Assentos de Equipe Utilizados</span>
                  <span className="font-mono font-bold text-[#D4AF37]">{stats.professionalsCount} ativos</span>
                </div>
                <div className="w-full bg-zinc-900 rounded-full h-1.5 mt-2">
                  <div 
                    className="bg-[#D4AF37] h-1.5 rounded-full" 
                    style={{ width: `${salonData?.plan === 'founder' ? 35 : (stats.professionalsCount / 5) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-zinc-500 mt-1.5">
                  <span>Capacidade do Plano</span>
                  <span>{maxProfessionalsSeat}</span>
                </div>
              </div>

              <div className="border-t border-zinc-900/50 pt-3 space-y-2 text-xs">
                <div className="flex justify-between text-zinc-400">
                  <span>Renovação Próxima</span>
                  <span className="text-white font-semibold flex items-center gap-1"><Sparkles className="w-3.5 h-3.5 text-amber-500" /> Benefício Vitalício</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Valor de Mensalidade</span>
                  <span className="text-white font-mono font-semibold">Sem cobrança (Founder)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Core Telemetry and Usage Audits */}
          <Card className="bg-zinc-950 border-zinc-900">
            <CardHeader className="border-b border-zinc-900/50 pb-5">
              <CardTitle className="text-md font-heading font-light text-white flex items-center gap-1.5">
                <Database className="w-4 h-4 text-purple-400" />
                Métricas de Armazenamento
              </CardTitle>
              <CardDescription className="text-xs text-zinc-500">Métricas consolidadas de uso real do Firestore.</CardDescription>
            </CardHeader>

            <CardContent className="p-6">
              {loading ? (
                <p className="text-xs text-zinc-500">Carregando telemetria...</p>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 justify-between p-2 rounded-lg border border-zinc-900 bg-zinc-900/20">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs">
                      <CalendarDays className="w-4 h-4 text-cyan-400" />
                      <span>Agendamentos Concluídos</span>
                    </div>
                    <span className="font-mono font-bold text-white text-xs">{stats.appointmentsCount}</span>
                  </div>

                  <div className="flex items-center gap-3 justify-between p-2 rounded-lg border border-zinc-900 bg-zinc-900/20">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs">
                      <ListTodo className="w-4 h-4 text-green-400" />
                      <span>Checklists Executados</span>
                    </div>
                    <span className="font-mono font-bold text-white text-xs">{stats.checklistsRunCount}</span>
                  </div>

                  <div className="flex items-center gap-3 justify-between p-2 rounded-lg border border-zinc-900 bg-zinc-900/20">
                    <div className="flex items-center gap-2 text-zinc-400 text-xs">
                      <Users className="w-4 h-4 text-purple-400" />
                      <span>Clientes Cadastrados</span>
                    </div>
                    <span className="font-mono font-bold text-white text-xs">{stats.clientsCount}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </div>

      </div>

      {/* Histórico de Auditoria do Estabelecimento */}
      <Card className="bg-zinc-950 border-zinc-900 overflow-hidden">
        <CardHeader className="border-b border-zinc-900/50 pb-5">
          <CardTitle className="text-lg font-heading font-light text-white flex items-center gap-2">
            <History className="w-5 h-5 text-[#D4AF37]" />
            Histórico de Alterações e Auditoria (Rastreabilidade)
          </CardTitle>
          <CardDescription className="text-xs text-zinc-500">
            Registro cronológico e imutável de ações e alterações críticas realizadas pelos usuários nas coleções do Firestore do salão.
          </CardDescription>
        </CardHeader>

        <CardContent className="p-6">
          {loadingAudits ? (
            <div className="flex items-center gap-2 text-zinc-500 py-8 text-xs font-mono justify-center">
              <Activity className="w-4 h-4 animate-spin text-purple-400" /> Carregando trilha de auditoria...
            </div>
          ) : auditLogs.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-zinc-900 rounded-xl">
              <History className="w-8 h-8 text-zinc-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-zinc-400">Nenhuma ação crítica registrada</p>
              <p className="text-xs text-zinc-500 mt-1">Os logs de novas alterações aparecerão aqui em tempo real.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs pb-2 border-b border-zinc-900">
                <span className="text-zinc-400 font-mono">Últimas {auditLogs.length} operações registradas</span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded">Rastreabilidade Ativa (Imutável)</span>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-full space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {auditLogs.map((log) => {
                    const getActionBadge = (action: string) => {
                      switch (action) {
                        case 'create':
                          return <span className="text-[10px] bg-green-500/10 border border-green-500/20 text-green-400 px-2 py-0.5 rounded font-mono font-bold uppercase">CRIAR</span>;
                        case 'update':
                          return <span className="text-[10px] bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-mono font-bold uppercase">EDITAR</span>;
                        case 'delete':
                          return <span className="text-[10px] bg-red-500/10 border border-red-500/20 text-red-400 px-2 py-0.5 rounded font-mono font-bold uppercase">APAGAR</span>;
                        case 'status_change':
                          return <span className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-mono font-bold uppercase">STATUS</span>;
                        case 'report':
                          return <span className="text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-400 px-2 py-0.5 rounded font-mono font-bold uppercase">REPORTAR</span>;
                        default:
                          return <span className="text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-400 px-2 py-0.5 rounded font-mono font-bold uppercase">{action}</span>;
                      }
                    };

                    const getRoleText = (role: string) => {
                      switch (role) {
                        case 'owner': return 'Proprietário';
                        case 'manager': return 'Gerente';
                        case 'receptionist': return 'Recepcionista';
                        case 'professional': return 'Colaborador';
                        case 'platform_admin': return 'Super Admin';
                        default: return 'Colaborador';
                      }
                    };

                    const dateStr = new Date(log.createdAt).toLocaleString('pt-BR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    });

                    return (
                      <div 
                        key={log.id} 
                        className="p-3.5 bg-zinc-900/20 hover:bg-zinc-900/40 border border-zinc-900/60 rounded-xl transition-all space-y-2 text-xs"
                      >
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                          <div className="flex items-center gap-2 shrink-0">
                            {getActionBadge(log.action)}
                            <span className="text-zinc-500 font-mono text-[10px]">{dateStr}</span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-white font-medium">{log.userName}</span>
                            <span className="text-zinc-650 font-mono text-[10px]">({getRoleText(log.userRole)})</span>
                            <span className="text-zinc-600 font-mono text-[10px]">•</span>
                            <span className="text-zinc-400 font-mono text-[11px]">{log.userEmail}</span>
                          </div>
                        </div>

                        <div className="pl-0 sm:pl-1 mt-1">
                          <p className="text-zinc-300 leading-relaxed font-light">{log.description}</p>
                        </div>
                        
                        {log.details && (
                          <div className="p-2.5 bg-zinc-950/80 rounded-lg border border-zinc-900/40 text-[10px] font-mono text-zinc-500 max-h-[100px] overflow-y-auto mt-2">
                            <span className="text-zinc-600 block mb-1 font-bold">DETALHES DA OPERAÇÃO (ID: {log.targetId}):</span>
                            <pre className="whitespace-pre-wrap leading-tight text-zinc-405">{JSON.stringify(log.details, null, 2)}</pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  );
}
