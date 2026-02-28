#!/usr/bin/env python3
"""
CipherGate Demo Video Recorder
Uses Playwright for browser automation + Gemini TTS for narration.
Outputs a final MP4 with narrated screen recording.

Usage:
    python scripts/demo_record.py --lang en
    python scripts/demo_record.py --lang kr
"""

import argparse
import base64
import json
import math
import os
import subprocess
import sys
import tempfile
import time
import urllib.request
from pathlib import Path

# ── Config ──────────────────────────────────────────────────────────────────

BASE_URL = "https://ciphergate-customer-app-940152137769.us-central1.run.app"
TTS_MODEL = "gemini-2.5-flash-preview-tts"
TTS_VOICE_EN = "Kore"   # English voice
TTS_VOICE_KR = "Kore"   # Korean voice (Kore supports Korean)
VIEWPORT = {"width": 1280, "height": 800}
VIDEO_SIZE = {"width": 1280, "height": 800}

FALLBACK_API_KEY = "REDACTED_GEMINI_API_KEY"


def load_env():
    """Load .env.local into os.environ."""
    env_path = Path(__file__).resolve().parent.parent / ".env.local"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def _tts_request(text: str, voice: str, api_key: str) -> bytes:
    """Send a single TTS request and return raw audio bytes."""
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{TTS_MODEL}:generateContent?key={api_key}"
    )
    body = json.dumps({
        "contents": [{"parts": [{"text": text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {"voiceName": voice}
                }
            }
        }
    }).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    resp = urllib.request.urlopen(req, timeout=60)
    data = json.loads(resp.read())
    audio_b64 = data["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
    return base64.b64decode(audio_b64)


def gemini_tts(text: str, voice: str, out_path: str, max_retries: int = 5) -> float:
    """Generate TTS audio via Gemini API with key fallback. Returns duration in seconds.
    On 429, immediately switches to next key (no retry on same key)."""
    primary_key = os.environ["GEMINI_API_KEY"]
    keys = [primary_key, FALLBACK_API_KEY]

    for key_idx, api_key in enumerate(keys):
        key_label = "primary" if key_idx == 0 else "fallback"
        for attempt in range(max_retries):
            try:
                audio_bytes = _tts_request(text, voice, api_key)

                with open(out_path, "wb") as f:
                    f.write(audio_bytes)

                dur = get_audio_duration(out_path)
                if key_idx > 0:
                    print(f"  TTS ({key_label} key): {len(text)} chars → {dur:.1f}s → {out_path}")
                else:
                    print(f"  TTS: {len(text)} chars → {dur:.1f}s → {out_path}")
                return dur

            except urllib.error.HTTPError as e:
                if e.code == 429:
                    if key_idx < len(keys) - 1:
                        print(f"  TTS 429 on {key_label} key, switching to next key...")
                        break  # immediately try next key
                    elif attempt < max_retries - 1:
                        wait = 2 ** attempt + 1
                        print(f"  TTS rate limited (last key), retrying in {wait}s... (attempt {attempt + 1}/{max_retries})")
                        time.sleep(wait)
                    else:
                        raise
                else:
                    if key_idx < len(keys) - 1:
                        print(f"  TTS HTTP {e.code} on {key_label} key, trying next key...")
                        break
                    raise
            except Exception as e:
                if key_idx < len(keys) - 1:
                    print(f"  TTS error with {key_label} key: {e}, trying next key...")
                    break
                else:
                    raise

    raise RuntimeError("All API keys exhausted for TTS")


def get_audio_duration(path: str) -> float:
    """Get audio duration in seconds using ffprobe."""
    r = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration",
         "-of", "csv=p=0", path],
        capture_output=True, text=True
    )
    try:
        return float(r.stdout.strip())
    except ValueError:
        return 5.0


def load_scenes(lang: str) -> list:
    """Load scene definitions for the given language."""
    scenes_path = Path(__file__).resolve().parent / f"scenes_{lang}.json"
    with open(scenes_path) as f:
        return json.load(f)


def generate_all_tts(scenes: list, voice: str, tmp_dir: str) -> list:
    """Pre-generate all TTS clips. Returns list of (audio_path, duration)."""
    results = []
    for i, scene in enumerate(scenes):
        narration = scene.get("narration", "")
        if narration:
            audio_path = os.path.join(tmp_dir, f"tts_{i:03d}.wav")
            dur = gemini_tts(narration, voice, audio_path)
            results.append({"path": audio_path, "duration": dur})
        else:
            results.append({"path": None, "duration": scene.get("wait", 3.0)})
    return results


def run_browser_recording(scenes: list, tts_clips: list, video_path: str, lang: str):
    """Run Playwright to record the browser with timed actions."""
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            viewport=VIEWPORT,
            record_video_dir=os.path.dirname(video_path),
            record_video_size=VIDEO_SIZE,
            color_scheme="dark",
        )
        page = context.new_page()

        for i, scene in enumerate(scenes):
            clip = tts_clips[i]
            action = scene.get("action", "navigate")
            target = scene.get("target", "")
            wait_after = clip["duration"] + scene.get("extra_wait", 0.5)

            print(f"  Scene {i}: {action} → {target[:60]}... ({wait_after:.1f}s)")

            if action == "navigate":
                page.goto(f"{BASE_URL}{target}", wait_until="networkidle", timeout=30000)
                time.sleep(min(wait_after, 2.0))  # let page render
                _slow_scroll(page, scene.get("scroll_to", 0), wait_after - 1.0)

            elif action == "scroll":
                scroll_y = scene.get("scroll_to", 500)
                _slow_scroll(page, scroll_y, wait_after)

            elif action == "type_message":
                msg = scene.get("message", "")
                textarea = page.locator("textarea, input[type='text']").first
                textarea.click()
                time.sleep(0.3)
                # Type character by character for dramatic effect
                for ch in msg:
                    textarea.type(ch, delay=40)
                time.sleep(0.5)
                # Submit
                submit_btn = page.locator("button[type='submit'], button:has-text('Send')").first
                submit_btn.click()
                # Wait for response
                time.sleep(max(wait_after, 6.0))

            elif action == "wait":
                time.sleep(wait_after)

            elif action == "screenshot":
                # Just pause to show current state
                time.sleep(wait_after)

            else:
                time.sleep(wait_after)

        # Final pause
        time.sleep(2.0)

        # Close and get video
        page.close()
        context.close()
        browser.close()

    # Playwright saves video in the dir, find it
    vid_dir = os.path.dirname(video_path)
    vids = sorted(Path(vid_dir).glob("*.webm"), key=lambda p: p.stat().st_mtime)
    if vids:
        latest = vids[-1]
        if str(latest) != video_path:
            latest.rename(video_path)
        print(f"  Video: {video_path}")


def _slow_scroll(page, target_y: int, duration: float):
    """Smoothly scroll to target_y over duration seconds."""
    if target_y <= 0:
        time.sleep(max(duration, 0.5))
        return
    steps = max(int(duration * 4), 4)  # 4 scroll steps per second
    step_delay = duration / steps
    current = page.evaluate("window.scrollY")
    diff = target_y - current
    for s in range(1, steps + 1):
        frac = s / steps
        y = current + diff * frac
        page.evaluate(f"window.scrollTo({{top: {y}, behavior: 'auto'}})")
        time.sleep(step_delay)


def merge_audio_video(tts_clips: list, video_path: str, output_path: str):
    """Merge TTS audio clips with video using ffmpeg."""
    # Concatenate all audio clips with silence gaps
    # Build an ffmpeg filter complex
    audio_inputs = []
    filter_parts = []
    input_idx = 0

    # First, create silence clips for clips without audio
    for i, clip in enumerate(tts_clips):
        if clip["path"]:
            audio_inputs.extend(["-i", clip["path"]])
            filter_parts.append(f"[{input_idx + 1}:a]aresample=24000[a{i}]")
            input_idx += 1
        else:
            dur = clip["duration"]
            filter_parts.append(
                f"anullsrc=r=24000:cl=mono:d={dur}[a{i}]"
            )

    # Concatenate all audio
    n = len(tts_clips)
    concat_inputs = "".join(f"[a{i}]" for i in range(n))
    filter_parts.append(f"{concat_inputs}concat=n={n}:v=0:a=1[audio]")

    filter_complex = ";".join(filter_parts)

    cmd = [
        "ffmpeg", "-y",
        "-i", video_path,
        *audio_inputs,
        "-filter_complex", filter_complex,
        "-map", "0:v",
        "-map", "[audio]",
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        output_path
    ]

    print(f"\n  Merging → {output_path}")
    subprocess.run(cmd, check=True, capture_output=True)
    print(f"  Done! {output_path}")


def main():
    parser = argparse.ArgumentParser(description="CipherGate Demo Recorder")
    parser.add_argument("--lang", choices=["en", "kr"], required=True)
    parser.add_argument("--output", default=None, help="Output MP4 path")
    args = parser.parse_args()

    load_env()
    assert os.environ.get("GEMINI_API_KEY"), "GEMINI_API_KEY not found"

    project_root = Path(__file__).resolve().parent.parent
    output_dir = project_root / "demo_output"
    output_dir.mkdir(exist_ok=True)

    output_path = args.output or str(output_dir / f"ciphergate_demo_{args.lang}.mp4")
    voice = TTS_VOICE_EN if args.lang == "en" else TTS_VOICE_KR

    print(f"\n{'='*60}")
    print(f"  CipherGate Demo Recorder — {args.lang.upper()}")
    print(f"{'='*60}\n")

    # Load scenes
    print("[1/4] Loading scenes...")
    scenes = load_scenes(args.lang)
    print(f"  {len(scenes)} scenes loaded\n")

    # Generate TTS
    print("[2/4] Generating TTS narration...")
    with tempfile.TemporaryDirectory() as tmp_dir:
        tts_clips = generate_all_tts(scenes, voice, tmp_dir)
        total_audio = sum(c["duration"] for c in tts_clips)
        print(f"  Total narration: {total_audio:.1f}s\n")

        # Record browser
        print("[3/4] Recording browser...")
        vid_dir = tempfile.mkdtemp()
        video_path = os.path.join(vid_dir, "recording.webm")
        run_browser_recording(scenes, tts_clips, video_path, args.lang)

        # Merge
        print("\n[4/4] Merging audio + video...")
        merge_audio_video(tts_clips, video_path, output_path)

    file_size = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\n{'='*60}")
    print(f"  Output: {output_path}")
    print(f"  Size: {file_size:.1f} MB")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
