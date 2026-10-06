"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { FORGET_VALUE, REMEMBER_COOKIE } from "@/lib/auth/remember";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
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
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: "Email et mot de passe requis." };

  // À poser avant la connexion : les cookies de session en tiennent compte.
  await setRememberPreference(formData.get("remember") === "on");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return {
      error:
        error.code === "email_not_confirmed"
          ? "Email non confirmé : clique sur le lien reçu par email."
          : "Identifiants invalides.",
    };
  }

  redirect(safeRedirectPath(formData.get("next")));
}

export async function signup(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { email, password } = readCredentials(formData);
  if (!email) return { error: "Email requis." };
  if (password.length < MIN_PASSWORD_LENGTH) {
    return { error: `Le mot de passe doit faire au moins ${MIN_PASSWORD_LENGTH} caractères.` };
  }
  if (password !== String(formData.get("confirm") ?? "")) {
    return { error: "Les mots de passe ne correspondent pas." };
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
    if (error.code === "weak_password") return { error: "Mot de passe trop faible : choisis-en un plus long ou plus varié." };
    if (error.code === "over_email_send_rate_limit" || error.status === 429) {
      return { error: "Trop de tentatives : réessaie dans quelques minutes." };
    }
    return { error: "Inscription impossible. Vérifie l'adresse email et réessaie." };
  }

  // Confirmation d'email désactivée dans Supabase : session ouverte directement.
  if (data.session) redirect("/");

  return { message: "Compte créé. Vérifie ta boîte mail pour confirmer ton adresse." };
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
