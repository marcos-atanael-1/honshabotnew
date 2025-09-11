-- Queries para atualizar senha do usuário pmlean@demo.com
-- Execute no console SQL do Supabase

-- 1. Primeiro, verificar se o usuário existe
SELECT id, email, nome, role, email_verified, password_reset_required
FROM public.users 
WHERE email = 'pmlean@demo.com';

-- 2. Atualizar senha para uma senha conhecida (ex: 123456)
UPDATE public.users 
SET 
    password_hash = hash_password('123456'),
    email_verified = true,
    password_reset_required = false,
    is_temp_password = false,
    updated_at = NOW()
WHERE email = 'pmlean@demo.com';

-- 3. Verificar se a atualização funcionou
SELECT 
    id, 
    email, 
    nome, 
    role,
    email_verified,
    password_reset_required,
    is_temp_password,
    CASE 
        WHEN password_hash IS NOT NULL THEN 'Senha definida' 
        ELSE 'Sem senha' 
    END as status_senha
FROM public.users 
WHERE email = 'pmlean@demo.com';

-- 4. OPCIONAL: Tornar o usuário admin se necessário
UPDATE public.users 
SET role = 'admin' 
WHERE email = 'pmlean@demo.com';

-- 5. OPCIONAL: Marcar para trocar senha no próximo login
UPDATE public.users 
SET 
    password_reset_required = true,
    is_temp_password = true
WHERE email = 'pmlean@demo.com';

-- 6. Verificação final
SELECT 
    email,
    nome,
    role,
    email_verified,
    password_reset_required,
    is_temp_password,
    created_at
FROM public.users 
WHERE email = 'pmlean@demo.com';
