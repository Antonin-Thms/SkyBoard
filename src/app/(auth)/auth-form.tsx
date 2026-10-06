"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { AuthFormState } from "./actions";

interface AuthFormProps {
  mode: "login" | "signup";
  action: (prev: AuthFormState, formData: FormData) => Promise<AuthFormState>;
  next?: string;
  initialError?: string;
}

export function AuthForm({ mode, action, next, initialError }: AuthFormProps) {
  const [state, formAction, pending] = useActionState(action, { error: initialError });
  const isSignup = mode === "signup";

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <form
        action={formAction}
        className="w-full max-w-sm space-y-4 rounded-2xl border border-slate-800 bg-slate-900/60 p-6"
      >
        <h1 className="text-xl font-semibold">{isSignup ? "Créer un compte" : "Connexion"}</h1>

        {next && <input type="hidden" name="next" value={next} />}

        <label className="block space-y-1">
          <span className="text-sm text-slate-400">Email</span>
          <input className="input" type="email" name="email" autoComplete="email" required />
        </label>

        <label className="block space-y-1">
          <span className="text-sm text-slate-400">Mot de passe</span>
          <input
            className="input"
            type="password"
            name="password"
            autoComplete={isSignup ? "new-password" : "current-password"}
            minLength={isSignup ? 8 : undefined}
            required
          />
        </label>

        {isSignup && (
          <label className="block space-y-1">
            <span className="text-sm text-slate-400">Confirmer le mot de passe</span>
            <input
              className="input"
              type="password"
              name="confirm"
              autoComplete="new-password"
              required
            />
          </label>
        )}

        {state.error && (
          <p role="alert" className="text-sm text-red-400">
            {state.error}
          </p>
        )}
        {state.message && <p className="text-sm text-emerald-400">{state.message}</p>}

        <button type="submit" className="btn-primary w-full" disabled={pending}>
          {pending ? "…" : isSignup ? "Créer le compte" : "Se connecter"}
        </button>

        <p className="text-center text-sm text-slate-400">
          {isSignup ? (
            <>
              Déjà un compte ?{" "}
              <Link href="/login" className="text-sky-400 hover:underline">
                Se connecter
              </Link>
            </>
          ) : (
            <>
              Pas de compte ?{" "}
              <Link href="/signup" className="text-sky-400 hover:underline">
                Créer un compte
              </Link>
            </>
          )}
        </p>
      </form>
    </main>
  );
}
