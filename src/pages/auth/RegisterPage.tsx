import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sparkles } from 'lucide-react';
import { auth, db } from '@/lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { toast } from 'sonner';

export default function RegisterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const planParam = searchParams.get('plan') || 'start';
  
  const [formData, setFormData] = useState({
    ownerName: '',
    email: '',
    phone: '',
    password: '',
    salonName: '',
    businessType: 'salon',
    city: '',
    state: '',
    professionalsCount: '1-3',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      // 1. Create Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;
      
      await updateProfile(user, { displayName: formData.ownerName });

      // Calculate trial end date (7 days from now)
      const now = Date.now();
      const trialEndsAt = now + 7 * 24 * 60 * 60 * 1000;

      // Map professionals limits based on plan
      let limit = 3;
      if (planParam === 'studio' || planParam === 'founder') limit = 10;
      if (planParam === 'performance') limit = 20;
      if (planParam === 'network') limit = 999;
      
      // Auto-generate a Salon ID (could just use a random string, but simpler to let Firestore auto-generate. Wait, we use setDoc, so we need an ID)
      const salonId = crypto.randomUUID();

      // 3. Create Salon Document
      const salonData = {
        id: salonId,
        name: formData.salonName,
        ownerName: formData.ownerName,
        ownerId: user.uid,
        ownerEmail: formData.email,
        phone: formData.phone,
        businessType: formData.businessType,
        city: formData.city,
        state: formData.state,
        plan: planParam,
        subscriptionStatus: 'trial',
        activationStatus: 'active',
        trialEndsAt: trialEndsAt,
        isActive: true,
        professionalsLimit: limit,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'salons', salonId), salonData);

      // 2. Create User Document
      const userData = {
        id: user.uid,
        fullName: formData.ownerName,
        email: formData.email,
        phone: formData.phone,
        role: 'owner',
        salonId: salonId,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(doc(db, 'users', user.uid), userData);

      toast.success('Conta criada com sucesso! Bem-vindo ao Lumiere.');
      navigate('/onboarding/equipe', { replace: true });
      
    } catch (error: any) {
      console.error(error);
      toast.error('Erro ao criar conta: ' + (error.message || 'Erro desconhecido'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary/10 to-transparent -z-10" />
      
      <div className="sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="flex justify-center mb-6">
          <Link to="/" className="flex items-center gap-2 group">
            <Sparkles className="w-10 h-10 text-primary transition-transform group-hover:scale-110" />
            <span className="text-3xl font-heading font-medium tracking-wide">Lumiere</span>
          </Link>
        </div>
        <h2 className="text-center text-3xl font-light font-heading tracking-tight text-foreground">
          Comece seu teste de 7 dias
        </h2>
        <p className="mt-2 text-center text-sm text-muted-foreground uppercase tracking-wider">
          Plano Selecionado: <span className="text-primary font-bold">{planParam}</span>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-xl">
        <div className="bg-card/40 backdrop-blur-xl py-8 px-4 shadow-2xl border border-white/10 sm:rounded-3xl sm:px-10">
          <form className="space-y-6" onSubmit={handleSubmit}>
            
            <div className="space-y-4">
              <h3 className="text-lg font-heading border-b border-white/10 pb-2">Seus Dados</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ownerName">Nome Completo</Label>
                  <Input id="ownerName" name="ownerName" required value={formData.ownerName} onChange={handleChange} className="bg-black/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">WhatsApp</Label>
                  <Input id="phone" name="phone" required value={formData.phone} onChange={handleChange} className="bg-black/50" placeholder="(11) 99999-9999" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" name="email" type="email" required value={formData.email} onChange={handleChange} className="bg-black/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <Input id="password" name="password" type="password" required value={formData.password} onChange={handleChange} className="bg-black/50" />
                </div>
              </div>
            </div>

            <div className="space-y-4 pt-4">
              <h3 className="text-lg font-heading border-b border-white/10 pb-2">Dados do Negócio</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="salonName">Nome do Negócio</Label>
                  <Input id="salonName" name="salonName" required value={formData.salonName} onChange={handleChange} className="bg-black/50" />
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Negócio</Label>
                  <Select value={formData.businessType} onValueChange={(v) => handleSelectChange('businessType', v)}>
                    <SelectTrigger className="bg-black/50">
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salon">Salão de Beleza</SelectItem>
                      <SelectItem value="clinic">Clínica de Estética</SelectItem>
                      <SelectItem value="barbershop">Barbearia</SelectItem>
                      <SelectItem value="studio">Studio</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">Cidade</Label>
                  <Input id="city" name="city" required value={formData.city} onChange={handleChange} className="bg-black/50" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">Estado</Label>
                  <Input id="state" name="state" required value={formData.state} onChange={handleChange} className="bg-black/50" placeholder="SP" />
                </div>
              </div>
            </div>

            <div className="pt-4">
              <Button type="submit" disabled={loading} className="w-full rounded-full h-14 bg-primary hover:bg-gold-400 text-black font-medium text-lg uppercase tracking-wide">
                {loading ? 'Criando Conta...' : 'Criar Minha Conta'}
              </Button>
            </div>
            
          </form>
          
          <div className="mt-6 text-center">
            <p className="text-sm text-muted-foreground">
              Já tem uma conta?{' '}
              <Link to="/login" className="font-medium text-primary hover:text-gold-400">
                Acesse aqui
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
