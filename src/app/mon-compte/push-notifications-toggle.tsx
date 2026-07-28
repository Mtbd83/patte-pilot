"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { savePushSubscription, deletePushSubscription } from "@/server/actions/push-subscriptions";
import { Button } from "@/components/ui/button";

type Status = "loading" | "unsupported" | "denied" | "subscribed" | "unsubscribed";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export function PushNotificationsToggle() {
  const [status, setStatus] = useState<Status>("loading");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setStatus("unsupported");
      return;
    }
    if (Notification.permission === "denied") {
      setStatus("denied");
      return;
    }
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => navigator.serviceWorker.ready)
      .then((registration) => registration.pushManager.getSubscription())
      .then((subscription) => setStatus(subscription ? "subscribed" : "unsubscribed"))
      .catch(() => setStatus("unsubscribed"));
  }, []);

  async function handleEnable() {
    setPending(true);
    try {
      const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicKey) throw new Error("Notifications non configurées côté serveur.");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus(permission === "denied" ? "denied" : "unsubscribed");
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      // Subscribing talks to the browser vendor's own push service over the
      // network — race a timeout so a slow/unreachable push service leaves
      // the button re-enabled instead of stuck "pending" forever.
      const subscription = await Promise.race([
        registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Le service de notifications ne répond pas, réessayez.")), 15000),
        ),
      ]);
      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Abonnement aux notifications incomplet.");
      }
      await savePushSubscription({
        endpoint: json.endpoint,
        p256dh: json.keys.p256dh,
        authKey: json.keys.auth,
      });
      setStatus("subscribed");
      toast.success("Notifications activées");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  async function handleDisable() {
    setPending(true);
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await deletePushSubscription({ endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setStatus("unsubscribed");
      toast.success("Notifications désactivées");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Une erreur est survenue.");
    } finally {
      setPending(false);
    }
  }

  if (status === "unsupported") {
    return (
      <p className="text-sm text-muted-foreground">
        Les notifications ne sont pas prises en charge par ce navigateur.
      </p>
    );
  }

  if (status === "denied") {
    return (
      <p className="text-sm text-muted-foreground">
        Notifications bloquées pour ce site — autorisez-les dans les réglages de votre navigateur pour
        les recevoir.
      </p>
    );
  }

  if (status === "loading") return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">
        Recevez une notification dès qu&apos;une nouvelle candidature d&apos;adoption arrive.
      </p>
      {status === "subscribed" ? (
        <Button variant="outline" onClick={handleDisable} disabled={pending} className="self-start">
          Désactiver les notifications
        </Button>
      ) : (
        <Button onClick={handleEnable} disabled={pending} className="self-start">
          Activer les notifications
        </Button>
      )}
    </div>
  );
}
