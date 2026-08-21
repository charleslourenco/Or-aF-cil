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
    return new Response('ok', {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Token de autorização não fornecido.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Configuração do servidor incompleta (chaves ausentes).',
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Initialize Supabase admin client with service_role key
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Validate the caller's JWT token
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(token)

    if (callerError || !callerData?.user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sessão inválida ou expirada.' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Verify caller has admin permission
    const { data: callerProfile, error: callerProfileError } = await supabaseAdmin
      .from('profiles')
      .select('role, ativo')
      .eq('id', callerData.user.id)
      .single()

    if (
      callerProfileError ||
      !callerProfile ||
      callerProfile.role !== 'admin' ||
      callerProfile.ativo === false
    ) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Permissão negada. Apenas administradores podem convidar usuários.',
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // Parse request body
    const body: CreateUserPayload = await req.json()
    const nome = body.nome?.trim()
    const email = body.email?.trim().toLowerCase()
    const role = (body.role || 'viewer') as 'admin' | 'editor' | 'viewer'

    if (!email || !nome) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nome e e-mail são obrigatórios.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    const validRoles = ['admin', 'editor', 'viewer']
    const assignedRole = validRoles.includes(role) ? role : 'viewer'

    // 1. Create the user in auth.users with email_confirm: true and empty/temp password
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: '',
      email_confirm: true,
      user_metadata: {
        nome,
        role: assignedRole,
      },
    })

    if (createError) {
      return new Response(JSON.stringify({ success: false, error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const createdUser = userData.user
    const userId = createdUser.id

    // 2. Upsert the profile in public.profiles
    const { error: profileUpsertError } = await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email,
      nome,
      role: assignedRole,
      ativo: true,
      updated_at: new Date().toISOString(),
    })

    if (profileUpsertError) {
      console.error('Erro ao registrar perfil:', profileUpsertError)
      return new Response(
        JSON.stringify({
          success: false,
          error: `Usuário criado no Auth, mas ocorreu erro no perfil: ${profileUpsertError.message}`,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      )
    }

    // 3. Send password setup/recovery email so user can create their password
    let inviteNotice: string | null = null
    try {
      // Disparar link de recuperação de senha ou invite
      const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email)
      if (resetError) {
        console.warn('Aviso ao resetar senha para email:', resetError.message)
        // Fallback: tentar gerar recovery link
        await supabaseAdmin.auth.admin.generateLink({
          type: 'recovery',
          email,
        })
      }
    } catch (inviteErr: any) {
      console.warn('Falha no disparo do email de boas-vindas:', inviteErr?.message)
      inviteNotice =
        'Usuário criado, mas não foi possível enviar o email de definição de senha automaticamente.'
    }

    // 4. Return success response
    return new Response(
      JSON.stringify({
        success: true,
        user: {
          id: userId,
          email,
          nome,
          role: assignedRole,
        },
        notice: inviteNotice,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Erro interno do servidor.'
    console.error('Exceção na Edge Function admin-create-user:', err)
    return new Response(JSON.stringify({ success: false, error: errorMsg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
