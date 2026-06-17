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
