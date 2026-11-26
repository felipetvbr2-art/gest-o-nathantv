const CACHE_NAME = "gestao-clientes-v86";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./manifest.json"
];

importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyBX4w6AdZg4oG-IcDJQVK8Hy0erlMYKpWk",
  authDomain: "gestaotv-61635.firebaseapp.com",
  projectId: "gestaotv-61635",
  storageBucket: "gestaotv-61635.firebasestorage.app",
  messagingSenderId: "493101764038",
  appId: "1:493101764038:web:7f72b8869e4dbe213a36c7",
  measurementId: "G-8S1VE6SQKY"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || "Gestão Nathan TV";
  const options = {
    body: payload.notification?.body || "Você tem clientes com vencimento amanhã.",
    icon: "./icons/app-logo.svg",
    badge: "./icons/app-logo.svg",
    data: { url: self.registration.scope }
  };
  self.registration.showNotification(title, options);
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url || self.registration.scope;
  event.waitUntil((async () => {
    const windows = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if ("focus" in client) {
        await client.focus();
        return;
      }
    }
    if (clients.openWindow) await clients.openWindow(target);
  })());
});

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
