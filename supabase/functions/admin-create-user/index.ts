import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface CreateUserPayload {
  nome: string
  email: string
  role?: 'admin' | 'editor' | 'viewer'
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token de autenticação não fornecido.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Variáveis de ambiente do servidor não configuradas.',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Client with service_role privileges for admin operations
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Validate the caller's JWT token
    const token = authHeader.replace('Bearer ', '')
    const { data: callerUser, error: callerAuthError } = await adminClient.auth.getUser(token)

    if (callerAuthError || !callerUser?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado ou sessão inválida.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Verify caller role in profiles table
    const { data: callerProfile, error: profileError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', callerUser.user.id)
      .single()

    if (profileError || !callerProfile || callerProfile.role !== 'admin') {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Apenas administradores podem convidar novos usuários.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Parse body
    const body: CreateUserPayload = await req.json()
    const { nome, email, role = 'viewer' } = body

    if (!email || !nome) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nome e e-mail são obrigatórios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const validRoles = ['admin', 'editor', 'viewer']
    const assignedRole = validRoles.includes(role) ? role : 'viewer'

    // Create user in auth.users
    const { data: createdUserData, error: createError } = await adminClient.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { nome, role: assignedRole },
    })

    if (createError) {
      // If user already exists, let caller know clearly
      return new Response(JSON.stringify({ success: false, error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const newUserId = createdUserData.user.id

    // Ensure profile row exists with the specified role and nome
    const { error: upsertProfileError } = await adminClient.from('profiles').upsert({
      id: newUserId,
      email,
      nome,
      role: assignedRole,
      ativo: true,
      updated_at: new Date().toISOString(),
    })

    if (upsertProfileError) {
      console.error('Erro ao salvar profile:', upsertProfileError)
    }

    // Generate password recovery/setup link to send email/link
    try {
      await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email,
      })
    } catch (linkErr) {
      console.warn('Aviso ao gerar link de recuperação:', linkErr)
    }

    return new Response(JSON.stringify({ success: true, userId: newUserId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Erro interno do servidor.'
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
