import { signup } from "../actions";
import { AuthForm } from "../auth-form";

export const metadata = { title: "Créer un compte · SkyBoard" };

export default function SignupPage() {
  return <AuthForm mode="signup" action={signup} />;
}
