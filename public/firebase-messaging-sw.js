// LumièreOS Dynamic Firebase Cloud Messaging Service Worker
// Extracts configuration dynamically from query parameters to maintain portability and security

importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

const urlParams = new URL(location).searchParams;

const firebaseConfig = {
  apiKey: urlParams.get('apiKey') || '',
  authDomain: urlParams.get('authDomain') || '',
  projectId: urlParams.get('projectId') || '',
  storageBucket: urlParams.get('storageBucket') || '',
  messagingSenderId: urlParams.get('messagingSenderId') || '',
  appId: urlParams.get('appId') || '',
};

if (firebaseConfig.apiKey && firebaseConfig.messagingSenderId) {
  firebase.initializeApp(firebaseConfig);

  const messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const title =
      payload.notification?.title ||
      payload.data?.title ||
      'LumièreOS · Alerta de Agenda';

    const body =
      payload.notification?.body ||
      payload.data?.body ||
      'Você recebeu uma atualização na sua agenda.';

    const appointmentId = payload.data?.appointmentId || '';
    const clickAction = payload.data?.click_action || '/dashboard/agendamentos';

    const notificationOptions = {
      body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      tag: appointmentId ? `lumiere-appt-${appointmentId}` : 'lumiere-push',
      renotify: true,
      requireInteraction: payload.data?.action === 'cancel',
      data: {
        ...(payload.data || {}),
        click_action: clickAction,
      },
      vibrate: [120, 60, 120],
      actions: [{ action: 'open', title: 'Ver na Agenda' }],
    };

    return self.registration.showNotification(title, notificationOptions);
  });
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const rawAction = event.notification.data?.click_action || '/dashboard/agendamentos';
  const targetUrl = rawAction.startsWith('/') ? rawAction : '/dashboard/agendamentos';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes('/dashboard') && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return client;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
      return undefined;
    })
  );
});
