"""v2: junta as duas leituras (dona / cliente) com 0,5 s entre elas, encurta pausas internas > 0,55 s para 0,5 s,
aplica leve aceleração e grava v2/audio/voz_final.wav + v2/tempos.js (palavras com o parágrafo f de narracao.txt)."""
import json, re, subprocess, sys, wave
import numpy as np
FATOR = float(sys.argv[1]) if len(sys.argv) > 1 else 1.0
SR = 48000
def ler(mp3):
    subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", mp3, "-ac", "1", "-ar", str(SR), "/var/tmp/_p.wav"], check=True)
    w = wave.open("/var/tmp/_p.wav"); return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32)
def palavras(ali, texto, f0):
    ch, s, e = ali["characters"], ali["character_start_times_seconds"], ali["character_end_times_seconds"]
    out, atual, f = [], None, f0
    for i, c in enumerate(ch):
        if re.match(r"[\wÀ-ÿ-]", c):
            if atual is None: atual = {"w": "", "s": s[i], "e": e[i], "f": f}
            atual["w"] += c; atual["e"] = e[i]
        else:
            if atual: out.append(atual); atual = None
            if c == "\n": f += 1
    if atual: out.append(atual)
    return out
linhas_a = open("v2/audio/parte_a.txt", encoding="utf8").read().strip().split("\n")
partes = [("parte_a", 0), ("parte_b", len(linhas_a))]
x_total, P, desloc = [], [], 0.0
for nome, f0 in partes:
    x = ler(f"v2/audio/voz_{nome}.mp3"); A = json.load(open(f"v2/audio/alinhamento_{nome}.json"))
    for p in palavras(A, None, f0): p["s"] += desloc; p["e"] += desloc; P.append(p)
    x_total.append(x); x_total.append(np.zeros(int(0.5 * SR), np.float32)); desloc += len(x) / SR + 0.5
x = np.concatenate(x_total[:-1])
w = wave.open("/var/tmp/_v.wav", "w"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(np.clip(x, -32768, 32767).astype(np.int16).tobytes()); w.close()
log = subprocess.run(["ffmpeg", "-hide_banner", "-i", "/var/tmp/_v.wav", "-af", "silencedetect=n=-38dB:d=0.3", "-f", "null", "-"], capture_output=True, text=True).stderr
ini = [float(v) for v in re.findall(r"silence_start: ([\d.]+)", log)]; fim = [float(v) for v in re.findall(r"silence_end: ([\d.]+)", log)]
cortes = [(a + 0.25, b - 0.25) for a, b in zip(ini, fim) if a > 0.05 and b < len(x) / SR - 0.05 and b - a > 0.55]
partes2, pos = [], 0
for a, b in cortes: partes2.append(x[pos:int(a * SR)]); pos = int(b * SR)
partes2.append(x[pos:]); y = partes2[0]; fd = int(0.005 * SR); r = np.linspace(0, 1, fd)
for p in partes2[1:]: y = np.concatenate([y[:-fd], y[-fd:] * (1 - r) + p[:fd] * r, p[fd:]])
w = wave.open("/var/tmp/_vs.wav", "w"); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(np.clip(y, -32768, 32767).astype(np.int16).tobytes()); w.close()
subprocess.run(["ffmpeg", "-y", "-v", "error", "-i", "/var/tmp/_vs.wav", "-af", f"atempo={FATOR}", "-ar", str(SR), "v2/audio/voz_final.wav"], check=True)
mapa = lambda t: (t - sum(min(max(t - a, 0), b - a) for a, b in cortes)) / FATOR
for p in P: p["s"] = round(mapa(p["s"]), 3); p["e"] = round(mapa(p["e"]), 3)
dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", "v2/audio/voz_final.wav"], capture_output=True, text=True).stdout)
open("v2/tempos.js", "w").write("// Gerado por scripts/processar_voz_v2.py a partir do áudio real. f = parágrafo de narracao.txt.\nwindow.TEMPOS = " + json.dumps({"duracao_voz": round(dur, 3), "palavras": P}, ensure_ascii=False) + ";\n")
print("cortes", len(cortes), "duração", round(dur, 1), "palavras", len(P))
