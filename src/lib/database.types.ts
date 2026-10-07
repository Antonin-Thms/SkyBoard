// Types de la base, alignés sur supabase/migrations.
// Peut être régénéré avec : npx supabase gen types typescript --linked

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type DocumentMimeType = "application/pdf" | "image/png" | "image/jpeg";

/** Rotation d'affichage, sens horaire. */
export type Rotation = 0 | 90 | 180 | 270;

export interface Database {
  public: {
    Tables: {
      cockpits: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          viewer_token: string;
          last_state: Json | null;
          active_folder_id: string | null;
          created_at: string;
        };
        Insert: {
          name: string;
        };
        Update: {
          name?: string;
          last_state?: Json | null;
          active_folder_id?: string | null;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          type: DocumentMimeType;
          storage_path: string;
          thumbnail_path: string | null;
          page_count: number;
          sort_order: number;
          folder_id: string | null;
          rotation: Rotation;
          created_at: string;
        };
        Insert: {
          name: string;
          type: DocumentMimeType;
          storage_path: string;
          thumbnail_path?: string | null;
          page_count?: number;
          sort_order?: number;
          folder_id?: string | null;
        };
        Update: {
          name?: string;
          thumbnail_path?: string | null;
          sort_order?: number;
          folder_id?: string | null;
          rotation?: Rotation;
        };
        Relationships: [];
      };
      folders: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          sort_order: number;
          /** Escadron avec lequel le dossier est partagé */
          squadron_id: string | null;
          created_at: string;
        };
        Insert: {
          name: string;
          sort_order?: number;
        };
        Update: {
          name?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      squadrons: {
        Row: {
          id: string;
          name: string;
          owner_id: string;
          invite_code: string;
          created_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      squadron_members: {
        Row: {
          squadron_id: string;
          user_id: string;
          callsign: string;
          joined_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      annotations: {
        Row: {
          document_id: string;
          page: number;
          user_id: string;
          strokes: Json;
          updated_at: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      document_favorites: {
        Row: {
          user_id: string;
          document_id: string;
          created_at: string;
        };
        Insert: {
          user_id?: string;
          document_id: string;
        };
        Update: never;
        Relationships: [];
      };
      /** Jumelage par QR code : accessible uniquement côté serveur (service_role). */
      remote_pairings: {
        Row: {
          code_hash: string;
          user_id: string;
          cockpit_id: string;
          expires_at: string;
          used_at: string | null;
        };
        Insert: {
          code_hash: string;
          user_id: string;
          cockpit_id: string;
          expires_at: string;
        };
        Update: {
          used_at?: string | null;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      regenerate_viewer_token: {
        Args: { cockpit_id: string };
        Returns: string;
      };
      reorder_documents: {
        Args: { ids: string[] };
        Returns: undefined;
      };
      annotation_add: {
        Args: { document_id: string; page: number; stroke: Json };
        Returns: undefined;
      };
      annotation_remove: {
        Args: { document_id: string; page: number; ids: string[] };
        Returns: undefined;
      };
      annotation_clear: {
        Args: { document_ids: string[]; page?: number | null };
        Returns: undefined;
      };
      create_squadron: {
        Args: { name: string; callsign: string };
        Returns: string;
      };
      join_squadron: {
        Args: { code: string; callsign: string };
        Returns: string;
      };
      leave_squadron: {
        Args: { squadron: string; member?: string | null };
        Returns: undefined;
      };
      delete_squadron: {
        Args: { squadron: string };
        Returns: undefined;
      };
      regenerate_squadron_invite: {
        Args: { squadron: string };
        Returns: string;
      };
      share_folder: {
        Args: { folder: string; squadron: string | null };
        Returns: undefined;
      };
      save_last_state: {
        Args: { cockpit_id: string; state: Json };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type CockpitRow = Database["public"]["Tables"]["cockpits"]["Row"];
export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type FolderRow = Database["public"]["Tables"]["folders"]["Row"];
