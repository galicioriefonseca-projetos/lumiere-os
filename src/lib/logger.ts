import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ProductionLog } from '../types';

export interface LogUserData {
  id?: string;
  fullName?: string;
  email?: string;
  role?: string;
}

/**
 * Envia um log diretamente para o Firestore sob a subcoleção do salão correspondente.
 */
export async function persistLog(
  salonId: string,
  level: 'error' | 'warning' | 'info',
  message: string,
  extra: {
    stack?: string;
    userData?: LogUserData;
    pagePath?: string;
  } = {}
): Promise<void> {
  if (!db || !salonId) {
    // Se o banco não estiver inicializado ou não houver salão, apenas reporta no console local
    console.warn(`[LumiereLogger Client-Fallback] [${level.toUpperCase()}] ${message}`, extra);
    return;
  }

  try {
    const logsCollectionRef = collection(db, `salons/${salonId}/productionLogs`);
    const newLogDocRef = doc(logsCollectionRef);

    const payload: ProductionLog = {
      id: newLogDocRef.id,
      salonId,
      userId: extra.userData?.id || '',
      userName: extra.userData?.fullName || '',
      userEmail: extra.userData?.email || '',
      userRole: extra.userData?.role || '',
      level,
      message: message || 'Nenhuma mensagem detalhada fornecida',
      stack: extra.stack || '',
      pagePath: extra.pagePath || window.location.pathname || '/',
      userAgent: navigator.userAgent || 'Desconhecido',
      isActive: true,
      deletedAt: null,
      createdAt: Date.now(),
    };

    await setDoc(newLogDocRef, payload);
  } catch (error) {
    // Evita loop infinito caso o erro de salvar seja jogado novamente no interceptor
    console.error('Falha crítica ao persistir o log no Firestore:', error);
  }
}

/**
 * Logger global de auxílio rápido para uso local ou manual.
 */
export const logger = {
  info: (salonId: string, message: string, extra?: { stack?: string; userData?: LogUserData; pagePath?: string }) => {
    persistLog(salonId, 'info', message, extra);
  },
  warn: (salonId: string, message: string, extra?: { stack?: string; userData?: LogUserData; pagePath?: string }) => {
    persistLog(salonId, 'warning', message, extra);
  },
  error: (salonId: string, message: string, extra?: { stack?: string; userData?: LogUserData; pagePath?: string }) => {
    persistLog(salonId, 'error', message, extra);
  },
};
