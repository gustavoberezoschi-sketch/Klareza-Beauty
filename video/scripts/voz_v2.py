"""Gera a leitura de uma parte (texto inteiro, uma chamada) via /stream/with-timestamps. Uso: voz_v2.py parte_a 1.05"""
import json, sys, base64, urllib.request
VOZ = "ohZOfA9iwlZ5nOsoY7LB"  # Roberta (pt-BR), escolhida pela usuária
parte, vel = sys.argv[1], float(sys.argv[2])
texto = open(f"v2/audio/{parte}.txt", encoding="utf8").read().strip()
corpo = {"text": texto, "model_id": "eleven_v3", "language_code": "pt",
         "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0, "use_speaker_boost": True, "speed": vel}}
req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{VOZ}/stream/with-timestamps?output_format=mp3_44100_128",
    data=json.dumps(corpo).encode(), headers={"content-type": "application/json", "xi-api-key": "proxy"})
audio = b""; ch, ini, fim = [], [], []
with urllib.request.urlopen(req, timeout=1200) as r:
    for linha in r:
        linha = linha.strip()
        if not linha: continue
        d = json.loads(linha)
        if d.get("audio_base64"): audio += base64.b64decode(d["audio_base64"])
        a = d.get("alignment")
        if a: ch += a["characters"]; ini += a["character_start_times_seconds"]; fim += a["character_end_times_seconds"]
open(f"v2/audio/voz_{parte}.mp3", "wb").write(audio)
json.dump({"characters": ch, "character_start_times_seconds": ini, "character_end_times_seconds": fim}, open(f"v2/audio/alinhamento_{parte}.json", "w"), ensure_ascii=False)
print("ok", parte, len(ch), len(texto), fim[-1] if fim else None)
