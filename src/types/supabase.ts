// Hand-maintained approximation of supabase gen types typescript --local output.
// Match the exact structure the CLI would produce so supabase-js resolves types correctly.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      puzzles: {
        Row: {
          id: string;
          fen: string;
          moves: string[];
          source: string;
          lichess_id: string | null;
          rating: number | null;
          popularity: number | null;
          themes: string[] | null;
          created_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          fen: string;
          moves: string[];
          source?: string;
          lichess_id?: string | null;
          rating?: number | null;
          popularity?: number | null;
          themes?: string[] | null;
          created_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          fen?: string;
          moves?: string[];
          source?: string;
          lichess_id?: string | null;
          rating?: number | null;
          popularity?: number | null;
          themes?: string[] | null;
          created_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      puzzle_sets: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      puzzle_set_puzzles: {
        Row: {
          puzzle_set_id: string;
          puzzle_id: string;
          added_at: string;
        };
        Insert: {
          puzzle_set_id: string;
          puzzle_id: string;
          added_at?: string;
        };
        Update: {
          puzzle_set_id?: string;
          puzzle_id?: string;
          added_at?: string;
        };
        Relationships: [];
      };
      training_sessions: {
        Row: {
          id: string;
          user_id: string;
          puzzle_set_id: string;
          cycle_number: number;
          started_at: string;
          completed_at: string | null;
          queue_state: Json;
        };
        Insert: {
          id?: string;
          user_id: string;
          puzzle_set_id: string;
          cycle_number?: number;
          started_at?: string;
          completed_at?: string | null;
          queue_state?: Json;
        };
        Update: {
          id?: string;
          user_id?: string;
          puzzle_set_id?: string;
          cycle_number?: number;
          started_at?: string;
          completed_at?: string | null;
          queue_state?: Json;
        };
        Relationships: [];
      };
      puzzle_attempts: {
        Row: {
          id: string;
          session_id: string;
          puzzle_id: string;
          user_id: string;
          solved_correctly: boolean;
          time_taken_ms: number | null;
          attempt_number: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          session_id: string;
          puzzle_id: string;
          user_id: string;
          solved_correctly: boolean;
          time_taken_ms?: number | null;
          attempt_number?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          session_id?: string;
          puzzle_id?: string;
          user_id?: string;
          solved_correctly?: boolean;
          time_taken_ms?: number | null;
          attempt_number?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "puzzle_attempts_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "training_sessions";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
