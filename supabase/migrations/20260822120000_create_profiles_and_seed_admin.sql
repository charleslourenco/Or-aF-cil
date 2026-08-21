-- Migration: Create profiles table, trigger on_auth_user_created, is_admin helper, RLS policies and seed admin user

-- 1. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL DEFAULT '',
  nome TEXT DEFAULT '',
  role TEXT NOT NULL DEFAULT 'viewer',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure columns exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS nome TEXT DEFAULT '';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'viewer';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Check constraint for valid roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('admin', 'editor', 'viewer'));
  END IF;
END $$;

-- 2. Helper function to check if current user is admin (avoids infinite recursion in RLS)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND ativo = true
  );
$$;

-- Helper function to check if current user is admin or editor
CREATE OR REPLACE FUNCTION public.is_editor_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'editor') AND ativo = true
  );
$$;

-- 3. Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies for public.profiles:
-- SELECT: authenticated users can read all profiles
DROP POLICY IF EXISTS "authenticated_select_profiles" ON public.profiles;
CREATE POLICY "authenticated_select_profiles" ON public.profiles
  FOR SELECT TO authenticated USING (true);

-- INSERT: authenticated users / trigger can insert
DROP POLICY IF EXISTS "authenticated_insert_profiles" ON public.profiles;
CREATE POLICY "authenticated_insert_profiles" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (true);

-- UPDATE: admin can update any profile; regular users can update their own profile
DROP POLICY IF EXISTS "profiles_update_policy" ON public.profiles;
CREATE POLICY "profiles_update_policy" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- DELETE: only admin can delete
DROP POLICY IF EXISTS "profiles_delete_policy" ON public.profiles;
CREATE POLICY "profiles_delete_policy" ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- 4. Trigger to auto-create profile on auth.users insert
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nome, role, ativo)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.raw_user_meta_data->>'name', split_part(COALESCE(NEW.email, ''), '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer'),
    true
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    nome = COALESCE(NULLIF(EXCLUDED.nome, ''), public.profiles.nome),
    role = COALESCE(NULLIF(EXCLUDED.role, ''), public.profiles.role),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. Seed Admin User
DO $$
DECLARE
  admin_id uuid := gen_random_uuid();
  admin_email text := 'admin@orcafacil.com';
  admin_pass text := 'Admin123!@#';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = admin_email) THEN
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      created_at, updated_at, raw_app_meta_data, raw_user_meta_data,
      is_super_admin, role, aud,
      confirmation_token, recovery_token, email_change_token_new,
      email_change, email_change_token_current,
      phone, phone_change, phone_change_token, reauthentication_token
    ) VALUES (
      admin_id,
      '00000000-0000-0000-0000-000000000000',
      admin_email,
      crypt(admin_pass, gen_salt('bf')),
      NOW(), NOW(), NOW(),
      '{"provider": "email", "providers": ["email"]}',
      '{"nome": "Administrador", "role": "admin"}',
      false, 'authenticated', 'authenticated',
      '',    -- confirmation_token: MUST be '' not NULL
      '',    -- recovery_token: MUST be '' not NULL
      '',    -- email_change_token_new: MUST be '' not NULL
      '',    -- email_change: MUST be '' not NULL
      '',    -- email_change_token_current: MUST be '' not NULL
      NULL,  -- phone: MUST be NULL (not '') due to UNIQUE constraint
      '',    -- phone_change: MUST be '' not NULL
      '',    -- phone_change_token: MUST be '' not NULL
      ''     -- reauthentication_token: MUST be '' not NULL
    );

    INSERT INTO public.profiles (id, email, nome, role, ativo)
    VALUES (admin_id, admin_email, 'Administrador', 'admin', true)
    ON CONFLICT (id) DO UPDATE
    SET role = 'admin', nome = 'Administrador', ativo = true;
  ELSE
    -- If user already exists in auth.users, update password and ensure profile is admin
    UPDATE auth.users
    SET encrypted_password = crypt(admin_pass, gen_salt('bf')),
        raw_user_meta_data = '{"nome": "Administrador", "role": "admin"}',
        email_confirmed_at = COALESCE(email_confirmed_at, NOW())
    WHERE email = admin_email;

    UPDATE public.profiles
    SET role = 'admin', nome = 'Administrador', ativo = true
    WHERE email = admin_email;
  END IF;
END $$;
