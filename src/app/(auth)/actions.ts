"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FORGET_VALUE, REMEMBER_COOKIE } from "@/lib/auth/remember";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
import { fmt } from "@/lib/i18n/define";
import { getT } from "@/lib/i18n/server";
import { siteOrigin } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";

export interface AuthFormState {
  error?: string;
  message?: string;
}

const MIN_PASSWORD_LENGTH = 8;

function readCredentials(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  return { email, password };
}

export async function login(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const t = await getT();
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: t.auth.errors.credentialsRequired };

  // À poser avant la connexion : les cookies de session en tiennent compte.
  await setRememberPreference(formData.get("remember") === "on");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error:
        error.code === "email_not_confirmed"
          ? t.auth.errors.emailNotConfirmed
          : t.auth.errors.invalidCredentials,
    };
  }

  redirect(safeRedirectPath(formData.get("next")));
}

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const t = await getT();
  const { email, password } = readCredentials(formData);
  if (!email) return { error: t.auth.errors.emailRequired };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: fmt(t.auth.errors.passwordTooShort, { n: MIN_PASSWORD_LENGTH }) };
  }
  if (password !== String(formData.get("confirm") ?? "")) {
    return { error: t.auth.errors.passwordMismatch };
  }

  const origin = await siteOrigin();

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) {
    // Messages génériques : ne pas révéler si une adresse a déjà un compte.
    if (error.code === "weak_password") return { error: t.auth.errors.weakPassword };
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return { error: t.auth.errors.rateLimited };
    }
    return { error: t.auth.errors.signupFailed };
  }

  // Confirmation d'email désactivée dans Supabase : session ouverte directement.
  if (data.session) redirect("/");

  return { message: t.auth.accountCreated };
}

async function setRememberPreference(remember: boolean) {
  const store = await cookies();
  if (remember) {
    store.delete(REMEMBER_COOKIE);
  } else {
    // Cookie de session (sans durée) : disparaît avec la session navigateur.
    store.set(REMEMBER_COOKIE, FORGET_VALUE, { path: "/", sameSite: "lax", httpOnly: false });
  }
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete(REMEMBER_COOKIE);
  redirect("/login");
}
