"use client";

import { useEffect } from "react";

/** Registers the PWA service worker (public/sw.js) app-wide, independently of whether the user enables push notifications. */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Échec de l'enregistrement du service worker:", err);
    });
  }, []);

  return null;
}
