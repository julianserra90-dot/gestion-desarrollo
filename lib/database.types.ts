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
      avances: {
        Row: {
          actualizado_en: string
          actualizado_por: string | null
          actualizado_por_nombre: string | null
          comentario: string | null
          estado: string
          fecha: string
          id: string
          obra_id: string
          porcentaje: number
          rubro_id: string
        }
        Insert: {
          actualizado_en?: string
          actualizado_por?: string | null
          actualizado_por_nombre?: string | null
          comentario?: string | null
          estado?: string
          fecha?: string
          id?: string
          obra_id: string
          porcentaje?: number
          rubro_id: string
        }
        Update: {
          actualizado_en?: string
          actualizado_por?: string | null
          actualizado_por_nombre?: string | null
          comentario?: string | null
          estado?: string
          fecha?: string
          id?: string
          obra_id?: string
          porcentaje?: number
          rubro_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "avances_actualizado_por_fkey"
            columns: ["actualizado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avances_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obra_resumen"
            referencedColumns: ["obra_id"]
          },
          {
            foreignKeyName: "avances_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "avances_rubro_id_fkey"
            columns: ["rubro_id"]
            isOneToOne: false
            referencedRelation: "rubros"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos: {
        Row: {
          categoria: string | null
          creado_en: string
          drive_file_id: string | null
          estado: string
          fecha: string
          id: string
          mime_type: string | null
          nombre: string
          obra_id: string
          storage_path: string | null
          subido_por: string | null
          subido_por_nombre: string | null
          tamano: number | null
          tipo: string | null
          version: string | null
        }
        Insert: {
          categoria?: string | null
          creado_en?: string
          drive_file_id?: string | null
          estado?: string
          fecha?: string
          id?: string
          mime_type?: string | null
          nombre: string
          obra_id: string
          storage_path?: string | null
          subido_por?: string | null
          subido_por_nombre?: string | null
          tamano?: number | null
          tipo?: string | null
          version?: string | null
        }
        Update: {
          categoria?: string | null
          creado_en?: string
          drive_file_id?: string | null
          estado?: string
          fecha?: string
          id?: string
          mime_type?: string | null
          nombre?: string
          obra_id?: string
          storage_path?: string | null
          subido_por?: string | null
          subido_por_nombre?: string | null
          tamano?: number | null
          tipo?: string | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obra_resumen"
            referencedColumns: ["obra_id"]
          },
          {
            foreignKeyName: "documentos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documentos_subido_por_fkey"
            columns: ["subido_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      empresas: {
        Row: {
          creado_en: string
          id: string
          nombre: string
        }
        Insert: {
          creado_en?: string
          id?: string
          nombre: string
        }
        Update: {
          creado_en?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      foto_registros: {
        Row: {
          creado_en: string
          descripcion: string | null
          estado: string
          fecha: string
          id: string
          obra_id: string
          rubro_id: string | null
          subido_por: string | null
          subido_por_nombre: string | null
        }
        Insert: {
          creado_en?: string
          descripcion?: string | null
          estado?: string
          fecha: string
          id?: string
          obra_id: string
          rubro_id?: string | null
          subido_por?: string | null
          subido_por_nombre?: string | null
        }
        Update: {
          creado_en?: string
          descripcion?: string | null
          estado?: string
          fecha?: string
          id?: string
          obra_id?: string
          rubro_id?: string | null
          subido_por?: string | null
          subido_por_nombre?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "foto_registros_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obra_resumen"
            referencedColumns: ["obra_id"]
          },
          {
            foreignKeyName: "foto_registros_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foto_registros_rubro_id_fkey"
            columns: ["rubro_id"]
            isOneToOne: false
            referencedRelation: "rubros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "foto_registros_subido_por_fkey"
            columns: ["subido_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
        ]
      }
      fotos: {
        Row: {
          creado_en: string
          drive_file_id: string | null
          id: string
          mime_type: string | null
          nombre: string | null
          orden: number
          registro_id: string
          storage_path: string | null
          tamano: number | null
        }
        Insert: {
          creado_en?: string
          drive_file_id?: string | null
          id?: string
          mime_type?: string | null
          nombre?: string | null
          orden?: number
          registro_id: string
          storage_path?: string | null
          tamano?: number | null
        }
        Update: {
          creado_en?: string
          drive_file_id?: string | null
          id?: string
          mime_type?: string | null
          nombre?: string | null
          orden?: number
          registro_id?: string
          storage_path?: string | null
          tamano?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fotos_registro_id_fkey"
            columns: ["registro_id"]
            isOneToOne: false
            referencedRelation: "foto_registros"
            referencedColumns: ["id"]
          },
        ]
      }
      gastos: {
        Row: {
          cargado_por: string | null
          comprobante_drive_id: string | null
          comprobante_mime: string | null
          comprobante_nombre: string | null
          comprobante_path: string | null
          comprobante_tamano: number | null
          concepto: string
          cotizacion: number | null
          creado_en: string
          empresa_pagadora_id: string
          empresa_receptora_id: string | null
          estado: string
          fecha: string
          id: string
          moneda: string
          monto: number
          monto_usd: number | null
          obra_id: string
          observaciones: string | null
          proveedor_id: string | null
          rubro_id: string | null
          tipo_gasto: string
          tipo_pago: string
        }
        Insert: {
          cargado_por?: string | null
          comprobante_drive_id?: string | null
          comprobante_mime?: string | null
          comprobante_nombre?: string | null
          comprobante_path?: string | null
          comprobante_tamano?: number | null
          concepto: string
          cotizacion?: number | null
          creado_en?: string
          empresa_pagadora_id: string
          empresa_receptora_id?: string | null
          estado?: string
          fecha: string
          id?: string
          moneda?: string
          monto: number
          monto_usd?: number | null
          obra_id: string
          observaciones?: string | null
          proveedor_id?: string | null
          rubro_id?: string | null
          tipo_gasto?: string
          tipo_pago?: string
        }
        Update: {
          cargado_por?: string | null
          comprobante_drive_id?: string | null
          comprobante_mime?: string | null
          comprobante_nombre?: string | null
          comprobante_path?: string | null
          comprobante_tamano?: number | null
          concepto?: string
          cotizacion?: number | null
          creado_en?: string
          empresa_pagadora_id?: string
          empresa_receptora_id?: string | null
          estado?: string
          fecha?: string
          id?: string
          moneda?: string
          monto?: number
          monto_usd?: number | null
          obra_id?: string
          observaciones?: string | null
          proveedor_id?: string | null
          rubro_id?: string | null
          tipo_gasto?: string
          tipo_pago?: string
        }
        Relationships: [
          {
            foreignKeyName: "gastos_cargado_por_fkey"
            columns: ["cargado_por"]
            isOneToOne: false
            referencedRelation: "perfiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_empresa_pagadora_id_fkey"
            columns: ["empresa_pagadora_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_empresa_receptora_id_fkey"
            columns: ["empresa_receptora_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obra_resumen"
            referencedColumns: ["obra_id"]
          },
          {
            foreignKeyName: "gastos_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_proveedor_id_fkey"
            columns: ["proveedor_id"]
            isOneToOne: false
            referencedRelation: "proveedores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gastos_rubro_id_fkey"
            columns: ["rubro_id"]
            isOneToOne: false
            referencedRelation: "rubros"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_socios: {
        Row: {
          empresa_id: string
          obra_id: string
          porcentaje: number
        }
        Insert: {
          empresa_id: string
          obra_id: string
          porcentaje: number
        }
        Update: {
          empresa_id?: string
          obra_id?: string
          porcentaje?: number
        }
        Relationships: [
          {
            foreignKeyName: "obra_socios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_socios_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obra_resumen"
            referencedColumns: ["obra_id"]
          },
          {
            foreignKeyName: "obra_socios_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obras: {
        Row: {
          archivada_en: string | null
          creado_en: string
          estado: string
          fecha_fin_estimada: string | null
          fecha_inicio: string | null
          id: string
          nombre: string
          presupuesto: number | null
          slug: string
          ubicacion: string | null
        }
        Insert: {
          archivada_en?: string | null
          creado_en?: string
          estado?: string
          fecha_fin_estimada?: string | null
          fecha_inicio?: string | null
          id?: string
          nombre: string
          presupuesto?: number | null
          slug: string
          ubicacion?: string | null
        }
        Update: {
          archivada_en?: string | null
          creado_en?: string
          estado?: string
          fecha_fin_estimada?: string | null
          fecha_inicio?: string | null
          id?: string
          nombre?: string
          presupuesto?: number | null
          slug?: string
          ubicacion?: string | null
        }
        Relationships: []
      }
      perfiles: {
        Row: {
          creado_en: string
          empresa_id: string | null
          id: string
          nombre: string
          rol: string
        }
        Insert: {
          creado_en?: string
          empresa_id?: string | null
          id: string
          nombre: string
          rol?: string
        }
        Update: {
          creado_en?: string
          empresa_id?: string | null
          id?: string
          nombre?: string
          rol?: string
        }
        Relationships: [
          {
            foreignKeyName: "perfiles_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
        ]
      }
      proveedores: {
        Row: {
          creado_en: string
          id: string
          nombre: string
          tipo: string
        }
        Insert: {
          creado_en?: string
          id?: string
          nombre: string
          tipo: string
        }
        Update: {
          creado_en?: string
          id?: string
          nombre?: string
          tipo?: string
        }
        Relationships: []
      }
      rubros: {
        Row: {
          id: string
          nombre: string
          obra_id: string | null
          orden: number
        }
        Insert: {
          id?: string
          nombre: string
          obra_id?: string | null
          orden?: number
        }
        Update: {
          id?: string
          nombre?: string
          obra_id?: string | null
          orden?: number
        }
        Relationships: [
          {
            foreignKeyName: "rubros_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obra_resumen"
            referencedColumns: ["obra_id"]
          },
          {
            foreignKeyName: "rubros_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      obra_balance: {
        Row: {
          ajustes: number | null
          empresa: string | null
          empresa_id: string | null
          le_corresponde: number | null
          obra_id: string | null
          pagado: number | null
          pagado_efectivo: number | null
          pagado_facturado: number | null
          porcentaje: number | null
          saldo: number | null
          total_obra: number | null
        }
        Relationships: [
          {
            foreignKeyName: "obra_socios_empresa_id_fkey"
            columns: ["empresa_id"]
            isOneToOne: false
            referencedRelation: "empresas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obra_socios_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obra_resumen"
            referencedColumns: ["obra_id"]
          },
          {
            foreignKeyName: "obra_socios_obra_id_fkey"
            columns: ["obra_id"]
            isOneToOne: false
            referencedRelation: "obras"
            referencedColumns: ["id"]
          },
        ]
      }
      obra_resumen: {
        Row: {
          avance_financiero: number | null
          avance_fisico: number | null
          cant_documentos: number | null
          cant_fotos: number | null
          cant_socios: number | null
          nombre: string | null
          obra_id: string | null
          presupuesto: number | null
          slug: string | null
          total_efectivo: number | null
          total_facturado: number | null
          total_gastado: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      auth_empresa_id: { Args: never; Returns: string }
      auth_es_admin: { Args: never; Returns: boolean }
      puede_ver_obra: { Args: { p_obra: string }; Returns: boolean }
      set_obra_socios: {
        Args: { p_obra: string; p_socios: Json }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
