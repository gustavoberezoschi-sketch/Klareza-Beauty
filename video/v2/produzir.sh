#!/usr/bin/env bash
# Pipeline v2 depois da voz: tempos reais -> validação -> trilha -> mix -> render 9:16 e 16:9 -> versões leves -> .srt
set -euo pipefail
cd "$(dirname "$0")/.."
python3 scripts/voz_v2.py parte_a 1.05
python3 scripts/voz_v2.py parte_b 1.05
python3 scripts/processar_voz_v2.py 1.0
node scripts/validar_cenas.js v2
python3 scripts/trilha.py v2/audio_eventos.json v2/audio
scripts/mixar.sh v2/audio
for F in 9x16 16x9; do
  node scripts/render2.mjs --formato $F --out v2/saida/video_${F}_sem_audio.mp4
  ffmpeg -y -v error -i v2/saida/video_${F}_sem_audio.mp4 -i v2/audio/mix_final.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -shortest -movflags +faststart v2/saida/klareza_beauty_${F}.mp4
  ffmpeg -y -v error -i v2/saida/klareza_beauty_${F}.mp4 -vf hqdn3d=1.5:1.5:6:6 -c:v libx264 -preset slow -crf 21 -pix_fmt yuv420p -c:a copy -movflags +faststart v2/saida/klareza_beauty_${F}_leve.mp4
done
