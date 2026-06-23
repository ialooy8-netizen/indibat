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
      attendance: {
        Row: {
          created_at: string
          date: string
          id: string
          note: string | null
          period: number
          recorded_by: string | null
          status: string
          student_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          date: string
          id?: string
          note?: string | null
          period?: number
          recorded_by?: string | null
          status: string
          student_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          period?: number
          recorded_by?: string | null
          status?: string
          student_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      behavior_incidents: {
        Row: {
          ai_draft: string | null
          created_at: string
          date: string
          id: string
          note: string | null
          points: number
          severity: string | null
          student_id: string
          teacher_id: string | null
          type: string
        }
        Insert: {
          ai_draft?: string | null
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          points: number
          severity?: string | null
          student_id: string
          teacher_id?: string | null
          type: string
        }
        Update: {
          ai_draft?: string | null
          created_at?: string
          date?: string
          id?: string
          note?: string | null
          points?: number
          severity?: string | null
          student_id?: string
          teacher_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "behavior_incidents_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      circulars: {
        Row: {
          attachment_path: string | null
          body: string | null
          created_at: string
          file_url: string | null
          id: string
          posted_by: string | null
          title: string
        }
        Insert: {
          attachment_path?: string | null
          body?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          posted_by?: string | null
          title: string
        }
        Update: {
          attachment_path?: string | null
          body?: string | null
          created_at?: string
          file_url?: string | null
          id?: string
          posted_by?: string | null
          title?: string
        }
        Relationships: []
      }
      class_teachers: {
        Row: {
          class_id: string
          created_at: string
          id: string
          teacher_id: string
        }
        Insert: {
          class_id: string
          created_at?: string
          id?: string
          teacher_id: string
        }
        Update: {
          class_id?: string
          created_at?: string
          id?: string
          teacher_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_teachers_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string
          grade: string | null
          id: string
          is_demo: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade?: string | null
          id?: string
          is_demo?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      facility_config: {
        Row: {
          id: number
          periods_per_day: number
          resources: string[]
          updated_at: string
          working_days: string[]
        }
        Insert: {
          id?: number
          periods_per_day?: number
          resources?: string[]
          updated_at?: string
          working_days?: string[]
        }
        Update: {
          id?: number
          periods_per_day?: number
          resources?: string[]
          updated_at?: string
          working_days?: string[]
        }
        Relationships: []
      }
      leave_requests: {
        Row: {
          attachment_path: string | null
          created_at: string
          employee_id: string
          end_date: string
          expected_return: string | null
          id: string
          leave_from: string | null
          leave_type: string
          reason: string
          review_note: string | null
          reviewer_id: string | null
          start_date: string
          status: string
          unseen_admin: boolean
          updated_at: string
          will_return: boolean | null
        }
        Insert: {
          attachment_path?: string | null
          created_at?: string
          employee_id: string
          end_date: string
          expected_return?: string | null
          id?: string
          leave_from?: string | null
          leave_type?: string
          reason: string
          review_note?: string | null
          reviewer_id?: string | null
          start_date: string
          status?: string
          unseen_admin?: boolean
          updated_at?: string
          will_return?: boolean | null
        }
        Update: {
          attachment_path?: string | null
          created_at?: string
          employee_id?: string
          end_date?: string
          expected_return?: string | null
          id?: string
          leave_from?: string | null
          leave_type?: string
          reason?: string
          review_note?: string | null
          reviewer_id?: string | null
          start_date?: string
          status?: string
          unseen_admin?: boolean
          updated_at?: string
          will_return?: boolean | null
        }
        Relationships: []
      }
      lesson_plans: {
        Row: {
          content: string
          created_at: string
          duration_minutes: number | null
          grade: string | null
          id: string
          objectives: string | null
          subject: string
          teacher_id: string
          topic: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          duration_minutes?: number | null
          grade?: string | null
          id?: string
          objectives?: string | null
          subject: string
          teacher_id: string
          topic: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          duration_minutes?: number | null
          grade?: string | null
          id?: string
          objectives?: string | null
          subject?: string
          teacher_id?: string
          topic?: string
          updated_at?: string
        }
        Relationships: []
      }
      parent_comms_log: {
        Row: {
          created_at: string
          id: string
          message: string | null
          sender_id: string | null
          student_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          sender_id?: string | null
          student_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          sender_id?: string | null
          student_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "parent_comms_log_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["id"]
          },
        ]
      }
      print_requests: {
        Row: {
          attachment_path: string | null
          copies: number
          created_at: string
          employee_id: string
          file_url: string | null
          id: string
          is_confidential: boolean
          notes: string | null
          principal_approved_at: string | null
          principal_approved_by: string | null
          status: string
          title: string
          unseen_admin: boolean
          updated_at: string
        }
        Insert: {
          attachment_path?: string | null
          copies?: number
          created_at?: string
          employee_id: string
          file_url?: string | null
          id?: string
          is_confidential?: boolean
          notes?: string | null
          principal_approved_at?: string | null
          principal_approved_by?: string | null
          status?: string
          title: string
          unseen_admin?: boolean
          updated_at?: string
        }
        Update: {
          attachment_path?: string | null
          copies?: number
          created_at?: string
          employee_id?: string
          file_url?: string | null
          id?: string
          is_confidential?: boolean
          notes?: string | null
          principal_approved_at?: string | null
          principal_approved_by?: string | null
          status?: string
          title?: string
          unseen_admin?: boolean
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
      resource_bookings: {
        Row: {
          booking_date: string
          created_at: string
          day_label: string | null
          employee_id: string
          id: string
          note: string | null
          period: string
          resource: string
          status: string
          unseen_admin: boolean
          updated_at: string
        }
        Insert: {
          booking_date: string
          created_at?: string
          day_label?: string | null
          employee_id: string
          id?: string
          note?: string | null
          period: string
          resource: string
          status?: string
          unseen_admin?: boolean
          updated_at?: string
        }
        Update: {
          booking_date?: string
          created_at?: string
          day_label?: string | null
          employee_id?: string
          id?: string
          note?: string | null
          period?: string
          resource?: string
          status?: string
          unseen_admin?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      students: {
        Row: {
          behavior_points: number
          class_id: string | null
          created_at: string
          gender: string | null
          id: string
          is_demo: boolean
          name: string
          national_id: string | null
          notes: string | null
          parent_name: string | null
          parent_phone: string | null
          updated_at: string
        }
        Insert: {
          behavior_points?: number
          class_id?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          is_demo?: boolean
          name: string
          national_id?: string | null
          notes?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          updated_at?: string
        }
        Update: {
          behavior_points?: number
          class_id?: string | null
          created_at?: string
          gender?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          national_id?: string | null
          notes?: string | null
          parent_name?: string | null
          parent_phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
        ]
      }
      timetables: {
        Row: {
          created_at: string
          file_url: string | null
          id: string
          payload: Json
          ref_id: string | null
          scope: string
          title: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_url?: string | null
          id?: string
          payload?: Json
          ref_id?: string | null
          scope: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_url?: string | null
          id?: string
          payload?: Json
          ref_id?: string | null
          scope?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_staff: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role:
        | "master"
        | "principal"
        | "teacher"
        | "print_manager"
        | "vice_principal"
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
        "master",
        "principal",
        "teacher",
        "print_manager",
        "vice_principal",
      ],
    },
  },
} as const
