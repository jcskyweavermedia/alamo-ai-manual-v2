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
  public: {
    Tables: {
      ai_prompt_snapshots: {
        Row: {
          prompt_en: string | null
          prompt_es: string | null
          slug: string | null
          snapshot_at: string | null
          snapshot_label: string | null
          updated_at: string | null
        }
        Insert: {
          prompt_en?: string | null
          prompt_es?: string | null
          slug?: string | null
          snapshot_at?: string | null
          snapshot_label?: string | null
          updated_at?: string | null
        }
        Update: {
          prompt_en?: string | null
          prompt_es?: string | null
          slug?: string | null
          snapshot_at?: string | null
          snapshot_label?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
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
      ai_teacher_persona_snapshots: {
        Row: {
          id: string | null
          persona_en: string | null
          persona_es: string | null
          slug: string | null
          snapshot_at: string | null
          snapshot_label: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string | null
          persona_en?: string | null
          persona_es?: string | null
          slug?: string | null
          snapshot_at?: string | null
          snapshot_label?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string | null
          persona_en?: string | null
          persona_es?: string | null
          slug?: string | null
          snapshot_at?: string | null
          snapshot_label?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      ai_teachers: {
        Row: {
          avatar_emoji: string
          category: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          level: number
          name: string
          persona_en: string | null
          persona_es: string | null
          prompt_en: string
          prompt_es: string | null
          slug: string
          updated_at: string
        }
        Insert: {
          avatar_emoji?: string
          category: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          level?: number
          name: string
          persona_en?: string | null
          persona_es?: string | null
          prompt_en: string
          prompt_es?: string | null
          slug: string
          updated_at?: string
        }
        Update: {
          avatar_emoji?: string
          category?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          level?: number
          name?: string
          persona_en?: string | null
          persona_es?: string | null
          prompt_en?: string
          prompt_es?: string | null
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      ai_usage_log: {
        Row: {
          action: string | null
          created_at: string
          credits_consumed: number
          domain: string
          edge_function: string | null
          group_id: string
          id: string
          input_mode: string | null
          metadata: Json | null
          model: string | null
          restaurant_id: string | null
          session_id: string | null
          tokens_input: number | null
          tokens_output: number | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          created_at?: string
          credits_consumed?: number
          domain: string
          edge_function?: string | null
          group_id: string
          id?: string
          input_mode?: string | null
          metadata?: Json | null
          model?: string | null
          restaurant_id?: string | null
          session_id?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          created_at?: string
          credits_consumed?: number
          domain?: string
          edge_function?: string | null
          group_id?: string
          id?: string
          input_mode?: string | null
          metadata?: Json | null
          model?: string | null
          restaurant_id?: string | null
          session_id?: string | null
          tokens_input?: number | null
          tokens_output?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_log_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_usage_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
          group_id: string
          id: string
          image: string | null
          is_featured: boolean
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
          group_id: string
          id?: string
          image?: string | null
          is_featured?: boolean
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
          group_id?: string
          id?: string
          image?: string | null
          is_featured?: boolean
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
            foreignKeyName: "beer_liquor_list_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beer_liquor_list_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "ingestion_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      brands: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: []
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
          group_id: string
          id: string
          image: string | null
          ingredients: Json
          is_featured: boolean
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
          group_id: string
          id?: string
          image?: string | null
          ingredients?: Json
          is_featured?: boolean
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
          group_id?: string
          id?: string
          image?: string | null
          ingredients?: Json
          is_featured?: boolean
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
            foreignKeyName: "cocktails_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cocktails_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "ingestion_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          address: string | null
          category: string
          contact_person: string | null
          created_at: string
          email: string | null
          group_id: string
          id: string
          is_demo_data: boolean
          is_priority: boolean
          name: string
          notes: string | null
          phone: string | null
          phone_alt: string | null
          search_vector: unknown
          sort_order: number | null
          status: string
          subcategory: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          category: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          group_id: string
          id?: string
          is_demo_data?: boolean
          is_priority?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          phone_alt?: string | null
          search_vector?: unknown
          sort_order?: number | null
          status?: string
          subcategory?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          category?: string
          contact_person?: string | null
          created_at?: string
          email?: string | null
          group_id?: string
          id?: string
          is_demo_data?: boolean
          is_priority?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          phone_alt?: string | null
          search_vector?: unknown
          sort_order?: number | null
          status?: string
          subcategory?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
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
          course_id: string | null
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
          topics_discussed: string[]
          updated_at: string
          user_id: string
        }
        Insert: {
          course_id?: string | null
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
          topics_discussed?: string[]
          updated_at?: string
          user_id: string
        }
        Update: {
          course_id?: string | null
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
          topics_discussed?: string[]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_conversations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
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
          assessed_section_ids: string[] | null
          completed_at: string | null
          completed_sections: number
          course_id: string
          course_version: number
          created_at: string
          expires_at: string | null
          final_passed: boolean | null
          final_score: number | null
          group_id: string
          id: string
          started_at: string | null
          status: string
          total_sections: number
          updated_at: string
          user_id: string
        }
        Insert: {
          assessed_section_ids?: string[] | null
          completed_at?: string | null
          completed_sections?: number
          course_id: string
          course_version?: number
          created_at?: string
          expires_at?: string | null
          final_passed?: boolean | null
          final_score?: number | null
          group_id: string
          id?: string
          started_at?: string | null
          status?: string
          total_sections?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          assessed_section_ids?: string[] | null
          completed_at?: string | null
          completed_sections?: number
          course_id?: string
          course_version?: number
          created_at?: string
          expires_at?: string | null
          final_passed?: boolean | null
          final_score?: number | null
          group_id?: string
          id?: string
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
          ai_instructions: string | null
          course_id: string
          created_at: string
          description_en: string | null
          description_es: string | null
          draft_content: Json | null
          elements: Json
          estimated_minutes: number
          generation_status: string
          group_id: string
          id: string
          section_type: string
          slug: string
          sort_order: number
          source_refs: Json
          status: string
          title_en: string
          title_es: string | null
          updated_at: string
        }
        Insert: {
          ai_instructions?: string | null
          course_id: string
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          draft_content?: Json | null
          elements?: Json
          estimated_minutes?: number
          generation_status?: string
          group_id: string
          id?: string
          section_type?: string
          slug: string
          sort_order?: number
          source_refs?: Json
          status?: string
          title_en: string
          title_es?: string | null
          updated_at?: string
        }
        Update: {
          ai_instructions?: string | null
          course_id?: string
          created_at?: string
          description_en?: string | null
          description_es?: string | null
          draft_content?: Json | null
          elements?: Json
          estimated_minutes?: number
          generation_status?: string
          group_id?: string
          id?: string
          section_type?: string
          slug?: string
          sort_order?: number
          source_refs?: Json
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
          assessment_config: Json
          course_type: string
          cover_image: string | null
          created_at: string
          created_by: string | null
          description_en: string | null
          description_es: string | null
          estimated_minutes: number
          group_id: string
          icon: string | null
          id: string
          page_header_data: Json | null
          program_id: string | null
          published_at: string | null
          quiz_config: Json
          slug: string
          sort_order: number
          status: string
          teacher_id: string | null
          teacher_level: string
          title_en: string
          title_es: string | null
          updated_at: string
          version: number
          wizard_config: Json | null
        }
        Insert: {
          assessment_config?: Json
          course_type?: string
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_es?: string | null
          estimated_minutes?: number
          group_id: string
          icon?: string | null
          id?: string
          page_header_data?: Json | null
          program_id?: string | null
          published_at?: string | null
          quiz_config?: Json
          slug: string
          sort_order?: number
          status?: string
          teacher_id?: string | null
          teacher_level?: string
          title_en: string
          title_es?: string | null
          updated_at?: string
          version?: number
          wizard_config?: Json | null
        }
        Update: {
          assessment_config?: Json
          course_type?: string
          cover_image?: string | null
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_es?: string | null
          estimated_minutes?: number
          group_id?: string
          icon?: string | null
          id?: string
          page_header_data?: Json | null
          program_id?: string | null
          published_at?: string | null
          quiz_config?: Json
          slug?: string
          sort_order?: number
          status?: string
          teacher_id?: string | null
          teacher_level?: string
          title_en?: string
          title_es?: string | null
          updated_at?: string
          version?: number
          wizard_config?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
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
          {
            foreignKeyName: "courses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "ai_teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      credit_costs: {
        Row: {
          action_type: string
          created_at: string
          credits: number
          description: string | null
          domain: string
          group_id: string | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          action_type?: string
          created_at?: string
          credits?: number
          description?: string | null
          domain: string
          group_id?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          credits?: number
          description?: string | null
          domain?: string
          group_id?: string | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "credit_costs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          brand_id: string
          created_at: string
          created_by: string | null
          department: string | null
          display_name: string | null
          email: string | null
          employment_status: string
          employment_type: string
          first_name: string
          group_id: string
          hire_date: string | null
          id: string
          last_name: string
          notes: string | null
          pay_type: string
          phone: string | null
          phone_consent: boolean
          phone_consent_at: string | null
          position: string
          profile_id: string | null
          termination_date: string | null
          updated_at: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          display_name?: string | null
          email?: string | null
          employment_status?: string
          employment_type?: string
          first_name: string
          group_id: string
          hire_date?: string | null
          id?: string
          last_name: string
          notes?: string | null
          pay_type?: string
          phone?: string | null
          phone_consent?: boolean
          phone_consent_at?: string | null
          position: string
          profile_id?: string | null
          termination_date?: string | null
          updated_at?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          created_by?: string | null
          department?: string | null
          display_name?: string | null
          email?: string | null
          employment_status?: string
          employment_type?: string
          first_name?: string
          group_id?: string
          hire_date?: string | null
          id?: string
          last_name?: string
          notes?: string | null
          pay_type?: string
          phone?: string | null
          phone_consent?: boolean
          phone_consent_at?: string | null
          position?: string
          profile_id?: string | null
          termination_date?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      evaluations: {
        Row: {
          ai_model: string | null
          competency_level: string
          course_id: string | null
          created_at: string
          enrollment_id: string | null
          eval_source: string
          eval_type: string
          evaluated_by: string | null
          group_id: string
          id: string
          manager_feedback: Json
          manager_notes: string | null
          passed: boolean
          score: number
          section_id: string | null
          signals: Json
          student_feedback: Json
          superseded_by: string | null
          unit_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_model?: string | null
          competency_level: string
          course_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          eval_source: string
          eval_type: string
          evaluated_by?: string | null
          group_id: string
          id?: string
          manager_feedback: Json
          manager_notes?: string | null
          passed: boolean
          score: number
          section_id?: string | null
          signals?: Json
          student_feedback: Json
          superseded_by?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_model?: string | null
          competency_level?: string
          course_id?: string | null
          created_at?: string
          enrollment_id?: string | null
          eval_source?: string
          eval_type?: string
          evaluated_by?: string | null
          group_id?: string
          id?: string
          manager_feedback?: Json
          manager_notes?: string | null
          passed?: boolean
          score?: number
          section_id?: string | null
          signals?: Json
          student_feedback?: Json
          superseded_by?: string | null
          unit_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "evaluations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "course_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evaluations_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
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
          {
            foreignKeyName: "fk_evaluations_unit"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      flavor_index_daily: {
        Row: {
          ambience_sentiment: number | null
          avg_rating: number | null
          created_at: string
          date: string
          five_star: number
          flavor_index: number | null
          food_sentiment: number | null
          four_star: number
          group_id: string
          id: string
          one_star: number
          restaurant_id: string
          service_sentiment: number | null
          three_star: number
          total_reviews: number
          two_star: number
          updated_at: string
          value_sentiment: number | null
        }
        Insert: {
          ambience_sentiment?: number | null
          avg_rating?: number | null
          created_at?: string
          date: string
          five_star?: number
          flavor_index?: number | null
          food_sentiment?: number | null
          four_star?: number
          group_id: string
          id?: string
          one_star?: number
          restaurant_id: string
          service_sentiment?: number | null
          three_star?: number
          total_reviews?: number
          two_star?: number
          updated_at?: string
          value_sentiment?: number | null
        }
        Update: {
          ambience_sentiment?: number | null
          avg_rating?: number | null
          created_at?: string
          date?: string
          five_star?: number
          flavor_index?: number | null
          food_sentiment?: number | null
          four_star?: number
          group_id?: string
          id?: string
          one_star?: number
          restaurant_id?: string
          service_sentiment?: number | null
          three_star?: number
          total_reviews?: number
          two_star?: number
          updated_at?: string
          value_sentiment?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "flavor_index_daily_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flavor_index_daily_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "tracked_restaurants"
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
          group_id: string
          id: string
          image: string | null
          ingredients: string[]
          is_featured: boolean
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
          group_id: string
          id?: string
          image?: string | null
          ingredients?: string[]
          is_featured?: boolean
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
          group_id?: string
          id?: string
          image?: string | null
          ingredients?: string[]
          is_featured?: boolean
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
            foreignKeyName: "foh_plate_specs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
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
      form_ai_tools: {
        Row: {
          created_at: string
          description_en: string
          description_es: string
          icon: string | null
          id: string
          label_en: string
          label_es: string
          search_function: string | null
          sort_order: number | null
          status: string
        }
        Insert: {
          created_at?: string
          description_en: string
          description_es: string
          icon?: string | null
          id: string
          label_en: string
          label_es: string
          search_function?: string | null
          sort_order?: number | null
          status?: string
        }
        Update: {
          created_at?: string
          description_en?: string
          description_es?: string
          icon?: string | null
          id?: string
          label_en?: string
          label_es?: string
          search_function?: string | null
          sort_order?: number | null
          status?: string
        }
        Relationships: []
      }
      form_submissions: {
        Row: {
          ai_session_id: string | null
          archive_manager_name: string | null
          archive_reason: string | null
          archive_signature: Json | null
          archived_at: string | null
          archived_by: string | null
          attachments: Json | null
          created_at: string
          field_values: Json
          fields_snapshot: Json | null
          filled_by: string
          group_id: string
          id: string
          notes: string | null
          status: string
          subject_user_id: string | null
          submitted_at: string | null
          submitted_by: string | null
          template_id: string
          template_version: number
          updated_at: string
        }
        Insert: {
          ai_session_id?: string | null
          archive_manager_name?: string | null
          archive_reason?: string | null
          archive_signature?: Json | null
          archived_at?: string | null
          archived_by?: string | null
          attachments?: Json | null
          created_at?: string
          field_values?: Json
          fields_snapshot?: Json | null
          filled_by: string
          group_id: string
          id?: string
          notes?: string | null
          status?: string
          subject_user_id?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          template_id: string
          template_version?: number
          updated_at?: string
        }
        Update: {
          ai_session_id?: string | null
          archive_manager_name?: string | null
          archive_reason?: string | null
          archive_signature?: Json | null
          archived_at?: string | null
          archived_by?: string | null
          attachments?: Json | null
          created_at?: string
          field_values?: Json
          fields_snapshot?: Json | null
          filled_by?: string
          group_id?: string
          id?: string
          notes?: string | null
          status?: string
          subject_user_id?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          template_id?: string
          template_version?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_submissions_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_filled_by_fkey"
            columns: ["filled_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_subject_user_id_fkey"
            columns: ["subject_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_submissions_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "form_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      form_templates: {
        Row: {
          ai_refinement_log: Json | null
          ai_system_prompt_en: string | null
          ai_system_prompt_es: string | null
          ai_tools: string[] | null
          builder_state: Json | null
          created_at: string
          created_by: string | null
          description_en: string | null
          description_es: string | null
          fields: Json
          group_id: string
          header_image: string | null
          icon: string | null
          icon_color: string
          id: string
          instructions_en: string | null
          instructions_es: string | null
          instructions_refined: boolean
          published_at: string | null
          search_vector: unknown
          slug: string
          sort_order: number | null
          status: string
          template_version: number
          title_en: string
          title_es: string | null
          updated_at: string
        }
        Insert: {
          ai_refinement_log?: Json | null
          ai_system_prompt_en?: string | null
          ai_system_prompt_es?: string | null
          ai_tools?: string[] | null
          builder_state?: Json | null
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_es?: string | null
          fields?: Json
          group_id: string
          header_image?: string | null
          icon?: string | null
          icon_color?: string
          id?: string
          instructions_en?: string | null
          instructions_es?: string | null
          instructions_refined?: boolean
          published_at?: string | null
          search_vector?: unknown
          slug: string
          sort_order?: number | null
          status?: string
          template_version?: number
          title_en: string
          title_es?: string | null
          updated_at?: string
        }
        Update: {
          ai_refinement_log?: Json | null
          ai_system_prompt_en?: string | null
          ai_system_prompt_es?: string | null
          ai_tools?: string[] | null
          builder_state?: Json | null
          created_at?: string
          created_by?: string | null
          description_en?: string | null
          description_es?: string | null
          fields?: Json
          group_id?: string
          header_image?: string | null
          icon?: string | null
          icon_color?: string
          id?: string
          instructions_en?: string | null
          instructions_es?: string | null
          instructions_refined?: boolean
          published_at?: string | null
          search_vector?: unknown
          slug?: string
          sort_order?: number | null
          status?: string
          template_version?: number
          title_en?: string
          title_es?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "form_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "form_templates_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
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
          address: string | null
          allow_signups: boolean
          brand_id: string
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          phone: string | null
          slug: string
          timezone: string
          unit_type: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          allow_signups?: boolean
          brand_id: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          phone?: string | null
          slug: string
          timezone?: string
          unit_type?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          allow_signups?: boolean
          brand_id?: string
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          phone?: string | null
          slug?: string
          timezone?: string
          unit_type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "groups_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
        ]
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
          group_id: string
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
          group_id: string
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
          group_id?: string
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
            foreignKeyName: "manual_sections_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manual_sections_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "manual_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          group_id: string
          id: string
          metadata: Json
          read: boolean
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          group_id: string
          id?: string
          metadata?: Json
          read?: boolean
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          group_id?: string
          id?: string
          metadata?: Json
          read?: boolean
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
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
          group_id: string
          id: string
          images: Json
          is_featured: boolean
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
          group_id: string
          id?: string
          images?: Json
          is_featured?: boolean
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
          group_id?: string
          id?: string
          images?: Json
          is_featured?: boolean
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
            foreignKeyName: "plate_specs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plate_specs_source_session_id_fkey"
            columns: ["source_session_id"]
            isOneToOne: false
            referencedRelation: "ingestion_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      position_training_requirements: {
        Row: {
          created_at: string
          due_within_days: number | null
          group_id: string
          id: string
          position: string
          program_id: string
          required: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          due_within_days?: number | null
          group_id: string
          id?: string
          position: string
          program_id: string
          required?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          due_within_days?: number | null
          group_id?: string
          id?: string
          position?: string
          program_id?: string
          required?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "position_training_requirements_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "position_training_requirements_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
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
          department: string
          embedding: string | null
          group_id: string
          id: string
          images: Json
          ingredients: Json
          is_featured: boolean
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
          department?: string
          embedding?: string | null
          group_id: string
          id?: string
          images?: Json
          ingredients: Json
          is_featured?: boolean
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
          department?: string
          embedding?: string | null
          group_id?: string
          id?: string
          images?: Json
          ingredients?: Json
          is_featured?: boolean
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
            foreignKeyName: "prep_recipes_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
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
          bookmarks: Json
          created_at: string
          default_language: string
          email: string
          full_name: string | null
          id: string
          is_active: boolean
          ui_preferences: Json
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          bookmarks?: Json
          created_at?: string
          default_language?: string
          email: string
          full_name?: string | null
          id: string
          is_active?: boolean
          ui_preferences?: Json
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          bookmarks?: Json
          created_at?: string
          default_language?: string
          email?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          ui_preferences?: Json
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
          additional_questions_asked: number
          attempt_number: number
          competency_score: number
          completed_at: string | null
          course_id: string
          created_at: string
          enrollment_id: string
          id: string
          passed: boolean | null
          questions_covered: string[]
          quiz_mode: string
          score: number | null
          section_id: string | null
          started_at: string
          status: string
          teaching_moments: number
          transcript_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          additional_questions_asked?: number
          attempt_number: number
          competency_score?: number
          completed_at?: string | null
          course_id: string
          created_at?: string
          enrollment_id: string
          id?: string
          passed?: boolean | null
          questions_covered?: string[]
          quiz_mode?: string
          score?: number | null
          section_id?: string | null
          started_at?: string
          status?: string
          teaching_moments?: number
          transcript_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          additional_questions_asked?: number
          attempt_number?: number
          competency_score?: number
          completed_at?: string | null
          course_id?: string
          created_at?: string
          enrollment_id?: string
          id?: string
          passed?: boolean | null
          questions_covered?: string[]
          quiz_mode?: string
          score?: number | null
          section_id?: string | null
          started_at?: string
          status?: string
          teaching_moments?: number
          transcript_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
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
          auto_flagged: boolean
          course_id: string
          created_at: string
          difficulty: string
          evaluation_criteria: Json | null
          explanation_en: string | null
          explanation_es: string | null
          group_id: string
          id: string
          is_active: boolean
          is_archived: boolean
          options: Json | null
          question_en: string
          question_es: string | null
          question_type: string
          rubric: Json | null
          scenario_en: string | null
          scenario_es: string | null
          section_id: string | null
          source: string
          source_element_key: string | null
          source_refs: Json
          times_correct: number
          times_shown: number
          updated_at: string
        }
        Insert: {
          auto_flagged?: boolean
          course_id: string
          created_at?: string
          difficulty?: string
          evaluation_criteria?: Json | null
          explanation_en?: string | null
          explanation_es?: string | null
          group_id: string
          id?: string
          is_active?: boolean
          is_archived?: boolean
          options?: Json | null
          question_en: string
          question_es?: string | null
          question_type: string
          rubric?: Json | null
          scenario_en?: string | null
          scenario_es?: string | null
          section_id?: string | null
          source?: string
          source_element_key?: string | null
          source_refs?: Json
          times_correct?: number
          times_shown?: number
          updated_at?: string
        }
        Update: {
          auto_flagged?: boolean
          course_id?: string
          created_at?: string
          difficulty?: string
          evaluation_criteria?: Json | null
          explanation_en?: string | null
          explanation_es?: string | null
          group_id?: string
          id?: string
          is_active?: boolean
          is_archived?: boolean
          options?: Json | null
          question_en?: string
          question_es?: string | null
          question_type?: string
          rubric?: Json | null
          scenario_en?: string | null
          scenario_es?: string | null
          section_id?: string | null
          source?: string
          source_element_key?: string | null
          source_refs?: Json
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
            foreignKeyName: "quiz_questions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
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
      restaurant_reviews: {
        Row: {
          ambience_rating: number | null
          analysis_status: string
          analyzed_at: string | null
          created_at: string
          food_rating: number | null
          group_id: string
          helpful_votes: number | null
          id: string
          language: string | null
          last_error: string | null
          owner_response_date: string | null
          owner_response_text: string | null
          platform: string
          platform_review_id: string
          rating: number
          restaurant_id: string
          retry_count: number
          review_date: string
          review_text: string | null
          review_title: string | null
          review_url: string | null
          reviewer_name: string | null
          scraped_at: string
          service_rating: number | null
          updated_at: string
          value_rating: number | null
          visit_date: string | null
        }
        Insert: {
          ambience_rating?: number | null
          analysis_status?: string
          analyzed_at?: string | null
          created_at?: string
          food_rating?: number | null
          group_id: string
          helpful_votes?: number | null
          id?: string
          language?: string | null
          last_error?: string | null
          owner_response_date?: string | null
          owner_response_text?: string | null
          platform: string
          platform_review_id: string
          rating: number
          restaurant_id: string
          retry_count?: number
          review_date: string
          review_text?: string | null
          review_title?: string | null
          review_url?: string | null
          reviewer_name?: string | null
          scraped_at?: string
          service_rating?: number | null
          updated_at?: string
          value_rating?: number | null
          visit_date?: string | null
        }
        Update: {
          ambience_rating?: number | null
          analysis_status?: string
          analyzed_at?: string | null
          created_at?: string
          food_rating?: number | null
          group_id?: string
          helpful_votes?: number | null
          id?: string
          language?: string | null
          last_error?: string | null
          owner_response_date?: string | null
          owner_response_text?: string | null
          platform?: string
          platform_review_id?: string
          rating?: number
          restaurant_id?: string
          retry_count?: number
          review_date?: string
          review_text?: string | null
          review_title?: string | null
          review_url?: string | null
          reviewer_name?: string | null
          scraped_at?: string
          service_rating?: number | null
          updated_at?: string
          value_rating?: number | null
          visit_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "restaurant_reviews_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "restaurant_reviews_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "tracked_restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      review_analyses: {
        Row: {
          created_at: string
          embedding: string | null
          emotion: string
          group_id: string
          high_severity_details: Json
          high_severity_flag: boolean
          id: string
          items_mentioned: Json
          opportunities: Json
          overall_sentiment: string
          rating: number
          restaurant_id: string
          return_intent: string | null
          review_date: string
          review_id: string
          staff_mentioned: Json
          strengths: Json
        }
        Insert: {
          created_at?: string
          embedding?: string | null
          emotion: string
          group_id: string
          high_severity_details?: Json
          high_severity_flag?: boolean
          id?: string
          items_mentioned?: Json
          opportunities?: Json
          overall_sentiment: string
          rating: number
          restaurant_id: string
          return_intent?: string | null
          review_date: string
          review_id: string
          staff_mentioned?: Json
          strengths?: Json
        }
        Update: {
          created_at?: string
          embedding?: string | null
          emotion?: string
          group_id?: string
          high_severity_details?: Json
          high_severity_flag?: boolean
          id?: string
          items_mentioned?: Json
          opportunities?: Json
          overall_sentiment?: string
          rating?: number
          restaurant_id?: string
          return_intent?: string | null
          review_date?: string
          review_id?: string
          staff_mentioned?: Json
          strengths?: Json
        }
        Relationships: [
          {
            foreignKeyName: "review_analyses_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_analyses_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "tracked_restaurants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_analyses_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: true
            referencedRelation: "restaurant_reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      review_intelligence: {
        Row: {
          ambience_sentiment: number | null
          avg_rating: number | null
          created_at: string
          emotion_distribution: Json
          flavor_index: number | null
          flavor_index_change: number | null
          food_sentiment: number | null
          group_id: string
          high_severity_count: number | null
          id: string
          period_end: string
          period_start: string
          period_type: string
          platform_breakdown: Json
          restaurant_id: string
          return_likely_pct: number | null
          return_unlikely_pct: number | null
          service_sentiment: number | null
          top_complaints: Json
          top_opportunities: Json
          top_positive_items: Json
          top_staff: Json
          top_strengths: Json
          total_reviews: number
          updated_at: string
          value_sentiment: number | null
        }
        Insert: {
          ambience_sentiment?: number | null
          avg_rating?: number | null
          created_at?: string
          emotion_distribution?: Json
          flavor_index?: number | null
          flavor_index_change?: number | null
          food_sentiment?: number | null
          group_id: string
          high_severity_count?: number | null
          id?: string
          period_end: string
          period_start: string
          period_type: string
          platform_breakdown?: Json
          restaurant_id: string
          return_likely_pct?: number | null
          return_unlikely_pct?: number | null
          service_sentiment?: number | null
          top_complaints?: Json
          top_opportunities?: Json
          top_positive_items?: Json
          top_staff?: Json
          top_strengths?: Json
          total_reviews?: number
          updated_at?: string
          value_sentiment?: number | null
        }
        Update: {
          ambience_sentiment?: number | null
          avg_rating?: number | null
          created_at?: string
          emotion_distribution?: Json
          flavor_index?: number | null
          flavor_index_change?: number | null
          food_sentiment?: number | null
          group_id?: string
          high_severity_count?: number | null
          id?: string
          period_end?: string
          period_start?: string
          period_type?: string
          platform_breakdown?: Json
          restaurant_id?: string
          return_likely_pct?: number | null
          return_unlikely_pct?: number | null
          service_sentiment?: number | null
          top_complaints?: Json
          top_opportunities?: Json
          top_positive_items?: Json
          top_staff?: Json
          top_strengths?: Json
          total_reviews?: number
          updated_at?: string
          value_sentiment?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "review_intelligence_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_intelligence_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "tracked_restaurants"
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
      scrape_runs: {
        Row: {
          apify_dataset_id: string | null
          apify_run_id: string | null
          completed_at: string | null
          error_message: string | null
          group_id: string
          id: string
          last_offset: number | null
          platform: string
          restaurant_id: string
          reviews_duplicate: number
          reviews_fetched: number
          reviews_inserted: number
          reviews_updated: number
          started_at: string
          status: string
        }
        Insert: {
          apify_dataset_id?: string | null
          apify_run_id?: string | null
          completed_at?: string | null
          error_message?: string | null
          group_id: string
          id?: string
          last_offset?: number | null
          platform: string
          restaurant_id: string
          reviews_duplicate?: number
          reviews_fetched?: number
          reviews_inserted?: number
          reviews_updated?: number
          started_at?: string
          status?: string
        }
        Update: {
          apify_dataset_id?: string | null
          apify_run_id?: string | null
          completed_at?: string | null
          error_message?: string | null
          group_id?: string
          id?: string
          last_offset?: number | null
          platform?: string
          restaurant_id?: string
          reviews_duplicate?: number
          reviews_fetched?: number
          reviews_inserted?: number
          reviews_updated?: number
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "scrape_runs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "scrape_runs_restaurant_id_fkey"
            columns: ["restaurant_id"]
            isOneToOne: false
            referencedRelation: "tracked_restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      section_progress: {
        Row: {
          completed_at: string | null
          content_hash_at_completion: string | null
          course_id: string
          created_at: string
          elements_total: number
          elements_viewed: string[]
          enrollment_id: string
          id: string
          quiz_attempts: number
          quiz_passed: boolean | null
          quiz_score: number | null
          section_id: string
          started_at: string | null
          status: string
          time_spent_seconds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          content_hash_at_completion?: string | null
          course_id: string
          created_at?: string
          elements_total?: number
          elements_viewed?: string[]
          enrollment_id: string
          id?: string
          quiz_attempts?: number
          quiz_passed?: boolean | null
          quiz_score?: number | null
          section_id: string
          started_at?: string | null
          status?: string
          time_spent_seconds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          content_hash_at_completion?: string | null
          course_id?: string
          created_at?: string
          elements_total?: number
          elements_viewed?: string[]
          enrollment_id?: string
          id?: string
          quiz_attempts?: number
          quiz_passed?: boolean | null
          quiz_score?: number | null
          section_id?: string
          started_at?: string | null
          status?: string
          time_spent_seconds?: number
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
      tracked_restaurants: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          created_by: string | null
          display_name: string | null
          google_place_id: string | null
          google_place_url: string | null
          group_id: string
          id: string
          last_scraped_at: string | null
          latitude: number | null
          longitude: number | null
          name: string
          opentable_url: string | null
          parent_unit_id: string | null
          restaurant_type: string
          scrape_enabled: boolean
          scrape_frequency: string
          slug: string
          state: string | null
          status: string
          tripadvisor_url: string | null
          updated_at: string
          zip: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          google_place_id?: string | null
          google_place_url?: string | null
          group_id: string
          id?: string
          last_scraped_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name: string
          opentable_url?: string | null
          parent_unit_id?: string | null
          restaurant_type: string
          scrape_enabled?: boolean
          scrape_frequency?: string
          slug: string
          state?: string | null
          status?: string
          tripadvisor_url?: string | null
          updated_at?: string
          zip?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          display_name?: string | null
          google_place_id?: string | null
          google_place_url?: string | null
          group_id?: string
          id?: string
          last_scraped_at?: string | null
          latitude?: number | null
          longitude?: number | null
          name?: string
          opentable_url?: string | null
          parent_unit_id?: string | null
          restaurant_type?: string
          scrape_enabled?: boolean
          scrape_frequency?: string
          slug?: string
          state?: string | null
          status?: string
          tripadvisor_url?: string | null
          updated_at?: string
          zip?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tracked_restaurants_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracked_restaurants_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tracked_restaurants_parent_unit_id_fkey"
            columns: ["parent_unit_id"]
            isOneToOne: false
            referencedRelation: "tracked_restaurants"
            referencedColumns: ["id"]
          },
        ]
      }
      training_actions: {
        Row: {
          action_type: string
          created_at: string
          display_data: Json
          expires_at: string
          group_id: string
          id: string
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          source: string
          status: string
          target_course_id: string | null
          target_employee_id: string | null
          target_program_id: string | null
          updated_at: string
        }
        Insert: {
          action_type: string
          created_at?: string
          display_data?: Json
          expires_at?: string
          group_id: string
          id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          target_course_id?: string | null
          target_employee_id?: string | null
          target_program_id?: string | null
          updated_at?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          display_data?: Json
          expires_at?: string
          group_id?: string
          id?: string
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          target_course_id?: string | null
          target_employee_id?: string | null
          target_program_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_actions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_actions_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_actions_target_course_id_fkey"
            columns: ["target_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_actions_target_employee_id_fkey"
            columns: ["target_employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_actions_target_program_id_fkey"
            columns: ["target_program_id"]
            isOneToOne: false
            referencedRelation: "training_programs"
            referencedColumns: ["id"]
          },
        ]
      }
      training_insights: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          group_id: string
          id: string
          insight_type: string
          period_end: string
          period_start: string
          severity: string
          superseded_by: string | null
          title: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          group_id: string
          id?: string
          insight_type: string
          period_end: string
          period_start: string
          severity?: string
          superseded_by?: string | null
          title: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          group_id?: string
          id?: string
          insight_type?: string
          period_end?: string
          period_start?: string
          severity?: string
          superseded_by?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_insights_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_insights_superseded_by_fkey"
            columns: ["superseded_by"]
            isOneToOne: false
            referencedRelation: "training_insights"
            referencedColumns: ["id"]
          },
        ]
      }
      training_programs: {
        Row: {
          category: string
          cover_image: string | null
          created_at: string
          created_by: string | null
          description_en: string | null
          description_es: string | null
          group_id: string
          icon: string | null
          id: string
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
          created_by?: string | null
          description_en?: string | null
          description_es?: string | null
          group_id: string
          icon?: string | null
          id?: string
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
          created_by?: string | null
          description_en?: string | null
          description_es?: string | null
          group_id?: string
          icon?: string | null
          id?: string
          slug?: string
          sort_order?: number
          status?: string
          title_en?: string
          title_es?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_programs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_programs_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
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
          group_id: string
          id: string
          image: string | null
          is_featured: boolean
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
          group_id: string
          id?: string
          image?: string | null
          is_featured?: boolean
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
          group_id?: string
          id?: string
          image?: string | null
          is_featured?: boolean
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
            foreignKeyName: "wines_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
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
      aggregate_item_mentions: {
        Args: {
          p_end_date: string
          p_limit?: number
          p_restaurant_id: string
          p_start_date: string
        }
        Returns: Json
      }
      aggregate_staff_mentions: {
        Args: {
          p_end_date: string
          p_limit?: number
          p_restaurant_id: string
          p_start_date: string
        }
        Returns: Json
      }
      cleanup_expired_training_data: { Args: never; Returns: undefined }
      cleanup_stale_ingestion_sessions: {
        Args: never
        Returns: {
          abandoned_count: number
          deleted_count: number
        }[]
      }
      close_stale_sessions: {
        Args: { _expiry_hours?: number }
        Returns: number
      }
      compute_flavor_index_range: {
        Args: {
          p_end_date: string
          p_restaurant_id: string
          p_start_date: string
        }
        Returns: {
          avg_rating: number
          five_star: number
          flavor_index: number
          four_star: number
          low_star: number
          total_reviews: number
        }[]
      }
      expire_rollouts: { Args: never; Returns: undefined }
      expire_stale_training_actions: { Args: never; Returns: number }
      fn_get_section_context: {
        Args: { _language?: string; _section_id: string }
        Returns: string
      }
      generate_training_insights: { Args: never; Returns: number }
      get_admin_employees: {
        Args: { p_group_id: string }
        Returns: {
          attention_reason: string
          avg_score: number
          course_progress: string
          courses_done: string
          current_course: string
          department: string
          display_name: string
          email: string
          employment_status: string
          first_name: string
          grade: string
          hire_date: string
          id: string
          is_new_hire: boolean
          last_name: string
          needs_attention: boolean
          overall_progress: number
          phone: string
          position: string
          profile_id: string
          tenure_label: string
        }[]
      }
      get_category_trend_weekly: {
        Args: {
          p_category: string
          p_end_date: string
          p_restaurant_ids: string[]
          p_start_date: string
        }
        Returns: {
          restaurant_id: string
          sentiment: number
          week_start: string
        }[]
      }
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
      get_competitor_ids: { Args: { p_unit_id: string }; Returns: string[] }
      get_course_training_analytics: {
        Args: { p_course_id: string; p_group_id: string }
        Returns: {
          avg_completion_days: number
          avg_score: number
          completed_count: number
          course_id: string
          course_title: string
          enrolled_count: number
          in_progress_count: number
          pass_rate: number
          problem_sections: Json
        }[]
      }
      get_courses_hero_stats: {
        Args: { p_group_id: string }
        Returns: {
          avg_grade: number
          completion_rate: number
          total_courses: number
        }[]
      }
      get_dashboard_competitors: {
        Args: { p_end_date: string; p_start_date: string; p_unit_id: string }
        Returns: {
          avg_rating: number
          delta: number
          flavor_index: number
          is_own: boolean
          name: string
          restaurant_id: string
          total_reviews: number
        }[]
      }
      get_employee_detail: {
        Args: { p_employee_id: string }
        Returns: {
          courses: Json
          department: string
          display_name: string
          email: string
          employment_status: string
          first_name: string
          hire_date: string
          id: string
          last_name: string
          phone: string
          position: string
          profile_id: string
        }[]
      }
      get_employee_training_detail: {
        Args: {
          p_employee_id?: string
          p_employee_name?: string
          p_group_id: string
        }
        Returns: {
          completed_at: string
          completion_pct: number
          course_id: string
          course_title: string
          department: string
          display_name: string
          employee_id: string
          employment_status: string
          enrollment_status: string
          final_passed: boolean
          final_score: number
          hire_date: string
          latest_eval_competency: string
          latest_eval_score: number
          match_count: number
          position: string
          profile_linked: boolean
          started_at: string
        }[]
      }
      get_full_sections: {
        Args: { section_ids: string[] }
        Returns: {
          category: string
          content_en: string
          content_es: string
          id: string
          slug: string
          tags: string[]
          title_en: string
          title_es: string
          updated_at: string
          word_count_en: number
          word_count_es: number
        }[]
      }
      get_hub_hero_stats: {
        Args: { p_group_id: string }
        Returns: {
          active_courses: number
          pending_actions: number
          staff_managed: number
        }[]
      }
      get_manual_section: {
        Args: { language?: string; p_group_id?: string; section_slug: string }
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
        Args: { language?: string; p_group_id?: string }
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
      get_pending_actions: {
        Args: { p_group_id: string }
        Returns: {
          action_id: string
          action_type: string
          course_title: string
          created_at: string
          display_data: Json
          employee_name: string
          expires_at: string
          program_title: string
          source: string
          status: string
        }[]
      }
      get_people_hero_stats: {
        Args: { p_group_id: string }
        Returns: {
          fully_trained: number
          needs_attention: number
          new_hires: number
          total_employees: number
        }[]
      }
      get_program_completion_summary: {
        Args: { p_group_id: string; p_program_id?: string }
        Returns: {
          completed_at: string
          completed_courses: number
          display_name: string
          employee_id: string
          overall_score: number
          position: string
          program_id: string
          program_status: string
          program_title: string
          started_at: string
          total_courses: number
        }[]
      }
      get_recent_insights: {
        Args: { p_group_id: string; p_insight_type?: string }
        Returns: {
          body: string
          created_at: string
          data: Json
          insight_id: string
          insight_type: string
          period_end: string
          period_start: string
          severity: string
          title: string
        }[]
      }
      get_severity_alerts: {
        Args: {
          p_end_date: string
          p_limit?: number
          p_restaurant_ids: string[]
          p_start_date: string
        }
        Returns: {
          alert_id: string
          alert_type: string
          restaurant_id: string
          restaurant_name: string
          review_date: string
          summary: string
        }[]
      }
      get_subcategory_breakdown: {
        Args: {
          p_bucket: string
          p_end_date: string
          p_limit?: number
          p_restaurant_id: string
          p_start_date: string
        }
        Returns: {
          avg_intensity: number
          category: string
          mentions: number
          trend_delta: number
        }[]
      }
      get_team_progress: {
        Args: { p_group_id: string }
        Returns: {
          completed_at: string
          completed_sections: number
          course_id: string
          course_title: string
          enrollment_status: string
          expires_at: string
          final_passed: boolean
          final_score: number
          is_overdue: boolean
          program_id: string
          program_title: string
          progress_pct: number
          started_at: string
          total_sections: number
          user_email: string
          user_full_name: string
          user_id: string
          user_role: string
        }[]
      }
      get_team_training_summary: {
        Args: {
          p_department?: string
          p_employment_status?: string
          p_group_id: string
          p_limit?: number
        }
        Returns: {
          avg_score: number
          courses_completed: number
          courses_enrolled: number
          department: string
          display_name: string
          employee_id: string
          employment_status: string
          hire_date: string
          latest_activity: string
          position: string
          profile_id: string
        }[]
      }
      get_training_alerts: {
        Args: { p_group_id: string }
        Returns: {
          alert_type: string
          course_id: string
          course_title: string
          detail: string
          display_name: string
          due_date: string
          employee_id: string
          position: string
          severity: string
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
      increment_quiz_question_stats: {
        Args: { p_question_id: string; p_was_correct: boolean }
        Returns: undefined
      }
      increment_usage: {
        Args: {
          _credits?: number
          _group_id: string
          _log?: Json
          _user_id: string
        }
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
      mark_notification_read: {
        Args: { p_notification_id: string }
        Returns: boolean
      }
      resolve_group_id: { Args: { p_group_id: string }; Returns: string }
      resolve_training_action: {
        Args: { p_action_id: string; p_note?: string; p_resolution: string }
        Returns: Json
      }
      rollup_daily_flavor_index: {
        Args: { p_target_date?: string }
        Returns: number
      }
      rollup_review_intelligence: {
        Args: { p_target_date?: string }
        Returns: number
      }
      run_auto_enrollment: {
        Args: never
        Returns: {
          actions_proposed: number
          enrollments_created: number
        }[]
      }
      run_daily_review_rollups: {
        Args: never
        Returns: {
          daily_rows: number
          intelligence_rows: number
        }[]
      }
      search_beer_liquor: {
        Args: {
          keyword_weight?: number
          p_group_id?: string
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
          p_group_id?: string
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
      search_contacts: {
        Args: {
          match_count?: number
          p_category?: string
          p_group_id?: string
          search_query: string
        }
        Returns: {
          address: string
          category: string
          contact_person: string
          email: string
          id: string
          is_demo_data: boolean
          name: string
          notes: string
          phone: string
          score: number
          subcategory: string
        }[]
      }
      search_dishes: {
        Args: {
          keyword_weight?: number
          p_group_id?: string
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
      search_forms: {
        Args: {
          match_count?: number
          p_group_id?: string
          search_language?: string
          search_query: string
        }
        Returns: {
          description: string
          icon: string
          icon_color: string
          id: string
          score: number
          slug: string
          title: string
        }[]
      }
      search_manual: {
        Args: {
          p_group_id?: string
          result_limit?: number
          search_language?: string
          search_query: string
        }
        Returns: {
          category: string
          file_path: string
          id: string
          rank: number
          slug: string
          snippet: string
          tags: string[]
          title: string
        }[]
      }
      search_manual_v2: {
        Args: {
          keyword_weight?: number
          p_group_id?: string
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
          p_group_id?: string
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
          p_group_id?: string
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
      send_notification: {
        Args: {
          p_body?: string
          p_group_id: string
          p_metadata?: Json
          p_title: string
          p_type: string
          p_user_id: string
        }
        Returns: string
      }
      set_active_unit: { Args: { p_unit_id: string }; Returns: boolean }
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
  public: {
    Enums: {
      user_role: ["staff", "manager", "admin"],
    },
  },
} as const
