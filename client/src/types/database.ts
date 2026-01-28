export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  fileflow: {
    Tables: {
      access_log: {
        Row: {
          accessed_at: string | null
          action: string
          file_id: string | null
          folder_id: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          public_link_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          accessed_at?: string | null
          action: string
          file_id?: string | null
          folder_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          public_link_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          accessed_at?: string | null
          action?: string
          file_id?: string | null
          folder_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          public_link_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "access_log_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_log_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_log_public_link_id_fkey"
            columns: ["public_link_id"]
            isOneToOne: false
            referencedRelation: "public_links"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "access_log_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      activities: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string | null
          details: Json | null
          id: string
          resource_id: string | null
          resource_type: string | null
          user_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          resource_id?: string | null
          resource_type?: string | null
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          resource_id?: string | null
          resource_type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activities_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activities_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      file_chunks: {
        Row: {
          checksum: string | null
          chunk_number: number
          chunk_size: number
          file_id: string
          id: string
          storage_path: string
          uploaded_at: string | null
        }
        Insert: {
          checksum?: string | null
          chunk_number: number
          chunk_size: number
          file_id: string
          id?: string
          storage_path: string
          uploaded_at?: string | null
        }
        Update: {
          checksum?: string | null
          chunk_number?: number
          chunk_size?: number
          file_id?: string
          id?: string
          storage_path?: string
          uploaded_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "file_chunks_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          bucket_name: string | null
          created_at: string | null
          deleted_at: string | null
          dimensions: Json | null
          duration_seconds: number | null
          file_extension: string | null
          file_type: string
          folder_id: string | null
          id: string
          last_accessed_at: string | null
          metadata: Json | null
          name: string
          owner_id: string
          parent_version_id: string | null
          size_bytes: number
          starred: boolean | null
          storage_path: string
          tag_ids: string[] | null
          thumbnail_path: string | null
          updated_at: string | null
          upload_status: string | null
          version: number | null
          workspace_id: string | null
        }
        Insert: {
          bucket_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          dimensions?: Json | null
          duration_seconds?: number | null
          file_extension?: string | null
          file_type: string
          folder_id?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name: string
          owner_id: string
          parent_version_id?: string | null
          size_bytes: number
          starred?: boolean | null
          storage_path: string
          tag_ids?: string[] | null
          thumbnail_path?: string | null
          updated_at?: string | null
          upload_status?: string | null
          version?: number | null
          workspace_id?: string | null
        }
        Update: {
          bucket_name?: string | null
          created_at?: string | null
          deleted_at?: string | null
          dimensions?: Json | null
          duration_seconds?: number | null
          file_extension?: string | null
          file_type?: string
          folder_id?: string | null
          id?: string
          last_accessed_at?: string | null
          metadata?: Json | null
          name?: string
          owner_id?: string
          parent_version_id?: string | null
          size_bytes?: number
          starred?: boolean | null
          storage_path?: string
          tag_ids?: string[] | null
          thumbnail_path?: string | null
          updated_at?: string | null
          upload_status?: string | null
          version?: number | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "files_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "files_parent_version_id_fkey"
            columns: ["parent_version_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          color: string | null
          created_at: string | null
          deleted_at: string | null
          depth: number | null
          id: string
          is_root: boolean | null
          metadata: Json | null
          name: string
          owner_id: string
          parent_id: string | null
          path: string
          starred: boolean | null
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          deleted_at?: string | null
          depth?: number | null
          id?: string
          is_root?: boolean | null
          metadata?: Json | null
          name: string
          owner_id: string
          parent_id?: string | null
          path: string
          starred?: boolean | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          deleted_at?: string | null
          depth?: number | null
          id?: string
          is_root?: boolean | null
          metadata?: Json | null
          name?: string
          owner_id?: string
          parent_id?: string | null
          path?: string
          starred?: boolean | null
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "folders_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          added_at: string | null
          added_by: string | null
          group_id: string
          id: string
          role: string | null
          user_id: string
        }
        Insert: {
          added_at?: string | null
          added_by?: string | null
          group_id: string
          id?: string
          role?: string | null
          user_id: string
        }
        Update: {
          added_at?: string | null
          added_by?: string | null
          group_id?: string
          id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          metadata: Json | null
          name: string
          updated_at: string | null
          workspace_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          updated_at?: string | null
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "groups_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      permissions: {
        Row: {
          file_id: string | null
          folder_id: string | null
          granted_at: string | null
          granted_by: string
          group_id: string | null
          id: string
          inherited_from: string | null
          permission_level: string
          user_id: string | null
        }
        Insert: {
          file_id?: string | null
          folder_id?: string | null
          granted_at?: string | null
          granted_by: string
          group_id?: string | null
          id?: string
          inherited_from?: string | null
          permission_level: string
          user_id?: string | null
        }
        Update: {
          file_id?: string | null
          folder_id?: string | null
          granted_at?: string | null
          granted_by?: string
          group_id?: string | null
          id?: string
          inherited_from?: string | null
          permission_level?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "permissions_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissions_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissions_granted_by_fkey"
            columns: ["granted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissions_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissions_inherited_from_fkey"
            columns: ["inherited_from"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          display_name: string
          email: string
          id: string
          role: string | null
          storage_quota_bytes: number | null
          storage_used_bytes: number | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          display_name: string
          email: string
          id: string
          role?: string | null
          storage_quota_bytes?: number | null
          storage_used_bytes?: number | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          display_name?: string
          email?: string
          id?: string
          role?: string | null
          storage_quota_bytes?: number | null
          storage_used_bytes?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      public_links: {
        Row: {
          created_at: string | null
          created_by: string
          current_access_count: number | null
          expires_at: string | null
          file_id: string | null
          folder_id: string | null
          id: string
          link_token: string
          max_access_count: number | null
          password_hash: string | null
          permission_level: string | null
          requires_password: boolean | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          current_access_count?: number | null
          expires_at?: string | null
          file_id?: string | null
          folder_id?: string | null
          id?: string
          link_token: string
          max_access_count?: number | null
          password_hash?: string | null
          permission_level?: string | null
          requires_password?: boolean | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          current_access_count?: number | null
          expires_at?: string | null
          file_id?: string | null
          folder_id?: string | null
          id?: string
          link_token?: string
          max_access_count?: number | null
          password_hash?: string | null
          permission_level?: string | null
          requires_password?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "public_links_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_links_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "public_links_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
        ]
      }
      storage_plans: {
        Row: {
          created_at: string | null
          features: Json | null
          id: string
          max_file_size_bytes: number
          name: string
          quota_bytes: number
        }
        Insert: {
          created_at?: string | null
          features?: Json | null
          id?: string
          max_file_size_bytes: number
          name: string
          quota_bytes: number
        }
        Update: {
          created_at?: string | null
          features?: Json | null
          id?: string
          max_file_size_bytes?: number
          name?: string
          quota_bytes?: number
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string
          id: string
          name: string
          workspace_id: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by: string
          id?: string
          name: string
          workspace_id?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string
          id?: string
          name?: string
          workspace_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tags_created_by_fkey"
            columns: ["created_by"]
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
      get_file_permission: {
        Args: { p_file_id: string; p_user_id: string }
        Returns: string
      }
      search_files: {
        Args: { p_limit?: number; p_query: string; p_user_id: string }
        Returns: {
          created_at: string
          file_id: string
          file_name: string
          file_type: string
          folder_name: string
          size_bytes: number
        }[]
      }
      update_storage_used: {
        Args: { bytes_delta: number; user_id: string }
        Returns: undefined
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
  fileflow: {
    Enums: {},
  },
} as const
