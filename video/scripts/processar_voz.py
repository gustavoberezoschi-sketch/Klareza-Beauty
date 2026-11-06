"""Encurta pausas internas > 0,55 s para 0,5 s, aplica leve aceleração e remapeia os tempos das palavras.
Saída: audio/voz_final.wav (48 kHz) e tempos.js (palavras e frases com tempos reais)."""
import json, re, subprocess, sys, wave, struct
import numpy as np
SRC = sys.argv[1]; ALI = sys.argv[2]; FATOR = float(sys.argv[3])
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", SRC, "-ac", "1", "-ar", "48000", "/var/tmp/voz_src.wav"], check=True)
w = wave.open("/var/tmp/voz_src.wav"); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32)
log = subprocess.run(["ffmpeg", "-hide_banner", "-i", "/var/tmp/voz_src.wav", "-af", "silencedetect=n=-38dB:d=0.3", "-f", "null", "-"], capture_output=True, text=True).stderr
ini = [float(v) for v in re.findall(r"silence_start: ([\d.]+)", log)]; fim = [float(v) for v in re.findall(r"silence_end: ([\d.]+)", log)]
cortes = []  # (inicio_do_corte, fim_do_corte) em segundos originais
for a, b in zip(ini, fim):
    if a < 0.05 or b > len(x) / sr - 0.05: continue
    if b - a > 0.55: cortes.append((a + 0.25, b - 0.25))
# monta áudio sem os trechos cortados (com micro-crossfade de 5 ms)
partes, pos = [], 0
for a, b in cortes:
    partes.append(x[pos:int(a * sr)]); pos = int(b * sr)
partes.append(x[pos:])
y = partes[0]
fade = int(0.005 * sr); r = np.linspace(0, 1, fade)
for p in partes[1:]:
    y = np.concatenate([y[:-fade], y[-fade:] * (1 - r) + p[:fade] * r, p[fade:]])
wave_out = wave.open("/var/tmp/voz_sem_pausas.wav", "w"); wave_out.setnchannels(1); wave_out.setsampwidth(2); wave_out.setframerate(sr)
wave_out.writeframes(np.clip(y, -32768, 32767).astype(np.int16).tobytes()); wave_out.close()
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", "/var/tmp/voz_sem_pausas.wav", "-af", f"atempo={FATOR}", "-ar", "48000", "audio/voz_final.wav"], check=True)
def mapa(t):
    removido = sum(min(max(t - a, 0), b - a) for a, b in cortes)
    return (t - removido) / FATOR
# palavras a partir do alinhamento por caractere
A = json.load(open(ALI)); ch = A["characters"]; s = A["character_start_times_seconds"]; e = A["character_end_times_seconds"]
palavras, atual = [], None
frase = 0
for i, c in enumerate(ch):
    if re.match(r"[\wÀ-ÿ-]", c):
        if atual is None: atual = {"w": "", "s": s[i], "e": e[i], "f": frase}
        atual["w"] += c; atual["e"] = e[i]
    else:
        if atual: palavras.append(atual); atual = None
        if c in ".?!\n": frase += 1 if c == "\n" else 0
if atual: palavras.append(atual)
for p in palavras: p["s"] = round(mapa(p["s"]), 3); p["e"] = round(mapa(p["e"]), 3)
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", "audio/voz_final.wav"], capture_output=True, text=True).stdout)
open("tempos.js", "w").write("// Gerado por scripts/processar_voz.py a partir do áudio real. f = número do parágrafo.\nwindow.TEMPOS = " + json.dumps({"duracao_voz": round(dur, 3), "palavras": palavras}, ensure_ascii=False) + ";\n")
print("cortes", len(cortes), "duracao", round(dur, 2), "palavras", len(palavras))
