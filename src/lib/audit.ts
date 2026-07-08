import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { AuditLog } from '../types';

export async function logAuditEvent(
  salonId: string,
  userId: string,
  userName: string,
  userEmail: string,
  userRole: string,
  event: {
    action: AuditLog['action'];
    targetEntity: AuditLog['targetEntity'];
    targetId: string;
    description: string;
    details?: any;
  }
): Promise<void> {
  if (!db || !salonId) {
    console.warn('[AuditLog] Firebase or salonId not available, skipping log');
    return;
  }

  try {
    const logRef = doc(collection(db, `salons/${salonId}/auditLogs`));
    const logData: AuditLog = {
      id: logRef.id,
      salonId,
      userId,
      userName: userName || 'Usuário Desconhecido',
      userEmail: userEmail || 'sem-email@lumiere.com',
      userRole: userRole || 'professional',
      action: event.action,
      targetEntity: event.targetEntity,
      targetId: event.targetId,
      description: event.description,
      details: event.details ? JSON.parse(JSON.stringify(event.details)) : null,
      createdAt: Date.now(),
    };

    await setDoc(logRef, logData);
    console.log(`[AuditLog] Log registered successfully: ${event.description}`);
  } catch (error) {
    console.error('Failed to write audit log in Firestore:', error);
  }
}

let cachedIp: string | null = null;

async function getPublicIp(): Promise<string> {
  if (cachedIp) return cachedIp;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 second timeout max
    
    const response = await fetch('https://api.ipify.org?format=json', { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      cachedIp = data.ip;
      return data.ip;
    }
  } catch (e) {
    // Fail silently, returning local/unknown
  }
  return 'IP Indisponível';
}

export async function logAuthAuditEvent(
  userIdentifier: string, // Email or UID
  action: 'Conta criada' | 'Conta ativada' | 'Primeiro Login' | 'Login Google' | 'Senha criada' | 'Senha alterada' | 'Logout' | 'Reset solicitado' | 'Reset concluído',
  details?: any
): Promise<void> {
  if (!db) {
    console.warn('[AuthAuditLog] Firestore db not initialized');
    return;
  }

  try {
    const ip = await getPublicIp();
    const logRef = doc(collection(db, 'authAuditLogs'));
    const logData = {
      id: logRef.id,
      userIdentifier,
      action,
      ip,
      userAgent: navigator.userAgent || 'Unknown',
      origin: window.location.origin || 'Unknown',
      details: details ? JSON.parse(JSON.stringify(details)) : null,
      createdAt: Date.now()
    };

    await setDoc(logRef, logData);
    console.log(`[AuthAuditLog] Saved log for ${action} (${userIdentifier})`);
  } catch (error) {
    console.error('[AuthAuditLog] Failed to write auth audit log:', error);
  }
}
