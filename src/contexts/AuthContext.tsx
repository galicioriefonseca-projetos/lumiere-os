import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as AuthUser, onAuthStateChanged, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { User, Salon, Role } from '../types';

interface AuthContextType {
  currentUser: AuthUser | null;
  userData: User | null;
  salonData: Salon | null;
  isPlatformAdmin: boolean;
  loading: boolean;
  logout: () => Promise<void>;
  refreshUserData: () => Promise<void>;
  demoRole: Role | null;
  setDemoRole: (role: Role | null) => void;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userData: null,
  salonData: null,
  isPlatformAdmin: false,
  loading: true,
  logout: async () => {},
  refreshUserData: async () => {},
  demoRole: null,
  setDemoRole: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [userData, setUserData] = useState<User | null>(null);
  const [salonData, setSalonData] = useState<Salon | null>(null);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [demoRole, setDemoRoleState] = useState<Role | null>(() => {
    return sessionStorage.getItem('demo_role') as Role | null;
  });

  const setDemoRole = (role: Role | null) => {
    setDemoRoleState(role);
    if (role) {
      sessionStorage.setItem('demo_role', role);
    } else {
      sessionStorage.removeItem('demo_role');
    }
  };

  const effectiveUserData = userData && demoRole 
    ? { ...userData, role: demoRole, fullName: demoRole === 'professional' ? "Profissional de Teste" : userData.fullName } 
    : userData;

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

  const fetchUserData = async (uid: string) => {
    try {
      // Check platform admin status
      const adminRef = doc(db, 'platformAdmins', uid);
      const adminSnap = await getDoc(adminRef);
      let isExplicitAdmin = adminSnap.exists();

      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);
      if (userSnap.exists()) {
        const uData = { id: userSnap.id, ...userSnap.data() } as User;
        setUserData(uData);
        setIsPlatformAdmin(isExplicitAdmin || uData.role === 'platform_admin');

        if (uData.salonId) {
          const salonRef = doc(db, 'salons', uData.salonId);
          const salonSnap = await getDoc(salonRef);
          if (salonSnap.exists()) {
            setSalonData({ id: salonSnap.id, ...salonSnap.data() } as Salon);
          }
        }
      } else {
        setIsPlatformAdmin(isExplicitAdmin);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    }
  };

  const refreshUserData = async () => {
    if (currentUser) {
      await fetchUserData(currentUser.uid);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserData(user.uid);
      } else {
        setUserData(null);
        setSalonData(null);
        setIsPlatformAdmin(false);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const logout = async () => {
    setLoading(true);
    await signOut(auth);
    setUserData(null);
    setSalonData(null);
    setIsPlatformAdmin(false);
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ currentUser, userData: effectiveUserData, salonData, isPlatformAdmin, loading, logout, refreshUserData, demoRole, setDemoRole }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
