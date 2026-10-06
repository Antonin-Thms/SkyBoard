"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCockpit } from "@/app/(app)/cockpits/actions";

export function CreateCockpitForm() {
  const [state, action, pending] = useActionState(createCockpit, {});
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!pending && !state.error) formRef.current?.reset();
  }, [pending, state]);

  return (
    <form ref={formRef} action={action} className="flex flex-wrap items-start gap-2">
      <input
        className="input max-w-xs"
        name="name"
        placeholder="Nom du cockpit (ex. F-16C)"
        maxLength={100}
        required
      />
      <button type="submit" className="btn-primary" disabled={pending}>
        {pending ? "Création…" : "Créer un cockpit"}
      </button>
      {state.error && <p className="w-full text-sm text-red-400">{state.error}</p>}
    </form>
  );
}
