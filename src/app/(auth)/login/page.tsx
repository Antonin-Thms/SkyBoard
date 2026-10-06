import { login } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Connexion · SkyBoard" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const initialError =
    params.error === "confirmation"
      ? "Lien de confirmation invalide ou expiré."
      : params.error === "pairing"
        ? "QR code expiré ou déjà utilisé : affiche-en un nouveau sur le PC, ou connecte-toi."
        : undefined;

  return <AuthForm mode="login" action={login} next={next} initialError={initialError} />;
}
