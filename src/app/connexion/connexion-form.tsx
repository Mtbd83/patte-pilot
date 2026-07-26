"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/**
 * Deliberately a plain <form method="post"> (no onSubmit/preventDefault) so
 * the browser performs a real navigation on submit. A JS-driven fetch-based
 * sign-in races with whatever the caller does right after clicking submit
 * (e.g. an immediate page.goto in e2e tests can abort the in-flight request
 * before the session cookie is set) — a native form submission has no such
 * race, since Playwright/browsers wait for the resulting navigation.
 */
export function ConnexionForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";
  const authError = searchParams.get("error");

  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/csrf")
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.csrfToken));
  }, []);

  return (
    <form method="POST" action="/api/auth/callback/credentials" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <input type="hidden" name="csrfToken" value={csrfToken ?? ""} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />
      <label htmlFor="connexion-email">
        Email
        <input
          id="connexion-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          style={{ display: "block", width: "100%" }}
        />
      </label>
      <label htmlFor="connexion-password">
        Mot de passe
        <input
          id="connexion-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
          style={{ display: "block", width: "100%" }}
        />
      </label>
      {authError && <p style={{ color: "crimson" }}>Email ou mot de passe incorrect.</p>}
      <button type="submit" disabled={!csrfToken}>
        Se connecter
      </button>
    </form>
  );
}
