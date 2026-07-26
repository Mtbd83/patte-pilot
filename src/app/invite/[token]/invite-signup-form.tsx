"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { createAccountAndAcceptInvitation } from "@/server/actions/invitations";

export function InviteSignupForm({ token, email: invitedEmail }: { token: string; email: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);

    try {
      const { organizationId } = await createAccountAndAcceptInvitation({ token, email, password });

      const signInResult = await signIn("credentials", { email, password, redirect: false });
      if (signInResult?.error) {
        throw new Error("Compte créé, mais la connexion automatique a échoué. Merci de vous connecter.");
      }

      router.push(`/organisations/${organizationId}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 16 }}>
      <label htmlFor="signup-email">
        Email
        <input
          id="signup-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ display: "block", width: "100%" }}
        />
      </label>
      <label htmlFor="signup-password">
        Mot de passe
        <input
          id="signup-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ display: "block", width: "100%" }}
        />
      </label>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      <button type="submit" disabled={pending}>
        Créer mon compte
      </button>
    </form>
  );
}
