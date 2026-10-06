"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeRedirectPath } from "@/lib/auth/safe-redirect";
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

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/confirm` },
  });
  if (error) return { error: error.message };

  // Confirmation d'email désactivée dans Supabase : session ouverte directement.
  if (data.session) redirect("/documents");

  return { message: "Compte créé. Vérifie ta boîte mail pour confirmer ton adresse." };
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
