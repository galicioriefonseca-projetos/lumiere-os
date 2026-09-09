import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Translates Firebase Auth and Firestore error codes into elegant, human-readable Brazilian Portuguese messages.
 */
export function translateAuthError(code?: string, customMessage?: string): string {
  console.log('[LumièreAuth] Translating error code:', code, customMessage);

  // Normalize code from error or message
  let resolvedCode = code || '';
  if (!resolvedCode && customMessage) {
    const match = customMessage.match(/auth\/([a-z0-9-]+)/i);
    if (match) resolvedCode = `auth/${match[1].toLowerCase()}`;
  }
  
  switch (resolvedCode) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'O e-mail ou a senha informados estão incorretos. Se você cadastrou sua conta pelo Google, utilize o botão "Entrar com Google".';
      
    case 'auth/user-not-found':
      return 'Não encontramos nenhuma conta com este e-mail em nossa plataforma.';
      
    case 'auth/email-already-in-use':
      return 'Este e-mail já está cadastrado no LumièreOS. Por favor, faça login com sua senha atual ou com o Google para continuar.';
      
    case 'auth/too-many-requests':
      return 'Muitas tentativas em sequência. Por favor, aguarde alguns instantes antes de tentar novamente.';
      
    case 'auth/user-disabled':
      return 'Esta conta de acesso foi temporariamente suspensa. Entre em contato com nosso suporte.';
      
    case 'auth/weak-password':
      return 'A senha escolhida é muito fraca. Ela deve conter pelo menos 8 caracteres.';
      
    case 'auth/network-request-failed':
      return 'Falha na conexão de rede. Verifique seu sinal de internet e tente novamente.';
      
    case 'auth/popup-closed-by-user':
      return 'A janela de autenticação foi fechada antes de concluir o processo.';

    case 'auth/cancelled-popup-request':
      return 'A solicitação de login foi cancelada.';
      
    case 'auth/account-exists-with-different-credential':
      return 'Já existe uma conta ativa associada a este e-mail usando outro método de acesso (como senha ou Google).';
      
    case 'auth/unauthorized-domain':
      return 'Este domínio de internet não está autorizado nas configurações do console do Firebase.';

    case 'auth/user-not-registered-google':
      return 'Nenhuma conta LumièreOS encontrada com este e-mail do Google. Se você é proprietário de um salão, crie sua conta na página de cadastro.';

    case 'auth/invalid-email':
      return 'O formato de e-mail fornecido é inválido. Por favor, use um endereço válido.';
      
    default:
      if (customMessage) {
        if (customMessage.includes('network-request-failed')) {
          return 'Falha na conexão de rede. Verifique seu sinal de internet e tente novamente.';
        }
        if (customMessage.includes('auth/invalid-credential')) {
          return 'O e-mail ou a senha informados estão incorretos. Se você cadastrou sua conta pelo Google, utilize o botão "Entrar com Google".';
        }
        if (customMessage.includes('auth/email-already-in-use')) {
          return 'Este e-mail já está cadastrado no LumièreOS. Faça login para continuar.';
        }
        // Strip raw Firebase Error envelope if present
        const cleaned = customMessage.replace(/^Firebase:\s*Error\s*\((.*?)\)\.?$/i, '$1');
        if (cleaned !== customMessage && cleaned.startsWith('auth/')) {
          return translateAuthError(cleaned);
        }
        return customMessage;
      }
      return 'Ocorreu um erro inesperado ao processar seu acesso. Tente novamente em alguns instantes.';
  }
}

/**
 * Checks if there is already an existing user in Firestore 'users' collection with the given email.
 */
export async function checkIfEmailExists(email: string): Promise<{ exists: boolean; uid: string | null; salonId: string | null }> {
  try {
    const q = query(collection(db, 'users'), where('email', '==', email.trim().toLowerCase()));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const docData = snap.docs[0].data();
      return { 
        exists: true, 
        uid: snap.docs[0].id, 
        salonId: docData?.salonId || null 
      };
    }
  } catch (error) {
    console.error('[LumièreAuth] Error checking if email exists:', error);
  }
  return { exists: false, uid: null, salonId: null };
}

/**
 * Checks if a salon exists by its ID and gets its data to pre-fill or confirm during activation.
 */
export async function getSalonActivationData(salonId: string) {
  try {
    const docRef = doc(db, 'salons', salonId);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data();
    }
  } catch (error) {
    console.error('[LumièreAuth] Error getting salon activation data:', error);
  }
  return null;
}

/**
 * Generates a random alphanumeric token with a custom prefix.
 */
function generateRandomToken(length = 32): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'act_';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Creates a unique, temporary activation token in Firestore.
 * By default, tokens expire in 24 hours.
 */
export async function createActivationToken(email: string, salonId: string): Promise<string> {
  const cleanEmail = email.trim().toLowerCase();

  // 1. Try server endpoint first (bypasses Firestore client permissions)
  try {
    const res = await fetch('/api/auth/simulate-activation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ simEmail: cleanEmail, simSalon: 'Salão Lumière Classic' }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        return data.token;
      }
    }
  } catch (backendErr) {
    console.warn('[LumièreAuth] Server simulate-activation unavailable, falling back:', backendErr);
  }

  // 2. Direct Firestore creation
  const token = generateRandomToken();
  const now = Date.now();
  const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours from now

  try {
    const tokenRef = doc(db, 'activationTokens', token);
    await setDoc(tokenRef, {
      token,
      email: cleanEmail,
      salonId,
      used: false,
      createdAt: now,
      expiresAt
    });
    console.log('[LumièreAuth] Created activation token in Firestore.');
    return token;
  } catch (error) {
    console.error('[LumièreAuth] Error creating activation token:', error);
    throw new Error('Falha ao gerar token de ativação.');
  }
}

/**
 * Validates an activation token. Returns the data if valid, otherwise throws or returns null.
 */
export async function validateActivationToken(token: string): Promise<{ email: string; salonId: string; salonName?: string } | null> {
  if (!token) return null;
  
  // 1. Try server validation endpoint first
  try {
    const res = await fetch(`/api/auth/validate-activation-token?token=${encodeURIComponent(token)}`);
    if (res.ok) {
      const data = await res.json();
      if (data.valid) {
        return { email: data.email, salonId: data.salonId, salonName: data.salonName };
      }
      return null;
    }
  } catch (serverErr) {
    console.warn('[LumièreAuth] Server validate token failed, trying direct Firestore:', serverErr);
  }

  // 2. Direct Firestore fallback
  try {
    const tokenRef = doc(db, 'activationTokens', token);
    const snap = await getDoc(tokenRef);
    
    if (!snap.exists()) {
      console.warn('[LumièreAuth] Token does not exist.');
      return null;
    }
    
    const data = snap.data();
    
    if (data.used) {
      console.warn('[LumièreAuth] Token already used.');
      return null;
    }
    
    if (data.expiresAt < Date.now()) {
      console.warn('[LumièreAuth] Token expired.');
      return null;
    }
    
    return {
      email: data.email,
      salonId: data.salonId
    };
  } catch (error) {
    console.error('[LumièreAuth] Error validating activation token:', error);
    return null;
  }
}

/**
 * Marks an activation token as used.
 */
export async function markActivationTokenUsed(token: string): Promise<void> {
  try {
    const tokenRef = doc(db, 'activationTokens', token);
    await updateDoc(tokenRef, {
      used: true,
      usedAt: Date.now()
    });
    console.log('[LumièreAuth] Marked token as used.');
  } catch (error) {
    console.warn('[LumièreAuth] Failed to mark token as used:', error);
  }
}
