import os
import re
import requests
from typing import Optional, Dict, Any, List

STEALTHGPT_API_URL = "https://www.stealthgpt.ai/api/stealthify"
DEFAULT_TIMEOUT_SEC = 180  # 3 minutes per request
CHUNK_WORD_THRESHOLD = 350  # Texts exceeding this are split into optimized chunks

class StealthGPTClient:
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or os.getenv("STEALTHGPT_API_KEY", "")

    def _split_into_chunks(self, text: str, max_words: int = CHUNK_WORD_THRESHOLD) -> List[str]:
        """
        Splits text into context-preserving chunks under max_words.
        Splits first on paragraphs (\n\n), or sentences if paragraphs are extra long.
        """
        paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]
        if not paragraphs:
            paragraphs = [p.strip() for p in text.split("\n") if p.strip()]
        if not paragraphs:
            paragraphs = [text.strip()]

        chunks: List[str] = []
        current_chunk: List[str] = []
        current_count = 0

        for para in paragraphs:
            para_words = len(para.split())
            # If a single paragraph is longer than max_words, split by sentences
            if para_words > max_words:
                sentences = re.split(r'(?<=[.!?])\s+', para)
                for sent in sentences:
                    sent = sent.strip()
                    if not sent:
                        continue
                    sent_words = len(sent.split())
                    if current_count + sent_words > max_words and current_chunk:
                        chunks.append(" ".join(current_chunk))
                        current_chunk = [sent]
                        current_count = sent_words
                    else:
                        current_chunk.append(sent)
                        current_count += sent_words
            elif current_count + para_words > max_words and current_chunk:
                chunks.append("\n\n".join(current_chunk))
                current_chunk = [para]
                current_count = para_words
            else:
                current_chunk.append(para)
                current_count += para_words

        if current_chunk:
            chunks.append("\n\n".join(current_chunk))

        return chunks if chunks else [text]

    def _call_api_single(
        self,
        prompt_text: str,
        model: str,
        tone: Optional[str],
        writing_mode: str,
        api_key: str,
        timeout: int = DEFAULT_TIMEOUT_SEC
    ) -> Dict[str, Any]:
        """
        Makes a single synchronous POST request to StealthGPT API.
        """
        headers = {
            "api-token": api_key.strip(),
            "Content-Type": "application/json"
        }

        payload: Dict[str, Any] = {
            "prompt": prompt_text,
            "rephrase": True,
            "model": model if model in ["super", "standard", "lite"] else "super",
            "writingMode": writing_mode if writing_mode else "default"
        }

        if tone and tone.strip() and tone.lower() != "default":
            payload["tone"] = tone.strip()

        try:
            response = requests.post(
                STEALTHGPT_API_URL,
                headers=headers,
                json=payload,
                timeout=timeout
            )

            if response.status_code == 200:
                data = response.json()
                result_text = data.get("result")
                if result_text is not None:
                    return {
                        "success": True,
                        "result": result_text,
                        "raw_response": data
                    }
                else:
                    return {
                        "success": False,
                        "error": "StealthGPT returned 200 OK but no 'result' field in response."
                    }

            elif response.status_code in (401, 403):
                return {
                    "success": False,
                    "error": "Authentication failed (HTTP 401/403). Your StealthGPT API key is invalid or unauthorized."
                }
            elif response.status_code == 429:
                return {
                    "success": False,
                    "error": "Rate limit or credit limit reached (HTTP 429). Please verify your StealthGPT subscription/credits."
                }
            elif response.status_code == 400:
                err_msg = response.text
                try:
                    err_json = response.json()
                    err_msg = err_json.get("message") or err_json.get("error") or response.text
                except Exception:
                    pass
                return {
                    "success": False,
                    "error": f"Bad request (HTTP 400): {err_msg}"
                }
            else:
                return {
                    "success": False,
                    "error": f"StealthGPT API error (HTTP {response.status_code}): {response.text}"
                }

        except requests.exceptions.Timeout:
            return {
                "success": False,
                "error": f"Request timed out waiting for StealthGPT API ({timeout}s limit). Please check your connection and retry."
            }
        except requests.exceptions.RequestException as e:
            return {
                "success": False,
                "error": f"Network error contacting StealthGPT API: {str(e)}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": f"Unexpected error: {str(e)}"
            }

    def humanize(
        self,
        text: str,
        model: str = "super",
        tone: Optional[str] = None,
        writing_mode: str = "default",
        api_key_override: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Rephrases/humanizes text using StealthGPT API.
        Automatically chunks long text (>350 words) to prevent HTTP timeouts and preserve bypass quality.
        """
        key = api_key_override or self.api_key
        if not key or not key.strip():
            return {
                "success": False,
                "error": "StealthGPT API key is missing. Please provide an API key in Settings or your .env file."
            }

        cleaned_text = text.strip()
        if not cleaned_text:
            return {
                "success": False,
                "error": "Input text cannot be empty."
            }

        # Check if input text contains multiple paragraphs separated by line breaks
        paragraphs = [p.strip() for p in re.split(r'\n\s*\n', cleaned_text) if p.strip()]

        # If not double-newline separated, check if it's a list separated by single newlines
        if len(paragraphs) <= 1:
            lines = [l.strip() for l in cleaned_text.split('\n') if l.strip()]
            if len(lines) > 1 and any(re.match(r'^[\u2022\u25cf\u25cb\u25a0\-\*\+]\s+|\b\d+\.\s+', l) for l in lines):
                paragraphs = lines

        if len(paragraphs) > 1:
            # Preserve exact paragraph layout: humanize each paragraph individually
            humanized_paragraphs: List[str] = []
            for idx, para in enumerate(paragraphs, 1):
                res = self.humanize(
                    text=para,
                    model=model,
                    tone=tone,
                    writing_mode=writing_mode,
                    api_key_override=key
                )
                if not res.get("success"):
                    return {
                        "success": False,
                        "error": f"Error humanizing paragraph {idx} of {len(paragraphs)}: {res.get('error')}"
                    }
                humanized_paragraphs.append(res.get("result", "").strip())

            return {
                "success": True,
                "result": "\n\n".join(humanized_paragraphs),
                "paragraphs_count": len(paragraphs)
            }

        word_count = len(re.findall(r"\b\w+\b", cleaned_text))

        # If short text, process directly in 1 request
        if word_count <= CHUNK_WORD_THRESHOLD:
            return self._call_api_single(
                prompt_text=cleaned_text,
                model=model,
                tone=tone,
                writing_mode=writing_mode,
                api_key=key,
                timeout=DEFAULT_TIMEOUT_SEC
            )

        # Long text handling: split into paragraph-safe chunks
        chunks = self._split_into_chunks(cleaned_text, max_words=CHUNK_WORD_THRESHOLD)
        humanized_chunks: List[str] = []

        for idx, chunk in enumerate(chunks, 1):
            chunk_res = self._call_api_single(
                prompt_text=chunk,
                model=model,
                tone=tone,
                writing_mode=writing_mode,
                api_key=key,
                timeout=DEFAULT_TIMEOUT_SEC
            )
            if not chunk_res.get("success"):
                error_msg = chunk_res.get("error", "Unknown error")
                return {
                    "success": False,
                    "error": f"Error humanizing section {idx} of {len(chunks)}: {error_msg}"
                }
            humanized_chunks.append(chunk_res.get("result", ""))

        # Seamlessly join chunks
        combined_result = "\n\n".join(humanized_chunks)
        return {
            "success": True,
            "result": combined_result,
            "chunks_count": len(chunks)
        }

    def verify_key(self, key_to_test: str) -> Dict[str, Any]:
        """
        Tests API key validity using a small text snippet.
        """
        if not key_to_test or not key_to_test.strip():
            return {"success": False, "error": "API key cannot be empty."}

        return self._call_api_single(
            prompt_text="AI generated content verification test.",
            model="lite",
            tone=None,
            writing_mode="default",
            api_key=key_to_test.strip(),
            timeout=30
        )
