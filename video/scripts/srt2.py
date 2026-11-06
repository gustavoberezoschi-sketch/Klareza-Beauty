"""Legendas .srt a partir dos tempos reais das palavras (tempos.js), frases de até ~42 caracteres por linha, 2 linhas."""
import json, re, sys
T = json.loads(open(sys.argv[1]).read().split('window.TEMPOS = ', 1)[1].rstrip(';\n'))
texto = open(sys.argv[2], encoding='utf8').read()
# tokens com pontuação original, na mesma ordem das palavras alinhadas
toks = re.findall(r"[\wÀ-ÿ-]+[^\s\w]*", texto)
P = T['palavras']; assert len(toks) == len(P), (len(toks), len(P))
blocos, atual = [], []
for tok, p in zip(toks, P):
    atual.append((tok, p))
    txt = ' '.join(x for x, _ in atual)
    if re.search(r'[.?!:]$', tok) or len(txt) > 64 or (re.search(r',$', tok) and len(txt) > 40):
        blocos.append(atual); atual = []
if atual: blocos.append(atual)
def ts(s):
    ms = int(round(s * 1000)); return f"{ms // 3600000:02}:{ms // 60000 % 60:02}:{ms // 1000 % 60:02},{ms % 1000:03}"
def quebra(s):
    if len(s) <= 42: return s
    meio = len(s) // 2; i = min((k for k, c in enumerate(s) if c == ' '), key=lambda k: abs(k - meio)); return s[:i] + '\n' + s[i + 1:]
out = []
for i, b in enumerate(blocos):
    ini = b[0][1]['s']; fim = b[-1][1]['e'] + 0.15
    if i + 1 < len(blocos): fim = min(fim, blocos[i + 1][0][1]['s'] - 0.02)
    out.append(f"{i + 1}\n{ts(ini)} --> {ts(fim)}\n{quebra(' '.join(x for x, _ in b))}\n")
open(sys.argv[3], 'w', encoding='utf8').write('\n'.join(out)); print(len(out), 'legendas')
