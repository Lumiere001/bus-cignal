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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      match_passengers: {
        Row: {
          access_token_hash: string | null
          anonymized: boolean
          created_at: string
          id: string
          last_seen_at: string | null
          match_id: string
          name: string
          phone: string
          school_or_role: string | null
        }
        Insert: {
          access_token_hash?: string | null
          anonymized?: boolean
          created_at?: string
          id?: string
          last_seen_at?: string | null
          match_id: string
          name: string
          phone: string
          school_or_role?: string | null
        }
        Update: {
          access_token_hash?: string | null
          anonymized?: boolean
          created_at?: string
          id?: string
          last_seen_at?: string | null
          match_id?: string
          name?: string
          phone?: string
          school_or_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "match_passengers_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "matches"
            referencedColumns: ["id"]
          },
        ]
      }
      matches: {
        Row: {
          cancellation_reason: string | null
          cancellation_source: string | null
          created_at: string
          id: string
          matched_at: string
          paid_at: string | null
          passenger_id: string
          payment_due_at: string | null
          payment_reported_at: string | null
          request_id: string
          reservation_code: string | null
          status: string
          trip_id: string
        }
        Insert: {
          cancellation_reason?: string | null
          cancellation_source?: string | null
          created_at?: string
          id?: string
          matched_at?: string
          paid_at?: string | null
          passenger_id: string
          payment_due_at?: string | null
          payment_reported_at?: string | null
          request_id: string
          reservation_code?: string | null
          status?: string
          trip_id: string
        }
        Update: {
          cancellation_reason?: string | null
          cancellation_source?: string | null
          created_at?: string
          id?: string
          matched_at?: string
          paid_at?: string | null
          passenger_id?: string
          payment_due_at?: string | null
          payment_reported_at?: string | null
          request_id?: string
          reservation_code?: string | null
          status?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matches_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "request_passengers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "seat_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "matches_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          channel: string
          created_at: string
          delivery_status: string
          id: string
          last_attempt_at: string | null
          operator_id: string | null
          passenger_id: string | null
          payload: Json | null
          read_at: string | null
          retry_count: number
          sent_at: string | null
          type: string
        }
        Insert: {
          channel: string
          created_at?: string
          delivery_status?: string
          id?: string
          last_attempt_at?: string | null
          operator_id?: string | null
          passenger_id?: string | null
          payload?: Json | null
          read_at?: string | null
          retry_count?: number
          sent_at?: string | null
          type: string
        }
        Update: {
          channel?: string
          created_at?: string
          delivery_status?: string
          id?: string
          last_attempt_at?: string | null
          operator_id?: string | null
          passenger_id?: string | null
          payload?: Json | null
          read_at?: string | null
          retry_count?: number
          sent_at?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "match_passengers"
            referencedColumns: ["id"]
          },
        ]
      }
      operators: {
        Row: {
          anonymized: boolean
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          campus: string | null
          ccc_id: string | null
          ccc_role: string | null
          created_at: string
          email: string | null
          id: string
          name: string | null
          phone: string | null
          region_id: string | null
          requested_region_id: string | null
          revoke_reason: string | null
          revoked_at: string | null
          role: string
        }
        Insert: {
          anonymized?: boolean
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          campus?: string | null
          ccc_id?: string | null
          ccc_role?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          region_id?: string | null
          requested_region_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          role?: string
        }
        Update: {
          anonymized?: boolean
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          campus?: string | null
          ccc_id?: string | null
          ccc_role?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string | null
          phone?: string | null
          region_id?: string | null
          requested_region_id?: string | null
          revoke_reason?: string | null
          revoked_at?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "operators_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operators_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operators_requested_region_id_fkey"
            columns: ["requested_region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          created_at: string
          id: string
          last_used_at: string
          operator_id: string | null
          passenger_id: string | null
          token: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          last_used_at?: string
          operator_id?: string | null
          passenger_id?: string | null
          token: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          last_used_at?: string
          operator_id?: string | null
          passenger_id?: string | null
          token?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_subscriptions_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "match_passengers"
            referencedColumns: ["id"]
          },
        ]
      }
      region_locations: {
        Row: {
          address: string
          created_at: string
          created_by: string | null
          direction: string
          id: string
          is_default: boolean
          label: string | null
          lat: number | null
          lng: number | null
          location_type: string
          region_id: string
        }
        Insert: {
          address: string
          created_at?: string
          created_by?: string | null
          direction: string
          id?: string
          is_default?: boolean
          label?: string | null
          lat?: number | null
          lng?: number | null
          location_type: string
          region_id: string
        }
        Update: {
          address?: string
          created_at?: string
          created_by?: string | null
          direction?: string
          id?: string
          is_default?: boolean
          label?: string | null
          lat?: number | null
          lng?: number | null
          location_type?: string
          region_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "region_locations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "region_locations_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          account_holder: string | null
          area: string | null
          bank_account: string | null
          bank_name: string | null
          category: string
          code: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          account_holder?: string | null
          area?: string | null
          bank_account?: string | null
          bank_name?: string | null
          category: string
          code: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          account_holder?: string | null
          area?: string | null
          bank_account?: string | null
          bank_name?: string | null
          category?: string
          code?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      rejection_log: {
        Row: {
          created_at: string
          id: string
          reason: string
          rejected_by: string | null
          seat_request_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          rejected_by?: string | null
          seat_request_id: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          rejected_by?: string | null
          seat_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rejection_log_rejected_by_fkey"
            columns: ["rejected_by"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rejection_log_seat_request_id_fkey"
            columns: ["seat_request_id"]
            isOneToOne: false
            referencedRelation: "seat_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      request_passengers: {
        Row: {
          anonymized: boolean
          created_at: string
          id: string
          name: string
          note: string | null
          phone: string
          priority: number
          request_id: string
          school_or_role: string | null
        }
        Insert: {
          anonymized?: boolean
          created_at?: string
          id?: string
          name: string
          note?: string | null
          phone: string
          priority: number
          request_id: string
          school_or_role?: string | null
        }
        Update: {
          anonymized?: boolean
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          phone?: string
          priority?: number
          request_id?: string
          school_or_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_passengers_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "seat_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      seat_offers: {
        Row: {
          created_at: string
          id: string
          posted_at: string
          seat_count: number
          status: string
          trip_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          posted_at?: string
          seat_count: number
          status?: string
          trip_id: string
        }
        Update: {
          created_at?: string
          id?: string
          posted_at?: string
          seat_count?: number
          status?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seat_offers_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      seat_requests: {
        Row: {
          consent_confirmed_at: string | null
          consent_confirmed_by: string | null
          created_at: string
          id: string
          operator_id: string
          parent_request_id: string | null
          region_id: string
          reject_reason: string | null
          requested_at: string
          seat_count: number
          status: string
          trip_id: string
        }
        Insert: {
          consent_confirmed_at?: string | null
          consent_confirmed_by?: string | null
          created_at?: string
          id?: string
          operator_id: string
          parent_request_id?: string | null
          region_id: string
          reject_reason?: string | null
          requested_at?: string
          seat_count: number
          status?: string
          trip_id: string
        }
        Update: {
          consent_confirmed_at?: string | null
          consent_confirmed_by?: string | null
          created_at?: string
          id?: string
          operator_id?: string
          parent_request_id?: string | null
          region_id?: string
          reject_reason?: string | null
          requested_at?: string
          seat_count?: number
          status?: string
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "seat_requests_consent_confirmed_by_fkey"
            columns: ["consent_confirmed_by"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_requests_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_requests_parent_request_id_fkey"
            columns: ["parent_request_id"]
            isOneToOne: false
            referencedRelation: "seat_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_requests_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "seat_requests_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      system_config: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: string | null
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: string | null
        }
        Relationships: []
      }
      trips: {
        Row: {
          capacity: number
          created_at: string
          created_by: string | null
          departure_at: string
          destination_location_id: string
          direction: string
          id: string
          note: string | null
          operator_region_id: string
          origin_location_id: string
          price_per_seat: number
          status: string
          treasurer_name: string | null
          treasurer_phone: string | null
        }
        Insert: {
          capacity: number
          created_at?: string
          created_by?: string | null
          departure_at: string
          destination_location_id: string
          direction: string
          id?: string
          note?: string | null
          operator_region_id: string
          origin_location_id: string
          price_per_seat: number
          status?: string
          treasurer_name?: string | null
          treasurer_phone?: string | null
        }
        Update: {
          capacity?: number
          created_at?: string
          created_by?: string | null
          departure_at?: string
          destination_location_id?: string
          direction?: string
          id?: string
          note?: string | null
          operator_region_id?: string
          origin_location_id?: string
          price_per_seat?: number
          status?: string
          treasurer_name?: string | null
          treasurer_phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_destination_location_id_fkey"
            columns: ["destination_location_id"]
            isOneToOne: false
            referencedRelation: "region_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_operator_region_id_fkey"
            columns: ["operator_region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_origin_location_id_fkey"
            columns: ["origin_location_id"]
            isOneToOne: false
            referencedRelation: "region_locations"
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
