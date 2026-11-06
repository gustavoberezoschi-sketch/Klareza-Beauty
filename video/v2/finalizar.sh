#!/usr/bin/env bash
# Render dos dois formatos (em paralelo), junta o áudio final e gera versões leves.
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/render2.mjs --formato 9x16 --out v2/saida/video_9x16_sem_audio.mp4 > /var/tmp/fr9.log 2>&1 &
node scripts/render2.mjs --formato 16x9 --out v2/saida/video_16x9_sem_audio.mp4 > /var/tmp/fr16.log 2>&1 &
wait
for F in 9x16 16x9; do
  ffmpeg -y -v error -i v2/saida/video_${F}_sem_audio.mp4 -i v2/audio/mix_final.wav -map 0:v -map 1:a -c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -c:a aac -b:a 256k -shortest -movflags +faststart v2/saida/klareza_beauty_${F}.mp4
  ffmpeg -y -v error -i v2/saida/klareza_beauty_${F}.mp4 -vf hqdn3d=1.5:1.5:6:6 -c:v libx264 -preset slow -crf 23 -pix_fmt yuv420p -c:a copy -movflags +faststart v2/saida/klareza_beauty_${F}_leve.mp4
done
echo FIM
