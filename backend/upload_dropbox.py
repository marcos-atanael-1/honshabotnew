import os
import sys
import requests

# ==========================
# CONFIG: COLOQUE SEU TOKEN
# ==========================
TOKEN = "sl.u.AF83ov9sJ91atZQv8WcSOIE-4AEitLrB1qAruOtanA9g3izUGh-ah3Wvjcx-yvUqcqfbQunh8MIJTIHDHGxkfVxijnhR2pLUTrXI2_Sd2mN4dl0yf0BSv70MEvBJ8yMDfHzxsZAc5QTz7r3GOTbLH1Ln7BBn66y12t8W61FhLbI8tavC0Aj6BV8do7QTLPacg-JLoVDsEQR3KGYL2b37ttpSvm_KiSnIM6WXo5ZUgWIDvx5-NLFEe5SvS3f5oBL8RU8CpF1F5H8PSYgQpBk9GYtJ0fOZkNG7UtYaGRXcr2En6sIPX81QjmgiClF9jEI1BYkJlVGIZehHby_xbgxC5K2_CLBZmPUthVDxISxrfr6NNuwLHjhoveZWTBdQ5lDqWkDNhZMvkD0OSZkVGIUKKUMyWB6FfT2pczhg07tjrq9nWwf3VbpA4-y8n82QKdRr9_TqIIpYWVw32ohp8kFhqmvA3-4fY0S-ywJybGsH3x_njKojAVZPSlEBXiZ6I-kagHctakAmphucPrw7dfe4IkBiG8zdx-G0SY-6qRuHXASlhsaU4YJxTdWOSipwmxapDaiTQUZ3D5nFHLrrwnrjZOnJJKAzBvMk2moX5Aj1rWUaKXvfGIon8CTdckurA7GLWD-VJTJrYLCwrXNjddukf51FiGnqup3Y8ITVtyP4yrtuHiw3O5xaMrJabj2JRMGVHCFwF_D7EawGiZ12GjcshriG_jDf7udI2mdbSDNJw1gH2s9Gs1mbjbdqK78hgxbCBFQZLm8uk_ylkeAI_CKn9qCGGSslSHxGqtyyl_-y5VOd0XRiTTwrGAByMCY6Zzi1j-ccbk_TISy1hSdp3rdIzBujv1xAskYSTzGL9m5nnzpvs90cEexd029ZhWqaEd_RCwK2d6PqDse-ruRoIySfurkvHwHCnMQV4y2fe_Bc7grd8haGyxj8hdRz0J7wQJzY63sDAF61HZnN7rGj-J6XFruGWbXnRie9kVVpbgYvCf6jDqiWSA5cWh_0y4PSaU2zzZ8m_I3fKMuSgT7NO5BI9Mj8usNhlhHa-ZR6aJOpGYJysSSpe9HZ50dG6tCPJbcwv0YI-HI57OQCFGleUvb9UqITd4iO6uFfRaXlMVhh4AA79P7BNkUxkRj96WxE9NV_q4yP9rz6jOlSZ8FRJulHrUNX62WXKa2EkWmV8x2ucglXZpAZBtMSbIEw-32MJALJZCc031MTj6ZYBH90HUIE0WDVXIpYLQU60Jq-LbqTGQdPowhjeenQbzJgfSEqo7uVKaJrGotY1PLBEDWI0URUwStrKyYIP1JJhI3TNqfWDYPygQ"  # <-- substitua aqui

# Endpoints
CONTENT_UPLOAD_URL = "https://content.dropboxapi.com/2/files/upload"
UPLOAD_SESSION_START_URL = "https://content.dropboxapi.com/2/files/upload_session/start"
UPLOAD_SESSION_APPEND_URL = "https://content.dropboxapi.com/2/files/upload_session/append_v2"
UPLOAD_SESSION_FINISH_URL = "https://content.dropboxapi.com/2/files/upload_session/finish"

CHUNK_SIZE = 8 * 1024 * 1024  # 8MB

def upload_small(local_path: str, dropbox_path: str, mode: str = "overwrite"):
    """
    Upload para arquivos <= 150MB via /files/upload.
    """
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/octet-stream",
        "Dropbox-API-Arg": (
            f'{{"path":"{dropbox_path}","mode":"{mode}","autorename":false,'
            f'"mute":false,"strict_conflict":false}}'
        ),
    }
    with open(local_path, "rb") as f:
        data = f.read()
    r = requests.post(CONTENT_UPLOAD_URL, headers=headers, data=data, timeout=120)
    if r.status_code != 200:
        raise RuntimeError(f"Falha no upload: {r.status_code} {r.text}")
    return r.json()

def upload_large(local_path: str, dropbox_path: str, mode: str = "overwrite"):
    """
    Upload para arquivos > 150MB usando sessões (start/append/finish).
    """
    file_size = os.path.getsize(local_path)
    with open(local_path, "rb") as f:
        # 1) start
        headers = {
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": '{"close": false}',
        }
        first_chunk = f.read(CHUNK_SIZE)
        r = requests.post(UPLOAD_SESSION_START_URL, headers=headers, data=first_chunk, timeout=120)
        if r.status_code != 200:
            raise RuntimeError(f"Falha ao iniciar sessão: {r.status_code} {r.text}")
        session_id = r.json()["session_id"]

        # 2) append
        offset = len(first_chunk)
        while offset < file_size:
            chunk = f.read(CHUNK_SIZE)
            headers = {
                "Authorization": f"Bearer {TOKEN}",
                "Content-Type": "application/octet-stream",
                "Dropbox-API-Arg": (
                    f'{{"cursor": {{"session_id":"{session_id}","offset": {offset}}}, "close": false}}'
                ),
            }
            r = requests.post(UPLOAD_SESSION_APPEND_URL, headers=headers, data=chunk, timeout=120)
            if r.status_code != 200:
                raise RuntimeError(f"Falha no append: {r.status_code} {r.text}")
            offset += len(chunk)

        # 3) finish
        headers = {
            "Authorization": f"Bearer {TOKEN}",
            "Content-Type": "application/octet-stream",
            "Dropbox-API-Arg": (
                f'{{"cursor": {{"session_id":"{session_id}","offset": {file_size}}},'
                f'"commit": {{"path":"{dropbox_path}","mode":"{mode}",'
                f'"autorename": false, "mute": false, "strict_conflict": false}}}}'
            ),
        }
        r = requests.post(UPLOAD_SESSION_FINISH_URL, headers=headers, data=b"", timeout=120)
        if r.status_code != 200:
            raise RuntimeError(f"Falha ao finalizar sessão: {r.status_code} {r.text}")
        return r.json()

def create_shared_link(dropbox_path: str) -> str:
    """
    Cria (ou obtém) link compartilhável do arquivo.
    Retorna a URL de visualização do Dropbox (dl=0).
    """
    api_create = "https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings"
    api_list   = "https://api.dropboxapi.com/2/sharing/list_shared_links"
    headers = {
        "Authorization": f"Bearer {TOKEN}",
        "Content-Type": "application/json"
    }

    # Tenta criar
    payload_create = {
        "path": dropbox_path,
        "settings": {"requested_visibility": "public"}  # pode depender das permissões da conta/equipe
    }
    r = requests.post(api_create, headers=headers, json=payload_create, timeout=60)
    if r.status_code == 200:
        return r.json().get("url")

    # Se já existir, lista e retorna
    if "shared_link_already_exists" in r.text:
        r2 = requests.post(api_list, headers=headers, json={"path": dropbox_path}, timeout=60)
        if r2.status_code == 200:
            links = r2.json().get("links", [])
            if links:
                return links[0]["url"]

    raise RuntimeError(f"Erro ao criar/obter link: {r.status_code} {r.text}")

def to_direct_download(url: str) -> str:
    """
    Converte link do Dropbox (dl=0) para download direto (dl=1), se aplicável.
    """
    if url is None:
        return url
    if "dl=0" in url:
        return url.replace("dl=0", "dl=1")
    if "?dl=0" not in url and "?dl=1" not in url:
        # alguns links vêm com ?rlkey=...&dl=0; tenta garantir dl=1
        if "dropbox.com" in url:
            sep = "&" if "?" in url else "?"
            return f"{url}{sep}dl=1"
    return url

def main():
    if len(sys.argv) < 2 or len(sys.argv) > 3:
        print("Uso: python upload_dropbox.py <caminho_local> [<caminho_dropbox>]")
        print('Ex.:  python upload_dropbox.py requirements.txt "/Honsha Bot/requirements.txt"')
        print('Ex.:  python upload_dropbox.py requirements.txt   (envia para "/requirements.txt")')
        sys.exit(1)

    local_path = sys.argv[1]
    if len(sys.argv) == 3:
        dropbox_path = sys.argv[2]
    else:
        # padrão: raiz com o mesmo nome
        dropbox_path = "/" + os.path.basename(local_path)

    if not os.path.isfile(local_path):
        print(f"Arquivo não encontrado: {local_path}")
        sys.exit(1)

    try:
        file_size = os.path.getsize(local_path)
        if file_size <= 150 * 1024 * 1024:
            resp = upload_small(local_path, dropbox_path)
        else:
            resp = upload_large(local_path, dropbox_path)

        name = resp.get("name")
        path_lower = resp.get("path_lower")
        rev = resp.get("rev")
        size_mb = resp.get("size", 0) / (1024 * 1024)

        print("Upload concluído ✅")
        print(f"Nome: {name}")
        print(f"Caminho: {path_lower}")
        print(f"Rev: {rev}")
        print(f"Tamanho: {size_mb:.2f} MB")

        # Link público
        link = create_shared_link(dropbox_path)
        print(f"Link (visualização): {link}")
        print(f"Link (download direto): {to_direct_download(link)}")

    except Exception as e:
        print(f"Erro: {e}")
        sys.exit(2)

if __name__ == "__main__":
    main()
