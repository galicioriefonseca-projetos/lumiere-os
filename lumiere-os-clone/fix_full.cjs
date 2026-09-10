const fs = require('fs');

const serviceCode = `
import { 
  User as AuthUser, 
  GoogleAuthProvider, 
  getAuth, 
  signInWithPopup, 
  signOut 
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logAuthAuditEvent } from '@/lib/audit';

const DEMO_MODE_ENABLED = import.meta.env.VITE_ENABLE_DEMO_MODE === "true";
const DEMO_USER_EMAIL = import.meta.env.VITE_DEMO_USER_EMAIL || "";

export const AuthService = {
  async logout(userEmailOrUid: string): Promise<void> {
    try {
      await logAuthAuditEvent(userEmailOrUid, 'Logout');
    } catch (e) {
      console.warn('Failed to register logout audit log:', e);
    }
    await signOut(getAuth());
  },

  async signInWithGoogle(): Promise<AuthUser> {
    const provider = new GoogleAuthProvider();
    const activeAuth = getAuth();
    console.log("[PlatformAuth] Chamando signInWithPopup...", { auth: activeAuth, provider });
    if (!activeAuth) {
        console.error("[PlatformAuth] auth is null!");
        throw new Error("Auth instance is null");
    }
    const result = await signInWithPopup(activeAuth, provider);
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
    const isPlatformAdminExplicit = (adminDocSnap && adminDocSnap.exists()) || (userDocSnap && userDocSnap.exists() && userDocSnap.data()?.role === 'platform_admin');
    console.log("[PlatformAuth] Usuário é platform_admin detectado?", isPlatformAdminExplicit);

    const isDemoOwner = DEMO_MODE_ENABLED === true && user.email === DEMO_USER_EMAIL;

    if (!userDocSnap || !userDocSnap.exists()) {
      if (isPlatformAdminExplicit) {
        console.log("[PlatformAuth] platform_admin sem documento user. Criando perfil...");
        const now = Date.now();
        const newProfile = {
          id: user.uid,
          fullName: user.displayName || 'Administrador da Plataforma',
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
          fullName: user.displayName || 'Administrador de Demonstração',
          email: user.email || '',
          phone: user.phoneNumber || '',
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
        await signOut(activeAuth); 
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
  },

  async signInWithGoogleForRegister(
    _salonFields: {
      salonName: string;
      businessType: string;
      city: string;
      state: string;
      phone: string;
      plan: string;
      limit: number;
      ownerName?: string;
      businessSegment?: string;
      estimatedProfessionals?: string;
      recommendedPlan?: string;
    },
    optionalFullName?: string
  ): Promise<AuthUser> {
    const provider = new GoogleAuthProvider();
    const activeAuth = getAuth();
    const result = await signInWithPopup(activeAuth, provider);
    const user = result.user;
    const now = Date.now();
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        id: user.uid,
        fullName: optionalFullName || user.displayName || '',
        name: optionalFullName || user.displayName || '',
        email: user.email || '',
        phone: user.phoneNumber || '',
        role: 'pending',
        salonId: null,
        onboardingStatus: 'pending_payment',
        createdAt: now,
        updatedAt: now,
      });
    }

    sessionStorage.removeItem('demo_role');
    return user;
  },

  async signInWithGoogleForInvite(
    inviteData: any,
    phone?: string,
    optionalFullName?: string,
    choices?: { primaryFunction?: string; additionalFunctions?: string[] }
  ): Promise<{ user: AuthUser; idToken: string }> {
    const provider = new GoogleAuthProvider();
    const activeAuth = getAuth();
    const result = await signInWithPopup(activeAuth, provider);
    const user = result.user;

    const fullName = optionalFullName || user.displayName || inviteData.fullName || user.displayName || '';
    const idToken = await user.getIdToken(true);

    const response = await fetch('/api/invites/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': \`Bearer \${idToken}\`
      },
      body: JSON.stringify({
        inviteId: inviteData.inviteId || inviteData.id,
        fullName: fullName,
        phone: phone || "",
        primaryFunction: choices?.primaryFunction || "",
        additionalFunctions: choices?.additionalFunctions || []
      })
    });

    const data = await response.json();
    if (!response.ok) {
       await signOut(activeAuth);
       const errorCode = data.code === 'auth/invite-email-mismatch' ? 'auth/invite-email-mismatch' : 'auth/invite-accept-failed';
       throw Object.assign(new Error(data.error || 'Erro ao aceitar convite'), { code: errorCode, invitedEmail: inviteData.email || inviteData.maskedEmail });
    }

    sessionStorage.removeItem('demo_role');
    return { user, idToken };
  }
};
`;

fs.writeFileSync('src/services/AuthService.ts', serviceCode.trim());
