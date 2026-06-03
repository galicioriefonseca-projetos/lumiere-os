import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as AuthUser, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { User, Salon, Role } from '../types';
import { ensureTutorialSalonForLeandro } from '@/lib/seedTutorialSalon';

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
  diagnostics?: {
    firebaseProjectId: string;
    firebaseAuthDomain: string;
    authUid: string | null;
    authEmail: string | null;
    userDocExists: string;
    salonIdFound: string;
    salonsCount: number;
    firestoreError: string;
  };
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
  diagnostics: {
    firebaseProjectId: 'Não informada',
    firebaseAuthDomain: 'Não informada',
    authUid: null,
    authEmail: null,
    userDocExists: 'não',
    salonIdFound: 'Nenhum',
    salonsCount: 0,
    firestoreError: 'Sem erro'
  }
});

const isOfflineError = (error: any): boolean => {
  if (!error) return false;
  const errMsg = error.message || '';
  const errCode = error.code || '';
  return (
    errCode === 'unavailable' ||
    errCode === 'failed-precondition' ||
    errMsg.toLowerCase().includes('offline') ||
    errMsg.toLowerCase().includes('failed to get document')
  );
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [salonData, setSalonData] = useState<Salon | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [diagnostics, setDiagnostics] = useState({
    firebaseProjectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'Não informada',
    firebaseAuthDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'Não informada',
    authUid: null as string | null,
    authEmail: null as string | null,
    userDocExists: 'não',
    salonIdFound: 'Nenhum',
    salonsCount: 0,
    firestoreError: 'Sem erro'
  });

  const updateDiagnostics = (updates: Partial<typeof diagnostics>) => {
    setDiagnostics(prev => ({ ...prev, ...updates }));
  };

  useEffect(() => {
    if (!currentUser) return;
    
    const countSalons = async () => {
      try {
        const snap = await getDocs(collection(db, 'salons'));
        updateDiagnostics({ salonsCount: snap.size });
      } catch (err: any) {
        console.log("diagnostics debug salons count fail:", err);
      }
    };
    
    countSalons();
  }, [currentUser]);


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

  const logAuthDebug = (info: {
    authUid: string | null;
    authEmail: string | null;
    userDocCheck: 'success' | 'error';
    userDocExists: boolean;
    userSalonId: string | null;
    salonDocCheck: 'success' | 'error' | 'none';
    salonDocExists: boolean;
    offlineError: boolean;
  }) => {
    const firebaseProjectId = db?.app?.options?.projectId || import.meta.env.VITE_FIREBASE_PROJECT_ID || 'unknown';
    const userDocPath = info.authUid ? `users/${info.authUid}` : 'none';
    console.log(`[AuthDebug]
- firebaseProjectId: ${firebaseProjectId}
- authUid: ${info.authUid}
- authEmail: ${info.authEmail}
- userDocPath: ${userDocPath}
- userDocCheck: ${info.userDocCheck}
- userDocExists: ${info.userDocExists}
- userSalonId: ${info.userSalonId || 'none'}
- salonDocCheck: ${info.salonDocCheck}
- salonDocExists: ${info.salonDocExists}
- offlineError: ${info.offlineError}`);
  };

  const runDemoBootstrapFallback = async (uid: string, email: string, displayName: string | null) => {
    console.log("[TEMPORARY BOOTSTRAP FALLBACK] Iniciando para", email, "UID:", uid);
    const demoSalonId = 'tutorial_lumiere_studio';
    try {
      await ensureTutorialSalonForLeandro(uid);
      const userSnap = await getDoc(doc(db, 'users', uid));
      const uData = userSnap.exists() ? { ...userSnap.data(), id: uid } : null;
      console.log("[TEMPORARY BOOTSTRAP FALLBACK] Processo de bootstrap operado com sucesso de ponta a ponta!");
      return { uData, demoSalonId };
    } catch (err) {
      console.error("[TEMPORARY BOOTSTRAP FALLBACK] Erro no bootstrap de Leandro Fonseca:", err);
      throw err;
    }
  };

  const trySalonFallback = async (uid: string, email: string | null): Promise<any> => {
    console.log("[AuthFallback] Buscando salão via ownerId ou ownerEmail para resolver conta órfã...", uid, email);
    try {
      const salonsColl = collection(db, 'salons');
      
      // 1. Query by ownerId == uid
      const q1 = query(salonsColl, where('ownerId', '==', uid));
      const snap1 = await getDocs(q1);
      if (!snap1.empty) {
        console.log("[AuthFallback] Salão encontrado por ownerId:", snap1.docs[0].id);
        return snap1.docs[0];
      }

      // 2. Query by ownerEmail == email
      if (email) {
        const q2 = query(salonsColl, where('ownerEmail', '==', email));
        const snap2 = await getDocs(q2);
        if (!snap2.empty) {
          console.log("[AuthFallback] Salão encontrado por ownerEmail:", snap2.docs[0].id);
          return snap2.docs[0];
        }
      }
    } catch (err) {
      console.error("[AuthFallback] Erro ao buscar salão por fallback:", err);
    }
    return null;
  };

  const fetchUserData = async (uid: string) => {
    let userDocCheck: 'success' | 'error' = 'success';
    let userDocExists = false;
    let userSalonId: string | null = null;
    let salonDocCheck: 'success' | 'error' | 'none' = 'none';
    let salonDocExists = false;
    let offlineError = false;

    try {
      setSyncError(null);
      
      const adminRef = doc(db, 'platformAdmins', uid);
      const adminSnap = await getDoc(adminRef);
      const isPlatformAdminFromColl = adminSnap.exists() || currentUser?.email === import.meta.env.VITE_PLATFORM_ADMIN_EMAIL;
      setIsPlatformAdmin(isPlatformAdminFromColl);

      if (currentUser?.email === import.meta.env.VITE_DEMO_USER_EMAIL) {
        await runDemoBootstrapFallback(uid, currentUser.email, currentUser.displayName);
      }

      let userSnap;
      try {
        userSnap = await getDoc(doc(db, 'users', uid));
        userDocExists = userSnap.exists();
        userDocCheck = 'success';
        updateDiagnostics({
          userDocExists: userSnap.exists() ? 'sim' : 'não',
          salonIdFound: userSnap.exists() ? (userSnap.data()?.salonId || 'Nenhum') : 'Nenhum',
          firestoreError: 'Sem erro'
        });
      } catch (err: any) {
        userDocCheck = 'error';
        updateDiagnostics({
          userDocExists: 'não',
          firestoreError: err.message || String(err)
        });
        if (isOfflineError(err)) {
          offlineError = true;
        }
        throw err;
      }

      let uData: User | null = null;

      if (userDocExists) {
        uData = { id: userSnap.id, ...userSnap.data() } as User;
        userSalonId = uData.salonId || null;
        
        // Active status filtering (Task 2 / Compatibilidade com usuários antigos Requirement 5)
        const isBlocked = uData.isActive === false || uData.status === 'inactive' || uData.status === 'deleted';
        if (isBlocked) {
          setUserData(null);
          setSalonData(null);
          setSyncError("Sua conta está inativa. Fale com o administrador.");
          logSecurityState({
            uid,
            email: currentUser?.email || null,
            userDocExists: true,
            platformAdminDocExists: isPlatformAdminFromColl,
            finalRole: uData.role,
            finalSalonId: uData.salonId || null,
            salonDataLoaded: false,
            error: `Conta de usuário inativa/bloqueada (status: ${uData.status}, isActive: ${uData.isActive})`,
          });
          logAuthDebug({
            authUid: uid,
            authEmail: currentUser?.email || null,
            userDocCheck,
            userDocExists,
            userSalonId,
            salonDocCheck,
            salonDocExists,
            offlineError,
          });
          return;
        }

        if (isPlatformAdminFromColl || uData.role === 'platform_admin' || currentUser?.email === import.meta.env.VITE_PLATFORM_ADMIN_EMAIL) {
          uData.role = 'platform_admin';
          uData.salonId = '';
          userSalonId = '';
        }
      } else if (isPlatformAdminFromColl || currentUser?.email === import.meta.env.VITE_PLATFORM_ADMIN_EMAIL) {
        uData = {
          id: uid,
          fullName: currentUser?.displayName || 'Gali Ciório Fonseca',
          email: currentUser?.email || import.meta.env.VITE_PLATFORM_ADMIN_EMAIL || '',
          phone: '',
          role: 'platform_admin',
          isActive: true,
          salonId: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        } as User;
        await setDoc(doc(db, 'users', uid), uData);
        userDocExists = true;
        userSalonId = '';
      }

      if (!uData) {
        // Se users/{uid} não existe e Firestore está online, tentar buscar salão por fallback (Requirement 4)
        const foundSalonDoc = await trySalonFallback(uid, currentUser?.email || null);
        if (foundSalonDoc) {
          console.log("[AuthFallback] Recuperação manual bem sucedida para novo/órfão usuário. Vinculando salão", foundSalonDoc.id, "ao usuário", uid);
          const foundSalonId = foundSalonDoc.id;
          const uRef = doc(db, 'users', uid);
          
          // Verify email and potential duplicate account (Requirement 7)
          const sDataForCheck = foundSalonDoc.data();
          if (currentUser?.email && sDataForCheck?.ownerEmail && currentUser.email.toLowerCase() !== sDataForCheck.ownerEmail.toLowerCase()) {
            console.log("Possível conta duplicada: e-mail autenticado diferente do ownerEmail.");
          }

          uData = {
            id: uid,
            fullName: currentUser?.displayName || sDataForCheck?.ownerName || 'Proprietário',
            email: currentUser?.email || sDataForCheck?.ownerEmail || '',
            phone: currentUser?.phoneNumber || sDataForCheck?.phone || '',
            salonId: foundSalonId,
            role: 'owner',
            isActive: true,
            status: 'active',
            createdAt: Date.now(),
            updatedAt: Date.now()
          } as User;

          await setDoc(uRef, uData);
          userDocExists = true;
          userSalonId = foundSalonId;
        }
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
        logAuthDebug({
          authUid: uid,
          authEmail: currentUser?.email || null,
          userDocCheck,
          userDocExists,
          userSalonId,
          salonDocCheck,
          salonDocExists,
          offlineError,
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
        logAuthDebug({
          authUid: uid,
          authEmail: currentUser?.email || null,
          userDocCheck,
          userDocExists,
          userSalonId,
          salonDocCheck,
          salonDocExists,
          offlineError,
        });
        return;
      }

      let salonDocToLoad = null;
      if (uData.salonId) {
        try {
          salonDocCheck = 'success';
          const salonSnap = await getDoc(doc(db, 'salons', uData.salonId));
          if (salonSnap.exists()) {
            salonDocToLoad = salonSnap;
            salonDocExists = true;
          }
        } catch (err: any) {
          salonDocCheck = 'error';
          if (isOfflineError(err)) {
            offlineError = true;
          }
          throw err;
        }
      }

      // Try fallback (Task 3)
      if (!salonDocToLoad) {
        const foundSalonDoc = await trySalonFallback(uid, currentUser?.email || null);
        if (foundSalonDoc) {
          console.log("[AuthFallback] Recuperação manual bem sucedida. Vinculando salão", foundSalonDoc.id, "ao usuário", uid);
          const foundSalonId = foundSalonDoc.id;
          const uRef = doc(db, 'users', uid);
          
          // Verify email and potential duplicate account (Requirement 7)
          const sDataForCheck = foundSalonDoc.data();
          if (currentUser?.email && sDataForCheck?.ownerEmail && currentUser.email.toLowerCase() !== sDataForCheck.ownerEmail.toLowerCase()) {
            console.log("Possível conta duplicada: e-mail autenticado diferente do ownerEmail.");
          }

          await setDoc(uRef, {
            fullName: currentUser?.displayName || sDataForCheck?.ownerName || 'Proprietário',
            email: currentUser?.email || sDataForCheck?.ownerEmail || '',
            phone: currentUser?.phoneNumber || sDataForCheck?.phone || '',
            salonId: foundSalonId,
            role: 'owner',
            isActive: true,
            status: 'active',
            updatedAt: Date.now()
          }, { merge: true });

          uData.salonId = foundSalonId;
          uData.role = 'owner';
          salonDocToLoad = foundSalonDoc;
          salonDocExists = true;
          userSalonId = foundSalonId;
        }
      }

      if (!uData.salonId) {
        setUserData(uData);
        setSalonData(null);
        setSyncError("Erro: Salão não vinculado. Sua conta precisa estar associada a um salão operacional para acessar o painel.");
        logSecurityState({
          uid,
          email: currentUser?.email || null,
          userDocExists: true,
          platformAdminDocExists: isPlatformAdminFromColl,
          finalRole: uData.role,
          finalSalonId: null,
          salonDataLoaded: false,
          error: "Usuário sem salonId no Firestore e nenhum salão encontrado por fallback (ownerId/ownerEmail)",
        });
        logAuthDebug({
          authUid: uid,
          authEmail: currentUser?.email || null,
          userDocCheck,
          userDocExists,
          userSalonId,
          salonDocCheck,
          salonDocExists,
          offlineError,
        });
        return;
      }

      if (!salonDocToLoad) {
        setUserData(uData);
        setSalonData(null);
        setSyncError(`Erro: Salão não encontrado. O salão vinculado a esta conta no Firestore (ID: ${uData.salonId}) não foi localizado ou foi excluído.`);
        logSecurityState({
          uid,
          email: currentUser?.email || null,
          userDocExists: true,
          platformAdminDocExists: isPlatformAdminFromColl,
          finalRole: uData.role,
          finalSalonId: uData.salonId,
          salonDataLoaded: false,
          error: `ID de salão ${uData.salonId} inexistente ou excluído no Firestore`,
        });
        logAuthDebug({
          authUid: uid,
          authEmail: currentUser?.email || null,
          userDocCheck,
          userDocExists,
          userSalonId,
          salonDocCheck,
          salonDocExists,
          offlineError,
        });
        return;
      }

      const sData = { id: salonDocToLoad.id, ...salonDocToLoad.data() } as Salon;

      // Check salon status (Task 2)
      const isSalonSuspended = sData.isActive === false || sData.activationStatus === 'blocked' || sData.activationStatus === 'canceled';
      if (isSalonSuspended) {
        setSalonData(null);
        setSyncError("Seu salão está suspenso ou inativo. Em caso de dúvidas, fale com o suporte.");
        setUserData(uData);
        logSecurityState({
          uid,
          email: currentUser?.email || null,
          userDocExists: true,
          platformAdminDocExists: isPlatformAdminFromColl,
          finalRole: uData.role,
          finalSalonId: uData.salonId,
          salonDataLoaded: false,
          error: `Salão suspenso ou inativo (activationStatus: ${sData.activationStatus}, isActive: ${sData.isActive})`,
        });
        logAuthDebug({
          authUid: uid,
          authEmail: currentUser?.email || null,
          userDocCheck,
          userDocExists,
          userSalonId,
          salonDocCheck,
          salonDocExists,
          offlineError,
        });
        return;
      }

      setSalonData(sData);
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
      logAuthDebug({
        authUid: uid,
        authEmail: currentUser?.email || null,
        userDocCheck,
        userDocExists,
        userSalonId,
        salonDocCheck,
        salonDocExists,
        offlineError,
      });

    } catch (error: any) {
      console.error('Error fetching user data manually:', error);
      updateDiagnostics({
        firestoreError: error.message || String(error)
      });
      if (isOfflineError(error)) {
        offlineError = true;
        setSyncError("Não foi possível conectar ao banco de dados. Verifique sua conexão e tente novamente.");
      } else {
        setSyncError(error.message || "Erro ao recuperar dados.");
      }
      logAuthDebug({
        authUid: uid,
        authEmail: currentUser?.email || null,
        userDocCheck,
        userDocExists,
        userSalonId,
        salonDocCheck,
        salonDocExists,
        offlineError,
      });
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
        updateDiagnostics({
          authUid: user.uid,
          authEmail: user.email,
        });

        let isPlatformAdminFromColl = false;
        try {
          const adminRef = doc(db, 'platformAdmins', user.uid);
          const adminSnap = await getDoc(adminRef);
          isPlatformAdminFromColl = adminSnap.exists() || user.email === import.meta.env.VITE_PLATFORM_ADMIN_EMAIL;
          setIsPlatformAdmin(isPlatformAdminFromColl);
          console.log("[AuthInit] PlatformAdmin doc existe em platformAdmins/", user.uid, "?", isPlatformAdminFromColl);
        } catch (err) {
          console.error("[AuthInit] Erro ao buscar platformAdmins document:", err);
          if (user.email === import.meta.env.VITE_PLATFORM_ADMIN_EMAIL) {
            isPlatformAdminFromColl = true;
            setIsPlatformAdmin(true);
          }
        }

        // TEMPORARY BOOTSTRAP FALLBACK para leandropfonseca20@gmail.com
        if (user.email === import.meta.env.VITE_DEMO_USER_EMAIL) {
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
          updateDiagnostics({
            userDocExists: userSnap.exists() ? 'sim' : 'não',
            salonIdFound: userSnap.exists() ? (userSnap.data()?.salonId || 'Nenhum') : 'Nenhum',
            firestoreError: 'Sem erro'
          });
          let platformAdminDocExists = isPlatformAdminFromColl;
          let finalRole: string | null = null;
          let finalSalonId: string | null = null;
          let salonDataLoaded = false;

          let userDocCheck: 'success' | 'error' = 'success';
          let userSalonId: string | null = null;
          let salonDocCheck: 'success' | 'error' | 'none' = 'none';
          let salonDocExists = false;
          let offlineError = false;

          try {
            if (userSnap.exists()) {
              uData = { id: userSnap.id, ...userSnap.data() } as User;
              userSalonId = uData.salonId || null;
              console.log("[AuthInit] users doc existe. Role:", uData.role, "SalonId:", uData.salonId);
              
              // Active status filtering (Task 2 / Compatibilidade com usuários antigos Requirement 5)
              const isBlocked = uData.isActive === false || uData.status === 'inactive' || uData.status === 'deleted';
              if (isBlocked) {
                setUserData(null);
                setSalonData(null);
                setSyncError("Sua conta está inativa. Fale com o administrador.");
                setLoading(false);
                logSecurityState({
                  uid: user.uid,
                  email: user.email,
                  userDocExists: true,
                  platformAdminDocExists: isPlatformAdminFromColl,
                  finalRole: uData.role,
                  finalSalonId: uData.salonId || null,
                  salonDataLoaded: false,
                  error: `Conta de usuário inativa/bloqueada (status: ${uData.status}, isActive: ${uData.isActive})`,
                });
                logAuthDebug({
                  authUid: user.uid,
                  authEmail: user.email,
                  userDocCheck,
                  userDocExists,
                  userSalonId,
                  salonDocCheck,
                  salonDocExists,
                  offlineError,
                });
                return;
              }

              if (isPlatformAdminFromColl || uData.role === 'platform_admin' || user.email === import.meta.env.VITE_PLATFORM_ADMIN_EMAIL) {
                uData.role = 'platform_admin';
                uData.salonId = '';
                userSalonId = '';
              }
            } else if (isPlatformAdminFromColl || user.email === import.meta.env.VITE_PLATFORM_ADMIN_EMAIL) {
              console.log("[AuthInit] users doc não existe, mas platform admin. Gerando perfil virtual...");
              uData = {
                id: user.uid,
                fullName: user.displayName || 'Gali Ciório Fonseca',
                email: user.email || import.meta.env.VITE_PLATFORM_ADMIN_EMAIL || '',
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
                userSalonId = '';
                userDocCheck = 'success';
              } catch (e: any) {
                console.error("Error saving virtual platform admin doc:", e);
                if (isOfflineError(e)) {
                  offlineError = true;
                }
              }
            }

            if (!uData) {
              // Se o Firestore estiver online, buscar salão por fallback
              const foundSalonDoc = await trySalonFallback(user.uid, user.email);
              if (foundSalonDoc) {
                console.log("[AuthFallback] Reativo: Salão correspondente localizado por fallback:", foundSalonDoc.id, ". Atualizando usuário...");
                const foundSalonId = foundSalonDoc.id;
                const uRef = doc(db, 'users', user.uid);
                
                // Verify email and potential duplicate account (Requirement 7)
                const sDataForCheck = foundSalonDoc.data();
                if (user.email && sDataForCheck?.ownerEmail && user.email.toLowerCase() !== sDataForCheck.ownerEmail.toLowerCase()) {
                  console.log("Possível conta duplicada: e-mail autenticado diferente do ownerEmail.");
                }

                uData = {
                  id: user.uid,
                  fullName: user.displayName || sDataForCheck?.ownerName || 'Proprietário',
                  email: user.email || sDataForCheck?.ownerEmail || '',
                  phone: user.phoneNumber || sDataForCheck?.phone || '',
                  salonId: foundSalonId,
                  role: 'owner',
                  isActive: true,
                  status: 'active',
                  createdAt: Date.now(),
                  updatedAt: Date.now()
                } as User;

                await setDoc(uRef, uData);
                userDocExists = true;
                userSalonId = foundSalonId;
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
              logAuthDebug({
                authUid: user.uid,
                authEmail: user.email,
                userDocCheck,
                userDocExists,
                userSalonId,
                salonDocCheck,
                salonDocExists,
                offlineError,
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
              logAuthDebug({
                authUid: user.uid,
                authEmail: user.email,
                userDocCheck,
                userDocExists,
                userSalonId,
                salonDocCheck,
                salonDocExists,
                offlineError,
              });
              return;
            }

            let salonDocToLoad = null;
            if (uData.salonId) {
              try {
                salonDocCheck = 'success';
                const salonSnap = await getDoc(doc(db, 'salons', uData.salonId));
                if (salonSnap.exists()) {
                  salonDocToLoad = salonSnap;
                  salonDocExists = true;
                }
              } catch (err: any) {
                salonDocCheck = 'error';
                if (isOfflineError(err)) {
                  offlineError = true;
                }
                throw err;
              }
            }

            // Try fallback (Task 3)
            if (!salonDocToLoad) {
              const foundSalonDoc = await trySalonFallback(user.uid, user.email);
              if (foundSalonDoc) {
                console.log("[AuthFallback] Reativo: Salão correspondente localizado por fallback:", foundSalonDoc.id, ". Atualizando usuário...");
                const foundSalonId = foundSalonDoc.id;
                const uRef = doc(db, 'users', user.uid);
                
                // Verify email and potential duplicate account (Requirement 7)
                const sDataForCheck = foundSalonDoc.data();
                if (user.email && sDataForCheck?.ownerEmail && user.email.toLowerCase() !== sDataForCheck.ownerEmail.toLowerCase()) {
                  console.log("Possível conta duplicada: e-mail autenticado diferente do ownerEmail.");
                }

                await setDoc(uRef, {
                  fullName: user.displayName || sDataForCheck?.ownerName || 'Proprietário',
                  email: user.email || sDataForCheck?.ownerEmail || '',
                  phone: user.phoneNumber || sDataForCheck?.phone || '',
                  salonId: foundSalonId,
                  role: 'owner',
                  isActive: true,
                  status: 'active',
                  updatedAt: Date.now()
                }, { merge: true });
                // Return early; Firestore update will automatically trigger this snapshot listener again.
                return;
              }
            }

            if (!uData.salonId) {
              setUserData(uData);
              setSalonData(null);
              setSyncError("Erro: Salão não vinculado. Sua conta precisa estar associada a um salão operacional para acessar o painel.");
              setLoading(false);
              logSecurityState({
                uid: user.uid,
                email: user.email,
                userDocExists: userDocExists,
                platformAdminDocExists: isPlatformAdminFromColl,
                finalRole: uData.role,
                finalSalonId: null,
                salonDataLoaded: false,
                error: "Usuário sem salonId no Firestore e nenhum salão encontrado por fallback (ownerId/ownerEmail)",
              });
              logAuthDebug({
                authUid: user.uid,
                authEmail: user.email,
                userDocCheck,
                userDocExists,
                userSalonId,
                salonDocCheck,
                salonDocExists,
                offlineError,
              });
              return;
            }

            if (!salonDocToLoad) {
              setUserData(uData);
              setSalonData(null);
              setSyncError(`Erro: Salão não encontrado. O salão vinculado a esta conta no Firestore (ID: ${uData.salonId}) não foi localizado ou foi excluído.`);
              setLoading(false);
              logSecurityState({
                uid: user.uid,
                email: user.email,
                userDocExists: userDocExists,
                platformAdminDocExists: isPlatformAdminFromColl,
                finalRole: uData.role,
                finalSalonId: uData.salonId,
                salonDataLoaded: false,
                error: `ID de salão ${uData.salonId} inexistente ou excluído no Firestore`,
              });
              logAuthDebug({
                authUid: user.uid,
                authEmail: user.email,
                userDocCheck,
                userDocExists,
                userSalonId,
                salonDocCheck,
                salonDocExists,
                offlineError,
              });
              return;
            }

            if (unsubscribeSalonSnapshot) {
              unsubscribeSalonSnapshot();
            }
            unsubscribeSalonSnapshot = onSnapshot(doc(db, 'salons', uData.salonId), (salonSnap) => {
              if (salonSnap.exists()) {
                const sData = { id: salonSnap.id, ...salonSnap.data() } as Salon;

                // Check salon status (Task 2)
                const isSalonSuspended = sData.isActive === false || sData.activationStatus === 'blocked' || sData.activationStatus === 'canceled';
                if (isSalonSuspended) {
                  setSalonData(null);
                  setSyncError("Seu salão está suspenso ou inativo. Em caso de dúvidas, fale com o suporte.");
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
                    error: `Salão suspenso ou inativo (activationStatus: ${sData.activationStatus}, isActive: ${sData.isActive})`,
                  });
                  logAuthDebug({
                    authUid: user.uid,
                    authEmail: user.email,
                    userDocCheck,
                    userDocExists,
                    userSalonId,
                    salonDocCheck: 'success',
                    salonDocExists: true,
                    offlineError: false,
                  });
                  return;
                }

                setSalonData(sData);
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
                logAuthDebug({
                  authUid: user.uid,
                  authEmail: user.email,
                  userDocCheck,
                  userDocExists,
                  userSalonId,
                  salonDocCheck: 'success',
                  salonDocExists: true,
                  offlineError: false,
                });
              } else {
                setSalonData(null);
                setSyncError(`Erro: Salão não encontrado. O salão vinculado a esta conta no Firestore (ID: ${uData!.salonId}) não foi localizado ou foi excluído.`);
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
                  error: `ID de salão ${uData!.salonId} inexistente ou excluído no Firestore`,
                });
                logAuthDebug({
                  authUid: user.uid,
                  authEmail: user.email,
                  userDocCheck,
                  userDocExists,
                  userSalonId,
                  salonDocCheck: 'error',
                  salonDocExists: false,
                  offlineError: false,
                });
              }
            }, (err) => {
              console.error("[AuthInit] Erro ao ouvir salons doc:", err);
              updateDiagnostics({
                firestoreError: err.message || String(err)
              });
              setSalonData(null);
              const isOffline = isOfflineError(err);
              if (isOffline) {
                setSyncError("Não foi possível conectar ao banco de dados. Verifique sua conexão e tente novamente.");
              } else {
                setSyncError("Erro: Dados do salão falharam ao carregar (Firestore). Se o problema persistir, fale com o suporte técnico.");
              }
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
              logAuthDebug({
                authUid: user.uid,
                authEmail: user.email,
                userDocCheck,
                userDocExists,
                userSalonId,
                salonDocCheck: 'error',
                salonDocExists: false,
                offlineError: isOffline,
              });
            });

          } catch (syncErr: any) {
            console.error("[AuthInit] Erro no fluxo de sincronização de snapshot:", syncErr);
            const isOffline = isOfflineError(syncErr);
            if (isOffline) {
              setSyncError("Não foi possível conectar ao banco de dados. Verifique sua conexão e tente novamente.");
            } else {
              setSyncError(syncErr.message || "Erro de sincronização");
            }
            setLoading(false);
            logAuthDebug({
              authUid: user.uid,
              authEmail: user.email,
              userDocCheck,
              userDocExists,
              userSalonId,
              salonDocCheck,
              salonDocExists,
              offlineError: isOffline,
            });
          }
        }, (err) => {
          console.error("[AuthInit] Erro ao escutar users doc snapshot:", err);
          updateDiagnostics({
            firestoreError: err.message || String(err)
          });
          let offlineError = isOfflineError(err);
          
          if (offlineError) {
            setSyncError("Não foi possível conectar ao banco de dados. Verifique sua conexão e tente novamente.");
          } else if (isPlatformAdminFromColl) {
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
          logAuthDebug({
            authUid: user.uid,
            authEmail: user.email,
            userDocCheck: 'error',
            userDocExists: false,
            userSalonId: null,
            salonDocCheck: 'none',
            salonDocExists: false,
            offlineError,
          });
        });

      } else {
        setUserData(null);
        setSalonData(null);
        setIsPlatformAdmin(false);
        setSyncError(null);
        setLoading(false);
        updateDiagnostics({
          authUid: null,
          authEmail: null,
          userDocExists: 'não',
          salonIdFound: 'Nenhum',
          salonsCount: 0,
          firestoreError: 'Sem erro'
        });
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
    const isPlatformAdminExplicit = (adminDocSnap && adminDocSnap.exists()) || (userDocSnap && userDocSnap.exists() && userDocSnap.data()?.role === 'platform_admin') || user.email === import.meta.env.VITE_PLATFORM_ADMIN_EMAIL;
    console.log("[PlatformAuth] Usuário é platform_admin detectado?", isPlatformAdminExplicit);

    const isDemoOwner = user.email === import.meta.env.VITE_DEMO_USER_EMAIL;

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
        console.log("[PlatformAuth] demo owner sem documento user. Criando perfil de owner de teste...");
        const demoSalonId = 'tutorial_lumiere_studio';
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
        const demoSalonId = 'tutorial_lumiere_studio';
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
      signInWithGoogleForInvite,
      diagnostics
    }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
