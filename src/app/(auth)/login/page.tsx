import { getT } from "@/lib/i18n/server";
import { login } from "../actions";
import { AuthForm } from "../auth-form";

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t.auth.loginTitle} · SkyBoard` };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const t = await getT();
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const initialError =
    params.error === "confirmation"
      ? t.auth.errors.confirmationInvalid
      : params.error === "pairing"
        ? t.auth.errors.pairingInvalid
        : undefined;

  return <AuthForm mode="login" action={login} next={next} initialError={initialError} />;
}
