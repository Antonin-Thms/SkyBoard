"use client";

import { Plus } from "lucide-react";
import { useActionState, useEffect, useRef } from "react";
import { createCockpit } from "@/app/(app)/cockpits/actions";
import { useT } from "@/lib/i18n/client";

export function CreateCockpitForm() {
  const t = useT();
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
        placeholder={t.cockpits.create.placeholder}
        aria-label={t.cockpits.create.ariaLabel}
        maxLength={100}
        required
      />
      <button type="submit" className="btn-primary" disabled={pending}>
        <Plus size={16} strokeWidth={1.75} />
        {pending ? t.cockpits.create.pending : t.cockpits.create.submit}
      </button>
      {state.error && <p className="w-full text-sm text-danger">{state.error}</p>}
    </form>
  );
}
