-- QUICK PASSWORD UPDATE para pmlean@demo.com
-- Execute no console SQL do Supabase

-- OPÇÃO 1: Senha simples (123456) - sem trocar no próximo login
UPDATE public.users 
SET 
    password_hash = hash_password('123456'),
    email_verified = true,
    password_reset_required = false,
    is_temp_password = false,
    role = 'admin',
    updated_at = NOW()
WHERE email = 'pmlean@demo.com';

-- OPÇÃO 2: Senha temporária - obriga trocar no próximo login
UPDATE public.users 
SET 
    password_hash = hash_password('TempPassword123!'),
    email_verified = true,
    password_reset_required = true,
    is_temp_password = true,
    role = 'admin',
    updated_at = NOW()
WHERE email = 'pmlean@demo.com';

-- OPÇÃO 3: Se o usuário não existir, criar do zero
INSERT INTO public.users (
    id, email, nome, role, password_hash, 
    email_verified, password_reset_required, is_temp_password,
    created_at, updated_at
) 
SELECT 
    gen_random_uuid(),
    'pmlean@demo.com',
    'PM Lean',
    'admin',
    hash_password('123456'),
    true,
    false,
    false,
    NOW(),
    NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM public.users WHERE email = 'pmlean@demo.com'
);

-- Verificar resultado final
SELECT 
    id,
    email,
    nome,
    role,
    email_verified,
    password_reset_required,
    is_temp_password,
    'Senha atualizada com sucesso!' as status
FROM public.users 
WHERE email = 'pmlean@demo.com';
