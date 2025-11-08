export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.12 (cd3cf9e)"
  }
  public: {
    Tables: {
      badges: {
        Row: {
          created_at: string | null
          description: string | null
          icon_url: string | null
          id: string
          title: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          title: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          icon_url?: string | null
          id?: string
          title?: string
        }
        Relationships: []
      }
      book_list_items: {
        Row: {
          added_at: string
          book_id: string
          id: string
          list_id: string
          position: number
        }
        Insert: {
          added_at?: string
          book_id: string
          id?: string
          list_id: string
          position?: number
        }
        Update: {
          added_at?: string
          book_id?: string
          id?: string
          list_id?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "book_list_items_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_list_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "book_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      book_lists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      book_reviews: {
        Row: {
          book_id: string
          comments_count: number | null
          content: string
          created_at: string
          id: string
          is_public: boolean | null
          is_spoiler: boolean | null
          likes_count: number | null
          rating: number
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          comments_count?: number | null
          content: string
          created_at?: string
          id?: string
          is_public?: boolean | null
          is_spoiler?: boolean | null
          likes_count?: number | null
          rating: number
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          comments_count?: number | null
          content?: string
          created_at?: string
          id?: string
          is_public?: boolean | null
          is_spoiler?: boolean | null
          likes_count?: number | null
          rating?: number
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_reviews_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          author: string | null
          chapters: number | null
          cover_url: string | null
          created_at: string | null
          current_page: number | null
          date_finished: string | null
          date_started: string | null
          deleted_at: string | null
          description: string | null
          genre: string | null
          id: string
          isbn: string | null
          metadata: Json | null
          notes: string | null
          pages: number | null
          rating: number | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          author?: string | null
          chapters?: number | null
          cover_url?: string | null
          created_at?: string | null
          current_page?: number | null
          date_finished?: string | null
          date_started?: string | null
          deleted_at?: string | null
          description?: string | null
          genre?: string | null
          id?: string
          isbn?: string | null
          metadata?: Json | null
          notes?: string | null
          pages?: number | null
          rating?: number | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          author?: string | null
          chapters?: number | null
          cover_url?: string | null
          created_at?: string | null
          current_page?: number | null
          date_finished?: string | null
          date_started?: string | null
          deleted_at?: string | null
          description?: string | null
          genre?: string | null
          id?: string
          isbn?: string | null
          metadata?: Json | null
          notes?: string | null
          pages?: number | null
          rating?: number | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "books_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          completed_at: string | null
          created_at: string | null
          end_date: string | null
          goal_type: string | null
          id: string
          is_active: boolean | null
          is_completed: boolean | null
          period_type: string | null
          reminder_time: string | null
          start_date: string | null
          target_books: number | null
          target_minutes: number | null
          target_pages: number | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          end_date?: string | null
          goal_type?: string | null
          id?: string
          is_active?: boolean | null
          is_completed?: boolean | null
          period_type?: string | null
          reminder_time?: string | null
          start_date?: string | null
          target_books?: number | null
          target_minutes?: number | null
          target_pages?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          end_date?: string | null
          goal_type?: string | null
          id?: string
          is_active?: boolean | null
          is_completed?: boolean | null
          period_type?: string | null
          reminder_time?: string | null
          start_date?: string | null
          target_books?: number | null
          target_minutes?: number | null
          target_pages?: number | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          book_id: string
          content: string
          created_at: string
          entry_type: string
          id: string
          page_reference: number | null
          tags: string[] | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          content: string
          created_at?: string
          entry_type: string
          id?: string
          page_reference?: number | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          content?: string
          created_at?: string
          entry_type?: string
          id?: string
          page_reference?: number | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          allow_friend_requests: boolean | null
          avatar_url: string | null
          bio: string | null
          color_theme: string | null
          created_at: string | null
          current_streak: number | null
          date_of_birth: string | null
          display_name: string | null
          first_name: string | null
          id: string
          is_active: boolean | null
          last_name: string | null
          last_reading_date: string | null
          longest_streak: number | null
          phone_number: string | null
          profile_visibility: string | null
          show_currently_reading: boolean | null
          show_reading_activity: boolean | null
          streak_freeze_used_at: string | null
          theme_mode: string | null
          updated_at: string | null
        }
        Insert: {
          allow_friend_requests?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          color_theme?: string | null
          created_at?: string | null
          current_streak?: number | null
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          id: string
          is_active?: boolean | null
          last_name?: string | null
          last_reading_date?: string | null
          longest_streak?: number | null
          phone_number?: string | null
          profile_visibility?: string | null
          show_currently_reading?: boolean | null
          show_reading_activity?: boolean | null
          streak_freeze_used_at?: string | null
          theme_mode?: string | null
          updated_at?: string | null
        }
        Update: {
          allow_friend_requests?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          color_theme?: string | null
          created_at?: string | null
          current_streak?: number | null
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          last_reading_date?: string | null
          longest_streak?: number | null
          phone_number?: string | null
          profile_visibility?: string | null
          show_currently_reading?: boolean | null
          show_reading_activity?: boolean | null
          streak_freeze_used_at?: string | null
          theme_mode?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      progress_logs: {
        Row: {
          book_id: string
          chapter_number: number | null
          created_at: string
          id: string
          log_type: string
          logged_at: string
          notes: string | null
          page_number: number
          paragraph_number: number | null
          session_id: string | null
          time_spent_minutes: number | null
          user_id: string
        }
        Insert: {
          book_id: string
          chapter_number?: number | null
          created_at?: string
          id?: string
          log_type: string
          logged_at?: string
          notes?: string | null
          page_number: number
          paragraph_number?: number | null
          session_id?: string | null
          time_spent_minutes?: number | null
          user_id: string
        }
        Update: {
          book_id?: string
          chapter_number?: number | null
          created_at?: string
          id?: string
          log_type?: string
          logged_at?: string
          notes?: string | null
          page_number?: number
          paragraph_number?: number | null
          session_id?: string | null
          time_spent_minutes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_logs_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "reading_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_habits: {
        Row: {
          avg_length: number | null
          avg_time_per_book: number | null
          books_1yr: number | null
          books_6mo: number | null
          created_at: string | null
          genres: string[] | null
          id: string
          longest_genre: string | null
          user_id: string | null
        }
        Insert: {
          avg_length?: number | null
          avg_time_per_book?: number | null
          books_1yr?: number | null
          books_6mo?: number | null
          created_at?: string | null
          genres?: string[] | null
          id?: string
          longest_genre?: string | null
          user_id?: string | null
        }
        Update: {
          avg_length?: number | null
          avg_time_per_book?: number | null
          books_1yr?: number | null
          books_6mo?: number | null
          created_at?: string | null
          genres?: string[] | null
          id?: string
          longest_genre?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reading_habits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_sessions: {
        Row: {
          book_id: string | null
          created_at: string | null
          duration: number | null
          end_time: string | null
          id: string
          start_time: string | null
          user_id: string | null
        }
        Insert: {
          book_id?: string | null
          created_at?: string | null
          duration?: number | null
          end_time?: string | null
          id?: string
          start_time?: string | null
          user_id?: string | null
        }
        Update: {
          book_id?: string | null
          created_at?: string | null
          duration?: number | null
          end_time?: string | null
          id?: string
          start_time?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reading_sessions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_streak_history: {
        Row: {
          achieved_at: string
          created_at: string | null
          id: string
          streak_count: number
          user_id: string
        }
        Insert: {
          achieved_at?: string
          created_at?: string | null
          id?: string
          streak_count: number
          user_id: string
        }
        Update: {
          achieved_at?: string
          created_at?: string | null
          id?: string
          streak_count?: number
          user_id?: string
        }
        Relationships: []
      }
      review_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          review_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          review_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          review_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "book_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_likes: {
        Row: {
          created_at: string
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "book_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          badge_id: string | null
          earned_at: string | null
          id: string
          user_id: string | null
        }
        Insert: {
          badge_id?: string | null
          earned_at?: string | null
          id?: string
          user_id?: string | null
        }
        Update: {
          badge_id?: string | null
          earned_at?: string | null
          id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
