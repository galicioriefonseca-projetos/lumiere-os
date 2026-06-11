import { getMessaging, getToken } from 'firebase/messaging';
import { doc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db, app } from '@/lib/firebase';
import { toast } from 'sonner';

/**
 * Requests push notification permissions and registers the FCM Token
 * @param salonId The current salon's ID
 * @param userId The current user's ID
 */
export async function requestAndRegisterNotificationPermission(salonId: string, userId: string) {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    console.warn('[Push Notification] Push notifications are not supported in this browser or environment.');
    return null;
  }

  try {
    // 1. Request Permission
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[Push Notification] Permission denied by the user.');
      return null;
    }

    console.log('[Push Notification] Permission granted. Fetching token...');

    // 2. Load dynamic config from env vars
    const apiKey = import.meta.env.VITE_FIREBASE_API_KEY || '';
    const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '';
    const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID || '';
    const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '';
    const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '';
    const appId = import.meta.env.VITE_FIREBASE_APP_ID || '';

    // If critical Firebase credentials are not defined, skip FCM token generation
    if (!apiKey || !messagingSenderId || !app) {
      console.warn('[Push Notification] Firebase app is not fully initialized or config vars are missing.');
      return null;
    }

    // 3. Register the service worker dynamically with config parameters
    const cacheBuster = Date.now();
    const swUrl = `/firebase-messaging-sw.js?apiKey=${encodeURIComponent(apiKey)}` +
                  `&authDomain=${encodeURIComponent(authDomain)}` +
                  `&projectId=${encodeURIComponent(projectId)}` +
                  `&storageBucket=${encodeURIComponent(storageBucket)}` +
                  `&messagingSenderId=${encodeURIComponent(messagingSenderId)}` +
                  `&appId=${encodeURIComponent(appId)}` +
                  `&v=${cacheBuster}`;

    let registration: ServiceWorkerRegistration;
    try {
      registration = await navigator.serviceWorker.register(swUrl, {
        scope: '/'
      });
      console.log('[Push Notification] Service worker registered successfully:', registration);
    } catch (swError) {
      console.error('[Push Notification] Failed to register FCM service worker:', swError);
      return null;
    }

    // 4. Retrieve FCM Token
    const messaging = getMessaging(app);
    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY || undefined;

    const token = await getToken(messaging, {
      serviceWorkerRegistration: registration,
      vapidKey: vapidKey
    });

    if (token) {
      console.log('[Push Notification] Retained FCM Token:', token);
      
      // Save Token to user's profile and active professional database
      await saveTokenToFirestore(salonId, userId, token);
      return token;
    } else {
      console.warn('[Push Notification] No registration token returned. Verify Web Push certs.');
      return null;
    }
  } catch (error) {
    console.error('[Push Notification] Error requesting notification permissions/subscribing:', error);
    return null;
  }
}

/**
 * Saves the FCM subscription token into Firestore for users and active professional documents
 */
async function saveTokenToFirestore(salonId: string, userId: string, token: string) {
  if (!db || !userId) return;

  try {
    // 1. Save directly to '/users/{userId}' document
    const userRef = doc(db, 'users', userId);
    const userDocSnapshot = await getDoc(userRef);
    
    if (userDocSnapshot.exists()) {
      await updateDoc(userRef, {
        fcmToken: token,
        fcmTokens: arrayUnion(token),
        pushEnabled: true,
        updatedAt: Date.now()
      });
    }

    // 2. Save directly to '/salons/{salonId}/professionals/{userId}' if the professional document exists
    if (salonId) {
      const professionalRef = doc(db, `salons/${salonId}/professionals`, userId);
      const professionalDocSnapshot = await getDoc(professionalRef);

      if (professionalDocSnapshot.exists()) {
        await updateDoc(professionalRef, {
          fcmToken: token,
          fcmTokens: arrayUnion(token),
          pushEnabled: true,
          updatedAt: Date.now()
        });
      }
    }

    console.log('[Push Notification] Token stored and synchronized in database.');
  } catch (err) {
    console.error('[Push Notification] Error saving Token to database:', err);
  }
}

/**
 * Triggers a push notification on the server side to alert the active professional
 */
export async function triggerAppointmentPushNotification(params: {
  salonId: string;
  appointmentId: string;
  professionalId: string;
  clientName: string;
  serviceName: string;
  date: string;
  time: string;
  action: 'create' | 'confirm' | 'cancel';
}) {
  try {
    const response = await fetch('/api/send-appointment-push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      console.warn('[FCM Alert Client] Failed to trigger push status:', response.status);
    } else {
      const data = await response.json();
      console.log('[FCM Alert Client] Push notification triggered succeeded:', data);
    }
  } catch (error) {
    console.error('[FCM Alert Client] Error triggering push notification:', error);
  }
}

