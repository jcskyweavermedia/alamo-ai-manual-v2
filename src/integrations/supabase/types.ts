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
          status?: string
          style?: string
          subcategory?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
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
          status?: string
          style?: string
          tasting_notes?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
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
          status?: string
          tags?: string[]
          updated_at?: string
          version?: number
        }
        Relationships: []
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
          status?: string
          tags?: string[]
          training_notes?: Json
          updated_at?: string
          version?: number
          yield_qty?: number
          yield_unit?: string
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
          status?: string
          style?: string
          tasting_notes?: string
          updated_at?: string
          varietal?: string
          version?: number
          vintage?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invite: { Args: { invite_token: string }; Returns: Json }
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
      get_user_groups: { Args: { _user_id: string }; Returns: string[] }
      get_user_permissions: { Args: never; Returns: Json }
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
      hybrid_search_manual: {
        Args: {
          keyword_weight?: number
          query_embedding: string
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
          slug: string
          snippet: string
          tags: string[]
          title: string
        }[]
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
      search_manual: {
        Args: {
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
  public: {
    Enums: {
      user_role: ["staff", "manager", "admin"],
    },
  },
} as const
