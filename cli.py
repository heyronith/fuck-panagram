#!/usr/bin/env python3
"""
StealthGPT CLI Tool
Quick command-line interface for humanizing text or files with StealthGPT API.
"""

import os
import sys
import argparse
from pathlib import Path
from dotenv import load_dotenv

from stealth_client import StealthGPTClient

# Load environment variables
load_dotenv(Path(__file__).parent / ".env")

def main():
    parser = argparse.ArgumentParser(description="Humanize AI text with StealthGPT API")
    parser.add_argument("text", nargs="?", help="Text to humanize (or omit to read from stdin/prompt)")
    parser.add_argument("-f", "--file", help="Path to input text file")
    parser.add_argument("-o", "--output", help="Path to output file for humanized text")
    parser.add_argument("-m", "--model", default="super", choices=["super", "standard", "lite"], help="Model (default: super)")
    parser.add_argument("-t", "--tone", default="Standard", help="Tone (e.g. Standard, Casual, College, PhD)")
    parser.add_argument("-w", "--mode", default="default", choices=["default", "essay"], help="Writing mode (default, essay)")
    parser.add_argument("-k", "--key", help="StealthGPT API Key (defaults to STEALTHGPT_API_KEY in .env)")

    args = parser.parse_args()

    client = StealthGPTClient(api_key=args.key)

    raw_text = ""
    if args.file:
        file_path = Path(args.file)
        if not file_path.exists():
            print(f"Error: File '{args.file}' not found.", file=sys.stderr)
            sys.exit(1)
        raw_text = file_path.read_text(encoding="utf-8")
    elif args.text:
        raw_text = args.text
    elif not sys.stdin.isatty():
        raw_text = sys.stdin.read()
    else:
        print("Enter or paste your text below (Press Ctrl+D or Ctrl+Z on a new line to finish):")
        try:
            raw_text = sys.stdin.read()
        except KeyboardInterrupt:
            print("\nAborted.")
            sys.exit(0)

    raw_text = raw_text.strip()
    if not raw_text:
        print("Error: No text provided.", file=sys.stderr)
        sys.exit(1)

    print(f"\n[StealthGPT] Humanizing text with model='{args.model}', tone='{args.tone}'...")
    res = client.humanize(
        text=raw_text,
        model=args.model,
        tone=args.tone,
        writing_mode=args.mode
    )

    if not res.get("success"):
        print(f"\n[Error] {res.get('error')}", file=sys.stderr)
        sys.exit(1)

    result = res.get("result", "")
    if args.output:
        out_path = Path(args.output)
        out_path.write_text(result, encoding="utf-8")
        print(f"[StealthGPT] Result saved to: {out_path}")
    else:
        print("\n================== HUMANIZED OUTPUT ==================\n")
        print(result)
        print("\n======================================================")

if __name__ == "__main__":
    main()
