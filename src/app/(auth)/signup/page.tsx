import { getT } from "@/lib/i18n/server";
import { signup } from "../actions";
import { AuthForm } from "../auth-form";

export async function generateMetadata() {
  const t = await getT();
  return { title: `${t.auth.signupTitle} · SkyBoard` };
}

export default function SignupPage() {
  return <AuthForm mode="signup" action={signup} />;
}
