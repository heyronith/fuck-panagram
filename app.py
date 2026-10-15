import os
import re
import json
import time
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from dotenv import load_dotenv

from stealth_client import StealthGPTClient
from history_manager import HistoryManager
from metric_preserver import lock_and_restore_metrics, verify_and_reinforce_fidelity

# Load environment variables
ENV_PATH = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=ENV_PATH)

app = FastAPI(title="Fuck panagram")

# Static files setup
STATIC_DIR = Path(__file__).parent / "static"
if not os.getenv("VERCEL"):
    STATIC_DIR.mkdir(exist_ok=True)
    (STATIC_DIR / "css").mkdir(exist_ok=True)
    (STATIC_DIR / "js").mkdir(exist_ok=True)

app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

# History & Client instances
history_mgr = HistoryManager()
stealth_client = StealthGPTClient()

def get_current_api_key() -> str:
    return os.getenv("STEALTHGPT_API_KEY", "").strip()

def mask_api_key(key: str) -> str:
    if not key:
        return ""
    if len(key) <= 8:
        return "••••" + key[-3:] if len(key) >= 3 else "••••"
    return "•" * 8 + key[-4:]

def update_env_file(key: str):
    os.environ["STEALTHGPT_API_KEY"] = key
    stealth_client.api_key = key

    try:
        content_lines = []
        if ENV_PATH.exists():
            with open(ENV_PATH, "r", encoding="utf-8") as f:
                lines = f.readlines()
            found = False
            for line in lines:
                if line.startswith("STEALTHGPT_API_KEY="):
                    content_lines.append(f"STEALTHGPT_API_KEY={key}\n")
                    found = True
                else:
                    content_lines.append(line)
            if not found:
                content_lines.append(f"STEALTHGPT_API_KEY={key}\n")
        else:
            content_lines = [
                f"# StealthGPT Configuration\n",
                f"STEALTHGPT_API_KEY={key}\n",
                f"HOST=127.0.0.1\n",
                f"PORT=8000\n"
            ]

        with open(ENV_PATH, "w", encoding="utf-8") as f:
            f.writelines(content_lines)
    except Exception:
        pass


class ConfigPayload(BaseModel):
    api_key: str = Field(..., description="StealthGPT API key")

class HumanizePayload(BaseModel):
    text: str = Field(..., description="Raw text to humanize")
    model: str = Field(default="super", description="StealthGPT model: super, standard, lite")
    tone: Optional[str] = Field(default="Standard", description="Tone of voice")
    writing_mode: Optional[str] = Field(default="default", description="Writing mode")
    api_key: Optional[str] = Field(default=None, description="Optional override API key")
    lock_metrics: Optional[bool] = Field(default=True, description="Strictly preserve and lock all scientific metrics and equations")
    fidelity: Optional[str] = Field(default="strict", description="Scientific Meaning Fidelity: strict, balanced, creative")
    context: Optional[str] = Field(default=None, description="Preceding manuscript context")

class VerifyPayload(BaseModel):
    api_key: str = Field(..., description="API key to verify")


def calculate_stats(orig: str, humanized: str) -> Dict[str, Any]:
    orig_words = len(re.findall(r"\b\w+\b", orig))
    humanized_words = len(re.findall(r"\b\w+\b", humanized))
    orig_chars = len(orig)
    humanized_chars = len(humanized)

    word_diff = humanized_words - orig_words
    diff_pct = round(((humanized_words - orig_words) / orig_words) * 100, 1) if orig_words > 0 else 0
    reading_time_sec = max(1, round(humanized_words / 3.3)) # ~200 wpm

    return {
        "original_words": orig_words,
        "humanized_words": humanized_words,
        "original_chars": orig_chars,
        "humanized_chars": humanized_chars,
        "word_diff": word_diff,
        "diff_pct": diff_pct,
        "reading_time_seconds": reading_time_sec
    }


@app.get("/", response_class=HTMLResponse)
async def serve_index():
    index_file = Path(__file__).parent / "templates" / "index.html"
    if not index_file.exists():
        raise HTTPException(status_code=404, detail="Index template not found")
    return FileResponse(index_file)


@app.get("/favicon.svg")
async def serve_favicon():
    fav_file = STATIC_DIR / "favicon.svg"
    if fav_file.exists():
        return FileResponse(fav_file, media_type="image/svg+xml")
    raise HTTPException(status_code=404, detail="Favicon not found")


@app.get("/api/config")
async def get_config():
    cur_key = get_current_api_key()
    return {
        "has_key": bool(cur_key),
        "masked_key": mask_api_key(cur_key),
        "models": [
            {"id": "super", "name": "Super (Advanced Undetectable)", "desc": "Highest bypass score against Turnitin, GPTZero & Winston"},
            {"id": "standard", "name": "Standard (Balanced)", "desc": "Fast & high-quality rephrasing for general content"},
            {"id": "lite", "name": "Lite (Fast)", "desc": "Lightweight rapid humanizing for simple text"}
        ],
        "tones": ["Standard", "Casual", "Professional", "HighSchool", "College", "PhD"],
        "writing_modes": [
            {"id": "default", "name": "Default"},
            {"id": "essay", "name": "Academic / Essay"}
        ]
    }


@app.post("/api/config")
async def save_config(payload: ConfigPayload):
    key = payload.api_key.strip()
    if not key:
        raise HTTPException(status_code=400, detail="API key cannot be empty")
    update_env_file(key)
    return {
        "success": True,
        "message": "API key successfully saved to environment and .env file.",
        "has_key": True,
        "masked_key": mask_api_key(key)
    }


@app.post("/api/verify-key")
async def verify_key(payload: VerifyPayload):
    test_key = payload.api_key.strip()
    if not test_key:
        return {"success": False, "error": "API key is required."}
    result = stealth_client.verify_key(test_key)
    return result


@app.post("/api/humanize")
async def humanize_text(payload: HumanizePayload):
    raw_text = payload.text.strip()
    if not raw_text:
        raise HTTPException(status_code=400, detail="Please provide raw text to humanize.")

    active_key = payload.api_key.strip() if payload.api_key else get_current_api_key()
    if not active_key:
        raise HTTPException(
            status_code=400,
            detail="No API key provided. Please save your API key in Settings or provide it with the request."
        )

    # If fidelity is strict, lock tone to PhD and writing_mode to essay for academic precision
    active_tone = payload.tone
    active_mode = payload.writing_mode or "default"
    fidelity_mode = (payload.fidelity or "strict").lower()
    
    if fidelity_mode == "strict":
        if not active_tone or active_tone.lower() in ["standard", "default"]:
            active_tone = "PhD"
        if not active_mode or active_mode == "default":
            active_mode = "essay"

    res = stealth_client.humanize(
        text=raw_text,
        model=payload.model,
        tone=active_tone,
        writing_mode=active_mode,
        api_key_override=active_key
    )

    if not res.get("success"):
        return {
            "success": False,
            "error": res.get("error", "Failed to humanize text via StealthGPT API.")
        }

    humanized = res.get("result", "")
    fidelity_audit = {}
    if payload.lock_metrics or fidelity_mode == "strict":
        humanized, fidelity_audit = verify_and_reinforce_fidelity(
            orig_text=raw_text,
            humanized_text=humanized,
            fidelity_mode=fidelity_mode
        )
    else:
        humanized, fidelity_audit = lock_and_restore_metrics(raw_text, humanized)

    stats = calculate_stats(raw_text, humanized)
    stats["chunks_count"] = res.get("chunks_count", 1)
    stats["fidelity_audit"] = fidelity_audit
    stats["fidelity_mode"] = payload.fidelity or "strict"

    # Save to history
    history_entry = history_mgr.add(
        original_text=raw_text,
        humanized_text=humanized,
        model=payload.model,
        tone=active_tone,
        writing_mode=active_mode,
        stats=stats
    )

    return {
        "success": True,
        "result": humanized,
        "stats": stats,
        "fidelity_audit": fidelity_audit,
        "history_id": history_entry.get("id")
    }


@app.get("/api/history")
async def get_history():
    return {
        "items": history_mgr.get_all()
    }


@app.delete("/api/history/{item_id}")
async def delete_history_item(item_id: str):
    success = history_mgr.delete(item_id)
    return {"success": success}


from document_handler import parse_docx, parse_pdf, parse_text, generate_docx_from_html_or_text
from fastapi import UploadFile, File, Response
import base64

class DocxExportPayload(BaseModel):
    content: str
    filename: Optional[str] = "manuscript_humanized.docx"


class DocumentBase64Payload(BaseModel):
    filename: str
    file_base64: str


@app.post("/api/document/parse-base64")
async def parse_document_base64(payload: DocumentBase64Payload):
    filename = payload.filename or "document.txt"
    ext = filename.lower().split(".")[-1]
    try:
        b64_str = payload.file_base64
        if "," in b64_str:
            b64_str = b64_str.split(",", 1)[1]
        file_bytes = base64.b64decode(b64_str)

        if ext == "docx":
            data = parse_docx(file_bytes)
        elif ext == "pdf":
            data = parse_pdf(file_bytes)
        else:
            data = parse_text(file_bytes)
    except Exception as e:
        return {"success": False, "error": f"Failed to parse document: {str(e)}"}

    data["filename"] = filename
    return data


@app.post("/api/document/parse")
async def parse_document(file: UploadFile = File(...)):
    filename = file.filename or "document.txt"
    ext = filename.lower().split(".")[-1]
    file_bytes = await file.read()

    try:
        if ext == "docx":
            data = parse_docx(file_bytes)
        elif ext == "pdf":
            data = parse_pdf(file_bytes)
        else:
            data = parse_text(file_bytes)
    except Exception as e:
        return {"success": False, "error": f"Failed to parse document: {str(e)}"}

    data["filename"] = filename
    return data


@app.post("/api/document/export-docx")
async def export_document_docx(payload: DocxExportPayload):
    safe_name = payload.filename or "manuscript_humanized.docx"
    if not safe_name.endswith(".docx"):
        safe_name += ".docx"

    buffer = generate_docx_from_html_or_text(payload.content, title=safe_name)
    return Response(
        content=buffer.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}"'
        }
    )


@app.delete("/api/history")
async def clear_history():
    success = history_mgr.clear()
    return {"success": success}


DRAFT_FILE = Path("/tmp/draft_manuscript.json") if os.getenv("VERCEL") else (Path(__file__).parent / "draft_manuscript.json")

class ManuscriptDraftPayload(BaseModel):
    html: str
    filename: Optional[str] = "manuscript_draft.docx"
    replaced_count: Optional[int] = 0


@app.post("/api/manuscript/save")
async def save_manuscript_draft(payload: ManuscriptDraftPayload):
    try:
        data = {
            "html": payload.html,
            "filename": payload.filename,
            "replaced_count": payload.replaced_count,
            "timestamp": time.time(),
            "formatted_time": datetime.now().strftime("%I:%M %p")
        }
        with open(DRAFT_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)
        return {"success": True, "saved_at": data["formatted_time"]}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/manuscript/restore")
async def restore_manuscript_draft():
    if DRAFT_FILE.exists():
        try:
            with open(DRAFT_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {"success": True, "draft": data}
        except Exception as e:
            return {"success": False, "error": str(e)}
    return {"success": False, "draft": None}


@app.delete("/api/manuscript/reset")
async def reset_manuscript_draft():
    if DRAFT_FILE.exists():
        try:
            DRAFT_FILE.unlink()
        except Exception:
            pass
    return {"success": True}


if __name__ == "__main__":
    import uvicorn
    import webbrowser

    host = os.getenv("HOST", "127.0.0.1")
    port = int(os.getenv("PORT", "8000"))
    url = f"http://{host}:{port}"
    print(f"\n=======================================================")
    print(f"🚀 Fuck panagram Studio is launching...")
    print(f"📍 Local URL: {url}")
    print(f"=======================================================\n")

    try:
        webbrowser.open(url)
    except Exception:
        pass

    uvicorn.run("app:app", host=host, port=port, reload=True)

