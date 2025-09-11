/*
  # Sincronizar usuários existentes do auth com a tabela users
  
  Esta migration garante que todos os usuários que existem em auth.users
  tenham registros correspondentes na tabela public.users
*/

-- Função para sincronizar usuários do auth para a tabela users
CREATE OR REPLACE FUNCTION sync_auth_users()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    auth_user RECORD;
BEGIN
    -- Iterar sobre todos os usuários em auth.users que não existem em public.users
    FOR auth_user IN 
        SELECT au.id, au.email, au.raw_user_meta_data, au.created_at, au.updated_at
        FROM auth.users au
        LEFT JOIN public.users pu ON au.id = pu.id
        WHERE pu.id IS NULL
    LOOP
        -- Inserir usuário na tabela public.users
        INSERT INTO public.users (
            id,
            email,
            nome,
            role,
            password_reset_required,
            is_temp_password,
            created_at,
            updated_at
        ) VALUES (
            auth_user.id,
            auth_user.email,
            COALESCE(auth_user.raw_user_meta_data->>'nome', split_part(auth_user.email, '@', 1)),
            'user',
            false,
            false,
            auth_user.created_at,
            COALESCE(auth_user.updated_at, auth_user.created_at)
        );
        
        RAISE NOTICE 'Synchronized user: %', auth_user.email;
    END LOOP;
END;
$$;

-- Executar a sincronização
SELECT sync_auth_users();

-- Remover a função após uso (opcional)
DROP FUNCTION sync_auth_users();
