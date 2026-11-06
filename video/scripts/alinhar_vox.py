"""Junta os parágrafos gerados (v2/audio/partes), encurta pausas internas > 0,55 s para 0,5 s e marca o tempo de cada
palavra do roteiro com faster-whisper (word timestamps), casando com o texto por alinhamento de sequência.
Saída: v2/audio/voz_final.wav e v2/tempos.js (mesmo formato usado pelo filme)."""
import json, re, sys, difflib, unicodedata
import numpy as np, soundfile as sf
from faster_whisper import WhisperModel
BASE = sys.argv[1]; SR = 48000; GAP = 0.42
norm = lambda w: unicodedata.normalize('NFD', w.lower()).encode('ascii', 'ignore').decode()
linhas = open(f"{BASE}/v2/audio/narracao.txt", encoding="utf8").read().strip().split("\n")
modelo = WhisperModel('small', device='cpu', compute_type='int8')
def resample(x, sr, alvo):
    if sr == alvo: return x
    n = int(len(x) * alvo / sr); return np.interp(np.linspace(0, len(x) - 1, n), np.arange(len(x)), x)
def encurtar(x):
    # pausas internas: janelas de 10 ms abaixo do limiar; corta o excesso acima de 0,5 s
    e = np.array([np.sqrt((x[i:i + 480] ** 2).mean()) for i in range(0, len(x), 480)]); lim = 0.012 * np.abs(x).max()
    quiet = e < lim; mapa = []; out = []; i = 0; pos_out = 0
    while i < len(quiet):
        if quiet[i]:
            j = i
            while j < len(quiet) and quiet[j]: j += 1
            dur = j - i
            if 0 < i and j < len(quiet) and dur > 55:
                keep_a, keep_b = 25, 25
                out.append(x[i * 480:(i + keep_a) * 480]); out.append(x[(j - keep_b) * 480:j * 480])
                mapa.append(((i + keep_a) * 480 / SR, (j - keep_b) * 480 / SR))
            else: out.append(x[i * 480:j * 480])
            i = j
        else:
            j = i
            while j < len(quiet) and not quiet[j]: j += 1
            out.append(x[i * 480:j * 480]); i = j
    return np.concatenate(out), mapa
blocos, P, t0 = [], [], 0.0
for f, l in enumerate(linhas):
    x, sr = sf.read(f"{BASE}/v2/audio/partes/p{f:02d}.wav"); x = resample(x.astype(np.float64), sr, SR)
    # tira silêncio das pontas
    e = np.abs(x) > 0.01 * np.abs(x).max(); idx = np.where(e)[0]; x = x[max(0, idx[0] - 1200):idx[-1] + 2400]
    x, cortes = encurtar(x)
    a16 = resample(x, SR, 16000).astype(np.float32)
    segs, _ = modelo.transcribe(a16, language='pt', word_timestamps=True)
    ws = [(w.word.strip(), w.start, w.end) for s in segs for w in s.words]
    script = re.findall(r"[\wÀ-ÿ-]+", l)
    A = [norm(w) for w in script]; B = [norm(re.sub(r"[^\wÀ-ÿ-]", "", w[0])) for w in ws]
    tempos = [None] * len(script)
    for bl in difflib.SequenceMatcher(None, A, B, autojunk=False).get_matching_blocks():
        for k in range(bl.size): tempos[bl.a + k] = (ws[bl.b + k][1], ws[bl.b + k][2])
    # interpola o que não casou (palavras com grafia diferente na fala)
    dur = len(x) / SR; conhecidos = [(i, t) for i, t in enumerate(tempos) if t]
    for i in range(len(script)):
        if tempos[i]: continue
        ant = max([c for c in conhecidos if c[0] < i], default=(-1, (0, 0)), key=lambda c: c[0]); pos = min([c for c in conhecidos if c[0] > i], default=(len(script), (dur, dur)), key=lambda c: c[0])
        k = (i - ant[0]) / (pos[0] - ant[0]); s = ant[1][1] + (pos[1][0] - ant[1][1]) * k; tempos[i] = (s, s + 0.2)
    casadas = sum(1 for c in conhecidos)
    for w, (s, e2) in zip(script, tempos): P.append({"w": w, "s": round(t0 + s, 3), "e": round(t0 + e2, 3), "f": f})
    print(f"p{f:02d} {len(script)} palavras, {casadas} casadas", flush=True)
    blocos += [x, np.zeros(int(GAP * SR))]; t0 += len(x) / SR + GAP
voz = np.concatenate(blocos[:-1]); voz = voz / np.abs(voz).max() * 0.89
sf.write(f"{BASE}/v2/audio/voz_final.wav", voz, SR, subtype='PCM_16')
open(f"{BASE}/v2/tempos.js", "w").write("// Gerado por scripts/alinhar_vox.py (voz VoxCPM2 + faster-whisper). f = parágrafo de narracao.txt.\nwindow.TEMPOS = " + json.dumps({"duracao_voz": round(len(voz) / SR, 3), "palavras": P}, ensure_ascii=False) + ";\n")
print("duração", round(len(voz) / SR, 1))
