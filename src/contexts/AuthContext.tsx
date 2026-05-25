import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as AuthUser, onAuthStateChanged, signOut, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, setDoc, updateDoc } from 'firebase/firestore';
import { User, Salon, Role } from '../types';

interface AuthContextType {
  currentUser: AuthUser | null;
  userData: User | null;
  salonData: Salon | null;
  isPlatformAdmin: boolean;
  loading: boolean;
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
    phone: string,
    optionalFullName?: string
  ) => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userData: null,
  salonData: null,
  isPlatformAdmin: false,
  loading: true,
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

        // Check platformAdmin status once
        try {
          const adminRef = doc(db, 'platformAdmins', user.uid);
          const adminSnap = await getDoc(adminRef);
          setIsPlatformAdmin(adminSnap.exists());
        } catch (err) {
          console.error("Error fetching platformAdmin:", err);
        }

        // Listen to users/{uid} document in real-time
        unsubscribeUserSnapshot = onSnapshot(doc(db, 'users', user.uid), (userSnap) => {
          if (userSnap.exists()) {
            const uData = { id: userSnap.id, ...userSnap.data() } as User;
            setUserData(uData);
            if (uData.role === 'platform_admin') {
              setIsPlatformAdmin(true);
            }

            // Listen to salons/{salonId} in real-time
            if (uData.salonId) {
              if (unsubscribeSalonSnapshot) {
                unsubscribeSalonSnapshot();
              }
              unsubscribeSalonSnapshot = onSnapshot(doc(db, 'salons', uData.salonId), (salonSnap) => {
                if (salonSnap.exists()) {
                  setSalonData({ id: salonSnap.id, ...salonSnap.data() } as Salon);
                } else {
                  setSalonData(null);
                }
                setLoading(false);
              }, (err) => {
                console.error("Error listening to salon:", err);
                setLoading(false);
              });
            } else {
              setSalonData(null);
              setLoading(false);
            }
          } else {
            setUserData(null);
            setSalonData(null);
            setLoading(false);
          }
        }, (err) => {
          console.error("Error listening to user document:", err);
          setLoading(false);
        });

      } else {
        setUserData(null);
        setSalonData(null);
        setIsPlatformAdmin(false);
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
    const result = await signInWithPopup(auth, provider);
    const user = result.user;
    const userDocRef = doc(db, 'users', user.uid);
    const userDocSnap = await getDoc(userDocRef);
    if (!userDocSnap.exists()) {
      await signOut(auth);
      throw { code: 'auth/user-not-registered-google' };
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
    phone: string,
    optionalFullName?: string
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
    if (userSnap.exists()) {
      const existingData = userSnap.data();
      if (existingData.salonId) {
        await signOut(auth);
        throw { code: 'auth/social-email-already-linked' };
      }
    }

    const now = Date.now();
    const fullName = optionalFullName || user.displayName || inviteData.fullName || '';
    const isProfRole = inviteData.role === 'professional' || inviteData.inviteType === 'professional';
    const professionUID = isProfRole ? user.uid : '';

    const userProfile: any = {
      id: user.uid,
      fullName: fullName,
      email: user.email || '',
      phone: phone,
      role: inviteData.inviteType === 'function_link' ? inviteData.role : inviteData.inviteType,
      salonId: inviteData.salonId,
      professionalId: professionUID,
      createdAt: now,
      updatedAt: now,
    };

    if (inviteData.inviteType === 'function_link') {
      userProfile.specialty = inviteData.specialty || '';
      userProfile.professionalFunction = inviteData.professionalFunction || '';
      userProfile.professionalCategory = inviteData.category || '';
    }

    try {
      await setDoc(doc(db, 'users', user.uid), userProfile);
    } catch (e) {
      console.error("Erro ao criar usuário:", e);
      throw e;
    }

    if (inviteData.inviteType === 'function_link' || inviteData.inviteType === 'professional') {
      const profRecord = {
        userId: user.uid,
        professionalId: user.uid,
        name: fullName,
        email: user.email || '',
        phone: phone,
        role: inviteData.inviteType === 'function_link' ? inviteData.role : inviteData.inviteType,
        category: inviteData.category || 'Profissional',
        specialty: inviteData.specialty || inviteData.category || '',
        professionalFunction: inviteData.professionalFunction || inviteData.category || '',
        status: 'active',
        isActive: true,
        joinedByInvite: true,
        inviteId: inviteData.id,
        createdAt: now,
        updatedAt: now,
      };
      
      try {
        await setDoc(doc(db, `salons/${inviteData.salonId}/professionals`, user.uid), profRecord);
      } catch (e) {
        console.error("Erro ao criar profissional:", e);
        throw e;
      }
    }

    try {
      if (inviteData.inviteType === 'function_link') {
        const newUses = (inviteData.usesCount || 0) + 1;
        const maxUses = inviteData.maxUses || 1;
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
      throw e;
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
