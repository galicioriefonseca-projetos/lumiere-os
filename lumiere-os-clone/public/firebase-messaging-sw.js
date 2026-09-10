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
    console.log('[Lumiere FCM SW] Background message received:', payload);
    
    const notificationTitle = payload.notification?.title || 'Novo do LumièreOS';
    const notificationOptions = {
      body: payload.notification?.body || 'Você recebeu uma nova notificação.',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-192x192.png',
      data: payload.data || {},
      vibrate: [100, 50, 100],
      actions: [
        { action: 'open', title: 'Ver na Agenda' }
      ]
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });
} else {
  console.warn('[Lumiere FCM SW] Configuração dinâmica incompleta para inicialização de background messaging.');
}

// Handle notification interaction click
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const clickAction = event.notification.data?.click_action || '/dashboard?tab=agenda';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Loop across windows and focus if already open
      for (let i = 0; i < windowClients.length; i++) {
        const client = windowClients[i];
        if (client.url.includes(clickAction) && 'focus' in client) {
          return client.focus();
        }
      }
      // Or open a new one
      if (clients.openWindow) {
        return clients.openWindow(clickAction);
      }
    })
  );
});
