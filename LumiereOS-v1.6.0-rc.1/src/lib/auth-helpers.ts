import { collection, query, where, getDocs, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Translates Firebase Auth and Firestore error codes into elegant, human-readable Brazilian Portuguese messages.
 */
export function translateAuthError(code: string, customMessage?: string): string {
  console.log('[LumièreAuth] Translating error code:', code, customMessage);
  
  switch (code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'O e-mail ou a senha informados estão incorretos. Verifique suas credenciais.';
      
    case 'auth/user-not-found':
      return 'Não encontramos nenhuma conta com este e-mail em nossa plataforma.';
      
    case 'auth/email-already-in-use':
      return 'Este e-mail já está em uso por outra conta do LumièreOS.';
      
    case 'auth/too-many-requests':
      return 'Muitas tentativas em sequência. Por favor, aguarde alguns instantes antes de tentar novamente.';
      
    case 'auth/user-disabled':
      return 'Esta conta de acesso foi temporariamente suspensa. Entre em contato com nosso suporte.';
      
    case 'auth/weak-password':
      return 'A senha escolhida é muito fraca. Ela deve conter pelo menos 6 caracteres.';
      
    case 'auth/network-request-failed':
      return 'Falha na conexão de rede. Verifique seu sinal de internet e tente novamente.';
      
    case 'auth/popup-closed-by-user':
      return 'A janela de login com o Google foi fechada antes de concluir o processo.';
      
    case 'auth/account-exists-with-different-credential':
      return 'Já existe uma conta ativa associada a este e-mail usando outro método de acesso (como senha).';
      
    case 'auth/unauthorized-domain':
      return 'Este domínio de internet não está autorizado nas configurações do console do Firebase.';

    case 'auth/invalid-email':
      return 'O formato de e-mail fornecido é inválido. Por favor, use um endereço válido.';
      
    default:
      if (customMessage) {
        if (customMessage.includes('network-request-failed')) {
          return 'Falha na conexão de rede. Verifique seu sinal de internet e tente novamente.';
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
  const token = generateRandomToken();
  const now = Date.now();
  const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours from now

  try {
    const tokenRef = doc(db, 'activationTokens', token);
    await setDoc(tokenRef, {
      token,
      email: email.trim().toLowerCase(),
      salonId,
      used: false,
      createdAt: now,
      expiresAt
    });
    console.log('[LumièreAuth] Created activation token:', token);
    return token;
  } catch (error) {
    console.error('[LumièreAuth] Error creating activation token:', error);
    throw new Error('Falha ao gerar token de ativação.');
  }
}

/**
 * Validates an activation token. Returns the data if valid, otherwise throws or returns null.
 */
export async function validateActivationToken(token: string): Promise<{ email: string; salonId: string } | null> {
  if (!token) return null;
  
  try {
    const tokenRef = doc(db, 'activationTokens', token);
    const snap = await getDoc(tokenRef);
    
    if (!snap.exists()) {
      console.warn('[LumièreAuth] Token does not exist:', token);
      return null;
    }
    
    const data = snap.data();
    
    if (data.used) {
      console.warn('[LumièreAuth] Token already used:', token);
      return null;
    }
    
    if (data.expiresAt < Date.now()) {
      console.warn('[LumièreAuth] Token expired:', token);
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
    console.log('[LumièreAuth] Marked token as used:', token);
  } catch (error) {
    console.warn('[LumièreAuth] Failed to mark token as used:', error);
  }
}
