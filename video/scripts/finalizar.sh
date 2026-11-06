#!/usr/bin/env bash
# Junta vídeo + mix, AAC 256k, +faststart, e verifica o resultado.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=saida/klareza_beauty_todas_as_funcoes.mp4
ffmpeg -y -v error -i saida/video_sem_audio.mp4 -i audio/mix_final.wav -map 0:v -map 1:a -c:v copy -c:a aac -b:a 256k -ar 48000 -shortest -movflags +faststart "$OUT"
ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt,nb_frames,duration -show_entries format=duration,size -of compact "$OUT"
ffmpeg -hide_banner -i "$OUT" -map 0:a -af ebur128=peak=true -f null - 2>&1 | grep -E "^\s+(I|Peak):"
ffmpeg -hide_banner -i "$OUT" -vf signalstats,metadata=print:key=lavfi.signalstats.YAVG -an -f null - 2>&1 | grep -o "YAVG=[0-9.]*" | awk -F= '{v=$2; if(v>240||v<8)a++; n++} END{print "quadros",n,"alertas YAVG",a+0}'
ls -la "$OUT"
