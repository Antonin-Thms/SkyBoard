import "server-only";

import { cache } from "react";
import { createClient, getSessionClaims } from "@/lib/supabase/server";

export interface SquadronMember {
  userId: string;
  callsign: string;
  isOwner: boolean;
  isMe: boolean;
}

export interface SquadronSummary {
  id: string;
  name: string;
  inviteCode: string;
  isOwner: boolean;
  members: SquadronMember[];
}

/** Escadrilles dont l'utilisateur est membre (RLS), avec leurs membres. */
export const getSquadrons = cache(async (): Promise<SquadronSummary[]> => {
  const supabase = await createClient();
  const me = (await getSessionClaims())?.sub ?? null;
  const [{ data: squadrons }, { data: members }] = await Promise.all([
    supabase.from("squadrons").select("id, name, owner_id, invite_code").order("created_at"),
    supabase.from("squadron_members").select("squadron_id, user_id, callsign, joined_at").order("joined_at"),
  ]);
  return (squadrons ?? []).map((s) => ({
    id: s.id,
    name: s.name,
    inviteCode: s.invite_code,
    isOwner: s.owner_id === me,
    members: (members ?? [])
      .filter((m) => m.squadron_id === s.id)
      .map((m) => ({
        userId: m.user_id,
        callsign: m.callsign,
        isOwner: m.user_id === s.owner_id,
        isMe: m.user_id === me,
      })),
  }));
});
