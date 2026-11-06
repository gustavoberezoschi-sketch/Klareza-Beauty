"""Trilha e efeitos sintetizados (48 kHz, stems separados) a partir de audio/eventos.json.
120 BPM, um acorde por compasso, bumbo seno 120->45 Hz, chimbal de ruído semeado, clap no 2 e 4, baixo, pad e pluck.
A levada começa no primeiro corte depois do gancho e a grade fica ancorada nele."""
import json, wave
import numpy as np
SR = 48000
E = json.load(open('audio/eventos.json'))
DUR = E['duracao']; N = int(DUR * SR) + SR
rng = np.random.default_rng(20261106)
BPM = 120; BEAT = 60 / BPM; BAR = 4 * BEAT
T0 = E['inicio_levada']  # grade ancorada no corte para a primeira cena
def env(n, a, d):
    t = np.arange(n) / SR; return np.minimum(t / max(a, 1e-4), 1) * np.exp(-t / d)
def add(buf, x, t):
    i = int(t * SR)
    if i < 0: x = x[-i:]; i = 0
    j = min(len(buf), i + len(x)); buf[i:j] += x[:j - i]
def kick():
    n = int(0.45 * SR); t = np.arange(n) / SR; f = 45 + 75 * np.exp(-t / 0.045)
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
def hat(dec=0.035):
    n = int(0.12 * SR); x = rng.standard_normal(n); x = np.diff(np.concatenate([[0], x]))  # agudo
    return x * env(n, 0.001, dec) * 0.35
def clap():
    n = int(0.3 * SR); x = rng.standard_normal(n); e = np.zeros(n)
    for k in (0, 0.011, 0.022): e += np.exp(-np.maximum(np.arange(n) / SR - k, 0) / 0.012) * (np.arange(n) / SR >= k)
    e += 0.4 * np.exp(-np.arange(n) / SR / 0.09)
    return np.convolve(x, [1, -0.6], 'same') * e * 0.4
def tone(f, dur, a=0.01, d=0.5, harm=(1, .5, .25)):
    n = int(dur * SR); t = np.arange(n) / SR
    return sum(h * np.sin(2 * np.pi * f * (k + 1) * t) for k, h in enumerate(harm)) * env(n, a, d)
# progressão (Fmaj7 - Dm9 - Bbmaj7 - C6), voicings suaves
mid = lambda m: 440 * 2 ** ((m - 69) / 12)
ACORDES = [[53, 57, 60, 64], [50, 57, 60, 65], [46, 53, 57, 62], [48, 55, 57, 64]]
BAIXO = [41, 38, 34, 36]
drums, bass, pad, pluck, sfx = (np.zeros(N) for _ in range(5))
# gancho: batidas pontuais nas três falas
for t in E['gancho']:
    add(drums, kick() * 0.9, t); add(sfx, hat(0.08) * 1.2, t + 0.01)
beats = []
fim_levada = E['fim'] + 0.2
b = 0
while T0 + b * BEAT < fim_levada:
    t = T0 + b * BEAT; beats.append(round(t, 4)); pos = b % 4; bar = b // 4
    plano = t >= E['planos']
    add(drums, kick() * (0.75 if pos in (0, 2) else 0) , t) if pos in (0, 2) else None
    if pos in (1, 3): add(drums, clap() * (0.55 if not plano else 0.4), t)
    for h in (0, 0.5): add(drums, hat() * (0.8 if h else 0.5), t + h * BEAT)
    if pos == 0:
        ch = ACORDES[bar % 4]
        add(bass, tone(mid(BAIXO[bar % 4] - 12 + 12), BAR * 0.95, 0.01, 0.9, (1, .3)) * 0.45, t)
        add(bass, tone(mid(BAIXO[bar % 4]), BEAT * 0.9, 0.005, 0.25, (1, .4)) * 0.25, t + 2.5 * BEAT)
        for m in ch:
            n = int(BAR * SR); tt = np.arange(n) / SR
            add(pad, (np.sin(2 * np.pi * mid(m + 12) * tt) + 0.3 * np.sin(2 * np.pi * mid(m + 12) * 1.003 * tt)) * np.minimum(tt / 0.4, 1) * np.minimum((BAR - tt) / 0.3, 1) * 0.07, t)
    # pluck em colcheias com padrão fixo
    padrao = [1, 0, 1, 1, 0, 1, 0, 1]
    for h in range(2):
        idx = (b * 2 + h) % 8
        if padrao[idx]:
            ch = ACORDES[bar % 4]; m = ch[(b * 2 + h) % 4] + 24
            add(pluck, tone(mid(m), 0.35, 0.002, 0.09, (1, .2, .1)) * 0.12, t + h * BEAT / 2)
    b += 1
# efeitos no instante de cada gesto
def whoosh(d=0.35):
    n = int(d * SR); x = rng.standard_normal(n); t = np.arange(n) / SR
    k = t / d; e = np.sin(np.pi * k) ** 2 * k  # cresce e termina no corte
    lp = np.convolve(x, np.ones(24) / 24, 'same')
    return lp * e * 0.6
for ev in E['eventos']:
    t = ev['t']
    if ev['tipo'] == 'corte': add(sfx, whoosh(0.3) * 0.55, t - 0.3)
    if ev['tipo'] == 'capitulo': add(sfx, whoosh(0.45) * 0.8, t - 0.45); add(sfx, tone(mid(77), 0.6, 0.003, 0.18, (1, .15)) * 0.18, t)
    if ev['tipo'] == 'toque':
        n = int(0.05 * SR); add(sfx, rng.standard_normal(n) * env(n, 0.0005, 0.006) * 0.5 + tone(1800, 0.05, 0.0005, 0.01, (1,)) * 0.2, t)
    if ev['tipo'] == 'enviar': add(sfx, tone(mid(81), 0.25, 0.003, 0.08, (1, .2)) * 0.2, t); add(sfx, tone(mid(88), 0.4, 0.003, 0.12, (1, .2)) * 0.2, t + 0.09)
    if ev['tipo'] == 'assinatura':
        for k, m in enumerate([65, 69, 72, 77]): add(sfx, tone(mid(m), 2.2, 0.01, 0.9, (1, .3, .1)) * 0.12, t + 0.05 * k)
        add(drums, kick() * 0.7, t)
# fade final da música
fade = np.ones(N); i0 = int((DUR - 1.8) * SR); fade[i0:] = np.linspace(1, 0, N - i0) ** 2
def salvar(nome, x):
    x = x[:int(DUR * SR)]; y = np.clip(x, -1, 1)
    w = wave.open(f'audio/stem_{nome}.wav', 'w'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((y * 32767 * 0.9).astype(np.int16).tobytes()); w.close()
salvar('bateria', drums * fade); salvar('baixo', bass * fade); salvar('pad', pad * fade); salvar('pluck', pluck * fade); salvar('efeitos', sfx)
json.dump({'bpm': BPM, 'ancora': T0, 'batidas': beats}, open('audio/beats.json', 'w'))
print('ok', len(beats), 'batidas')
