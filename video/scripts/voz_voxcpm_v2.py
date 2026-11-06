"""Narração v2 com VoxCPM2 (Apache-2.0), grátis e local. Voz 'b' escolhida pela usuária, mantida igual em todos os
parágrafos usando a amostra aprovada como referência. 'Beauty' vai escrito 'Biuti' só para a voz (grafia aprovada).
Gera um WAV por parágrafo em v2/audio/partes/."""
import soundfile as sf, sys, os, time
from voxcpm import VoxCPM
BASE = sys.argv[1]; REF = sys.argv[2]
REF_TXT = "Agenda no caderno, caixa na planilha e cliente no WhatsApp? O Klareza Beauty organiza o salão inteiro. A ficha de anamnese registra alergias, como cola, esmalte ou henna, gestação, lentes de contato e procedimentos recentes."
m = VoxCPM.from_pretrained("openbmb/VoxCPM2", load_denoiser=False); sr = m.tts_model.sample_rate
linhas = open(f"{BASE}/v2/audio/narracao.txt", encoding="utf8").read().strip().split("\n")
for f, l in enumerate(linhas):
    out = f"{BASE}/v2/audio/partes/p{f:02d}.wav"
    if os.path.exists(out): continue
    t0 = time.time()
    w = m.generate(text=l.replace("Beauty", "Biuti"), prompt_wav_path=REF, prompt_text=REF_TXT, reference_wav_path=REF, cfg_value=2.0, inference_timesteps=10)
    sf.write(out, w, sr); print(f"p{f:02d}", round(len(w) / sr, 1), "s em", round(time.time() - t0), "s", flush=True)
print("fim")
