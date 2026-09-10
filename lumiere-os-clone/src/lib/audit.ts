import { collection, doc, setDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
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

export async function logAuthAuditEvent(
  userIdentifier: string, // Email or UID
  action: 'Conta criada' | 'Conta ativada' | 'Primeiro Login' | 'Login Google' | 'Senha criada' | 'Senha alterada' | 'Logout' | 'Reset solicitado' | 'Reset concluído',
  details?: any
): Promise<void> {
  if (!db) {
    console.warn('[AuthAuditLog] Firestore db not initialized');
    return;
  }

  const currentUser = auth?.currentUser;
  if (!currentUser) {
    console.warn('[AuthAuditLog] No authenticated user, skipping logAuthAuditEvent for action:', action);
    return;
  }

  try {
    const logRef = doc(collection(db, 'authAuditLogs'));
    
    const logData: Record<string, any> = {
      id: logRef.id,
      userIdentifier: currentUser.email || currentUser.uid,
      action,
      userAgent: typeof navigator !== 'undefined' ? (navigator.userAgent || 'Unknown') : 'Unknown',
      origin: typeof window !== 'undefined' ? (window.location.origin || 'Unknown') : 'Unknown',
      createdAt: Date.now()
    };

    if (details !== undefined && details !== null) {
      logData.details = JSON.stringify(details).slice(0, 2000);
    }

    await setDoc(logRef, logData);
    console.log(`[AuthAuditLog] Saved log for ${action} (${logData.userIdentifier})`);
  } catch (error) {
    console.error('[AuthAuditLog] Failed to write auth audit log:', error);
  }
}
