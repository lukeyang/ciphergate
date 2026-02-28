#!/usr/bin/env python3
"""Test Gemini TTS API."""
import os, json, base64, urllib.request

key = os.environ.get("GEMINI_API_KEY", "")
print("Key present:", bool(key))
assert key, "GEMINI_API_KEY not set"

url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key={key}"
body = json.dumps({
    "contents": [{"parts": [{"text": "Hello, this is a test of CipherGate."}]}],
    "generationConfig": {
        "responseModalities": ["AUDIO"],
        "speechConfig": {
            "voiceConfig": {
                "prebuiltVoiceConfig": {"voiceName": "Kore"}
            }
        }
    }
}).encode()

req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
resp = urllib.request.urlopen(req)
data = json.loads(resp.read())
audio_b64 = data["candidates"][0]["content"]["parts"][0]["inlineData"]["data"]
audio_bytes = base64.b64decode(audio_b64)
mime = data["candidates"][0]["content"]["parts"][0]["inlineData"]["mimeType"]
print(f"TTS OK — mime: {mime}, size: {len(audio_bytes)} bytes")
with open("/tmp/tts_test.wav", "wb") as f:
    f.write(audio_bytes)
print("Saved to /tmp/tts_test.wav")
