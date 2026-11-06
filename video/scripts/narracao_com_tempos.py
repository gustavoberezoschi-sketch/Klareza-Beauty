"""Gera UMA leitura contínua com tempos por caractere (ElevenLabs /with-timestamps).
A chave é injetada pelo proxy do ambiente; nada de segredo no código."""
import json, sys, base64, urllib.request, os
VOZ = "ohZOfA9iwlZ5nOsoY7LB"  # Roberta - Casual, Engaging and Clear (pt-BR), escolhida pela usuária
modelo = sys.argv[1] if len(sys.argv) > 1 else "eleven_v3"
texto = open("audio/narracao.txt", encoding="utf8").read().strip()
corpo = {"text": texto, "model_id": modelo, "language_code": "pt",
         "voice_settings": {"stability": 0.5, "similarity_boost": 0.75, "style": 0, "use_speaker_boost": True}}
req = urllib.request.Request(f"https://api.elevenlabs.io/v1/text-to-speech/{VOZ}/with-timestamps?output_format=mp3_44100_128",
    data=json.dumps(corpo).encode(), headers={"content-type": "application/json", "xi-api-key": os.environ.get("XI_DUMMY", "proxy")})
try:
    r = json.load(urllib.request.urlopen(req, timeout=600))
except urllib.error.HTTPError as e:
    print(e.code, e.read()[:500]); sys.exit(1)
open(f"audio/voz_{modelo}.mp3", "wb").write(base64.b64decode(r["audio_base64"]))
json.dump(r["alignment"], open(f"audio/alinhamento_{modelo}.json", "w"), ensure_ascii=False)
a = r["alignment"]; print("ok", modelo, len(a["characters"]), a["character_end_times_seconds"][-1])
