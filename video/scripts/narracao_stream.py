"""Leitura contínua única via /stream/with-timestamps (evita timeout em texto longo).
Junta os blocos de áudio e de alinhamento numa única linha do tempo."""
import json, sys, base64, urllib.request
VOZ = "ohZOfA9iwlZ5nOsoY7LB"  # Roberta (pt-BR), escolhida pela usuária
modelo = sys.argv[1]; vel = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
texto = open("audio/narracao.txt", encoding="utf8").read().strip()
corpo = {"text": texto, "model_id": modelo, "language_code": "pt",
         "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0, "use_speaker_boost": True, "speed": vel}}
req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{VOZ}/stream/with-timestamps?output_format=mp3_44100_128",
    data=json.dumps(corpo).encode(), headers={"content-type": "application/json", "xi-api-key": "proxy"})
audio = b""; chars, ini, fim = [], [], []
with urllib.request.urlopen(req, timeout=900) as r:
    for linha in r:
        linha = linha.strip()
        if not linha: continue
        d = json.loads(linha)
        if d.get("audio_base64"): audio += base64.b64decode(d["audio_base64"])
        a = d.get("alignment")
        if a: chars += a["characters"]; ini += a["character_start_times_seconds"]; fim += a["character_end_times_seconds"]
tag = f"{modelo}_{vel}"
open(f"audio/voz_{tag}.mp3", "wb").write(audio)
json.dump({"characters": chars, "character_start_times_seconds": ini, "character_end_times_seconds": fim}, open(f"audio/alinhamento_{tag}.json", "w"), ensure_ascii=False)
print("ok", tag, len(chars), fim[-1] if fim else None)
