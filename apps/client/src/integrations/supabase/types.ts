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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      activity_feed_items: {
        Row: {
          activity_id: string
          actor_id: string
          created_at: string
          id: string
          item_created_at: string
          viewer_id: string
        }
        Insert: {
          activity_id: string
          actor_id: string
          created_at?: string
          id?: string
          item_created_at?: string
          viewer_id: string
        }
        Update: {
          activity_id?: string
          actor_id?: string
          created_at?: string
          id?: string
          item_created_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_feed_items_activity_id_fkey"
            columns: ["activity_id"]
            isOneToOne: false
            referencedRelation: "social_activities"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_feed_items_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_feed_items_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      analytics_snapshots: {
        Row: {
          author_distribution: Json | null
          avg_pages_per_hour: number | null
          books_completed: number | null
          books_started: number | null
          computed_at: string | null
          genre_distribution: Json | null
          hourly_distribution: Json | null
          id: string
          snapshot_date: string
          status_breakdown: Json | null
          total_pages_read: number | null
          total_reading_minutes: number | null
          user_id: string
        }
        Insert: {
          author_distribution?: Json | null
          avg_pages_per_hour?: number | null
          books_completed?: number | null
          books_started?: number | null
          computed_at?: string | null
          genre_distribution?: Json | null
          hourly_distribution?: Json | null
          id?: string
          snapshot_date: string
          status_breakdown?: Json | null
          total_pages_read?: number | null
          total_reading_minutes?: number | null
          user_id: string
        }
        Update: {
          author_distribution?: Json | null
          avg_pages_per_hour?: number | null
          books_completed?: number | null
          books_started?: number | null
          computed_at?: string | null
          genre_distribution?: Json | null
          hourly_distribution?: Json | null
          id?: string
          snapshot_date?: string
          status_breakdown?: Json | null
          total_pages_read?: number | null
          total_reading_minutes?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "analytics_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      api_rate_limits: {
        Row: {
          bucket_key: string
          request_count: number
          updated_at: string
          window_seconds: number
          window_start: string
        }
        Insert: {
          bucket_key: string
          request_count?: number
          updated_at?: string
          window_seconds: number
          window_start?: string
        }
        Update: {
          bucket_key?: string
          request_count?: number
          updated_at?: string
          window_seconds?: number
          window_start?: string
        }
        Relationships: []
      }
      app_feature_flags: {
        Row: {
          config: Json
          enabled: boolean
          key: string
          updated_at: string
        }
        Insert: {
          config?: Json
          enabled?: boolean
          key: string
          updated_at?: string
        }
        Update: {
          config?: Json
          enabled?: boolean
          key?: string
          updated_at?: string
        }
        Relationships: []
      }
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
      book_club_discussions: {
        Row: {
          club_id: string
          content: string
          content_format: string
          content_html: string | null
          content_json: Json | null
          created_at: string
          deleted_at: string | null
          discussion_type: string
          id: string
          is_pinned: boolean
          media: Json
          parent_id: string | null
          reply_count: number
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          content: string
          content_format?: string
          content_html?: string | null
          content_json?: Json | null
          created_at?: string
          deleted_at?: string | null
          discussion_type?: string
          id?: string
          is_pinned?: boolean
          media?: Json
          parent_id?: string | null
          reply_count?: number
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          content?: string
          content_format?: string
          content_html?: string | null
          content_json?: Json | null
          created_at?: string
          deleted_at?: string | null
          discussion_type?: string
          id?: string
          is_pinned?: boolean
          media?: Json
          parent_id?: string | null
          reply_count?: number
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_club_discussions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "book_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_club_discussions_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "book_club_discussions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_club_discussions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      book_club_invites: {
        Row: {
          club_id: string
          created_at: string
          expires_at: string | null
          id: string
          invited_by: string
          invited_user_id: string
          message: string | null
          responded_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          club_id: string
          created_at?: string
          expires_at?: string | null
          id?: string
          invited_by: string
          invited_user_id: string
          message?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          club_id?: string
          created_at?: string
          expires_at?: string | null
          id?: string
          invited_by?: string
          invited_user_id?: string
          message?: string | null
          responded_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_club_invites_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "book_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_club_invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_club_invites_invited_user_id_fkey"
            columns: ["invited_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      book_club_join_requests: {
        Row: {
          club_id: string
          created_at: string
          id: string
          message: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          message?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_club_join_requests_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "book_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_club_join_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_club_join_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      book_club_members: {
        Row: {
          club_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          club_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          club_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "book_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      book_clubs: {
        Row: {
          announcement_count: number
          avatar_image_path: string | null
          banner_image_path: string | null
          city: string | null
          country: string | null
          cover_image_url: string | null
          created_at: string
          created_by: string
          current_book_id: string | null
          description: string | null
          discussion_count: number
          genres: string[]
          id: string
          is_private: boolean | null
          last_activity_at: string
          latitude: number | null
          longitude: number | null
          member_count: number
          member_limit: number | null
          name: string
          tags: string[]
          updated_at: string
        }
        Insert: {
          announcement_count?: number
          avatar_image_path?: string | null
          banner_image_path?: string | null
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by: string
          current_book_id?: string | null
          description?: string | null
          discussion_count?: number
          genres?: string[]
          id?: string
          is_private?: boolean | null
          last_activity_at?: string
          latitude?: number | null
          longitude?: number | null
          member_count?: number
          member_limit?: number | null
          name: string
          tags?: string[]
          updated_at?: string
        }
        Update: {
          announcement_count?: number
          avatar_image_path?: string | null
          banner_image_path?: string | null
          city?: string | null
          country?: string | null
          cover_image_url?: string | null
          created_at?: string
          created_by?: string
          current_book_id?: string | null
          description?: string | null
          discussion_count?: number
          genres?: string[]
          id?: string
          is_private?: boolean | null
          last_activity_at?: string
          latitude?: number | null
          longitude?: number | null
          member_count?: number
          member_limit?: number | null
          name?: string
          tags?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_clubs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_clubs_current_book_id_fkey"
            columns: ["current_book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
        ]
      }
      book_list_items: {
        Row: {
          added_at: string
          book_id: string
          deleted_at: string | null
          id: string
          list_id: string
          position: number
          updated_at: string
          user_id: string
        }
        Insert: {
          added_at?: string
          book_id: string
          deleted_at?: string | null
          id?: string
          list_id: string
          position?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          added_at?: string
          book_id?: string
          deleted_at?: string | null
          id?: string
          list_id?: string
          position?: number
          updated_at?: string
          user_id?: string
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
          deleted_at: string | null
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          order_version: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          order_version?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          order_version?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      book_metadata_cache: {
        Row: {
          cache_key: string
          expires_at: string
          fetched_at: string
          isbn: string | null
          last_error: string | null
          payload: Json
          provider: string
          query: string
        }
        Insert: {
          cache_key: string
          expires_at: string
          fetched_at?: string
          isbn?: string | null
          last_error?: string | null
          payload: Json
          provider: string
          query: string
        }
        Update: {
          cache_key?: string
          expires_at?: string
          fetched_at?: string
          isbn?: string | null
          last_error?: string | null
          payload?: Json
          provider?: string
          query?: string
        }
        Relationships: []
      }
      book_reviews: {
        Row: {
          book_id: string
          comments_count: number | null
          content: string
          content_format: string
          content_html: string | null
          content_json: Json | null
          created_at: string
          deleted_at: string | null
          id: string
          is_public: boolean | null
          is_spoiler: boolean | null
          likes_count: number | null
          rating: number
          share_count: number
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          comments_count?: number | null
          content: string
          content_format?: string
          content_html?: string | null
          content_json?: Json | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_public?: boolean | null
          is_spoiler?: boolean | null
          likes_count?: number | null
          rating: number
          share_count?: number
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          comments_count?: number | null
          content?: string
          content_format?: string
          content_html?: string | null
          content_json?: Json | null
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_public?: boolean | null
          is_spoiler?: boolean | null
          likes_count?: number | null
          rating?: number
          share_count?: number
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
          source_id: string | null
          source_provider: string | null
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
          source_id?: string | null
          source_provider?: string | null
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
          source_id?: string | null
          source_provider?: string | null
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
      club_chat_media: {
        Row: {
          bucket_id: string
          club_id: string
          created_at: string
          external_url: string | null
          height: number | null
          id: string
          media_source: string
          media_type: string
          message_id: string
          metadata: Json
          mime_type: string
          position: number
          preview_url: string | null
          provider: string | null
          provider_id: string | null
          size_bytes: number | null
          storage_path: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          bucket_id?: string
          club_id: string
          created_at?: string
          external_url?: string | null
          height?: number | null
          id?: string
          media_source?: string
          media_type: string
          message_id: string
          metadata?: Json
          mime_type: string
          position?: number
          preview_url?: string | null
          provider?: string | null
          provider_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          user_id: string
          width?: number | null
        }
        Update: {
          bucket_id?: string
          club_id?: string
          created_at?: string
          external_url?: string | null
          height?: number | null
          id?: string
          media_source?: string
          media_type?: string
          message_id?: string
          metadata?: Json
          mime_type?: string
          position?: number
          preview_url?: string | null
          provider?: string | null
          provider_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "club_chat_media_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "book_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_chat_media_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "club_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_chat_media_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_chat_mentions: {
        Row: {
          club_id: string
          created_at: string
          created_by: string
          id: string
          mentioned_user_id: string
          message_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          created_by: string
          id?: string
          mentioned_user_id: string
          message_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          created_by?: string
          id?: string
          mentioned_user_id?: string
          message_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_chat_mentions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "book_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_chat_mentions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_chat_mentions_mentioned_user_id_fkey"
            columns: ["mentioned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_chat_mentions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "club_chat_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      club_chat_messages: {
        Row: {
          client_message_id: string | null
          club_id: string
          content: string | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          message_type: string
          metadata: Json
          reply_to_message_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          client_message_id?: string | null
          club_id: string
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          message_type?: string
          metadata?: Json
          reply_to_message_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          client_message_id?: string | null
          club_id?: string
          content?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          message_type?: string
          metadata?: Json
          reply_to_message_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_chat_messages_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "book_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_chat_messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "club_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_chat_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_chat_reactions: {
        Row: {
          club_id: string
          created_at: string
          id: string
          message_id: string
          reaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          id?: string
          message_id: string
          reaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          id?: string
          message_id?: string
          reaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_chat_reactions_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "book_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_chat_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "club_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_chat_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_chat_reads: {
        Row: {
          club_id: string
          created_at: string
          last_read_message_id: string | null
          read_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          last_read_message_id?: string | null
          read_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          last_read_message_id?: string | null
          read_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_chat_reads_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "book_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_chat_reads_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "club_chat_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_chat_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      club_chat_user_settings: {
        Row: {
          club_id: string
          created_at: string
          is_muted: boolean
          last_opened_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          club_id: string
          created_at?: string
          is_muted?: boolean
          last_opened_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          club_id?: string
          created_at?: string
          is_muted?: boolean
          last_opened_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "club_chat_user_settings_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "book_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "club_chat_user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_reads: {
        Row: {
          conversation_id: string
          created_at: string
          last_read_message_id: string | null
          read_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          last_read_message_id?: string | null
          read_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          last_read_message_id?: string | null
          read_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_reads_last_read_message_id_fkey"
            columns: ["last_read_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_user_settings: {
        Row: {
          conversation_id: string
          created_at: string
          hidden_at: string | null
          is_archived: boolean
          is_muted: boolean
          is_pinned: boolean
          last_opened_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          hidden_at?: string | null
          is_archived?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          last_opened_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          hidden_at?: string | null
          is_archived?: boolean
          is_muted?: boolean
          is_pinned?: boolean
          last_opened_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_user_settings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_user_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          participant_one_id: string
          participant_two_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          participant_one_id: string
          participant_two_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          participant_one_id?: string
          participant_two_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_participant_one_id_fkey"
            columns: ["participant_one_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_participant_two_id_fkey"
            columns: ["participant_two_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      core_telemetry_events: {
        Row: {
          app_version: string | null
          created_at: string
          event_name: string
          id: string
          metadata: Json
          platform: string
          user_id: string | null
        }
        Insert: {
          app_version?: string | null
          created_at?: string
          event_name: string
          id?: string
          metadata?: Json
          platform?: string
          user_id?: string | null
        }
        Update: {
          app_version?: string | null
          created_at?: string
          event_name?: string
          id?: string
          metadata?: Json
          platform?: string
          user_id?: string | null
        }
        Relationships: []
      }
      dashboard_home_snapshots: {
        Row: {
          created_at: string
          data: Json
          generated_at: string
          recent_limit: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json
          generated_at?: string
          recent_limit?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json
          generated_at?: string
          recent_limit?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dashboard_home_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          completed_at: string | null
          created_at: string | null
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
          content_format: string
          content_html: string | null
          content_json: Json | null
          created_at: string
          deleted_at: string | null
          entry_type: string
          id: string
          page_reference: number | null
          photo_url: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          content: string
          content_format?: string
          content_html?: string | null
          content_json?: Json | null
          created_at?: string
          deleted_at?: string | null
          entry_type: string
          id?: string
          page_reference?: number | null
          photo_url?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          content?: string
          content_format?: string
          content_html?: string | null
          content_json?: Json | null
          created_at?: string
          deleted_at?: string | null
          entry_type?: string
          id?: string
          page_reference?: number | null
          photo_url?: string | null
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
          {
            foreignKeyName: "journal_entries_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_media: {
        Row: {
          bucket_id: string
          conversation_id: string
          created_at: string
          external_url: string | null
          height: number | null
          id: string
          media_source: string
          media_type: string
          message_id: string
          metadata: Json
          mime_type: string
          position: number
          preview_url: string | null
          provider: string | null
          provider_id: string | null
          size_bytes: number | null
          storage_path: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          bucket_id?: string
          conversation_id: string
          created_at?: string
          external_url?: string | null
          height?: number | null
          id?: string
          media_source?: string
          media_type: string
          message_id: string
          metadata?: Json
          mime_type: string
          position?: number
          preview_url?: string | null
          provider?: string | null
          provider_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          user_id: string
          width?: number | null
        }
        Update: {
          bucket_id?: string
          conversation_id?: string
          created_at?: string
          external_url?: string | null
          height?: number | null
          id?: string
          media_source?: string
          media_type?: string
          message_id?: string
          metadata?: Json
          mime_type?: string
          position?: number
          preview_url?: string | null
          provider?: string | null
          provider_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "message_media_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_media_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_media_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          message_id: string
          reaction_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          message_id: string
          reaction_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          message_id?: string
          reaction_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          client_message_id: string | null
          content: string | null
          conversation_id: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          is_read: boolean | null
          message_type: string
          metadata: Json
          reply_to_message_id: string | null
          sender_id: string
          updated_at: string
        }
        Insert: {
          client_message_id?: string | null
          content?: string | null
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_read?: boolean | null
          message_type?: string
          metadata?: Json
          reply_to_message_id?: string | null
          sender_id: string
          updated_at?: string
        }
        Update: {
          client_message_id?: string | null
          content?: string | null
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          is_read?: boolean | null
          message_type?: string
          metadata?: Json
          reply_to_message_id?: string | null
          sender_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          book_clubs_enabled: boolean
          created_at: string
          followers_enabled: boolean
          goals_enabled: boolean
          id: string
          messages_enabled: boolean
          push_enabled: boolean
          quiet_hours_end: string | null
          quiet_hours_start: string | null
          reading_reminders_enabled: boolean
          streaks_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          book_clubs_enabled?: boolean
          created_at?: string
          followers_enabled?: boolean
          goals_enabled?: boolean
          id?: string
          messages_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          reading_reminders_enabled?: boolean
          streaks_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          book_clubs_enabled?: boolean
          created_at?: string
          followers_enabled?: boolean
          goals_enabled?: boolean
          id?: string
          messages_enabled?: boolean
          push_enabled?: boolean
          quiet_hours_end?: string | null
          quiet_hours_start?: string | null
          reading_reminders_enabled?: boolean
          streaks_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          content: string
          created_at: string
          deleted_at: string | null
          depth: number
          id: string
          parent_id: string | null
          post_id: string
          reply_count: number
          root_comment_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          deleted_at?: string | null
          depth?: number
          id?: string
          parent_id?: string | null
          post_id: string
          reply_count?: number
          root_comment_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          deleted_at?: string | null
          depth?: number
          id?: string
          parent_id?: string | null
          post_id?: string
          reply_count?: number
          root_comment_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_feed_items: {
        Row: {
          actor_id: string
          created_at: string
          id: string
          item_created_at: string
          post_id: string
          source: string
          viewer_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          id?: string
          item_created_at?: string
          post_id: string
          source?: string
          viewer_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          id?: string
          item_created_at?: string
          post_id?: string
          source?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_feed_items_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_feed_items_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_feed_items_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_media: {
        Row: {
          bucket_id: string
          created_at: string
          duration_ms: number | null
          height: number | null
          id: string
          media_type: string
          mime_type: string
          position: number
          post_id: string
          size_bytes: number
          storage_path: string
          thumbnail_path: string | null
          user_id: string
          width: number | null
        }
        Insert: {
          bucket_id?: string
          created_at?: string
          duration_ms?: number | null
          height?: number | null
          id?: string
          media_type: string
          mime_type: string
          position?: number
          post_id: string
          size_bytes: number
          storage_path: string
          thumbnail_path?: string | null
          user_id: string
          width?: number | null
        }
        Update: {
          bucket_id?: string
          created_at?: string
          duration_ms?: number | null
          height?: number | null
          id?: string
          media_type?: string
          mime_type?: string
          position?: number
          post_id?: string
          size_bytes?: number
          storage_path?: string
          thumbnail_path?: string | null
          user_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "post_media_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_media_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_shares: {
        Row: {
          created_at: string
          id: string
          post_id: string
          share_target: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          share_target?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          share_target?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_shares_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_shares_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          book_id: string | null
          club_id: string | null
          comments_count: number | null
          content: string
          content_format: string
          content_html: string | null
          content_json: Json | null
          created_at: string
          deleted_at: string | null
          genre: string | null
          id: string
          likes_count: number | null
          metadata: Json
          post_type: string
          share_count: number
          title: string
          updated_at: string
          user_id: string
          visibility: string
        }
        Insert: {
          book_id?: string | null
          club_id?: string | null
          comments_count?: number | null
          content: string
          content_format?: string
          content_html?: string | null
          content_json?: Json | null
          created_at?: string
          deleted_at?: string | null
          genre?: string | null
          id?: string
          likes_count?: number | null
          metadata?: Json
          post_type?: string
          share_count?: number
          title: string
          updated_at?: string
          user_id: string
          visibility?: string
        }
        Update: {
          book_id?: string | null
          club_id?: string | null
          comments_count?: number | null
          content?: string
          content_format?: string
          content_html?: string | null
          content_json?: Json | null
          created_at?: string
          deleted_at?: string | null
          genre?: string | null
          id?: string
          likes_count?: number | null
          metadata?: Json
          post_type?: string
          share_count?: number
          title?: string
          updated_at?: string
          user_id?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "book_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          allow_friend_requests: boolean | null
          avatar_url: string | null
          bio: string | null
          city: string | null
          color_theme: string | null
          country: string | null
          created_at: string | null
          current_streak: number | null
          date_of_birth: string | null
          display_name: string | null
          first_name: string | null
          id: string
          is_active: boolean | null
          last_name: string | null
          last_reading_date: string | null
          last_seen_at: string | null
          latitude: number | null
          library_view_mode: string
          longest_streak: number | null
          longitude: number | null
          onboarding_completed_at: string | null
          onboarding_last_step: string | null
          onboarding_skipped_at: string | null
          onboarding_status: string
          onboarding_version: number
          phone_number: string | null
          profile_visibility: string | null
          reader_status: string
          show_currently_reading: boolean | null
          show_location: boolean
          show_online_status: boolean
          show_reading_activity: boolean | null
          streak_freeze_used_at: string | null
          theme_mode: string | null
          updated_at: string | null
        }
        Insert: {
          allow_friend_requests?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          color_theme?: string | null
          country?: string | null
          created_at?: string | null
          current_streak?: number | null
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          id: string
          is_active?: boolean | null
          last_name?: string | null
          last_reading_date?: string | null
          last_seen_at?: string | null
          latitude?: number | null
          library_view_mode?: string
          longest_streak?: number | null
          longitude?: number | null
          onboarding_completed_at?: string | null
          onboarding_last_step?: string | null
          onboarding_skipped_at?: string | null
          onboarding_status?: string
          onboarding_version?: number
          phone_number?: string | null
          profile_visibility?: string | null
          reader_status?: string
          show_currently_reading?: boolean | null
          show_location?: boolean
          show_online_status?: boolean
          show_reading_activity?: boolean | null
          streak_freeze_used_at?: string | null
          theme_mode?: string | null
          updated_at?: string | null
        }
        Update: {
          allow_friend_requests?: boolean | null
          avatar_url?: string | null
          bio?: string | null
          city?: string | null
          color_theme?: string | null
          country?: string | null
          created_at?: string | null
          current_streak?: number | null
          date_of_birth?: string | null
          display_name?: string | null
          first_name?: string | null
          id?: string
          is_active?: boolean | null
          last_name?: string | null
          last_reading_date?: string | null
          last_seen_at?: string | null
          latitude?: number | null
          library_view_mode?: string
          longest_streak?: number | null
          longitude?: number | null
          onboarding_completed_at?: string | null
          onboarding_last_step?: string | null
          onboarding_skipped_at?: string | null
          onboarding_status?: string
          onboarding_version?: number
          phone_number?: string | null
          profile_visibility?: string | null
          reader_status?: string
          show_currently_reading?: boolean | null
          show_location?: boolean
          show_online_status?: boolean
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
          client_log_id: string | null
          created_at: string
          id: string
          log_type: string
          logged_at: string
          notes: string | null
          page_number: number
          paragraph_number: number | null
          photo_url: string | null
          session_id: string | null
          time_spent_minutes: number | null
          user_id: string
        }
        Insert: {
          book_id: string
          chapter_number?: number | null
          client_log_id?: string | null
          created_at?: string
          id?: string
          log_type: string
          logged_at?: string
          notes?: string | null
          page_number: number
          paragraph_number?: number | null
          photo_url?: string | null
          session_id?: string | null
          time_spent_minutes?: number | null
          user_id: string
        }
        Update: {
          book_id?: string
          chapter_number?: number | null
          client_log_id?: string | null
          created_at?: string
          id?: string
          log_type?: string
          logged_at?: string
          notes?: string | null
          page_number?: number
          paragraph_number?: number | null
          photo_url?: string | null
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
          {
            foreignKeyName: "progress_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      push_tokens: {
        Row: {
          created_at: string
          id: string
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_habits: {
        Row: {
          avg_length: number | null
          avg_time_per_book: number | null
          book_format: string | null
          books_1yr: number | null
          books_6mo: number | null
          created_at: string | null
          genres: string[] | null
          id: string
          longest_genre: string | null
          motivation: string | null
          preferred_reading_time: string | null
          preferred_session_minutes: number | null
          reading_frequency: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          avg_length?: number | null
          avg_time_per_book?: number | null
          book_format?: string | null
          books_1yr?: number | null
          books_6mo?: number | null
          created_at?: string | null
          genres?: string[] | null
          id?: string
          longest_genre?: string | null
          motivation?: string | null
          preferred_reading_time?: string | null
          preferred_session_minutes?: number | null
          reading_frequency?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          avg_length?: number | null
          avg_time_per_book?: number | null
          book_format?: string | null
          books_1yr?: number | null
          books_6mo?: number | null
          created_at?: string | null
          genres?: string[] | null
          id?: string
          longest_genre?: string | null
          motivation?: string | null
          preferred_reading_time?: string | null
          preferred_session_minutes?: number | null
          reading_frequency?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_habits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_import_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          last_error: string | null
          payload: Json
          preview: Json
          processed_items: number
          result: Json | null
          source_format: string
          source_hash: string
          status: string
          total_items: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          preview?: Json
          processed_items?: number
          result?: Json | null
          source_format: string
          source_hash: string
          status?: string
          total_items?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_error?: string | null
          payload?: Json
          preview?: Json
          processed_items?: number
          result?: Json | null
          source_format?: string
          source_hash?: string
          status?: string
          total_items?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reading_sessions: {
        Row: {
          book_id: string | null
          client_session_id: string | null
          created_at: string | null
          duration: number | null
          end_time: string | null
          id: string
          start_time: string | null
          user_id: string | null
        }
        Insert: {
          book_id?: string | null
          client_session_id?: string | null
          created_at?: string | null
          duration?: number | null
          end_time?: string | null
          id?: string
          start_time?: string | null
          user_id?: string | null
        }
        Update: {
          book_id?: string | null
          client_session_id?: string | null
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
      reading_streak_days: {
        Row: {
          activity_date: string
          created_at: string
          id: string
          progress_log_count: number
          session_count: number
          total_minutes: number
          updated_at: string
          used_freeze: boolean
          user_id: string
        }
        Insert: {
          activity_date: string
          created_at?: string
          id?: string
          progress_log_count?: number
          session_count?: number
          total_minutes?: number
          updated_at?: string
          used_freeze?: boolean
          user_id: string
        }
        Update: {
          activity_date?: string
          created_at?: string
          id?: string
          progress_log_count?: number
          session_count?: number
          total_minutes?: number
          updated_at?: string
          used_freeze?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_streak_days_user_id_fkey"
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
        Relationships: [
          {
            foreignKeyName: "reading_streak_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      social_activities: {
        Row: {
          activity_type: string
          badge_id: string | null
          book_id: string | null
          created_at: string
          id: string
          list_id: string | null
          metadata: Json | null
          review_id: string | null
          user_id: string
          visibility: string | null
        }
        Insert: {
          activity_type: string
          badge_id?: string | null
          book_id?: string | null
          created_at?: string
          id?: string
          list_id?: string | null
          metadata?: Json | null
          review_id?: string | null
          user_id: string
          visibility?: string | null
        }
        Update: {
          activity_type?: string
          badge_id?: string | null
          book_id?: string | null
          created_at?: string
          id?: string
          list_id?: string | null
          metadata?: Json | null
          review_id?: string | null
          user_id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_activities_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_activities_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_activities_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "book_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_activities_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "book_reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_activities_user_id_fkey"
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
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
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
      user_learning_profiles: {
        Row: {
          created_at: string
          derived_preferences: Json
          onboarding_answers: Json
          signal_version: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          derived_preferences?: Json
          onboarding_answers?: Json
          signal_version?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          derived_preferences?: Json
          onboarding_answers?: Json
          signal_version?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_learning_profiles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
      add_library_book: {
        Args: { p_book: Json; p_user_id: string }
        Returns: Json
      }
      award_badges: {
        Args: { p_event?: string; p_user_id: string }
        Returns: Json
      }
      calculate_distance: {
        Args: { lat1: number; lat2: number; lon1: number; lon2: number }
        Returns: number
      }
      can_view_club_chat_message: {
        Args: { p_author_id: string; p_club_id: string; p_viewer_id: string }
        Returns: boolean
      }
      can_view_social_post: {
        Args: {
          p_post: Database["public"]["Tables"]["posts"]["Row"]
          p_viewer: string
        }
        Returns: boolean
      }
      check_api_rate_limit: {
        Args: {
          p_bucket_key: string
          p_limit: number
          p_window_seconds: number
        }
        Returns: Json
      }
      club_chat_pair_blocked: {
        Args: { p_user_a: string; p_user_b: string }
        Returns: boolean
      }
      complete_reading_transaction: {
        Args: {
          p_book_id: string
          p_chapter_number?: number
          p_client_log_id?: string
          p_client_session_id?: string
          p_duration_minutes?: number
          p_end_time?: string
          p_log_type?: string
          p_mark_complete?: boolean
          p_notes?: string
          p_page_number?: number
          p_paragraph_number?: number
          p_photo_url?: string
          p_start_time?: string
          p_time_spent_minutes?: number
          p_user_id: string
        }
        Returns: Json
      }
      compute_daily_analytics: {
        Args: { p_date: string; p_user_id: string }
        Returns: {
          author_distribution: Json | null
          avg_pages_per_hour: number | null
          books_completed: number | null
          books_started: number | null
          computed_at: string | null
          genre_distribution: Json | null
          hourly_distribution: Json | null
          id: string
          snapshot_date: string
          status_breakdown: Json | null
          total_pages_read: number | null
          total_reading_minutes: number | null
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "analytics_snapshots"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      conversation_other_participant_id: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: string
      }
      create_reading_session: {
        Args: {
          p_book_id: string
          p_client_session_id?: string
          p_duration_minutes: number
          p_end_time: string
          p_start_time: string
          p_user_id: string
        }
        Returns: Json
      }
      delete_book_list_transaction: {
        Args: { p_list_id: string; p_user_id: string }
        Returns: Json
      }
      get_conversation_summaries: { Args: { p_user_id: string }; Returns: Json }
      get_dashboard_home_snapshot: {
        Args: {
          p_max_age_seconds?: number
          p_recent_limit?: number
          p_user_id: string
        }
        Returns: Json
      }
      get_user_dashboard_stats: {
        Args: { p_recent_limit?: number; p_user_id: string }
        Returns: Json
      }
      is_club_admin: {
        Args: { club_id: string; user_id: string }
        Returns: boolean
      }
      is_club_member: {
        Args: { club_id: string; user_id: string }
        Returns: boolean
      }
      is_club_moderator_or_admin: {
        Args: { club_id: string; user_id: string }
        Returns: boolean
      }
      is_conversation_participant: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      log_progress_transaction:
        | {
            Args: {
              p_book_id: string
              p_chapter_number?: number
              p_log_type?: string
              p_notes?: string
              p_page_number: number
              p_paragraph_number?: number
              p_photo_url?: string
              p_time_spent_minutes?: number
              p_user_id: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_book_id: string
              p_chapter_number?: number
              p_client_log_id?: string
              p_log_type?: string
              p_notes?: string
              p_page_number: number
              p_paragraph_number?: number
              p_photo_url?: string
              p_time_spent_minutes?: number
              p_user_id: string
            }
            Returns: Json
          }
      messaging_pair_blocked: {
        Args: { p_user_a: string; p_user_b: string }
        Returns: boolean
      }
      normalize_book_isbn: { Args: { value: string }; Returns: string }
      normalize_book_text: { Args: { value: string }; Returns: string }
      recalculate_user_reading_streak: {
        Args: { p_user_id: string }
        Returns: Json
      }
      refresh_book_club_counts: {
        Args: { p_club_id: string }
        Returns: undefined
      }
      refresh_book_club_reply_count: {
        Args: { p_parent_id: string }
        Returns: undefined
      }
      refresh_dashboard_home_snapshot: {
        Args: { p_recent_limit?: number; p_user_id: string }
        Returns: Json
      }
      refresh_reading_streak_day: {
        Args: { p_activity_date: string; p_user_id: string }
        Returns: undefined
      }
      reorder_book_list_items: {
        Args: {
          p_expected_version?: number
          p_list_id: string
          p_ordered_book_ids: string[]
          p_user_id: string
        }
        Returns: Json
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      social_pair_blocked: {
        Args: { p_user_a: string; p_user_b: string }
        Returns: boolean
      }
      use_reading_streak_freeze: {
        Args: { p_activity_date?: string; p_user_id: string }
        Returns: {
          activity_date: string
          created_at: string
          id: string
          progress_log_count: number
          session_count: number
          total_minutes: number
          updated_at: string
          used_freeze: boolean
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "reading_streak_days"
          isOneToOne: true
          isSetofReturn: false
        }
      }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
