// AVOID UPDATING THIS FILE DIRECTLY. It is automatically generated.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: '14.5'
  }
  public: {
    Tables: {
      CatalogoMateriais: {
        Row: {
          ativo: boolean
          categoria: string
          created_at: string
          id: string
          nivel_padrao: string
          nome_material: string
          preco_custo: number
          unidade: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          categoria: string
          created_at?: string
          id?: string
          nivel_padrao?: string
          nome_material: string
          preco_custo: number
          unidade: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          categoria?: string
          created_at?: string
          id?: string
          nivel_padrao?: string
          nome_material?: string
          preco_custo?: number
          unidade?: string
          updated_at?: string
        }
        Relationships: []
      }
      comissoes_personalizadas: {
        Row: {
          config_id: string
          created_at: string
          id: string
          nome: string
          percentual: number
        }
        Insert: {
          config_id: string
          created_at?: string
          id?: string
          nome?: string
          percentual?: number
        }
        Update: {
          config_id?: string
          created_at?: string
          id?: string
          nome?: string
          percentual?: number
        }
        Relationships: [
          {
            foreignKeyName: 'comissoes_personalizadas_config_id_fkey'
            columns: ['config_id']
            isOneToOne: false
            referencedRelation: 'configuracoes_engenharia'
            referencedColumns: ['id']
          },
        ]
      }
      configuracoes_engenharia: {
        Row: {
          comissoes_percent: number
          created_at: string
          custo_financeiro_percent: number
          id: string
          impostos_percent: number
          markup_padrao: number
          meta_faturamento: number
          perda_material_percent: number
          updated_at: string
        }
        Insert: {
          comissoes_percent?: number
          created_at?: string
          custo_financeiro_percent?: number
          id?: string
          impostos_percent?: number
          markup_padrao?: number
          meta_faturamento?: number
          perda_material_percent?: number
          updated_at?: string
        }
        Update: {
          comissoes_percent?: number
          created_at?: string
          custo_financeiro_percent?: number
          id?: string
          impostos_percent?: number
          markup_padrao?: number
          meta_faturamento?: number
          perda_material_percent?: number
          updated_at?: string
        }
        Relationships: []
      }
      custos_fixos: {
        Row: {
          config_id: string
          created_at: string
          descricao: string
          id: string
          valor: number
        }
        Insert: {
          config_id: string
          created_at?: string
          descricao: string
          id?: string
          valor?: number
        }
        Update: {
          config_id?: string
          created_at?: string
          descricao?: string
          id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: 'custos_fixos_config_id_fkey'
            columns: ['config_id']
            isOneToOne: false
            referencedRelation: 'configuracoes_engenharia'
            referencedColumns: ['id']
          },
        ]
      }
      custos_variaveis: {
        Row: {
          config_id: string
          created_at: string
          descricao: string
          id: string
          valor: number
        }
        Insert: {
          config_id: string
          created_at?: string
          descricao: string
          id?: string
          valor?: number
        }
        Update: {
          config_id?: string
          created_at?: string
          descricao?: string
          id?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: 'custos_variaveis_config_id_fkey'
            columns: ['config_id']
            isOneToOne: false
            referencedRelation: 'configuracoes_engenharia'
            referencedColumns: ['id']
          },
        ]
      }
      Orcamentos: {
        Row: {
          ambiente: string | null
          bom_json: Json | null
          cliente_nome: string
          created_at: string | null
          data: string | null
          dimensoes_json: Json | null
          dre_json: Json | null
          forma_pagamento: string | null
          id: string
          mdf_externo: string | null
          mdf_fundo: string | null
          mdf_interno: string | null
          modulo: string | null
          numero_sequencial: number
          observacoes: string | null
          padrao_projeto: string | null
          status: string | null
          updated_at: string | null
          valor_total: number | null
        }
        Insert: {
          ambiente?: string | null
          bom_json?: Json | null
          cliente_nome: string
          created_at?: string | null
          data?: string | null
          dimensoes_json?: Json | null
          dre_json?: Json | null
          forma_pagamento?: string | null
          id?: string
          mdf_externo?: string | null
          mdf_fundo?: string | null
          mdf_interno?: string | null
          modulo?: string | null
          numero_sequencial?: number
          observacoes?: string | null
          padrao_projeto?: string | null
          status?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Update: {
          ambiente?: string | null
          bom_json?: Json | null
          cliente_nome?: string
          created_at?: string | null
          data?: string | null
          dimensoes_json?: Json | null
          dre_json?: Json | null
          forma_pagamento?: string | null
          id?: string
          mdf_externo?: string | null
          mdf_fundo?: string | null
          mdf_interno?: string | null
          modulo?: string | null
          numero_sequencial?: number
          observacoes?: string | null
          padrao_projeto?: string | null
          status?: string | null
          updated_at?: string | null
          valor_total?: number | null
        }
        Relationships: []
      }
      perfil_empresa: {
        Row: {
          bairro: string | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          complemento: string | null
          created_at: string
          email_comercial: string | null
          estado: string | null
          facebook: string | null
          id: string
          inscricao_estadual: string | null
          instagram: string | null
          logo_url: string | null
          logradouro: string | null
          nome_fantasia: string | null
          numero: string | null
          razao_social: string | null
          site: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          email_comercial?: string | null
          estado?: string | null
          facebook?: string | null
          id?: string
          inscricao_estadual?: string | null
          instagram?: string | null
          logo_url?: string | null
          logradouro?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          razao_social?: string | null
          site?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          bairro?: string | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          complemento?: string | null
          created_at?: string
          email_comercial?: string | null
          estado?: string | null
          facebook?: string | null
          id?: string
          inscricao_estadual?: string | null
          instagram?: string | null
          logo_url?: string | null
          logradouro?: string | null
          nome_fantasia?: string | null
          numero?: string | null
          razao_social?: string | null
          site?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string
          id: string
          nome: string | null
          role: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string
          id: string
          nome?: string | null
          role?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string
          id?: string
          nome?: string | null
          role?: string
          updated_at?: string
        }
        Relationships: []
      }
      templatesengenharia: {
        Row: {
          assinatura_visual: Json | null
          ativo: boolean | null
          id: string
          nome_template: string
          regras_json: Json | null
        }
        Insert: {
          assinatura_visual?: Json | null
          ativo?: boolean | null
          id?: string
          nome_template: string
          regras_json?: Json | null
        }
        Update: {
          assinatura_visual?: Json | null
          ativo?: boolean | null
          id?: string
          nome_template?: string
          regras_json?: Json | null
        }
        Relationships: []
      }
      TemplatesEngenharia: {
        Row: {
          assinatura_visual: string[] | null
          categoria: string | null
          codigo: string | null
          created_at: string
          descricao: string | null
          dimensoes: string | null
          ferragens: Json | null
          icon_type: string
          id: string
          imagem_url: string | null
          material: string | null
          nome_template: string
          pecas_mdf: Json | null
          updated_at: string
        }
        Insert: {
          assinatura_visual?: string[] | null
          categoria?: string | null
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          dimensoes?: string | null
          ferragens?: Json | null
          icon_type?: string
          id?: string
          imagem_url?: string | null
          material?: string | null
          nome_template: string
          pecas_mdf?: Json | null
          updated_at?: string
        }
        Update: {
          assinatura_visual?: string[] | null
          categoria?: string | null
          codigo?: string | null
          created_at?: string
          descricao?: string | null
          dimensoes?: string | null
          ferragens?: Json | null
          icon_type?: string
          id?: string
          imagem_url?: string | null
          material?: string | null
          nome_template?: string
          pecas_mdf?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_admin: { Args: never; Returns: boolean }
      is_editor_or_admin: { Args: never; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema['Tables']
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema['Enums']
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema['CompositeTypes']
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
