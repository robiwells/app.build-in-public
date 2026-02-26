export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          github_id: number;
          username: string;
          avatar_url: string | null;
          bio: string | null;
          timezone: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          github_id: number;
          username: string;
          avatar_url?: string | null;
          bio?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          github_id?: number;
          username?: string;
          avatar_url?: string | null;
          bio?: string | null;
          timezone?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          url: string | null;
          slug: string | null;
          active: boolean;
          category: string | null;
          xp: number;
          level: number;
          hearts_count: number;
          comments_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          url?: string | null;
          slug?: string | null;
          active?: boolean;
          category?: string | null;
          xp?: number;
          level?: number;
          hearts_count?: number;
          comments_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          url?: string | null;
          slug?: string | null;
          active?: boolean;
          category?: string | null;
          xp?: number;
          level?: number;
          hearts_count?: number;
          comments_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "projects_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      project_repos: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          installation_id: number;
          repo_full_name: string;
          repo_url: string;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          installation_id: number;
          repo_full_name: string;
          repo_url: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          installation_id?: number;
          repo_full_name?: string;
          repo_url?: string;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_repos_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_repos_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      activities: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          project_repo_id: string | null;
          connector_source_id: string | null;
          connector_metadata: Json | null;
          date_utc: string;
          type: string;
          content_text: string | null;
          content_image_url: string | null;
          date_local: string | null;
          commit_count: number;
          first_commit_at: string | null;
          last_commit_at: string | null;
          github_link: string | null;
          commit_messages: string[] | null;
          hearts_count: number;
          comments_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          project_repo_id?: string | null;
          connector_source_id?: string | null;
          connector_metadata?: Json | null;
          date_utc: string;
          type?: string;
          content_text?: string | null;
          content_image_url?: string | null;
          date_local?: string | null;
          commit_count?: number;
          first_commit_at?: string | null;
          last_commit_at?: string | null;
          github_link?: string | null;
          commit_messages?: string[] | null;
          hearts_count?: number;
          comments_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string | null;
          project_repo_id?: string | null;
          connector_source_id?: string | null;
          connector_metadata?: Json | null;
          date_utc?: string;
          type?: string;
          content_text?: string | null;
          content_image_url?: string | null;
          date_local?: string | null;
          commit_count?: number;
          first_commit_at?: string | null;
          last_commit_at?: string | null;
          github_link?: string | null;
          commit_messages?: string[] | null;
          hearts_count?: number;
          comments_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "activities_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_project_repo_id_fkey";
            columns: ["project_repo_id"];
            isOneToOne: false;
            referencedRelation: "project_repos";
            referencedColumns: ["id"];
          }
        ];
      };
      hearts: {
        Row: {
          id: string;
          user_id: string;
          post_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          post_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          post_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "hearts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "hearts_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          }
        ];
      };
      comments: {
        Row: {
          id: string;
          post_id: string;
          user_id: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          post_id: string;
          user_id: string;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          post_id?: string;
          user_id?: string;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "comments_post_id_fkey";
            columns: ["post_id"];
            isOneToOne: false;
            referencedRelation: "activities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      project_hearts: {
        Row: {
          id: string;
          user_id: string;
          project_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          project_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_hearts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_hearts_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          }
        ];
      };
      project_comments: {
        Row: {
          id: string;
          project_id: string;
          user_id: string;
          body: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_id: string;
          body: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_id?: string;
          body?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_comments_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_comments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      webhook_events: {
        Row: {
          delivery_id: string;
          event_type: string;
          received_at: string;
        };
        Insert: {
          delivery_id: string;
          event_type: string;
          received_at?: string;
        };
        Update: {
          delivery_id?: string;
          event_type?: string;
          received_at?: string;
        };
        Relationships: [];
      };
      user_github_installations: {
        Row: {
          user_id: string;
          installation_id: number;
          created_at: string;
        };
        Insert: {
          user_id: string;
          installation_id: number;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          installation_id?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_github_installations_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_connectors: {
        Row: {
          id: string;
          user_id: string;
          type: string;
          external_id: string;
          display_name: string | null;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: string;
          external_id: string;
          display_name?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          type?: string;
          external_id?: string;
          display_name?: string | null;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_connectors_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      project_connector_sources: {
        Row: {
          id: string;
          project_id: string;
          user_connector_id: string;
          connector_type: string;
          external_id: string;
          display_name: string | null;
          url: string | null;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          user_connector_id: string;
          connector_type: string;
          external_id: string;
          display_name?: string | null;
          url?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          project_id?: string;
          user_connector_id?: string;
          connector_type?: string;
          external_id?: string;
          display_name?: string | null;
          url?: string | null;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_connector_sources_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "projects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_connector_sources_user_connector_id_fkey";
            columns: ["user_connector_id"];
            isOneToOne: false;
            referencedRelation: "user_connectors";
            referencedColumns: ["id"];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
