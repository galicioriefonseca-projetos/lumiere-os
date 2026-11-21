import { db } from '@/lib/firebase';
import { SalonNotification } from '@/types';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';

export function subscribeSalonNotifications(
  salonId: string,
  onData: (items: SalonNotification[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!db || !salonId) return () => {};

  const q = query(
    collection(db, `salons/${salonId}/notifications`),
    orderBy('createdAt', 'desc'),
    limit(40)
  );

  return onSnapshot(
    q,
    (snap) => {
      const items: SalonNotification[] = [];
      snap.forEach((docSnap) => {
        items.push({ id: docSnap.id, ...(docSnap.data() as Omit<SalonNotification, 'id'>) });
      });
      onData(items);
    },
    (err) => {
      if (onError) onError(err);
    }
  );
}

export async function markNotificationAsRead(
  salonId: string,
  notificationId: string
): Promise<void> {
  if (!db || !salonId || !notificationId) return;
  await updateDoc(doc(db, `salons/${salonId}/notifications`, notificationId), {
    read: true,
    readAt: Date.now(),
  });
}

export async function markAllNotificationsAsRead(
  salonId: string,
  notifications: SalonNotification[]
): Promise<void> {
  if (!db || !salonId) return;
  const unread = notifications.filter((n) => !n.read);
  if (unread.length === 0) return;

  const batch = writeBatch(db);
  const now = Date.now();
  unread.slice(0, 50).forEach((n) => {
    batch.update(doc(db, `salons/${salonId}/notifications`, n.id), {
      read: true,
      readAt: now,
    });
  });
  await batch.commit();
}

export async function updatePushPreferencesInDb(params: {
  userId: string;
  salonId?: string;
  professionalDocId?: string;
  onConfirmed: boolean;
  onCanceled: boolean;
}): Promise<void> {
  if (!db || !params.userId) return;
  const now = Date.now();
  const pushPreferences = {
    onConfirmed: params.onConfirmed,
    onCanceled: params.onCanceled,
  };

  await setDoc(
    doc(db, 'users', params.userId),
    { pushPreferences, updatedAt: now },
    { merge: true }
  );

  if (params.salonId && params.professionalDocId) {
    await setDoc(
      doc(db, `salons/${params.salonId}/professionals`, params.professionalDocId),
      { pushPreferences, updatedAt: now },
      { merge: true }
    ).catch(() => undefined);
  }
}
