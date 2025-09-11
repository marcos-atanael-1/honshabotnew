import dropbox

# Pegue no painel do App Console do Dropbox
APP_KEY = "9tp8fq5oi875ugm"
APP_SECRET = "nzc4w09wdu07an3"

def main():
    auth_flow = dropbox.DropboxOAuth2FlowNoRedirect(
        APP_KEY,
        APP_SECRET,
        token_access_type='offline'  # offline = gera refresh_token
    )

    authorize_url = auth_flow.start()
    print("1. Vá para este link no navegador e faça login no Dropbox:")
    print(authorize_url)
    print("2. Clique em 'Allow' (Permitir) e copie o código exibido.")
    auth_code = input("3. Cole o código aqui: ").strip()

    oauth_result = auth_flow.finish(auth_code)

    print("\n✅ Tokens gerados com sucesso!\n")
    print("Access token (expira em 4h):", oauth_result.access_token)
    print("Refresh token (NÃO expira):", oauth_result.refresh_token)
    print("Guarde o refresh token no seu .env como abaixo:\n")
    print(f"DROPBOX_APP_KEY={APP_KEY}")
    print(f"DROPBOX_APP_SECRET={APP_SECRET}")
    print(f"DROPBOX_REFRESH_TOKEN={oauth_result.refresh_token}")

if __name__ == "__main__":
    main()
