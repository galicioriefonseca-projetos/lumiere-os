import { 
  User as AuthUser, 
  GoogleAuthProvider, 
  getAuth, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut 
} from 'firebase/auth';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logAuthAuditEvent } from '@/lib/audit';

import { clearWorkspaceToken } from './googleWorkspaceService';

const DEMO_MODE_ENABLED = import.meta.env.VITE_ENABLE_DEMO_MODE === "true";
const DEMO_USER_EMAIL = import.meta.env.VITE_DEMO_USER_EMAIL || "";
const PENDING_OAUTH_KEY = "lumiere_pending_oauth_action";

function isStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean(
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
      (window.navigator as any)?.standalone === true
  );
}

function shouldFallbackToRedirect(err: any): boolean {
  const code = String(err?.code || "");
  if (
    code === "auth/popup-blocked" ||
    code === "auth/operation-not-supported-in-this-environment" ||
    code === "auth/web-storage-unsupported"
  ) {
    return true;
  }
  if (isStandaloneMode() && code === "auth/internal-error") {
    return true;
  }
  return false;
}

async function syncAuthenticatedGoogleUser(user: AuthUser): Promise<AuthUser> {
  const activeAuth = getAuth();
  console.log("[PlatformAuth] Autenticado via Google. UID:", user.uid, "Email:", user.email);

  let userDocSnap = null;
  try {
    userDocSnap = await getDoc(doc(db, 'users', user.uid));
    console.log("[PlatformAuth] users doc lido. Existe?", userDocSnap.exists());
  } catch (e) {
    console.warn("[PlatformAuth] Erro ao ler users doc. Prosseguindo para sincronização...", e);
  }

  let adminDocSnap = null;
  try {
    adminDocSnap = await getDoc(doc(db, 'platformAdmins', user.uid));
  } catch (e) {
    console.warn("[PlatformAuth] Erro ao ler platformAdmins doc. Ignorando...", e);
  }

  const existingData = userDocSnap?.exists() ? userDocSnap.data() : null;
  const isPlatformAdminExplicit =
    (adminDocSnap && adminDocSnap.exists()) ||
    existingData?.role === 'platform_admin' ||
    user.email?.toLowerCase() === 'galicioriefonseca@gmail.com';

  const isDemoOwner = DEMO_MODE_ENABLED === true && user.email === DEMO_USER_EMAIL;

  const needsBackendSync =
    !existingData ||
    (!isPlatformAdminExplicit &&
      (!existingData.salonId ||
        existingData.role === 'pending' ||
        existingData.role === 'function_link'));

  if (needsBackendSync) {
    if (isPlatformAdminExplicit && !existingData) {
      const now = Date.now();
      try {
        await setDoc(doc(db, 'users', user.uid), {
          id: user.uid,
          fullName: user.displayName || 'Administrador da Plataforma',
          email: (user.email || '').toLowerCase(),
          phone: user.phoneNumber || '',
          role: 'platform_admin',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      } catch (writeErr) {
        console.error("[PlatformAuth] Erro ao gravar perfil platform_admin:", writeErr);
      }
    } else if (isDemoOwner && !existingData) {
      const demoSalonId = 'tutorial_lumiere_studio';
      const now = Date.now();
      try {
        await setDoc(doc(db, 'users', user.uid), {
          id: user.uid,
          fullName: user.displayName || 'Administrador de Demonstração',
          email: (user.email || '').toLowerCase(),
          phone: user.phoneNumber || '',
          role: 'owner',
          salonId: demoSalonId,
          isActive: true,
          createdAt: now,
          updatedAt: now,
        });
      } catch (writeErr) {
        console.error("[PlatformAuth] Erro ao gravar perfil demo owner:", writeErr);
      }
    } else {
      let synced = false;
      let blockedMessage = '';
      try {
        const idToken = await user.getIdToken(true);
        const syncRes = await fetch('/api/auth/sync-google-account', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          }
        });
        const syncData = await syncRes.json().catch(() => ({}));
        if (syncRes.ok && (syncData.status === 'synced' || syncData.status === 'existing')) {
          console.log("[PlatformAuth] Sincronização Google no backend bem-sucedida:", syncData);
          synced = true;
        } else if (syncRes.status === 403 || syncData.code === 'auth/user-disabled') {
          blockedMessage = syncData.error || 'Esta conta foi desativada no salão.';
        }
      } catch (syncErr) {
        console.warn("[PlatformAuth] Falha na sincronização Google via backend:", syncErr);
      }

      if (!synced) {
        console.log("[PlatformAuth] Bloqueando login: Usuário sem vínculo ativo no LumièreOS.");
        await signOut(activeAuth);
        if (blockedMessage) {
          throw { code: 'auth/user-disabled', message: blockedMessage };
        }
        throw { code: 'auth/user-not-registered-google' };
      }
    }
  } else {
    const currentRole = existingData?.role;
    if (isPlatformAdminExplicit && currentRole !== 'platform_admin') {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          role: 'platform_admin',
          updatedAt: Date.now()
        });
      } catch (writeErr) {
        console.error("[PlatformAuth] Erro ao atualizar papel no Firestore:", writeErr);
      }
    } else if (isDemoOwner) {
      const demoSalonId = 'tutorial_lumiere_studio';
      if (currentRole !== 'owner' || existingData?.salonId !== demoSalonId) {
        try {
          await updateDoc(doc(db, 'users', user.uid), {
            role: 'owner',
            salonId: demoSalonId,
            updatedAt: Date.now()
          });
        } catch (writeErr) {
          console.error("[PlatformAuth] Erro ao atualizar papel demo:", writeErr);
        }
      }
    }
  }

  return user;
}

export const AuthService = {
  async logout(userEmailOrUid: string): Promise<void> {
    try {
      await logAuthAuditEvent(userEmailOrUid, 'Logout');
    } catch (e) {
      console.warn('Failed to register logout audit log:', e);
    }
    try {
      localStorage.removeItem(PENDING_OAUTH_KEY);
    } catch {}
    clearWorkspaceToken();
    await signOut(getAuth());
  },

  async completePendingRedirect(): Promise<{ error?: string } | null> {
    try {
      const activeAuth = getAuth();
      if (!activeAuth) return null;
      const result = await getRedirectResult(activeAuth);
      if (!result?.user) {
        return null;
      }

      const user = result.user;
      let pendingRaw: string | null = null;
      try {
        pendingRaw = localStorage.getItem(PENDING_OAUTH_KEY);
        localStorage.removeItem(PENDING_OAUTH_KEY);
      } catch {}

      const pending = pendingRaw ? JSON.parse(pendingRaw) : { type: 'login' };

      if (pending?.type === 'invite' && pending?.inviteId) {
        const fullName = pending.optionalFullName || user.displayName || pending.inviteFullName || '';
        const idToken = await user.getIdToken(true);
        const response = await fetch('/api/invites/accept', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            inviteId: pending.inviteId,
            fullName,
            phone: pending.phone || '',
            primaryFunction: pending.choices?.primaryFunction || '',
            additionalFunctions: pending.choices?.additionalFunctions || []
          })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          await signOut(activeAuth);
          return { error: data.error || 'Erro ao concluir convite com o Google.' };
        }
        sessionStorage.removeItem('demo_role');
        return null;
      }

      if (pending?.type === 'register') {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (!userSnap.exists()) {
          const now = Date.now();
          await setDoc(userRef, {
            id: user.uid,
            fullName: pending.optionalFullName || user.displayName || '',
            name: pending.optionalFullName || user.displayName || '',
            email: (user.email || '').toLowerCase(),
            phone: user.phoneNumber || '',
            role: 'pending',
            salonId: null,
            onboardingStatus: 'pending_payment',
            createdAt: now,
            updatedAt: now,
          });
        }
        sessionStorage.removeItem('demo_role');
        return null;
      }

      await syncAuthenticatedGoogleUser(user);
      return null;
    } catch (err: any) {
      console.warn("[PlatformAuth] Erro ao concluir redirect OAuth:", err);
      if (err?.code === 'auth/user-not-registered-google') {
        return {
          error: 'Nenhuma conta LumièreOS encontrada com este e-mail do Google. Se você faz parte de uma equipe, peça para o gestor cadastrar seu e-mail na aba Equipe ou utilize o link de convite.'
        };
      }
      if (err?.message) {
        return { error: err.message };
      }
      return null;
    }
  },

  async signInWithGoogle(): Promise<AuthUser | null> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const activeAuth = getAuth();
    if (!activeAuth) {
      throw new Error("Auth instance is null");
    }

    try {
      const result = await signInWithPopup(activeAuth, provider);
      return await syncAuthenticatedGoogleUser(result.user);
    } catch (err: any) {
      if (shouldFallbackToRedirect(err)) {
        console.log("[PlatformAuth] Popup bloqueado/indisponível no PWA ou navegador, redirecionando via signInWithRedirect...");
        try {
          localStorage.setItem(PENDING_OAUTH_KEY, JSON.stringify({ type: 'login' }));
        } catch {}
        await signInWithRedirect(activeAuth, provider);
        return null;
      }
      throw err;
    }
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
  ): Promise<AuthUser | null> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const activeAuth = getAuth();

    let result;
    try {
      result = await signInWithPopup(activeAuth, provider);
    } catch (err: any) {
      if (shouldFallbackToRedirect(err)) {
        try {
          localStorage.setItem(PENDING_OAUTH_KEY, JSON.stringify({ type: 'register', optionalFullName }));
        } catch {}
        await signInWithRedirect(activeAuth, provider);
        return null;
      }
      throw err;
    }

    const user = result.user;
    const now = Date.now();
    const userRef = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      await setDoc(userRef, {
        id: user.uid,
        fullName: optionalFullName || user.displayName || '',
        name: optionalFullName || user.displayName || '',
        email: (user.email || '').toLowerCase(),
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
  ): Promise<{ user: AuthUser; idToken: string } | null> {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    const activeAuth = getAuth();

    let result;
    try {
      result = await signInWithPopup(activeAuth, provider);
    } catch (err: any) {
      if (shouldFallbackToRedirect(err)) {
        try {
          localStorage.setItem(PENDING_OAUTH_KEY, JSON.stringify({
            type: 'invite',
            inviteId: inviteData.inviteId || inviteData.id,
            inviteFullName: inviteData.fullName || '',
            optionalFullName,
            phone: phone || '',
            choices,
          }));
        } catch {}
        await signInWithRedirect(activeAuth, provider);
        return null;
      }
      throw err;
    }

    const user = result.user;
    const fullName = optionalFullName || user.displayName || inviteData.fullName || user.email?.split('@')[0] || '';
    const idToken = await user.getIdToken(true);

    const response = await fetch('/api/invites/accept', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`
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