"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  const callbackUrl = searchParams.get("callbackUrl") ?? "/apres-connexion";
  const authError = searchParams.get("error");

  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  useEffect(() => {
    // no-store: this must always be a fresh request. A cached response would
    // hand back a token whose matching authjs.csrf-token cookie was never
    // (re-)set on this load, so the subsequent form submit gets rejected as
    // a missing/invalid CSRF token.
    fetch("/api/auth/csrf", { cache: "no-store" })
      .then((res) => res.json())
      .then((data) => setCsrfToken(data.csrfToken));
  }, []);

  return (
    <form method="POST" action="/api/auth/callback/credentials" className="flex flex-col gap-4">
      <input type="hidden" name="csrfToken" value={csrfToken ?? ""} />
      <input type="hidden" name="callbackUrl" value={callbackUrl} />

      <Field label="Email" htmlFor="connexion-email">
        <Input id="connexion-email" name="email" type="email" required autoComplete="email" />
      </Field>

      <Field label="Mot de passe" htmlFor="connexion-password">
        <Input
          id="connexion-password"
          name="password"
          type="password"
          required
          autoComplete="current-password"
        />
      </Field>

      {authError && (
        <p className="text-sm text-destructive">Email ou mot de passe incorrect.</p>
      )}

      <Button type="submit" disabled={!csrfToken} className="w-full">
        Se connecter
      </Button>
    </form>
  );
}
