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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: Json
          id: string
          scope: string
          scope_id: string | null
          target_id: string | null
          target_table: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          scope?: string
          scope_id?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          scope?: string
          scope_id?: string | null
          target_id?: string | null
          target_table?: string | null
        }
        Relationships: []
      }
      countries: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      education_levels: {
        Row: {
          active: boolean
          code: string
          created_at: string
          id: string
          max_age: number | null
          min_age: number | null
          name: string
          order: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          id?: string
          max_age?: number | null
          min_age?: number | null
          name: string
          order?: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          id?: string
          max_age?: number | null
          min_age?: number | null
          name?: string
          order?: number
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          auto_approve_registrations: boolean
          created_at: string
          id: string
          logo_url: string | null
          platform_name: string
          singleton: boolean
          support_email: string | null
          tagline: string
          updated_at: string
        }
        Insert: {
          auto_approve_registrations?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          platform_name?: string
          singleton?: boolean
          support_email?: string | null
          tagline?: string
          updated_at?: string
        }
        Update: {
          auto_approve_registrations?: boolean
          created_at?: string
          id?: string
          logo_url?: string | null
          platform_name?: string
          singleton?: boolean
          support_email?: string | null
          tagline?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      records: {
        Row: {
          collection: string
          created_at: string
          data: Json
          id: string
          school_id: string | null
          updated_at: string
        }
        Insert: {
          collection: string
          created_at?: string
          data?: Json
          id?: string
          school_id?: string | null
          updated_at?: string
        }
        Update: {
          collection?: string
          created_at?: string
          data?: Json
          id?: string
          school_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "records_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          active: boolean
          code: string
          country_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          country_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          country_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "regions_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      school_registrations: {
        Row: {
          confirmed_at: string | null
          confirmed_by: string | null
          contact_phone: string | null
          country_id: string | null
          created_at: string
          district: string | null
          id: string
          level_codes: string[]
          proposed_code: string
          region_id: string | null
          rejection_reason: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          school_id: string | null
          school_name: string
          status: string
          type_code: string
          updated_at: string
        }
        Insert: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          contact_phone?: string | null
          country_id?: string | null
          created_at?: string
          district?: string | null
          id?: string
          level_codes?: string[]
          proposed_code: string
          region_id?: string | null
          rejection_reason?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string | null
          school_name: string
          status?: string
          type_code?: string
          updated_at?: string
        }
        Update: {
          confirmed_at?: string | null
          confirmed_by?: string | null
          contact_phone?: string | null
          country_id?: string | null
          created_at?: string
          district?: string | null
          id?: string
          level_codes?: string[]
          proposed_code?: string
          region_id?: string | null
          rejection_reason?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          school_id?: string | null
          school_name?: string
          status?: string
          type_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_registrations_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_registrations_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "school_registrations_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_settings: {
        Row: {
          created_at: string
          id: string
          school_id: string
          settings: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          school_id: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          school_id?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "school_settings_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: true
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
      school_types: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      schools: {
        Row: {
          active: boolean
          code: string
          country: string
          country_id: string | null
          created_at: string
          created_by: string | null
          currency: string
          district: string | null
          id: string
          level_codes: string[]
          locale: string
          name: string
          region: string | null
          region_id: string | null
          status: string
          timezone: string
          type_code: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code: string
          country?: string
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          district?: string | null
          id?: string
          level_codes?: string[]
          locale?: string
          name: string
          region?: string | null
          region_id?: string | null
          status?: string
          timezone?: string
          type_code?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string
          country?: string
          country_id?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          district?: string | null
          id?: string
          level_codes?: string[]
          locale?: string
          name?: string
          region?: string | null
          region_id?: string | null
          status?: string
          timezone?: string
          type_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "schools_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "schools_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          access_level: number
          country_id: string | null
          created_at: string
          id: string
          region_id: string | null
          role: Database["public"]["Enums"]["app_role"]
          school_id: string | null
          user_id: string
        }
        Insert: {
          access_level?: number
          country_id?: string | null
          created_at?: string
          id?: string
          region_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id: string
        }
        Update: {
          access_level?: number
          country_id?: string | null
          created_at?: string
          id?: string
          region_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          school_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_school_id_fkey"
            columns: ["school_id"]
            isOneToOne: false
            referencedRelation: "schools"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_write_school: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_school_access: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      is_national_admin: {
        Args: { _country_id: string; _user_id: string }
        Returns: boolean
      }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_platform_bootstrapped: { Args: never; Returns: boolean }
      is_regional_admin: {
        Args: { _region_id: string; _user_id: string }
        Returns: boolean
      }
      is_school_admin: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { _user_id: string }; Returns: boolean }
      national_overview: {
        Args: never
        Returns: {
          active: boolean
          configured: boolean
          country: string
          country_id: string
          last_activity: string
          level_codes: string[]
          record_count: number
          region: string
          region_id: string
          school_code: string
          school_id: string
          school_name: string
          staff_count: number
          type_code: string
        }[]
      }
      school_in_scope: {
        Args: { _school_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "super_admin"
        | "national_admin"
        | "regional_admin"
        | "school_admin"
        | "staff"
        | "teacher"
        | "parent"
        | "student"
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
      app_role: [
        "super_admin",
        "national_admin",
        "regional_admin",
        "school_admin",
        "staff",
        "teacher",
        "parent",
        "student",
      ],
    },
  },
} as const
