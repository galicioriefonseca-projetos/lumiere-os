import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as AuthUser, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { User, Salon, Role } from '../types';

interface AuthContextType {
  currentUser: AuthUser | null;
  userData: User | null;
  salonData: Salon | null;
  isPlatformAdmin: boolean;
  loading: boolean;
  syncError: string | null;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  signInWithGoogle: () => Promise<AuthUser>;
  signInWithGoogleForRegister: (
    salonFields: {
      salonName: string;
      businessType: string;
      city: string;
      state: string;
      phone: string;
      plan: string;
      limit: number;
    },
    optionalFullName?: string
  ) => Promise<AuthUser>;
  signInWithGoogleForInvite: (
    inviteData: any,
    phone?: string,
    optionalFullName?: string,
    choices?: { primaryFunction?: string; additionalFunctions?: string[] }
  ) => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userData: null,
  salonData: null,
  isPlatformAdmin: false,
  loading: true,
  syncError: null,
  logout: async () => {},
  refreshUserData: async () => {},
  signInWithGoogle: async () => { throw new Error('Not implemented'); },
  signInWithGoogleForRegister: async () => { throw new Error('Not implemented'); },
  signInWithGoogleForInvite: async () => { throw new Error('Not implemented'); },
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [salonData, setSalonData] = useState<Salon | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);


  if (!auth || !db) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card p-8 rounded-2xl border border-destructive/30 text-center shadow-lg">
          <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
          </div>
          <h2 className="text-2xl font-heading mb-3">Configuração Ausente</h2>
          <p className="text-muted-foreground text-sm font-light">
            As variáveis de ambiente do Firebase não foram encontradas.
            <br/><br/>
            Adicione <b>VITE_FIREBASE_API_KEY</b> e demais chaves no painel <i>Settings &gt; Secrets</i> ou no arquivo <code>.env</code> para continuar.
          </p>
        </div>
      </div>
    );
  }

   const logSecurityState = (details: {
    uid: string;
    email: string | null;
    userDocExists: boolean;
    platformAdminDocExists: boolean;
    finalRole: string | null;
    finalSalonId: string | null;
    salonDataLoaded: boolean;
    error: string | null;
  }) => {
    console.log(`[SecurityLog] SECURE AUTH SYNC REPORT:
- UID autenticado: ${details.uid}
- Email: ${details.email}
- users/{uid} existe?: ${details.userDocExists}
- platformAdmins/{uid} existe?: ${details.platformAdminDocExists}
- role final: ${details.finalRole}
- salonId final: ${details.finalSalonId}
- salonData carregou?: ${details.salonDataLoaded}
- erro final: ${details.error || 'Nenhum'}`);
  };

  const runDemoBootstrapFallback = async (uid: string, email: string, displayName: string | null) => {
    console.log("[TEMPORARY BOOTSTRAP FALLBACK] Iniciando para", email, "UID:", uid);
    const demoSalonId = 'demo_salon_lumiere';
    const now = Date.now();
    
    try {
      // 1. PRIMARIAMENTE, criamos ou garantimos que o documento users/{uid} existe no Firestore.
      // Pelas regras do Firestore, para acessar o salão e subcoleções, o documento 'users/{uid}'
      // deve existir e possuir o salonId correspondente. Como o 'create' de seu próprio perfil
      // é permitido para qualquer usuário autenticado que não tente se passar por platform_admin,
      // esta operação de create/setDoc SEMPRE tem permissão garantida sem exigir nada prévio.
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      
      let uData: any;
      if (!userSnap.exists()) {
        uData = {
          id: uid,
          fullName: displayName || 'Leandro Fonseca',
          email: email,
          phone: '17996140963',
          role: 'owner',
          isActive: true,
          salonId: demoSalonId,
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(userRef, uData);
        console.log("[TEMPORARY BOOTSTRAP FALLBACK] Perfil de usuário de Leandro cadastrado com sucesso:", uid);
      } else {
        uData = { ...userSnap.data(), id: uid };
        console.log("[TEMPORARY BOOTSTRAP FALLBACK] Perfil de Leandro já existe no Firestore.");
        
        // Verifica se os campos salonId ou role diferem e tenta atualizar de forma segura
        if (uData.role !== 'owner' || uData.salonId !== demoSalonId) {
          try {
            await updateDoc(userRef, {
              role: 'owner',
              salonId: demoSalonId,
              updatedAt: now,
            });
            uData.role = 'owner';
            uData.salonId = demoSalonId;
            console.log("[TEMPORARY BOOTSTRAP FALLBACK] Vínculos de owner e salonId atualizados no Firestore.");
          } catch (updateErr) {
            console.warn("[TEMPORARY BOOTSTRAP FALLBACK] Update do user_doc bloqueado pelas regras (esperado se não houver privilégio platform_admin de escrita direta, prosseguindo com dados em memória):", updateErr);
            uData.role = 'owner';
            uData.salonId = demoSalonId;
          }
        }
      }

      // 2. Agora que o 'userDoc' está estabelecido no banco, buscamos o salão com id 'demo_salon_lumiere' por getDoc direto.
      // Isso consome as regras de leitura individuais, passando perfeitamente pela vericação 'userSalonId() == salonId'
      // sem tentar listar a coleção geral 'salons' (que possui restrição a Platform Admins).
      const salonRef = doc(db, 'salons', demoSalonId);
      let salonExists = false;
      
      try {
        const salonSnap = await getDoc(salonRef);
        salonExists = salonSnap.exists();
      } catch (getSalonErr) {
        console.warn("[TEMPORARY BOOTSTRAP FALLBACK] Não foi possível verificar existência do salão por getDoc individual:", getSalonErr);
      }
      
      if (!salonExists) {
        console.log("[TEMPORARY BOOTSTRAP FALLBACK] Criando salão demo 'demo_salon_lumiere' com subcoleções...");
        const newDemoSalon = {
          id: demoSalonId,
          name: 'Lumière Demo Studio',
          ownerName: displayName || 'Leandro Fonseca',
          ownerId: uid,
          ownerEmail: email,
          phone: '17996140963',
          businessType: 'Barbearia / Salão',
          city: 'São José do Rio Preto',
          state: 'SP',
          plan: 'Premium',
          subscriptionStatus: 'active',
          activationStatus: 'active',
          trialEndsAt: now + 30 * 24 * 60 * 60 * 1000,
          isActive: true,
          isDemo: true,
          professionalsLimit: 20,
          createdAt: now,
          updatedAt: now,
        };
        await setDoc(salonRef, newDemoSalon);

        // Seed das subcoleções básicas utilizando escritas diretas por ID para evitar listagens
        // e otimizar a carga de dados iniciais do Dashboard do cliente.
        
        // Profissionais
        await setDoc(doc(db, `salons/${demoSalonId}/professionals`, 'prof_camila'), {
          id: 'prof_camila',
          name: 'Camila Rocha',
          role: 'manager',
          phone: '11999999999',
          email: 'camila@lumiere.demo',
          status: 'active',
          isActive: true,
          commissionRate: 40,
          createdAt: now,
          updatedAt: now
        });

        await setDoc(doc(db, `salons/${demoSalonId}/professionals`, 'prof_bruna'), {
          id: 'prof_bruna',
          name: 'Bruna Almeida',
          role: 'receptionist',
          phone: '11999999999',
          email: 'bruna@lumiere.demo',
          status: 'active',
          isActive: true,
          commissionRate: 0,
          createdAt: now,
          updatedAt: now
        });

        await setDoc(doc(db, `salons/${demoSalonId}/professionals`, 'prof_rafaela'), {
          id: 'prof_rafaela',
          name: 'Rafaela Santos',
          role: 'attendant',
          phone: '11999999999',
          email: 'rafaela@lumiere.demo',
          status: 'active',
          isActive: true,
          commissionRate: 0,
          createdAt: now,
          updatedAt: now
        });

        // Clientes
        await setDoc(doc(db, `salons/${demoSalonId}/clients`, 'client_lucas'), {
          id: 'client_lucas',
          name: 'Lucas Antunes',
          phone: '11988880001',
          email: 'lucas@demo.com',
          notes: 'Cliente VIP',
          createdAt: now,
          updatedAt: now
        });

        await setDoc(doc(db, `salons/${demoSalonId}/clients`, 'client_marcos'), {
          id: 'client_marcos',
          name: 'Marcos Aurelio',
          phone: '11988880002',
          email: 'marcos@demo.com',
          notes: '',
          createdAt: now,
          updatedAt: now
        });

        // Meta Mensal
        const currentMonthStr = new Date().toISOString().substring(0, 7);
        await setDoc(doc(db, `salons/${demoSalonId}/goals`, 'goal_current'), {
          id: 'goal_current',
          month: currentMonthStr,
          targetAmount: 85000,
          currentAmount: 32750,
          type: 'monthly_revenue',
          createdAt: now,
          updatedAt: now
        });

        // Agendamentos de Hoje
        const todayStr = new Date().toISOString().substring(0, 10);
        await setDoc(doc(db, `salons/${demoSalonId}/appointments`, 'appt_1'), {
          id: 'appt_1',
          clientId: 'client_lucas',
          clientName: 'Lucas Antunes',
          professionalId: 'prof_camila',
          professionalName: 'Camila Rocha',
          serviceId: 'srv_corte',
          serviceName: 'Corte Premium',
          date: todayStr,
          time: '10:00',
          status: 'completed',
          price: 120,
          createdAt: now,
          updatedAt: now
        });

        await setDoc(doc(db, `salons/${demoSalonId}/appointments`, 'appt_2'), {
          id: 'appt_2',
          clientId: 'client_marcos',
          clientName: 'Marcos Aurelio',
          professionalId: 'prof_rafaela',
          professionalName: 'Rafaela Santos',
          serviceId: 'srv_barba',
          serviceName: 'Barba Terápica',
          date: todayStr,
          time: '14:30',
          status: 'scheduled',
          price: 80,
          createdAt: now,
          updatedAt: now
        });

        // Checklist Config
        await setDoc(doc(db, `salons/${demoSalonId}/checklists`, 'chk_default'), {
          id: 'chk_default',
          title: 'Checklist de Abertura e Fechamento',
          isActive: true,
          items: [
            { id: 'it_1', label: 'Verificar ar condicionado', required: true, points: 5 },
            { id: 'it_2', label: 'Esterilizar materiais', required: true, points: 5 },
            { id: 'it_3', label: 'Limpeza das bancadas', required: true, points: 5 }
          ],
          createdAt: now,
          updatedAt: now
        });

        // Checklist Daily Run de Hoje
        await setDoc(doc(db, `salons/${demoSalonId}/checklistRuns`, 'run_1'), {
          id: 'run_1',
          checklistId: 'chk_default',
          checklistTitle: 'Checklist de Abertura e Fechamento',
          evaluationDate: todayStr,
          date: todayStr,
          evaluatedProfessionalId: 'prof_camila',
          evaluatedProfessionalName: 'Camila Rocha',
          evaluatorName: 'Leandro Fonseca',
          attendanceStatus: 'present',
          completionPercentage: 100,
          totalScore: 15,
          maxScore: 15,
          createdAt: now,
          updatedAt: now
        });

        console.log("[TEMPORARY BOOTSTRAP FALLBACK] Subcoleções básicas do Lumière Demo Studio criadas com sucesso.");
      } else {
        // Se o salão já existe, certificamos de atualizar seus dados principais com o usuário atual como owner
        try {
          await updateDoc(salonRef, {
            ownerId: uid,
            ownerEmail: email,
            ownerName: displayName || 'Leandro Fonseca',
            updatedAt: now
          });
          console.log("[TEMPORARY BOOTSTRAP FALLBACK] Salão demo atualizado com o UID correspondente.");
        } catch (updateSalonErr) {
          console.warn("[TEMPORARY BOOTSTRAP FALLBACK] Falha ao sintonizar proprietário no salão:", updateSalonErr);
        }
      }

      console.log("[TEMPORARY BOOTSTRAP FALLBACK] Processo de bootstrap operado com sucesso de ponta a ponta!");
      return { uData, demoSalonId };
    } catch (err) {
      console.error("[TEMPORARY BOOTSTRAP FALLBACK] Erro no bootstrap de Leandro Fonseca:", err);
      throw err;
    }
  };

  const fetchUserData = async (uid: string) => {
    try {
      setSyncError(null);
      
      const adminRef = doc(db, 'platformAdmins', uid);
      const adminSnap = await getDoc(adminRef);
      const isPlatformAdminFromColl = adminSnap.exists() || currentUser?.email === 'galicioriefonseca@gmail.com';
      setIsPlatformAdmin(isPlatformAdminFromColl);

      if (currentUser?.email === 'leandropfonseca20@gmail.com') {
        await runDemoBootstrapFallback(uid, currentUser.email, currentUser.displayName);
      }

      const userSnap = await getDoc(doc(db, 'users', uid));
      let uData: User | null = null;
      let userDocExists = userSnap.exists();

      if (userSnap.exists()) {
        uData = { id: userSnap.id, ...userSnap.data() } as User;
        if (isPlatformAdminFromColl || uData.role === 'platform_admin' || currentUser?.email === 'galicioriefonseca@gmail.com') {
          uData.role = 'platform_admin';
          uData.salonId = '';
        }
      } else if (isPlatformAdminFromColl || currentUser?.email === 'galicioriefonseca@gmail.com') {
        uData = {
          id: uid,
          fullName: currentUser?.displayName || 'Gali Ciório Fonseca',
          email: currentUser?.email || 'galicioriefonseca@gmail.com',
          phone: '',
          role: 'platform_admin',
          isActive: true,
          salonId: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as User;
        await setDoc(doc(db, 'users', uid), uData);
        userDocExists = true;
      }

      if (!uData) {
        setUserData(null);
        setSalonData(null);
        setSyncError("Sua conta foi autenticada, mas ainda não está vinculada a um salão. Entre em contato com o administrador.");
        logSecurityState({
          uid,
          email: currentUser?.email || null,
          userDocExists: false,
          platformAdminDocExists: isPlatformAdminFromColl,
          finalRole: null,
          finalSalonId: null,
          salonDataLoaded: false,
          error: "Usuário sem registro users/{uid}",
        });
        return;
      }

      if (uData.role === 'platform_admin') {
        setUserData(uData);
        setSalonData(null);
        setSyncError(null);
        logSecurityState({
          uid,
          email: currentUser?.email || null,
          userDocExists: true,
          platformAdminDocExists: isPlatformAdminFromColl,
          finalRole: 'platform_admin',
          finalSalonId: '',
          salonDataLoaded: false,
          error: null,
        });
        return;
      }

      if (!uData.salonId) {
        setUserData(uData);
        setSalonData(null);
        if (uData.role === 'owner') {
          setSyncError("Sua conta de proprietário ainda não está vinculada a um salão.");
        } else {
          setSyncError("Sua conta de colaborador ainda não está vinculada a um salão.");
        }
        logSecurityState({
          uid,
          email: currentUser?.email || null,
          userDocExists: true,
          platformAdminDocExists: isPlatformAdminFromColl,
          finalRole: uData.role,
          finalSalonId: null,
          salonDataLoaded: false,
          error: "User sem salonId",
        });
        return;
      }

      const salonSnap = await getDoc(doc(db, 'salons', uData.salonId));
      if (salonSnap.exists()) {
        setSalonData({ id: salonSnap.id, ...salonSnap.data() } as Salon);
        setSyncError(null);
        setUserData(uData);
        logSecurityState({
          uid,
          email: currentUser?.email || null,
          userDocExists: true,
          platformAdminDocExists: isPlatformAdminFromColl,
          finalRole: uData.role,
          finalSalonId: uData.salonId,
          salonDataLoaded: true,
          error: null,
        });
      } else {
        setSalonData(null);
        setSyncError("Não foi possível localizar o salão vinculado a esta conta.");
        setUserData(uData);
        logSecurityState({
          uid,
          email: currentUser?.email || null,
          userDocExists: true,
          platformAdminDocExists: isPlatformAdminFromColl,
          finalRole: uData.role,
          finalSalonId: uData.salonId,
          salonDataLoaded: false,
          error: "Salão ID inexistente no Firestore",
        });
      }
    } catch (error: any) {
      console.error('Error fetching user data manually:', error);
      setSyncError(error.message || "Erro ao recuperar dados.");
    }
  };

  const refreshUserData = async () => {
    if (currentUser) {
      await fetchUserData(currentUser.uid);
    }
  };

  useEffect(() => {
    let unsubscribeUserSnapshot: (() => void) | null = null;
    let unsubscribeSalonSnapshot: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      
      if (unsubscribeUserSnapshot) {
        unsubscribeUserSnapshot();
        unsubscribeUserSnapshot = null;
      }
      if (unsubscribeSalonSnapshot) {
        unsubscribeSalonSnapshot();
        unsubscribeSalonSnapshot = null;
      }

      if (user) {
        setLoading(true);
        setSyncError(null);
        console.log("[AuthInit] Usuário autenticado no Firebase Auth. UID:", user.uid, "Email:", user.email);

        let isPlatformAdminFromColl = false;
        try {
          const adminRef = doc(db, 'platformAdmins', user.uid);
          const adminSnap = await getDoc(adminRef);
          isPlatformAdminFromColl = adminSnap.exists() || user.email === 'galicioriefonseca@gmail.com';
          setIsPlatformAdmin(isPlatformAdminFromColl);
          console.log("[AuthInit] PlatformAdmin doc existe em platformAdmins/", user.uid, "?", isPlatformAdminFromColl);
        } catch (err) {
          console.error("[AuthInit] Erro ao buscar platformAdmins document:", err);
          if (user.email === 'galicioriefonseca@gmail.com') {
            isPlatformAdminFromColl = true;
            setIsPlatformAdmin(true);
          }
        }

        // TEMPORARY BOOTSTRAP FALLBACK para leandropfonseca20@gmail.com
        if (user.email === 'leandropfonseca20@gmail.com') {
          try {
            await runDemoBootstrapFallback(user.uid, user.email, user.displayName);
          } catch (err) {
            console.error("[AuthInit] Falha ao rodar bootstrap Leandro Fonseca:", err);
          }
        }

        // Listen to users/{uid} document in real-time
        unsubscribeUserSnapshot = onSnapshot(doc(db, 'users', user.uid), async (userSnap) => {
          let uData: User | null = null;
          let userDocExists = userSnap.exists();
          let platformAdminDocExists = isPlatformAdminFromColl;
          let finalRole: string | null = null;
          let finalSalonId: string | null = null;
          let salonDataLoaded = false;
          let currentErr: string | null = null;

          try {
            if (userSnap.exists()) {
              uData = { id: userSnap.id, ...userSnap.data() } as User;
              console.log("[AuthInit] users doc existe. Role:", uData.role, "SalonId:", uData.salonId);
              
              if (isPlatformAdminFromColl || uData.role === 'platform_admin' || user.email === 'galicioriefonseca@gmail.com') {
                uData.role = 'platform_admin';
                uData.salonId = '';
              }
            } else if (isPlatformAdminFromColl || user.email === 'galicioriefonseca@gmail.com') {
              console.log("[AuthInit] users doc não existe, mas platform admin. Gerando perfil virtual...");
              uData = {
                id: user.uid,
                fullName: user.displayName || 'Gali Ciório Fonseca',
                email: user.email || 'galicioriefonseca@gmail.com',
                phone: '',
                role: 'platform_admin',
                isActive: true,
                salonId: '',
                createdAt: Date.now(),
                updatedAt: Date.now(),
              } as User;
              try {
                await setDoc(doc(db, 'users', user.uid), uData);
                userDocExists = true;
              } catch (e) {
                console.error("Error saving virtual platform admin doc:", e);
              }
            }

            if (!uData) {
              setUserData(null);
              setSalonData(null);
              setSyncError("Sua conta foi autenticada, mas ainda não está vinculada a um salão. Entre em contato com o administrador.");
              setLoading(false);
              logSecurityState({
                uid: user.uid,
                email: user.email,
                userDocExists: false,
                platformAdminDocExists: isPlatformAdminFromColl,
                finalRole: null,
                finalSalonId: null,
                salonDataLoaded: false,
                error: "Usuário sem registro users/{uid}",
              });
              return;
            }

            finalRole = uData.role;
            finalSalonId = uData.salonId || '';

            if (uData.role === 'platform_admin') {
              setUserData(uData);
              setSalonData(null);
              setSyncError(null);
              setLoading(false);
              logSecurityState({
                uid: user.uid,
                email: user.email,
                userDocExists: userDocExists,
                platformAdminDocExists: isPlatformAdminFromColl,
                finalRole: uData.role,
                finalSalonId: '',
                salonDataLoaded: false,
                error: null,
              });
              return;
            }

            if (!uData.salonId) {
              setUserData(uData);
              setSalonData(null);
              if (uData.role === 'owner') {
                setSyncError("Sua conta de proprietário ainda não está vinculada a um salão.");
                currentErr = "Owner sem salonId";
              } else {
                setSyncError("Sua conta de colaborador ainda não está vinculada a um salão.");
                currentErr = "User sem salonId";
              }
              setLoading(false);
              logSecurityState({
                uid: user.uid,
                email: user.email,
                userDocExists: userDocExists,
                platformAdminDocExists: isPlatformAdminFromColl,
                finalRole: uData.role,
                finalSalonId: null,
                salonDataLoaded: false,
                error: currentErr,
              });
              return;
            }

            if (unsubscribeSalonSnapshot) {
              unsubscribeSalonSnapshot();
            }
            unsubscribeSalonSnapshot = onSnapshot(doc(db, 'salons', uData.salonId), (salonSnap) => {
              if (salonSnap.exists()) {
                setSalonData({ id: salonSnap.id, ...salonSnap.data() } as Salon);
                setSyncError(null);
                setUserData(uData!);
                setLoading(false);
                logSecurityState({
                  uid: user.uid,
                  email: user.email,
                  userDocExists: userDocExists,
                  platformAdminDocExists: isPlatformAdminFromColl,
                  finalRole: uData!.role,
                  finalSalonId: uData!.salonId,
                  salonDataLoaded: true,
                  error: null,
                });
              } else {
                setSalonData(null);
                setSyncError("Não foi possível localizar o salão vinculado a esta conta.");
                setUserData(uData!);
                setLoading(false);
                logSecurityState({
                  uid: user.uid,
                  email: user.email,
                  userDocExists: userDocExists,
                  platformAdminDocExists: isPlatformAdminFromColl,
                  finalRole: uData!.role,
                  finalSalonId: uData!.salonId,
                  salonDataLoaded: false,
                  error: "Salão ID inexistente no Firestore",
                });
              }
            }, (err) => {
              console.error("[AuthInit] Erro ao ouvir salons doc:", err);
              setSalonData(null);
              setSyncError("Erro de acesso aos dados do salão.");
              setLoading(false);
              logSecurityState({
                uid: user.uid,
                email: user.email,
                userDocExists: userDocExists,
                platformAdminDocExists: isPlatformAdminFromColl,
                finalRole: uData!.role,
                finalSalonId: uData!.salonId,
                salonDataLoaded: false,
                error: err.message,
              });
            });

          } catch (syncErr: any) {
            console.error("[AuthInit] Erro no fluxo de sincronização de snapshot:", syncErr);
            setSyncError(syncErr.message || "Erro de sincronização");
            setLoading(false);
          }
        }, (err) => {
          console.error("[AuthInit] Erro ao escutar users doc snapshot:", err);
          
          if (isPlatformAdminFromColl) {
            console.log("[AuthInit] Ativando perfil virtual de platform_admin sob erro de permissão.");
            setIsPlatformAdmin(true);
            setUserData({
              id: user.uid,
              fullName: user.displayName || 'Platform Admin',
              email: user.email || '',
              phone: '',
              role: 'platform_admin',
              isActive: true,
              salonId: '',
              createdAt: Date.now(),
              updatedAt: Date.now(),
            } as User);
          } else {
            setSyncError("Erro de permissão ou acesso aos dados de usuário no Firestore.");
          }
          setLoading(false);
          logSecurityState({
            uid: user.uid,
            email: user.email,
            userDocExists: false,
            platformAdminDocExists: isPlatformAdminFromColl,
            finalRole: null,
            finalSalonId: null,
            salonDataLoaded: false,
            error: err.message,
          });
        });

      } else {
        setUserData(null);
        setSalonData(null);
        setIsPlatformAdmin(false);
        setSyncError(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubscribeUserSnapshot) unsubscribeUserSnapshot();
      if (unsubscribeSalonSnapshot) unsubscribeSalonSnapshot();
    };
  }, []);

  const logout = async () => {
    setLoading(true);
    await signOut(auth);
    setUserData(null);
    setSalonData(null);
    setIsPlatformAdmin(false);
    setLoading(false);
  };

  const signInWithGoogle = async (): Promise<AuthUser> => {
    const provider = new GoogleAuthProvider();
    console.log("[PlatformAuth] Chamando signInWithPopup...");
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    console.log("[PlatformAuth] Autenticado via Google Popup. UID:", user.uid, "Email:", user.email);
    
    let userDocSnap = null;
    try {
      userDocSnap = await getDoc(doc(db, 'users', user.uid));
      console.log("[PlatformAuth] users doc lido. Existe?", userDocSnap.exists());
    } catch (e) {
      console.warn("[PlatformAuth] Erro ao ler users doc. Ignorando para possível criação...", e);
    }
    
    let adminDocSnap = null;
    try {
      adminDocSnap = await getDoc(doc(db, 'platformAdmins', user.uid));
      console.log("[PlatformAuth] platformAdmins doc lido. Existe?", adminDocSnap.exists());
    } catch (e) {
      console.warn("[PlatformAuth] Erro ao ler platformAdmins doc. Ignorando...", e);
    }
    
    // Check if user is platform admin in platformAdmins/{uid} OR if users/{uid}.role === 'platform_admin'
    const isPlatformAdminExplicit = (adminDocSnap && adminDocSnap.exists()) || (userDocSnap && userDocSnap.exists() && userDocSnap.data()?.role === 'platform_admin') || user.email === 'galicioriefonseca@gmail.com';
    console.log("[PlatformAuth] Usuário é platform_admin detectado?", isPlatformAdminExplicit);

    const isDemoOwner = user.email === 'leandropfonseca20@gmail.com';

    if (!userDocSnap || !userDocSnap.exists()) {
      if (isPlatformAdminExplicit) {
        console.log("[PlatformAuth] platform_admin sem documento user. Criando perfil...");
        const now = Date.now();
        const newProfile = {
          id: user.uid,
          fullName: user.displayName || 'Gali Ciório Fonseca',
          email: user.email || '',
          phone: user.phoneNumber || '',
          role: 'platform_admin',
          createdAt: now,
          updatedAt: now,
        };
        try {
          await setDoc(doc(db, 'users', user.uid), newProfile);
          console.log("[PlatformAuth] Perfil gravado com sucesso.");
        } catch (writeErr) {
          console.error("[PlatformAuth] Erro ao gravar perfil users no Firestore:", writeErr);
        }
      } else if (isDemoOwner) {
        console.log("[PlatformAuth] leandropfonseca20@gmail.com sem documento user. Criando perfil de owner de teste...");
        // Find existing demo salon
        let demoSalonId = '';
        try {
          const salonsRef = collection(db, 'salons');
          const q = query(salonsRef, where('isDemo', '==', true));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            demoSalonId = qSnap.docs[0].id;
          }
        } catch (e) {
          console.error("Error finding demo salon:", e);
        }
        
        const now = Date.now();
        const newProfile = {
          id: user.uid,
          fullName: user.displayName || 'Leandro Fonseca',
          email: user.email || '',
          phone: user.phoneNumber || '17996140963',
          role: 'owner',
          salonId: demoSalonId,
          createdAt: now,
          updatedAt: now,
        };
        try {
          await setDoc(doc(db, 'users', user.uid), newProfile);
          console.log("[PlatformAuth] Perfil de owner de teste gravado.");
        } catch (writeErr) {
          console.error("[PlatformAuth] Erro ao gravar perfil de owner no Firestore:", writeErr);
        }
      } else {
        console.log("[PlatformAuth] Bloqueando login: Usuário normal não registrado.");
         await signOut(auth);
         throw { code: 'auth/user-not-registered-google' };
      }
    } else {
      // User doc already exists. Sync role if they are found in platformAdmins
      const currentRole = userDocSnap.data()?.role;
      if (isPlatformAdminExplicit && currentRole !== 'platform_admin') {
        console.log("[PlatformAuth] Sincronizando papel de usuário existente para 'platform_admin'...");
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            role: 'platform_admin',
            updatedAt: Date.now()
          });
          console.log("[PlatformAuth] Papel sincronizado no Firestore.");
        } catch (writeErr) {
          console.error("[PlatformAuth] Erro ao atualizar papel no Firestore:", writeErr);
        }
      } else if (isDemoOwner) {
        // Find existing demo salon
        let demoSalonId = '';
        try {
          const salonsRef = collection(db, 'salons');
          const q = query(salonsRef, where('isDemo', '==', true));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            demoSalonId = qSnap.docs[0].id;
          }
        } catch (e) {
          console.error("Error finding demo salon:", e);
        }
        if (currentRole !== 'owner' || userDocSnap.data()?.salonId !== demoSalonId) {
          console.log("[PlatformAuth] Sincronizando perfil do owner de teste com o salão demo...");
          try {
            await updateDoc(doc(db, 'users', user.uid), {
              role: 'owner',
              salonId: demoSalonId,
              updatedAt: Date.now()
            });
          } catch (writeErr) {
            console.error("[PlatformAuth] Erro ao atualizar papel no Firestore:", writeErr);
          }
        }
      }
    }
    
    return user;
  };

  const signInWithGoogleForRegister = async (
    salonFields: {
      salonName: string;
      businessType: string;
      city: string;
      state: string;
      phone: string;
      plan: string;
      limit: number;
    },
    optionalFullName?: string
  ): Promise<AuthUser> => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      const existingData = userSnap.data();
      if (existingData.salonId) {
        await signOut(auth);
        throw { code: 'auth/social-email-already-linked' };
      }
      
      const now = Date.now();
      const trialEndsAt = now + 7 * 24 * 60 * 60 * 1000;
      const salonId = crypto.randomUUID();
      const fullName = optionalFullName || user.displayName || existingData.fullName || '';

      const salonData = {
        id: salonId,
        name: salonFields.salonName,
        ownerName: fullName,
        ownerId: user.uid,
        ownerEmail: user.email || '',
        phone: salonFields.phone,
        businessType: salonFields.businessType,
        city: salonFields.city,
        state: salonFields.state,
        plan: salonFields.plan,
        subscriptionStatus: 'trial',
        activationStatus: 'active',
        trialEndsAt: trialEndsAt,
        isActive: true,
        professionalsLimit: salonFields.limit,
        createdAt: now,
        updatedAt: now,
      };
      await setDoc(doc(db, 'salons', salonId), salonData);

      await updateDoc(doc(db, 'users', user.uid), {
        salonId: salonId,
        fullName: fullName,
        phone: salonFields.phone,
        role: 'owner',
        updatedAt: now,
      });

      sessionStorage.removeItem('demo_role');
      return user;
    }

    const now = Date.now();
    const trialEndsAt = now + 7 * 24 * 60 * 60 * 1000;
    const salonId = crypto.randomUUID();
    const fullName = optionalFullName || user.displayName || '';

    const salonData = {
      id: salonId,
      name: salonFields.salonName,
      ownerName: fullName,
      ownerId: user.uid,
      ownerEmail: user.email || '',
      phone: salonFields.phone,
      businessType: salonFields.businessType,
      city: salonFields.city,
      state: salonFields.state,
      plan: salonFields.plan,
      subscriptionStatus: 'trial',
      activationStatus: 'active',
      trialEndsAt: trialEndsAt,
      isActive: true,
      professionalsLimit: salonFields.limit,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, 'salons', salonId), salonData);

    const userData = {
      id: user.uid,
      fullName: fullName,
      email: user.email || '',
      phone: salonFields.phone,
      role: 'owner',
      salonId: salonId,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(doc(db, 'users', user.uid), userData);

    sessionStorage.removeItem('demo_role');
    return user;
  };

  const signInWithGoogleForInvite = async (
    inviteData: any,
    phone?: string,
    optionalFullName?: string,
    choices?: { primaryFunction?: string; additionalFunctions?: string[] }
  ): Promise<AuthUser> => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    if (inviteData.email && inviteData.email.trim().toLowerCase() !== user.email?.trim().toLowerCase()) {
      await signOut(auth);
      throw { code: 'auth/invite-email-mismatch', invitedEmail: inviteData.email };
    }

    const userDocRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userDocRef);
    let existingData: any = null;
    let isAlreadyInSameSalon = false;

    if (userSnap.exists()) {
      existingData = userSnap.data();
      if (existingData.salonId) {
        if (existingData.salonId === inviteData.salonId) {
          isAlreadyInSameSalon = true;
        } else {
          await signOut(auth);
          throw { code: 'auth/already-linked-to-other-salon' };
        }
      }
    }

    const now = Date.now();
    const fullName = optionalFullName || user.displayName || inviteData.fullName || userProfileName(user) || '';
    
    function userProfileName(u: any) {
      return u.displayName || '';
    }

    const isTeamPublicLink = inviteData.inviteType === 'team_public_link';
    const isFunctionLink = inviteData.inviteType === 'function_link';
    const isProfInvite = inviteData.inviteType === 'professional';

    const finalRole = isTeamPublicLink ? 'professional' : (isFunctionLink ? (inviteData.role || 'professional') : inviteData.inviteType);
    const isProfRole = finalRole === 'professional' || isProfInvite || isTeamPublicLink;
    const professionUID = isProfRole ? user.uid : '';

    const primaryFunction = isTeamPublicLink 
      ? (choices?.primaryFunction || 'Profissional') 
      : (inviteData.specialty || inviteData.category || 'Profissional');
    const extras = isTeamPublicLink ? (choices?.additionalFunctions || []) : [];
    const allSpecialties = isTeamPublicLink 
      ? Array.from(new Set([primaryFunction, ...extras])).filter(Boolean) 
      : Array.from(new Set([primaryFunction])).filter(Boolean);

    const userProfile: any = {
      id: user.uid,
      fullName: fullName,
      email: user.email || '',
      phone: phone || existingData?.phone || null,
      role: finalRole,
      salonId: inviteData.salonId,
      professionalId: professionUID,
      isActive: existingData?.isActive !== undefined ? existingData.isActive : true,
      status: existingData?.status || 'active',
      createdAt: existingData?.createdAt || now,
      updatedAt: now,
    };

    if (isTeamPublicLink) {
      userProfile.primaryFunction = primaryFunction;
      userProfile.professionalFunction = primaryFunction;
      userProfile.professionalCategory = primaryFunction;
      userProfile.category = primaryFunction;
      userProfile.specialty = primaryFunction;
      userProfile.specialties = allSpecialties;
      userProfile.additionalFunctions = extras;
    } else if (isFunctionLink) {
      userProfile.specialty = inviteData.specialty || '';
      userProfile.professionalFunction = inviteData.professionalFunction || '';
      userProfile.professionalCategory = inviteData.category || '';
      userProfile.category = inviteData.category || '';
    }

    try {
      await setDoc(doc(db, 'users', user.uid), userProfile, { merge: true });
    } catch (e) {
      console.error("Erro ao criar/atualizar usuário:", e);
      throw e;
    }

    if (isTeamPublicLink || isFunctionLink || isProfInvite) {
      const profRecord: any = {
        userId: user.uid,
        professionalId: user.uid,
        name: fullName,
        email: user.email || '',
        phone: phone || existingData?.phone || null,
        role: finalRole,
        status: existingData?.status || 'active',
        isActive: existingData?.isActive !== undefined ? existingData.isActive : true,
        joinedByInvite: true,
        inviteId: inviteData.id,
        inviteType: inviteData.inviteType,
        createdAt: existingData?.createdAt || now,
        updatedAt: now,
      };

      if (isTeamPublicLink) {
        profRecord.primaryFunction = primaryFunction;
        profRecord.professionalFunction = primaryFunction;
        profRecord.professionalCategory = primaryFunction;
        profRecord.category = primaryFunction;
        profRecord.specialty = primaryFunction;
        profRecord.specialties = allSpecialties;
        profRecord.additionalFunctions = extras;
      } else {
        profRecord.category = inviteData.category || 'Profissional';
        profRecord.specialty = inviteData.specialty || inviteData.category || '';
        profRecord.professionalFunction = inviteData.professionalFunction || inviteData.category || '';
      }
      
      try {
        await setDoc(doc(db, `salons/${inviteData.salonId}/professionals`, user.uid), profRecord, { merge: true });
      } catch (e) {
        console.error("Erro ao criar/atualizar profissional no salão:", e);
        throw e;
      }
    }

    try {
      if (isFunctionLink || isTeamPublicLink) {
        const newUses = (inviteData.usesCount || 0) + 1;
        const maxUses = inviteData.maxUses || 99999;
        const finalStatus = newUses >= maxUses ? 'used_limit_reached' : 'pending';

        await updateDoc(doc(db, 'invites', inviteData.id), {
          usesCount: newUses,
          status: finalStatus,
          updatedAt: now,
        });
      } else {
        await updateDoc(doc(db, 'invites', inviteData.id), {
          status: 'accepted',
          acceptedByUserId: user.uid,
          usedAt: now,
          updatedAt: now,
        });
      }
    } catch (e) {
      console.error("Erro ao atualizar convite:", e);
      // Nao relancar erro pois o cadastro em si ja foi concluido com sucesso!
    }

    sessionStorage.removeItem('demo_role');
    return user;
  };

  return (
    <AuthContext.Provider value={{
      currentUser,
      userData,
      salonData,
      isPlatformAdmin,
      loading,
      syncError,
      logout,
      refreshUserData,
      signInWithGoogle,
      signInWithGoogleForRegister,
      signInWithGoogleForInvite
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
