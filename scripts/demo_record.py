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

# Additional API keys — loaded only from environment variables.


def load_env():
    """Load .env.local into os.environ."""
    env_path = Path(__file__).resolve().parent.parent / ".env.local"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip())


def _build_tts_prompt(text: str) -> str:
    """Wrap narration text in a prompt that clearly signals audio-only output."""
    return (
        "Read the following narration aloud as clear, professional voice-over audio.\n"
        "Deliver at a measured pace with confident, neutral tone.\n"
        "Do not add, omit, paraphrase, or translate any words.\n"
        "\n"
        f"Narration:\n{text}"
    )


def _collect_api_keys() -> list[str]:
    """Collect all API keys in priority order (dedup, no empty strings)."""
    seen: set[str] = set()
    keys: list[str] = []
    candidates = [
        os.environ.get("GEMINI_API_KEY", "").strip(),
        os.environ.get("GEMINI_API_KEY_FALLBACK", "").strip(),
        *[k.strip() for k in os.environ.get("GEMINI_API_KEYS", "").split(",")],
    ]
    for k in candidates:
        if k and k not in seen:
            seen.add(k)
            keys.append(k)
    return keys


def _tts_request(text: str, voice: str, api_key: str) -> bytes:
    """Send a single TTS request and return raw audio bytes."""
    url = (
        f"https://generativelanguage.googleapis.com/v1beta/models/"
        f"{TTS_MODEL}:generateContent?key={api_key}"
    )
    prompt = _build_tts_prompt(text)
    body = json.dumps({
        "contents": [{"parts": [{"text": prompt}]}],
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
    part = data["candidates"][0]["content"]["parts"][0]["inlineData"]
    audio_bytes = base64.b64decode(part["data"])
    mime = part.get("mimeType", "audio/wav")
    # If raw PCM (L16), convert to WAV via ffmpeg
    if "L16" in mime or "pcm" in mime.lower():
        rate_match = __import__("re").search(r"rate=(\d+)", mime)
        sample_rate = rate_match.group(1) if rate_match else "24000"
        return _pcm_to_wav(audio_bytes, sample_rate)
    return audio_bytes


def _pcm_to_wav(pcm_bytes: bytes, sample_rate: str) -> bytes:
    """Convert raw PCM s16le bytes to WAV via ffmpeg."""
    result = subprocess.run(
        ["ffmpeg", "-y", "-f", "s16le", "-ar", sample_rate, "-ac", "1",
         "-i", "pipe:0", "-f", "wav", "pipe:1"],
        input=pcm_bytes, capture_output=True, check=True
    )
    return result.stdout


def gemini_tts(text: str, voice: str, out_path: str, max_retries: int = 5) -> float:
    """Generate TTS audio via Gemini API with key fallback. Returns duration in seconds.
    On 429, immediately switches to next key (no retry on same key)."""
    keys = _collect_api_keys()

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
                # type_delay: wait this many seconds before typing starts
                # (lets narration finish explaining the message first)
                type_delay = scene.get("type_delay", 0.0)
                if type_delay > 0:
                    time.sleep(type_delay)
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
                # Wait for Gemini response; remaining time after type_delay
                remaining = max(wait_after - type_delay, 2.0)
                time.sleep(max(remaining, 6.0))

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


def _scene_total_duration(clip: dict, scene: dict) -> float:
    """Compute the total real-time browser duration of a scene.

    This must mirror exactly what run_browser_recording() spends on each scene
    so that cursor_ms stays in sync with the video timeline.
    """
    tts_dur = clip["duration"]
    extra_wait = scene.get("extra_wait", 0.5)
    action = scene.get("action", "navigate")
    if action == "type_message":
        type_delay = scene.get("type_delay", 0.0)
        wait_after = tts_dur + extra_wait
        remaining = max(wait_after - type_delay, 2.0)
        # Approximate typing time: ~40 ms/char + 0.8 s overhead
        typing_time = len(scene.get("message", "")) * 0.04 + 0.8
        return type_delay + typing_time + max(remaining, 6.0)
    elif action == "wait":
        # browser: time.sleep(clip["duration"] + scene.get("extra_wait", 0.5))
        # note: scene["wait"] is only used when there is no narration
        return tts_dur + scene.get("extra_wait", 0.5)
    # navigate / scroll
    return tts_dur + extra_wait


def merge_audio_video(tts_clips: list, scenes: list, video_path: str, output_path: str):
    """Merge TTS audio clips with video using ffmpeg.

    Strategy: compute each clip's start offset (ms) from the accumulated
    scene durations, then use adelay + amix to overlay all clips onto a
    single audio track aligned with the video timeline.
    """
    print(f"\n  Merging \u2192 {output_path}")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    # Step 1: collect clips that actually have audio + their start offsets
    audio_clips: list[tuple[str, int]] = []  # (path, start_ms)
    cursor_ms = 0
    for clip, scene in zip(tts_clips, scenes):
        if clip["path"] and os.path.exists(clip["path"]):
            audio_clips.append((clip["path"], cursor_ms))
        scene_ms = int(_scene_total_duration(clip, scene) * 1000)
        cursor_ms += scene_ms

    if not audio_clips:
        # No audio at all — just re-encode video
        cmd = [
            "ffmpeg", "-y", "-i", video_path,
            "-c:v", "libx264", "-preset", "fast", "-crf", "23",
            "-an", output_path
        ]
        _run_ffmpeg(cmd)
        return

    # Step 2: build filter_complex with adelay for each clip
    # [1:a]aresample=24000,aformat=sample_fmts=fltp:channel_layouts=mono,adelay=<ms>:all=1[a0]
    # then amix=inputs=N:normalize=0[audio]
    audio_inputs: list[str] = []
    filter_parts: list[str] = []

    for idx, (path, start_ms) in enumerate(audio_clips):
        audio_inputs += ["-i", path]
        in_ref = idx + 1  # input 0 is the video
        filter_parts.append(
            f"[{in_ref}:a]aresample=24000,"
            f"aformat=sample_fmts=fltp:channel_layouts=mono,"
            f"adelay={start_ms}:all=1[a{idx}]"
        )

    n = len(audio_clips)
    mix_inputs = "".join(f"[a{i}]" for i in range(n))
    filter_parts.append(f"{mix_inputs}amix=inputs={n}:normalize=0[audio]")
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
        output_path,
    ]
    _run_ffmpeg(cmd)


def _run_ffmpeg(cmd: list[str]):
    """Run ffmpeg, printing stderr on failure."""
    result = subprocess.run(cmd, capture_output=True)
    if result.returncode != 0:
        print("\n  [ffmpeg stderr]")
        print(result.stderr.decode(errors="replace")[-3000:])
        raise subprocess.CalledProcessError(result.returncode, cmd)
    print(f"  Done! → {cmd[-1]}")


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
        merge_audio_video(tts_clips, scenes, video_path, output_path)

    file_size = os.path.getsize(output_path) / (1024 * 1024)
    print(f"\n{'='*60}")
    print(f"  Output: {output_path}")
    print(f"  Size: {file_size:.1f} MB")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    main()
