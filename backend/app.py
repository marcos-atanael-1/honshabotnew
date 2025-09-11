import os
import shutil
import uuid
import subprocess
import mimetypes
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import httpx
import requests
from pydub import AudioSegment
import dropbox
from supabase import create_client, Client
from datetime import datetime

load_dotenv()

# =============================================================================
# Config
# =============================================================================
DROPBOX_ACCESS_TOKEN = os.getenv("DROPBOX_ACCESS_TOKEN", "")
DROPBOX_APP_KEY = os.getenv("DROPBOX_APP_KEY", "")
DROPBOX_APP_SECRET = os.getenv("DROPBOX_APP_SECRET", "")
DROPBOX_REFRESH_TOKEN = os.getenv("DROPBOX_REFRESH_TOKEN", "")
TRANSKRIPTOR_API_URL = os.getenv("TRANSKRIPTOR_API_URL", "https://api.tor.app/developer/transcription/url")
TRANSKRIPTOR_API_KEY = os.getenv("TRANSKRIPTOR_API_KEY", "")

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY", "")
SUPABASE_TABLE = os.getenv("SUPABASE_TABLE", "transcricoes")

# >>> NOVO: compressão por bitrate-alvo (kbps), sem teto fixo de MB
TARGET_KBPS = int(os.getenv("TARGET_KBPS", "64"))

DEFAULT_LANGUAGE = os.getenv("DEFAULT_LANGUAGE", "pt-BR")
DEFAULT_SERVICE = os.getenv("DEFAULT_SERVICE", "Standard")
CALLBACK_URL = os.getenv("CALLBACK_URL", "")
REFERENCE_PREFIX = os.getenv("REFERENCE_PREFIX", "dropbox")

WORK_DIR = Path(os.getenv("WORK_DIR", "./tmp")).resolve()
WORK_DIR.mkdir(parents=True, exist_ok=True)

# Checagens básicas
if not DROPBOX_REFRESH_TOKEN or not DROPBOX_APP_KEY or not DROPBOX_APP_SECRET:
    raise RuntimeError("Faltam DROPBOX_REFRESH_TOKEN, DROPBOX_APP_KEY ou DROPBOX_APP_SECRET no .env")
if not TRANSKRIPTOR_API_KEY:
    raise RuntimeError("Falta TRANSKRIPTOR_API_KEY no .env")
if not SUPABASE_URL or not SUPABASE_ANON_KEY:
    raise RuntimeError("Faltam SUPABASE_URL e/ou SUPABASE_ANON_KEY no .env")

# Função para renovar token Dropbox
def refresh_dropbox_token():
    """Renova o access token do Dropbox usando o refresh token"""
    try:
        import requests
        
        data = {
            'grant_type': 'refresh_token',
            'refresh_token': DROPBOX_REFRESH_TOKEN,
            'client_id': DROPBOX_APP_KEY,
            'client_secret': DROPBOX_APP_SECRET
        }
        
        response = requests.post('https://api.dropboxapi.com/oauth2/token', data=data)
        response.raise_for_status()
        
        token_data = response.json()
        return token_data['access_token']
    except Exception as e:
        raise RuntimeError(f"Erro ao renovar token Dropbox: {e}")

# Dropbox client com token renovado
try:
    # Tenta usar o access token atual, se falhar renova
    if DROPBOX_ACCESS_TOKEN:
        dbx = dropbox.Dropbox(DROPBOX_ACCESS_TOKEN)
        # Testa se o token ainda é válido
        dbx.users_get_current_account()
    else:
        raise dropbox.exceptions.AuthError("Token inválido")
except (dropbox.exceptions.AuthError, Exception):
    # Token expirado ou inválido, renova
    print("Token Dropbox expirado, renovando...")
    new_token = refresh_dropbox_token()
    dbx = dropbox.Dropbox(new_token)
    print("Token Dropbox renovado com sucesso!")

# Supabase client
supabase: Optional[Client] = None
try:
    supabase = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)
except Exception as e:
    raise RuntimeError(f"Erro criando cliente Supabase: {e}")

# =============================================================================
# App
# =============================================================================
app = FastAPI(title="Uploader → MP3 (compressão por bitrate) → Dropbox → Transkriptor → Supabase")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# =============================================================================
# Utilitários
# =============================================================================
def is_video_mimetype(mtype: str) -> bool:
    return mtype.startswith("video/")

def is_audio_mimetype(mtype: str) -> bool:
    return mtype.startswith("audio/")

def ensure_ffmpeg() -> None:
    try:
        subprocess.run(["ffmpeg", "-version"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    except Exception:
        raise HTTPException(status_code=500, detail="ffmpeg não encontrado no sistema. Instale o ffmpeg.")

def run_ffmpeg_extract_audio(input_path: Path, output_mp3: Path, bitrate_kbps: int) -> None:
    """
    Extrai áudio de vídeo direto já no bitrate-alvo (CBR), para reduzir bastante.
    """
    cmd = [
        "ffmpeg", "-y",
        "-i", str(input_path),
        "-vn",
        "-ar", "44100",
        "-ac", "2",
        "-b:a", f"{bitrate_kbps}k",
        str(output_mp3)
    ]
    subprocess.run(cmd, check=True)

def transcode_audio_to_mp3(input_path: Path, output_mp3: Path, bitrate_kbps: int) -> None:
    """
    Converte qualquer áudio para MP3 no bitrate-alvo.
    """
    ensure_ffmpeg()
    audio = AudioSegment.from_file(input_path)
    audio.export(output_mp3, format="mp3", bitrate=f"{bitrate_kbps}k")

def upload_to_dropbox(local_path: Path, dropbox_dest_path: str) -> str:
    """
    Sobe arquivo e cria/obtém link compartilhável.
    Retorna URL público (ex.: ...?dl=0).
    Inclui renovação automática do token se necessário.
    """
    global dbx
    
    def _try_upload():
        with local_path.open("rb") as f:
            dbx.files_upload(f.read(), dropbox_dest_path, mode=dropbox.files.WriteMode("overwrite"))

        try:
            link = dbx.sharing_create_shared_link_with_settings(dropbox_dest_path)
            return link.url
        except dropbox.exceptions.ApiError:
            res = dbx.sharing_list_shared_links(path=dropbox_dest_path, direct_only=True)
            if res.links:
                return res.links[0].url
            else:
                raise
    
    try:
        return _try_upload()
    except dropbox.exceptions.AuthError:
        # Token expirado, renova e tenta novamente
        print("Token Dropbox expirado durante upload, renovando...")
        new_token = refresh_dropbox_token()
        dbx = dropbox.Dropbox(new_token)
        print("Token renovado, tentando upload novamente...")
        return _try_upload()

async def send_to_transkriptor(file_url: str, language: str, service: str, callback_url: str, reference: str) -> str:
    headers = {
        "Authorization": f"Bearer {TRANSKRIPTOR_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload = {
        "url": file_url,
        "language": language,
        "service": service,
        "callback_url": callback_url,
        "reference": reference
    }
    async with httpx.AsyncClient(timeout=120) as client:
        r = await client.post(TRANSKRIPTOR_API_URL, headers=headers, json=payload)
        if r.status_code >= 400:
            raise HTTPException(status_code=502, detail=f"Erro Transkriptor: {r.text}")
        data = r.json()
        order_id = data.get("order_id")
        if not order_id:
            raise HTTPException(status_code=502, detail=f"Resposta inesperada do Transkriptor: {data}")
        return order_id

def supabase_insert(processo_id: str, filename: str, order_id: str = "", status: str = "processando", 
                   conteudo: str = "", dropbox_url: str = "", dropbox_filename: str = "", 
                   tipo_transcricao: str = "") -> dict:
    """Insere registro na tabela transcricoes com a nova estrutura"""
    if not supabase:
        raise HTTPException(status_code=500, detail="Cliente Supabase não inicializado.")
    
    # Dados para inserção na tabela transcricoes
    insert_data = {
        "processo_id": processo_id,
        "conteudo": conteudo,
        "status": status,
        "tempo_processamento": 0,  # Será atualizado quando a transcrição for concluída
        "dropbox_url": dropbox_url,
        "order_id": order_id,
        "dropbox_filename": dropbox_filename
    }
    
    # Adiciona tipo_transcricao se fornecido
    if tipo_transcricao:
        insert_data["tipo_transcricao"] = tipo_transcricao
    
    resp = supabase.table(SUPABASE_TABLE).insert(insert_data).execute()
    return resp.data[0] if getattr(resp, "data", None) else {}

# =============================================================================
# Endpoint principal
# =============================================================================
@app.post("/upload")
async def upload(processo_id: str,
                 file: UploadFile = File(...),
                 language: Optional[str] = None,
                 service: Optional[str] = None,
                 reference: Optional[str] = None,
                 tipo_transcricao: Optional[str] = Form(None)):
    """
    Fluxo:
      - recebe upload
      - vídeo → extrai MP3 já no bitrate-alvo (TARGET_KBPS)
      - áudio → converte/reencoda para MP3 (TARGET_KBPS)
      - sobe no Dropbox (raiz) e cria link público
      - envia URL ao Transkriptor
      - grava registro no Supabase (status Em Andamento; transcription vazia)
    """
    language = language or DEFAULT_LANGUAGE
    service = service or DEFAULT_SERVICE
    ref = reference or f"{REFERENCE_PREFIX}-{uuid.uuid4().hex[:8]}"

    # Salvar upload original
    suffix = Path(file.filename or f"upload-{uuid.uuid4().hex}").suffix or ""
    orig_path = WORK_DIR / f"orig-{uuid.uuid4().hex}{suffix}"
    with orig_path.open("wb") as out:
        shutil.copyfileobj(file.file, out)

    # Detectar mimetype (fallback por extensão)
    mtype = file.content_type or mimetypes.guess_type(str(orig_path))[0] or ""

    # Arquivo MP3 final (sempre reencodado para reduzir bastante o tamanho)
    mp3_final = WORK_DIR / f"final-{uuid.uuid4().hex}.mp3"

    try:
        if is_video_mimetype(mtype):
            ensure_ffmpeg()
            run_ffmpeg_extract_audio(orig_path, mp3_final, TARGET_KBPS)
        elif is_audio_mimetype(mtype):
            # Se já é mp3, ainda assim reencodamos para TARGET_KBPS para redução agressiva.
            transcode_audio_to_mp3(orig_path, mp3_final, TARGET_KBPS)
        else:
            raise HTTPException(status_code=400, detail=f"Tipo de arquivo não suportado: {mtype or 'desconhecido'}")

        # Sobe no Dropbox (na raiz). Nome limpo e estável:
        safe_name = Path(file.filename or "audio.mp3").stem
        safe_name = "".join(c for c in safe_name if c.isalnum() or c in ("-", "_")).strip() or "audio"
        dropbox_dest = f"/{safe_name}.mp3"

        public_url = upload_to_dropbox(mp3_final, dropbox_dest)

        # Envia ao Transkriptor
        order_id = await send_to_transkriptor(
            file_url=public_url,
            language=language,
            service=service,
            callback_url=CALLBACK_URL,
            reference=ref
        )

        # Grava no Supabase com a nova estrutura
        row = supabase_insert(
            processo_id=processo_id,
            filename=f"{safe_name}.mp3",
            order_id=order_id,
            status="Em Andamento",
            conteudo="",  # Será preenchido quando a transcrição for concluída
            dropbox_url=public_url,
            dropbox_filename=f"{safe_name}.mp3",
            tipo_transcricao=tipo_transcricao or ""
        )

        return JSONResponse({
            "message": "Arquivo processado e enviado ao Transkriptor.",
            "dropbox_url": public_url,
            "order_id": order_id,
            "supabase_row": row,
            "target_kbps": TARGET_KBPS
        })

    except HTTPException:
        raise
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"Erro no ffmpeg: {e}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Falha no processamento: {e}")
    finally:
        # limpeza
        for p in (orig_path, mp3_final):
            try:
                if p.exists():
                    p.unlink()
            except Exception:
                pass


@app.get("/status", tags=["Health"])
async def status(deep: bool = False):
    """
    Health check.
    - deep=false (default): resposta rápida.
    - deep=true  (ou ?deep=1): roda checagens em ffmpeg, Dropbox e Supabase.
    """
    details = {
        "app": "Uploader → MP3 → Dropbox → Transkriptor → Supabase",
        "time_utc": datetime.utcnow().isoformat() + "Z",
        "status": "ok",
        "deep_checks": {}
    }

    if deep:
        # ffmpeg
        try:
            ensure_ffmpeg()
            details["deep_checks"]["ffmpeg"] = "ok"
        except Exception as e:
            details["deep_checks"]["ffmpeg"] = f"error: {e}"
            details["status"] = "degraded"

        # Dropbox
        try:
            dbx.users_get_current_account()
            details["deep_checks"]["dropbox"] = "ok"
        except Exception as e:
            details["deep_checks"]["dropbox"] = f"error: {e}"
            details["status"] = "degraded"

        # Supabase (consulta leve)
        try:
            resp = supabase.table(SUPABASE_TABLE).select("*").limit(1).execute()
            # Se chegou aqui, a conexão/credenciais funcionaram
            details["deep_checks"]["supabase"] = "ok"
        except Exception as e:
            details["deep_checks"]["supabase"] = f"error: {e}"
            details["status"] = "degraded"

    return details