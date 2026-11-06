"""Tempos PROVISÓRIOS (sem áudio): estimados pelo texto, no ritmo medido da v1 (≈0,0728 s por caractere).
Servem só para montar e revisar o movimento; o render final usa os tempos reais da voz."""
import json, re
linhas = open('v2/audio/narracao.txt', encoding='utf8').read().strip().split('\n')
t = 0.0; palavras = []
for f, l in enumerate(linhas):
    for tok in re.findall(r"[\wÀ-ÿ-]+[^\s\w]*", l):
        w = re.match(r"[\wÀ-ÿ-]+", tok).group(0)
        d = 0.066 * (len(w) + 1)
        palavras.append({"w": w, "s": round(t, 3), "e": round(t + d - 0.03, 3), "f": f}); t += d
        if re.search(r'[.?!:]$', tok): t += 0.42
        elif tok.endswith(','): t += 0.18
    t += 0.15
open('v2/tempos.js', 'w').write("// PROVISÓRIO: estimado pelo texto (sem áudio). f = parágrafo.\nwindow.TEMPOS = " + json.dumps({"duracao_voz": round(t, 3), "provisorio": True, "palavras": palavras}, ensure_ascii=False) + ";\n")
print(round(t, 1), 's', len(palavras), 'palavras')
