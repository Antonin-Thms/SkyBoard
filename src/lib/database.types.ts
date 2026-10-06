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
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type CockpitRow = Database["public"]["Tables"]["cockpits"]["Row"];
export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];
export type FolderRow = Database["public"]["Tables"]["folders"]["Row"];
