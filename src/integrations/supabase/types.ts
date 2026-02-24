Initialising login role...
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
    PostgrestVersion: "14.1"
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
      ai_prompts: {
        Row: {
          category: string
          created_at: string
          domain: string | null
          id: string
          is_active: boolean
          prompt_en: string
          prompt_es: string | null
          slug: string
          sort_order: number
          tools_config: Json | null
          updated_at: string
          voice: string | null
        }
        Insert: {
          category?: string
          created_at?: string
          domain?: string | null
          id?: string
          is_active?: boolean
          prompt_en: string
          prompt_es?: string | null
          slug: string
          sort_order?: number
          tools_config?: Json | null
          updated_at?: string
          voice?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          domain?: string | null
          id?: string
          is_active?: boolean
          prompt_en?: string
          prompt_es?: string | null
          slug?: string
          sort_order?: number
          tools_config?: Json | null
          updated_at?: string
          voice?: string | null
        }
        Relationships: []
      }
      beer_liquor_list: {
        Row: {
          ai_ingestion_meta: Json
          category: string
          country: string
          created_at: string
          created_by: string
          description: string
          embedding: string | null
          id: string
          name: string
          notes: string
          producer: string
          search_vector: unknown
          slug: string
          source_session_id: string | null
          status: string
          style: string
          subcategory: string
          updated_at: string
          version: number
        }
        Insert: {
          ai_ingestion_meta?: Json
          category: string
          country: string
          created_at?: string
          created_by: string
          description: string
          embedding?: string | null
          id?: string
          name: string
          notes?: string
          producer: string
          search_vector?: unknown
          slug: string
          source_session_id?: string | null
          status?: string
          style: string
          subcategory: string
          updated_at?: string
          version?: number
        }
        Update: {
          ai_ingestion_meta?: Json
          category?: string
          country?: string
          created_at?: string
          created_by?: string
          description?: string
          embedding?: string | null
          id?: string
          name?: string
          notes?: string
          producer?: string
          search_vector?: unknown
          slug?: string
          source_session_id?: string | null
          status?: string
          style?: string
          subcategory?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "beer_liquor_list_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "ingestion_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_messages: {
        Row: {
          citations: Json | null
          content: string | null
          created_at: string
          id: string
          input_mode: string | null
          role: string
          session_id: string
          tokens_used: number | null
          tool_call_id: string | null
          tool_calls: Json | null
        }
        Insert: {
          citations?: Json | null
          content?: string | null
          created_at?: string
          id?: string
          input_mode?: string | null
          role: string
          session_id: string
          tokens_used?: number | null
          tool_call_id?: string | null
          tool_calls?: Json | null
        }
        Update: {
          citations?: Json | null
          content?: string | null
          created_at?: string
          id?: string
          input_mode?: string | null
          role?: string
          session_id?: string
          tokens_used?: number | null
          tool_call_id?: string | null
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "chat_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_sessions: {
        Row: {
          context_id: string | null
          context_type: string
          created_at: string
          group_id: string
          id: string
          last_active_at: string
          message_count: number
          mode: string
          started_at: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          context_id?: string | null
          context_type: string
          created_at?: string
          group_id: string
          id?: string
          last_active_at?: string
          message_count?: number
          mode?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          context_id?: string | null
          context_type?: string
          created_at?: string
          group_id?: string
          id?: string
          last_active_at?: string
          message_count?: number
          mode?: string
          started_at?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_sessions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cocktails: {
        Row: {
          ai_ingestion_meta: Json
          created_at: string
          created_by: string
          description: string
          embedding: string | null
          glass: string
          id: string
          image: string | null
          ingredients: string
          is_top_seller: boolean
          key_ingredients: string
          name: string
          notes: string
          procedure: Json
          search_vector: unknown
          slug: string
          source_session_id: string | null
          status: string
          style: string
          tasting_notes: string
          updated_at: string
          version: number
        }
        Insert: {
          ai_ingestion_meta?: Json
          created_at?: string
          created_by: string
          description: string
          embedding?: string | null
          glass: string
          id?: string
          image?: string | null
          ingredients: string
          is_top_seller?: boolean
          key_ingredients: string
          name: string
          notes?: string
          procedure: Json
          search_vector?: unknown
          slug: string
          source_session_id?: string | null
          status?: string
          style: string
          tasting_notes: string
          updated_at?: string
          version?: number
        }
        Update: {
          ai_ingestion_meta?: Json
          created_at?: string
          created_by?: string
          description?: string
          embedding?: string | null
          glass?: string
          id?: string
          image?: string | null
          ingredients?: string
          is_top_seller?: boolean
          key_ingredients?: string
          name?: string
          notes?: string
          procedure?: Json
          search_vector?: unknown
          slug?: string
          source_session_id?: string | null
          status?: string
          style?: string
          tasting_notes?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cocktails_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "ingestion_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      content_change_log: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          content_hash: string
          created_at: string
          id: string
          previous_hash: string | null
          source_id: string
          source_table: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          content_hash: string
          created_at?: string
          id?: string
          previous_hash?: string | null
          source_id: string
          source_table: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          content_hash?: string
          created_at?: string
          id?: string
          previous_hash?: string | null
          source_id?: string
          source_table?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_change_log_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_messages: {
        Row: {
          attempt_id: string
          content: string
          created_at: string
          id: string
          metadata: Json | null
          role: string
        }
        Insert: {
          attempt_id: string
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role: string
        }
        Update: {
          attempt_id?: string
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_messages_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      course_conversations: {
        Row: {
          created_at: string
          enrollment_id: string | null
          expires_at: string
          flagged_at: string | null
          flagged_by: string | null
          flagged_reason: string | null
          id: string
          is_flagged: boolean
          messages: Json
          section_id: string | null
          session_summary: string | null
          topics_discussed: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enrollment_id?: string | null
          expires_at?: string
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_reason?: string | null
          id?: string
          is_flagged?: boolean
          messages?: Json
          section_id?: string | null
          session_summary?: string | null
          topics_discussed?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string | null
          expires_at?: string
          flagged_at?: string | null
          flagged_by?: string | null
          flagged_reason?: string | null
          id?: string
          is_flagged?: boolean
          messages?: Json
          section_id?: string | null
          session_summary?: string | null
          topics_discussed?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_conversations_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_conversations_flagged_by_fkey"
            columns: ["flagged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_conversations_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_enrollments: {
        Row: {
          completed_at: string | null
          completed_sections: number
          course_id: string
          created_at: string
          expires_at: string | null
          final_passed: boolean | null
          final_score: number | null
          group_id: string
          id: string
          module_test_attempts: number
          started_at: string | null
          status: string
          total_sections: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_sections?: number
          course_id: string
          created_at?: string
          expires_at?: string | null
          final_passed?: boolean | null
          final_score?: number | null
          group_id: string
          id?: string
          module_test_attempts?: number
          started_at?: string | null
          status?: string
          total_sections?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_sections?: number
          course_id?: string
          created_at?: string
          expires_at?: string | null
          final_passed?: boolean | null
          final_score?: number | null
          group_id?: string
          id?: string
          module_test_attempts?: number
          started_at?: string | null
          status?: string
          total_sections?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_sections: {
        Row: {
          ai_prompt_en: string | null
          ai_prompt_es: string | null
          content_filter: Json | null
          content_ids: string[]
          content_source: string
          course_id: string
          created_at: string
          description_en: string
          description_es: string | null
          estimated_minutes: number
          group_id: string
          id: string
          quiz_enabled: boolean
          quiz_mode: string
          quiz_mode_changed_at: string | null
          quiz_passing_score: number | null
          quiz_question_count: number | null
          section_type: string
          slug: string
          sort_order: number
          status: string
          title_en: string
          title_es: string | null
          updated_at: string
        }
        Insert: {
          ai_prompt_en?: string | null
          ai_prompt_es?: string | null
          content_filter?: Json | null
          content_ids?: string[]
          content_source: string
          course_id: string
          created_at?: string
          description_en?: string
          description_es?: string | null
          estimated_minutes?: number
          group_id: string
          id?: string
          quiz_enabled?: boolean
          quiz_mode?: string
          quiz_mode_changed_at?: string | null
          quiz_passing_score?: number | null
          quiz_question_count?: number | null
          section_type?: string
          slug: string
          sort_order?: number
          status?: string
          title_en: string
          title_es?: string | null
          updated_at?: string
        }
        Update: {
          ai_prompt_en?: string | null
          ai_prompt_es?: string | null
          content_filter?: Json | null
          content_ids?: string[]
          content_source?: string
          course_id?: string
          created_at?: string
          description_en?: string
          description_es?: string | null
          estimated_minutes?: number
          group_id?: string
          id?: string
          quiz_enabled?: boolean
          quiz_mode?: string
          quiz_mode_changed_at?: string | null
          quiz_passing_score?: number | null
          quiz_question_count?: number | null
          section_type?: string
          slug?: string
          sort_order?: number
          status?: string
          title_en?: string
          title_es?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_sections_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_sections_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string
          description_en: string | null
          description_es: string | null
          estimated_minutes: number
          group_id: string
          icon: string | null
          id: string
          passing_score: number
          program_id: string | null
          slug: string
          sort_order: number
          status: string
          title_en: string
          title_es: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          estimated_minutes?: number
          group_id: string
          icon?: string | null
          id?: string
          passing_score?: number
          program_id?: string | null
          slug: string
          sort_order?: number
          status?: string
          title_en: string
          title_es?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          estimated_minutes?: number
          group_id?: string
          icon?: string | null
          id?: string
          passing_score?: number
          program_id?: string | null
          slug?: string
          sort_order?: number
          status?: string
          title_en?: string
          title_es?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          competency_level: string | null
          created_at: string
          enrollment_id: string | null
          eval_type: string
          evaluated_by: string | null
          id: string
          manager_feedback: Json
          manager_notes: string | null
          section_id: string | null
          student_feedback: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          competency_level?: string | null
          created_at?: string
          enrollment_id?: string | null
          eval_type: string
          evaluated_by?: string | null
          id?: string
          manager_feedback: Json
          manager_notes?: string | null
          section_id?: string | null
          student_feedback: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          competency_level?: string | null
          created_at?: string
          enrollment_id?: string | null
          eval_type?: string
          evaluated_by?: string | null
          id?: string
          manager_feedback?: Json
          manager_notes?: string | null
          section_id?: string | null
          student_feedback?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_evaluated_by_fkey"
            columns: ["evaluated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      foh_plate_specs: {
        Row: {
          ai_ingestion_meta: Json
          allergens: string[]
          allergy_notes: string
          created_at: string
          created_by: string
          detailed_description: string
          embedding: string | null
          flavor_profile: string[]
          id: string
          image: string | null
          ingredients: string[]
          is_top_seller: boolean
          key_ingredients: string[]
          menu_name: string
          notes: string
          plate_spec_id: string | null
          plate_type: string
          search_vector: unknown
          short_description: string
          slug: string
          source_session_id: string | null
          status: string
          updated_at: string
          upsell_notes: string
          version: number
        }
        Insert: {
          ai_ingestion_meta?: Json
          allergens?: string[]
          allergy_notes?: string
          created_at?: string
          created_by: string
          detailed_description: string
          embedding?: string | null
          flavor_profile?: string[]
          id?: string
          image?: string | null
          ingredients?: string[]
          is_top_seller?: boolean
          key_ingredients?: string[]
          menu_name: string
          notes?: string
          plate_spec_id?: string | null
          plate_type: string
          search_vector?: unknown
          short_description: string
          slug: string
          source_session_id?: string | null
          status?: string
          updated_at?: string
          upsell_notes?: string
          version?: number
        }
        Update: {
          ai_ingestion_meta?: Json
          allergens?: string[]
          allergy_notes?: string
          created_at?: string
          created_by?: string
          detailed_description?: string
          embedding?: string | null
          flavor_profile?: string[]
          id?: string
          image?: string | null
          ingredients?: string[]
          is_top_seller?: boolean
          key_ingredients?: string[]
          menu_name?: string
          notes?: string
          plate_spec_id?: string | null
          plate_type?: string
          search_vector?: unknown
          short_description?: string
          slug?: string
          source_session_id?: string | null
          status?: string
          updated_at?: string
          upsell_notes?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "foh_plate_specs_plate_spec_id_fkey"
            columns: ["plate_spec_id"]
            isOneToOne: false
            referencedRelation: "plate_specs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foh_plate_specs_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "ingestion_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      group_memberships: {
        Row: {
          created_at: string
          group_id: string
          id: string
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_memberships_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          allow_signups: boolean
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          allow_signups?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          allow_signups?: boolean
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      ingestion_messages: {
        Row: {
          content: string
          created_at: string
          draft_updates: Json | null
          id: string
          role: string
          session_id: string
          tool_calls: Json | null
        }
        Insert: {
          content: string
          created_at?: string
          draft_updates?: Json | null
          id?: string
          role: string
          session_id: string
          tool_calls?: Json | null
        }
        Update: {
          content?: string
          created_at?: string
          draft_updates?: Json | null
          id?: string
          role?: string
          session_id?: string
          tool_calls?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "ingestion_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ingestion_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ingestion_sessions: {
        Row: {
          ai_confidence: number | null
          created_at: string
          created_by: string
          draft_data: Json
          draft_version: number
          editing_product_id: string | null
          id: string
          ingestion_method: string
          missing_fields: string[]
          product_id: string | null
          product_table: string
          source_file_name: string | null
          source_file_type: string | null
          status: string
          updated_at: string
        }
        Insert: {
          ai_confidence?: number | null
          created_at?: string
          created_by: string
          draft_data?: Json
          draft_version?: number
          editing_product_id?: string | null
          id?: string
          ingestion_method?: string
          missing_fields?: string[]
          product_id?: string | null
          product_table: string
          source_file_name?: string | null
          source_file_type?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          ai_confidence?: number | null
          created_at?: string
          created_by?: string
          draft_data?: Json
          draft_version?: number
          editing_product_id?: string | null
          id?: string
          ingestion_method?: string
          missing_fields?: string[]
          product_id?: string | null
          product_table?: string
          source_file_name?: string | null
          source_file_type?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      invites: {
        Row: {
          created_at: string
          email: string | null
          expires_at: string
          group_id: string
          id: string
          invited_by: string | null
          role: Database["public"]["Enums"]["user_role"]
          token: string
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          expires_at?: string
          group_id: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          expires_at?: string
          group_id?: string
          id?: string
          invited_by?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          token?: string
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invites_used_by_fkey"
            columns: ["used_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      manual_sections: {
        Row: {
          category: string
          content_en: string | null
          content_es: string | null
          created_at: string
          embedding_en: string | null
          embedding_es: string | null
          file_path: string
          icon: string | null
          id: string
          is_category: boolean
          level: number
          parent_id: string | null
          search_vector_en: unknown
          search_vector_es: unknown
          slug: string
          sort_order: number
          tags: string[] | null
          title_en: string
          title_es: string | null
          updated_at: string
          word_count_en: number | null
          word_count_es: number | null
        }
        Insert: {
          category: string
          content_en?: string | null
          content_es?: string | null
          created_at?: string
          embedding_en?: string | null
          embedding_es?: string | null
          file_path: string
          icon?: string | null
          id?: string
          is_category?: boolean
          level?: number
          parent_id?: string | null
          search_vector_en?: unknown
          search_vector_es?: unknown
          slug: string
          sort_order?: number
          tags?: string[] | null
          title_en: string
          title_es?: string | null
          updated_at?: string
          word_count_en?: number | null
          word_count_es?: number | null
        }
        Update: {
          category?: string
          content_en?: string | null
          content_es?: string | null
          created_at?: string
          embedding_en?: string | null
          embedding_es?: string | null
          file_path?: string
          icon?: string | null
          id?: string
          is_category?: boolean
          level?: number
          parent_id?: string | null
          search_vector_en?: unknown
          search_vector_es?: unknown
          slug?: string
          sort_order?: number
          tags?: string[] | null
          title_en?: string
          title_es?: string | null
          updated_at?: string
          word_count_en?: number | null
          word_count_es?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "manual_sections_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "manual_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      module_test_answers: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean | null
          question_id: string
          section_id: string
          selected_option: string | null
          time_spent_seconds: number
          transcription: string | null
          transcription_expires_at: string | null
          voice_feedback_en: string | null
          voice_feedback_es: string | null
          voice_score: number | null
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_id: string
          section_id: string
          selected_option?: string | null
          time_spent_seconds?: number
          transcription?: string | null
          transcription_expires_at?: string | null
          voice_feedback_en?: string | null
          voice_feedback_es?: string | null
          voice_score?: number | null
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_id?: string
          section_id?: string
          selected_option?: string | null
          time_spent_seconds?: number
          transcription?: string | null
          transcription_expires_at?: string | null
          voice_feedback_en?: string | null
          voice_feedback_es?: string | null
          voice_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "module_test_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "module_test_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_test_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_test_answers_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      module_test_attempts: {
        Row: {
          attempt_number: number
          completed_at: string | null
          course_id: string
          created_at: string
          enrollment_id: string
          id: string
          passed: boolean | null
          score: number | null
          section_scores: Json | null
          started_at: string
          status: string
          total_questions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_number?: number
          completed_at?: string | null
          course_id: string
          created_at?: string
          enrollment_id: string
          id?: string
          passed?: boolean | null
          score?: number | null
          section_scores?: Json | null
          started_at?: string
          status?: string
          total_questions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_number?: number
          completed_at?: string | null
          course_id?: string
          created_at?: string
          enrollment_id?: string
          id?: string
          passed?: boolean | null
          score?: number | null
          section_scores?: Json | null
          started_at?: string
          status?: string
          total_questions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "module_test_attempts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_test_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "module_test_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      plate_specs: {
        Row: {
          ai_ingestion_meta: Json
          allergens: string[]
          assembly_procedure: Json
          components: Json
          created_at: string
          created_by: string
          embedding: string | null
          id: string
          images: Json
          menu_category: string
          name: string
          notes: string
          plate_type: string
          search_vector: unknown
          slug: string
          source_session_id: string | null
          status: string
          tags: string[]
          updated_at: string
          version: number
        }
        Insert: {
          ai_ingestion_meta?: Json
          allergens?: string[]
          assembly_procedure: Json
          components: Json
          created_at?: string
          created_by: string
          embedding?: string | null
          id?: string
          images?: Json
          menu_category: string
          name: string
          notes?: string
          plate_type: string
          search_vector?: unknown
          slug: string
          source_session_id?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          version?: number
        }
        Update: {
          ai_ingestion_meta?: Json
          allergens?: string[]
          assembly_procedure?: Json
          components?: Json
          created_at?: string
          created_by?: string
          embedding?: string | null
          id?: string
          images?: Json
          menu_category?: string
          name?: string
          notes?: string
          plate_type?: string
          search_vector?: unknown
          slug?: string
          source_session_id?: string | null
          status?: string
          tags?: string[]
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "plate_specs_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "ingestion_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      prep_recipes: {
        Row: {
          ai_ingestion_meta: Json
          batch_scaling: Json
          created_at: string
          created_by: string
          embedding: string | null
          id: string
          images: Json
          ingredients: Json
          name: string
          prep_type: string
          procedure: Json
          search_vector: unknown
          shelf_life_unit: string
          shelf_life_value: number
          slug: string
          source_session_id: string | null
          status: string
          tags: string[]
          training_notes: Json
          updated_at: string
          version: number
          yield_qty: number
          yield_unit: string
        }
        Insert: {
          ai_ingestion_meta?: Json
          batch_scaling?: Json
          created_at?: string
          created_by: string
          embedding?: string | null
          id?: string
          images?: Json
          ingredients: Json
          name: string
          prep_type: string
          procedure: Json
          search_vector?: unknown
          shelf_life_unit: string
          shelf_life_value: number
          slug: string
          source_session_id?: string | null
          status?: string
          tags?: string[]
          training_notes?: Json
          updated_at?: string
          version?: number
          yield_qty: number
          yield_unit: string
        }
        Update: {
          ai_ingestion_meta?: Json
          batch_scaling?: Json
          created_at?: string
          created_by?: string
          embedding?: string | null
          id?: string
          images?: Json
          ingredients?: Json
          name?: string
          prep_type?: string
          procedure?: Json
          search_vector?: unknown
          shelf_life_unit?: string
          shelf_life_value?: number
          slug?: string
          source_session_id?: string | null
          status?: string
          tags?: string[]
          training_notes?: Json
          updated_at?: string
          version?: number
          yield_qty?: number
          yield_unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "prep_recipes_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "ingestion_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      product_translations: {
        Row: {
          approved_by: string | null
          created_at: string
          field_path: string
          id: string
          is_approved: boolean
          product_id: string
          product_table: string
          source_lang: string
          source_text: string
          translated_lang: string
          translated_text: string
          updated_at: string
        }
        Insert: {
          approved_by?: string | null
          created_at?: string
          field_path: string
          id?: string
          is_approved?: boolean
          product_id: string
          product_table: string
          source_lang?: string
          source_text: string
          translated_lang?: string
          translated_text: string
          updated_at?: string
        }
        Update: {
          approved_by?: string | null
          created_at?: string
          field_path?: string
          id?: string
          is_approved?: boolean
          product_id?: string
          product_table?: string
          source_lang?: string
          source_text?: string
          translated_lang?: string
          translated_text?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          default_language: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          default_language?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          default_language?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      program_enrollments: {
        Row: {
          completed_at: string | null
          completed_courses: number
          created_at: string
          group_id: string
          id: string
          overall_score: number | null
          program_id: string
          started_at: string | null
          status: string
          total_courses: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_courses?: number
          created_at?: string
          group_id: string
          id?: string
          overall_score?: number | null
          program_id: string
          started_at?: string | null
          status?: string
          total_courses?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_courses?: number
          created_at?: string
          group_id?: string
          id?: string
          overall_score?: number | null
          program_id?: string
          started_at?: string | null
          status?: string
          total_courses?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "program_enrollments_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_enrollments_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "program_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempt_answers: {
        Row: {
          attempt_id: string
          created_at: string
          id: string
          is_correct: boolean | null
          question_id: string
          selected_option: string | null
          time_spent_seconds: number
          transcription: string | null
          transcription_expires_at: string | null
          voice_feedback_en: string | null
          voice_feedback_es: string | null
          voice_score: number | null
        }
        Insert: {
          attempt_id: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_id: string
          selected_option?: string | null
          time_spent_seconds?: number
          transcription?: string | null
          transcription_expires_at?: string | null
          voice_feedback_en?: string | null
          voice_feedback_es?: string | null
          voice_score?: number | null
        }
        Update: {
          attempt_id?: string
          created_at?: string
          id?: string
          is_correct?: boolean | null
          question_id?: string
          selected_option?: string | null
          time_spent_seconds?: number
          transcription?: string | null
          transcription_expires_at?: string | null
          voice_feedback_en?: string | null
          voice_feedback_es?: string | null
          voice_score?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempt_answers_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "quiz_attempts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempt_answers_question_id_fkey"
            columns: ["question_id"]
            isOneToOne: false
            referencedRelation: "quiz_questions"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_attempts: {
        Row: {
          additional_questions_asked: number | null
          attempt_number: number
          competency_score: number | null
          completed_at: string | null
          created_at: string
          enrollment_id: string
          id: string
          passed: boolean | null
          questions_covered: string[] | null
          quiz_mode: string
          score: number | null
          section_id: string
          started_at: string
          status: string
          teaching_moments: number | null
          transcript_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_questions_asked?: number | null
          attempt_number: number
          competency_score?: number | null
          completed_at?: string | null
          created_at?: string
          enrollment_id: string
          id?: string
          passed?: boolean | null
          questions_covered?: string[] | null
          quiz_mode?: string
          score?: number | null
          section_id: string
          started_at?: string
          status?: string
          teaching_moments?: number | null
          transcript_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_questions_asked?: number | null
          attempt_number?: number
          competency_score?: number | null
          completed_at?: string | null
          created_at?: string
          enrollment_id?: string
          id?: string
          passed?: boolean | null
          questions_covered?: string[] | null
          quiz_mode?: string
          score?: number | null
          section_id?: string
          started_at?: string
          status?: string
          teaching_moments?: number | null
          transcript_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          course_id: string | null
          created_at: string
          difficulty: string | null
          explanation_en: string | null
          explanation_es: string | null
          id: string
          is_active: boolean
          options: Json | null
          question_en: string
          question_es: string | null
          question_type: string
          rubric: Json | null
          section_id: string
          source: string
          times_correct: number
          times_shown: number
          updated_at: string
        }
        Insert: {
          course_id?: string | null
          created_at?: string
          difficulty?: string | null
          explanation_en?: string | null
          explanation_es?: string | null
          id?: string
          is_active?: boolean
          options?: Json | null
          question_en: string
          question_es?: string | null
          question_type: string
          rubric?: Json | null
          section_id: string
          source?: string
          times_correct?: number
          times_shown?: number
          updated_at?: string
        }
        Update: {
          course_id?: string | null
          created_at?: string
          difficulty?: string | null
          explanation_en?: string | null
          explanation_es?: string | null
          id?: string
          is_active?: boolean
          options?: Json | null
          question_en?: string
          question_es?: string | null
          question_type?: string
          rubric?: Json | null
          section_id?: string
          source?: string
          times_correct?: number
          times_shown?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_questions_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      role_policies: {
        Row: {
          can_use_ai: boolean
          can_use_search: boolean
          can_view_manual: boolean
          created_at: string
          daily_ai_limit: number
          group_id: string
          id: string
          monthly_ai_limit: number
          role: Database["public"]["Enums"]["user_role"]
          updated_at: string
          voice_enabled: boolean
        }
        Insert: {
          can_use_ai?: boolean
          can_use_search?: boolean
          can_view_manual?: boolean
          created_at?: string
          daily_ai_limit?: number
          group_id: string
          id?: string
          monthly_ai_limit?: number
          role: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          voice_enabled?: boolean
        }
        Update: {
          can_use_ai?: boolean
          can_use_search?: boolean
          can_view_manual?: boolean
          created_at?: string
          daily_ai_limit?: number
          group_id?: string
          id?: string
          monthly_ai_limit?: number
          role?: Database["public"]["Enums"]["user_role"]
          updated_at?: string
          voice_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "role_policies_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      rollout_assignments: {
        Row: {
          completed_at: string | null
          completed_courses: number
          created_at: string
          id: string
          rollout_id: string
          started_at: string | null
          status: string
          total_courses: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          completed_courses?: number
          created_at?: string
          id?: string
          rollout_id: string
          started_at?: string | null
          status?: string
          total_courses?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          completed_courses?: number
          created_at?: string
          id?: string
          rollout_id?: string
          started_at?: string | null
          status?: string
          total_courses?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rollout_assignments_rollout_id_fkey"
            columns: ["rollout_id"]
            isOneToOne: false
            referencedRelation: "rollouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rollout_assignments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rollouts: {
        Row: {
          course_ids: string[]
          created_at: string
          created_by: string
          deadline: string | null
          description: string | null
          expires_at: string | null
          group_id: string
          id: string
          name: string
          section_ids: string[]
          starts_at: string
          status: string
          updated_at: string
        }
        Insert: {
          course_ids?: string[]
          created_at?: string
          created_by: string
          deadline?: string | null
          description?: string | null
          expires_at?: string | null
          group_id: string
          id?: string
          name: string
          section_ids?: string[]
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          course_ids?: string[]
          created_at?: string
          created_by?: string
          deadline?: string | null
          description?: string | null
          expires_at?: string | null
          group_id?: string
          id?: string
          name?: string
          section_ids?: string[]
          starts_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rollouts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rollouts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      routing_prompts: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          mode: string
          prompt_en: string
          prompt_es: string | null
          slug: string
          updated_at: string | null
          voice: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          mode?: string
          prompt_en: string
          prompt_es?: string | null
          slug: string
          updated_at?: string | null
          voice?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          mode?: string
          prompt_en?: string
          prompt_es?: string | null
          slug?: string
          updated_at?: string | null
          voice?: string | null
        }
        Relationships: []
      }
      section_progress: {
        Row: {
          completed_at: string | null
          content_hash_at_completion: string | null
          course_id: string
          created_at: string
          enrollment_id: string
          id: string
          quiz_attempts: number
          quiz_passed: boolean | null
          quiz_score: number | null
          section_id: string
          started_at: string | null
          status: string
          time_spent_seconds: number
          topics_covered: number
          topics_total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          content_hash_at_completion?: string | null
          course_id: string
          created_at?: string
          enrollment_id: string
          id?: string
          quiz_attempts?: number
          quiz_passed?: boolean | null
          quiz_score?: number | null
          section_id: string
          started_at?: string | null
          status?: string
          time_spent_seconds?: number
          topics_covered?: number
          topics_total?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          content_hash_at_completion?: string | null
          course_id?: string
          created_at?: string
          enrollment_id?: string
          id?: string
          quiz_attempts?: number
          quiz_passed?: boolean | null
          quiz_score?: number | null
          section_id?: string
          started_at?: string | null
          status?: string
          time_spent_seconds?: number
          topics_covered?: number
          topics_total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "section_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_progress_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_progress_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "section_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      steps_of_service_sections: {
        Row: {
          chapter: string | null
          content_en: string
          content_es: string | null
          created_at: string
          created_by: string
          embedding_en: string | null
          embedding_es: string | null
          group_id: string
          id: string
          parent_key: string | null
          position: string
          search_vector_en: unknown
          search_vector_es: unknown
          section_key: string
          sort_order: number
          status: string
          title_en: string
          title_es: string | null
          updated_at: string
          version: number
        }
        Insert: {
          chapter?: string | null
          content_en: string
          content_es?: string | null
          created_at?: string
          created_by: string
          embedding_en?: string | null
          embedding_es?: string | null
          group_id: string
          id?: string
          parent_key?: string | null
          position: string
          search_vector_en?: unknown
          search_vector_es?: unknown
          section_key: string
          sort_order?: number
          status?: string
          title_en: string
          title_es?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          chapter?: string | null
          content_en?: string
          content_es?: string | null
          created_at?: string
          created_by?: string
          embedding_en?: string | null
          embedding_es?: string | null
          group_id?: string
          id?: string
          parent_key?: string | null
          position?: string
          search_vector_en?: unknown
          search_vector_es?: unknown
          section_key?: string
          sort_order?: number
          status?: string
          title_en?: string
          title_es?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "steps_of_service_sections_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      sub_recipe_links: {
        Row: {
          child_id: string
          child_table: string
          context: string
          created_at: string
          id: string
          parent_id: string
          parent_table: string
        }
        Insert: {
          child_id: string
          child_table: string
          context?: string
          created_at?: string
          id?: string
          parent_id: string
          parent_table: string
        }
        Update: {
          child_id?: string
          child_table?: string
          context?: string
          created_at?: string
          id?: string
          parent_id?: string
          parent_table?: string
        }
        Relationships: []
      }
      training_programs: {
        Row: {
          category: string
          cover_image: string | null
          created_at: string
          description_en: string | null
          description_es: string | null
          estimated_minutes: number
          group_id: string
          icon: string | null
          id: string
          passing_score: number
          slug: string
          sort_order: number
          status: string
          title_en: string
          title_es: string | null
          updated_at: string
        }
        Insert: {
          category?: string
          cover_image?: string | null
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          estimated_minutes?: number
          group_id: string
          icon?: string | null
          id?: string
          passing_score?: number
          slug: string
          sort_order?: number
          status?: string
          title_en: string
          title_es?: string | null
          updated_at?: string
        }
        Update: {
          category?: string
          cover_image?: string | null
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          estimated_minutes?: number
          group_id?: string
          icon?: string | null
          id?: string
          passing_score?: number
          slug?: string
          sort_order?: number
          status?: string
          title_en?: string
          title_es?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_programs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      tutor_sessions: {
        Row: {
          correct_answers: number
          course_id: string
          created_at: string
          enrollment_id: string | null
          expires_at: string
          id: string
          messages: Json
          questions_asked: number
          readiness_score: number | null
          readiness_suggested: boolean
          topics_covered: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          correct_answers?: number
          course_id: string
          created_at?: string
          enrollment_id?: string | null
          expires_at?: string
          id?: string
          messages?: Json
          questions_asked?: number
          readiness_score?: number | null
          readiness_suggested?: boolean
          topics_covered?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          correct_answers?: number
          course_id?: string
          created_at?: string
          enrollment_id?: string | null
          expires_at?: string
          id?: string
          messages?: Json
          questions_asked?: number
          readiness_score?: number | null
          readiness_suggested?: boolean
          topics_covered?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tutor_sessions_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_sessions_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tutor_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_counters: {
        Row: {
          count: number
          created_at: string
          group_id: string
          id: string
          period_start: string
          period_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          count?: number
          created_at?: string
          group_id: string
          id?: string
          period_start: string
          period_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          count?: number
          created_at?: string
          group_id?: string
          id?: string
          period_start?: string
          period_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_counters_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "usage_counters_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wines: {
        Row: {
          ai_ingestion_meta: Json
          blend: boolean
          body: string
          country: string
          created_at: string
          created_by: string
          embedding: string | null
          id: string
          image: string | null
          is_top_seller: boolean
          name: string
          notes: string
          producer: string
          producer_notes: string
          region: string
          search_vector: unknown
          slug: string
          source_session_id: string | null
          status: string
          style: string
          tasting_notes: string
          updated_at: string
          varietal: string
          version: number
          vintage: string | null
        }
        Insert: {
          ai_ingestion_meta?: Json
          blend?: boolean
          body: string
          country: string
          created_at?: string
          created_by: string
          embedding?: string | null
          id?: string
          image?: string | null
          is_top_seller?: boolean
          name: string
          notes?: string
          producer: string
          producer_notes?: string
          region: string
          search_vector?: unknown
          slug: string
          source_session_id?: string | null
          status?: string
          style: string
          tasting_notes: string
          updated_at?: string
          varietal: string
          version?: number
          vintage?: string | null
        }
        Update: {
          ai_ingestion_meta?: Json
          blend?: boolean
          body?: string
          country?: string
          created_at?: string
          created_by?: string
          embedding?: string | null
          id?: string
          image?: string | null
          is_top_seller?: boolean
          name?: string
          notes?: string
          producer?: string
          producer_notes?: string
          region?: string
          search_vector?: unknown
          slug?: string
          source_session_id?: string | null
          status?: string
          style?: string
          tasting_notes?: string
          updated_at?: string
          varietal?: string
          version?: number
          vintage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wines_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "ingestion_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { invite_token: string }; Returns: Json }
      cleanup_expired_training_data: { Args: never; Returns: undefined }
      close_stale_sessions: {
        Args: { _expiry_hours?: number }
        Returns: number
      }
      detect_content_changes: {
        Args: { p_group_id: string }
        Returns: {
          new_hash: string
          old_hash: string
          section_id: string
          section_title: string
          source_id: string
          source_table: string
        }[]
      }
      expire_rollouts: { Args: never; Returns: undefined }
      get_chat_history: {
        Args: {
          _max_messages?: number
          _max_tokens?: number
          _session_id: string
        }
        Returns: {
          citations: Json
          content: string
          created_at: string
          role: string
        }[]
      }
      get_manual_section: {
        Args: { language?: string; section_slug: string }
        Returns: {
          category: string
          content: string
          file_path: string
          has_translation: boolean
          icon: string
          id: string
          parent_id: string
          slug: string
          tags: string[]
          title: string
          updated_at: string
        }[]
      }
      get_manual_tree: {
        Args: { language?: string }
        Returns: {
          has_content: boolean
          icon: string
          id: string
          is_category: boolean
          level: number
          parent_id: string
          slug: string
          sort_order: number
          title: string
        }[]
      }
      get_or_create_chat_session: {
        Args: {
          _context_id?: string
          _context_type: string
          _expiry_hours?: number
          _group_id: string
          _mode?: string
          _user_id: string
        }
        Returns: string
      }
      get_team_progress: {
        Args: { p_group_id: string }
        Returns: {
          avatar_url: string
          average_quiz_score: number
          courses_completed: number
          courses_total: number
          email: string
          failed_sections: string[]
          full_name: string
          last_active_at: string
          overall_progress_percent: number
          role: string
          user_id: string
        }[]
      }
      get_user_group_id: { Args: never; Returns: string }
      get_user_groups: { Args: { _user_id: string }; Returns: string[] }
      get_user_permissions: { Args: never; Returns: Json }
      get_user_role: { Args: never; Returns: string }
      get_user_usage: {
        Args: { _group_id: string; _user_id: string }
        Returns: {
          can_ask: boolean
          daily_count: number
          daily_limit: number
          monthly_count: number
          monthly_limit: number
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_role_in_group: {
        Args: {
          _group_id: string
          _role: Database["public"]["Enums"]["user_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_usage: {
        Args: { _group_id: string; _user_id: string }
        Returns: {
          daily_count: number
          daily_limit: number
          monthly_count: number
          monthly_limit: number
        }[]
      }
      is_group_member: {
        Args: { _group_id: string; _user_id: string }
        Returns: boolean
      }
      join_group_by_slug: { Args: { group_slug: string }; Returns: Json }
      search_beer_liquor: {
        Args: {
          keyword_weight?: number
          query_embedding: string
          result_limit?: number
          search_query: string
          vector_weight?: number
        }
        Returns: {
          category: string
          combined_score: number
          id: string
          name: string
          slug: string
          snippet: string
          subcategory: string
        }[]
      }
      search_cocktails: {
        Args: {
          keyword_weight?: number
          query_embedding: string
          result_limit?: number
          search_query: string
          vector_weight?: number
        }
        Returns: {
          combined_score: number
          id: string
          name: string
          slug: string
          snippet: string
          style: string
        }[]
      }
      search_dishes: {
        Args: {
          keyword_weight?: number
          query_embedding: string
          result_limit?: number
          search_query: string
          vector_weight?: number
        }
        Returns: {
          combined_score: number
          id: string
          is_top_seller: boolean
          name: string
          plate_type: string
          slug: string
          snippet: string
        }[]
      }
      search_manual_v2: {
        Args: {
          keyword_weight?: number
          query_embedding?: string
          result_limit?: number
          search_language?: string
          search_query: string
          vector_weight?: number
        }
        Returns: {
          category: string
          combined_score: number
          file_path: string
          id: string
          name: string
          slug: string
          snippet: string
          tags: string[]
        }[]
      }
      search_recipes: {
        Args: {
          keyword_weight?: number
          query_embedding: string
          result_limit?: number
          search_query: string
          vector_weight?: number
        }
        Returns: {
          combined_score: number
          id: string
          name: string
          slug: string
          snippet: string
          source_table: string
        }[]
      }
      search_steps_of_service: {
        Args: {
          keyword_weight?: number
          p_group_id: string
          p_position?: string
          query_embedding: string
          result_limit?: number
          search_language?: string
          search_query: string
          vector_weight?: number
        }
        Returns: {
          combined_score: number
          id: string
          parent_key: string
          position: string
          section_key: string
          snippet: string
          title: string
        }[]
      }
      search_wines: {
        Args: {
          keyword_weight?: number
          query_embedding: string
          result_limit?: number
          search_query: string
          vector_weight?: number
        }
        Returns: {
          combined_score: number
          id: string
          name: string
          slug: string
          snippet: string
          style: string
          varietal: string
        }[]
      }
    }
    Enums: {
      user_role: "staff" | "manager" | "admin"
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
    Enums: {
      user_role: ["staff", "manager", "admin"],
    },
  },
} as const
