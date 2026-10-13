import os
import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional

HISTORY_FILE = "/tmp/history.json" if os.getenv("VERCEL") else os.path.join(os.path.dirname(__file__), "history.json")

class HistoryManager:
    def __init__(self, filepath: str = HISTORY_FILE):
        self.filepath = filepath
        self._ensure_file()

    def _ensure_file(self):
        if not os.path.exists(self.filepath):
            try:
                with open(self.filepath, "w", encoding="utf-8") as f:
                    json.dump([], f)
            except Exception:
                pass

    def get_all(self, limit: int = 50) -> List[Dict[str, Any]]:
        self._ensure_file()
        try:
            with open(self.filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data[:limit]
                return []
        except Exception:
            return []

    def add(
        self,
        original_text: str,
        humanized_text: str,
        model: str,
        tone: Optional[str] = None,
        writing_mode: Optional[str] = "default",
        stats: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        items = self.get_all(limit=100)
        item_id = str(uuid.uuid4())[:8]
        entry = {
            "id": item_id,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "original_text": original_text,
            "humanized_text": humanized_text,
            "model": model,
            "tone": tone or "Default",
            "writing_mode": writing_mode or "default",
            "stats": stats or {}
        }
        items.insert(0, entry)
        # Cap to 50 entries
        items = items[:50]

        try:
            with open(self.filepath, "w", encoding="utf-8") as f:
                json.dump(items, f, indent=2, ensure_ascii=False)
        except Exception:
            pass

        return entry

    def delete(self, item_id: str) -> bool:
        items = self.get_all(limit=100)
        initial_len = len(items)
        items = [it for it in items if it.get("id") != item_id]
        if len(items) != initial_len:
            try:
                with open(self.filepath, "w", encoding="utf-8") as f:
                    json.dump(items, f, indent=2, ensure_ascii=False)
                return True
            except Exception:
                return False
        return False

    def clear(self) -> bool:
        try:
            with open(self.filepath, "w", encoding="utf-8") as f:
                json.dump([], f)
            return True
        except Exception:
            return False
