#!/usr/bin/env bash
# Mixagem: voz 1,6 · efeitos 0,6 · música com sidechain pela voz; normalização em duas passadas (-14 LUFS, TP -1 dBTP).
set -euo pipefail
cd "$(dirname "$0")/.."
A=${1:-audio}
EV=audio/eventos.json; [ "$A" != audio ] && EV=v2/audio_eventos.json
DUR=$(python3 -c "import json;print(json.load(open('$EV'))['duracao'])")
ffmpeg -y -v error -i $A/stem_bateria.wav -i $A/stem_baixo.wav -i $A/stem_pad.wav -i $A/stem_pluck.wav \
  -filter_complex "[0][1][2][3]amix=inputs=4:normalize=0,volume=0.5[m]" -map "[m]" $A/musica.wav
ffmpeg -y -v error -i $A/voz_final.wav -i $A/musica.wav -i $A/stem_efeitos.wav -filter_complex "
 [0]apad=whole_dur=${DUR},volume=1.6,asplit=2[v][sc];
 [1][sc]sidechaincompress=threshold=0.02:ratio=10:attack=15:release=350[mus];
 [2]volume=0.6[fx];
 [v][mus][fx]amix=inputs=3:normalize=0:duration=first,atrim=0:${DUR}[out]" -map "[out]" -ar 48000 -ac 2 $A/mix_bruto.wav
J=$(ffmpeg -hide_banner -i $A/mix_bruto.wav -af loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
g() { echo "$J" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -y -v error -i $A/mix_bruto.wav -af "loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):offset=$(g target_offset):linear=true,aresample=48000" -ar 48000 $A/mix_final.wav
ffmpeg -hide_banner -i $A/mix_final.wav -af ebur128=peak=true -f null - 2>&1 | grep -A12 Summary | grep -E "I:|Peak:"
