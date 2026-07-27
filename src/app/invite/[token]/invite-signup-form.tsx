"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { createAccountAndAcceptInvitation } from "@/server/actions/invitations";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4">
      <Field label="Email" htmlFor="signup-email">
        <Input
          id="signup-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </Field>
      <Field label="Mot de passe" htmlFor="signup-password">
        <Input
          id="signup-password"
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </Field>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending} className="w-full">
        Créer mon compte
      </Button>
    </form>
  );
}
