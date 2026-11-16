export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      collections: {
        Row: {
          id: string
          user_id: string
          name: string
          cover_gradient: string | null
          item_count: number
          progress: number
          color: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          cover_gradient?: string | null
          item_count?: number
          progress?: number
          color?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          cover_gradient?: string | null
          item_count?: number
          progress?: number
          color?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      notes: {
        Row: {
          id: string
          user_id: string
          collection_id: string | null
          title: string
          type: string
          content: string
          summary: string | null
          takeaways: string[] | null
          tags: string[] | null
          saved_date: string | null
          saved_time: string | null
          pinned: boolean
          cover_image: string | null
          original_url: string | null
          audio_duration: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          collection_id?: string | null
          title: string
          type?: string
          content: string
          summary?: string | null
          takeaways?: string[] | null
          tags?: string[] | null
          saved_date?: string | null
          saved_time?: string | null
          pinned?: boolean
          cover_image?: string | null
          original_url?: string | null
          audio_duration?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          collection_id?: string | null
          title?: string
          type?: string
          content?: string
          summary?: string | null
          takeaways?: string[] | null
          tags?: string[] | null
          saved_date?: string | null
          saved_time?: string | null
          pinned?: boolean
          cover_image?: string | null
          original_url?: string | null
          audio_duration?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      tasks: {
        Row: {
          id: string
          note_id: string
          user_id: string
          text: string
          completed: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          note_id: string
          user_id: string
          text: string
          completed?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          note_id?: string
          user_id?: string
          text?: string
          completed?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      tags: {
        Row: {
          id: string
          user_id: string
          name: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          created_at?: string
          updated_at?: string
        }
      }
      attachments: {
        Row: {
          id: string
          note_id: string
          user_id: string
          name: string
          type: string
          url: string
          size_bytes: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          note_id: string
          user_id: string
          name: string
          type: string
          url: string
          size_bytes?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          note_id?: string
          user_id?: string
          name?: string
          type?: string
          url?: string
          size_bytes?: number | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}
