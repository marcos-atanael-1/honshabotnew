# oauth_init.py
from __future__ import annotations
import os
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials

# Use o escopo mínimo necessário. 'drive.file' é o recomendado.
SCOPES = ["https://www.googleapis.com/auth/drive.file"]

# Se seus arquivos têm outro nome/caminho, ajuste aqui ou use variáveis de ambiente
CLIENT_SECRET_FILE = os.getenv("GOOGLE_CLIENT_SECRET_FILE", "oauth_client.json")
TOKEN_FILE = os.getenv("GOOGLE_TOKEN_FILE", "token.json")

def main():
    creds = None
    if os.path.exists(TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(TOKEN_FILE, SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # Abre o navegador para você logar na sua conta Google
            flow = InstalledAppFlow.from_client_secrets_file(CLIENT_SECRET_FILE, SCOPES)
            creds = flow.run_local_server(port=0)  # se não abrir, use flow.run_console()
        with open(TOKEN_FILE, "w") as f:
            f.write(creds.to_json())

    print(f"✅ Token salvo em: {TOKEN_FILE}")

if __name__ == "__main__":
    main()
