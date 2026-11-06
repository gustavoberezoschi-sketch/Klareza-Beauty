#!/usr/bin/env bash
# Mixagem: voz 1,6 · efeitos 0,6 · música com sidechain pela voz; normalização em duas passadas (-14 LUFS, TP -1 dBTP).
set -euo pipefail
cd "$(dirname "$0")/.."
DUR=$(python3 -c "import json;print(json.load(open('audio/eventos.json'))['duracao'])")
ffmpeg -y -v error -i audio/stem_bateria.wav -i audio/stem_baixo.wav -i audio/stem_pad.wav -i audio/stem_pluck.wav \
  -filter_complex "[0][1][2][3]amix=inputs=4:normalize=0,volume=0.5[m]" -map "[m]" audio/musica.wav
ffmpeg -y -v error -i audio/voz_final.wav -i audio/musica.wav -i audio/stem_efeitos.wav -filter_complex "
 [0]apad=whole_dur=${DUR},volume=1.6,asplit=2[v][sc];
 [1][sc]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=350[mus];
 [2]volume=0.6[fx];
 [v][mus][fx]amix=inputs=3:normalize=0:duration=first,atrim=0:${DUR}[out]" -map "[out]" -ar 48000 -ac 2 audio/mix_bruto.wav
J=$(ffmpeg -hide_banner -i audio/mix_bruto.wav -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$J" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -y -v error -i audio/mix_bruto.wav -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" -ar 48000 audio/mix_final.wav
ffmpeg -hide_banner -i audio/mix_final.wav -af ebur128=peak=true -f null - 2>&1 | grep -A12 Summary | grep -E "I:|Peak:"
