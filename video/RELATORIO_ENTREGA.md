# Relatório de entrega — vídeo "todas as funções" · 06/11/2026

## Arquivos

| Arquivo | Situação |
|---|---|
| `saida/klareza_beauty_todas_as_funcoes_leve.mp4` | Versão para postar (CRF 21, ~35 MB). No repositório |
| `saida/klareza_beauty_todas_as_funcoes.mp4` | Master CRF 16 (~183 MB). **Não vai para o GitHub** (limite de 100 MB por arquivo); recriável com `node scripts/render.mjs --out saida/video_sem_audio.mp4 && scripts/finalizar.sh` |
| `saida/capa_1080x1920.png` | Capa, essenciais entre y 262 e 1660 |
| `saida/legenda_instagram.txt` | Legenda, 5 hashtags |
| `saida/klareza_beauty_todas_as_funcoes.srt` | 58 legendas a partir dos tempos reais da voz |
| `vistoria.md`, `inventario_assets.md`, `assets/meta.json` | Vistoria, inventário e origem de cada asset |

## Verificações executadas

| Item | Resultado medido |
|---|---|
| Resolução / fps / codec | 1080×1920, 30 fps, H.264 yuv420p, AAC 256k, `+faststart` |
| Duração / quadros | 176,77 s = 5.303 quadros (voz 174,16 s + 2,6 s de fechamento) |
| Loudness | −14,0 LUFS integrado; pico verdadeiro −1,8 dBTP |
| Pausas internas da voz | maior 0,48 s (27 pausas encurtadas para 0,5 s; aceleração 1,06×; tempos remapeados) |
| Quadros claros/escuros | 0 alertas de YAVG (> 240 ou < 8) |
| Determinismo | toda propriedade sai de `seek(t)`; grão por quadro com mulberry32; sem `Math.random`, `setTimeout` ou relógio no render |
| Fontes | Geist, Figtree e Instrument Serif oficiais carregadas antes do render (`window.ready` falha se não carregarem) |
| Folhas de contato | 4 rodadas inspecionadas; corrigidos: gancho estourando a largura, barra `localhost` visível, anel no lugar errado, subtítulo preso, câmera dos planos, etiqueta "dados fictícios" sobre preços reais, grão pesado demais |

## Notas (PLAYBOOK §10)

| Critério | Nota | Observação |
|---|---|---|
| Gancho em 2 s | 8 | Primeira linha já na tela no quadro 0 |
| Leitura no celular | 7 | Títulos, subtítulos, régua e preços legíveis; o texto miúdo das telas do painel é apoio, não leitura. Limite do pedido: 60 funções em 3 min |
| Clareza do fluxo | 8 | 5 capítulos + planos, um gesto por função |
| Precisão de recursos e planos | 9 | Planos e condições conferidos no site e no código em 06/11 |
| Fidelidade visual | 9 | Só telas reais (demo do próprio app) e um diagrama do envio marcado como ilustração |
| Movimento | 8 | Câmera até o detalhe, empurrão lateral, cortina por capítulo, toques e anéis |
| Variedade | 7 | Proposta; não há histórico das linguagens usadas para comparar |
| Sincronia | 8 | Cenas, toques e efeitos amarrados às palavras reais |
| Ritmo | 7 | Denso de propósito (troca a cada 1–4 s) |
| Privacidade | 8 | Só dados fictícios do seed; anamnese fictícia aparece pequena, sem zoom |

Ficaram abaixo de 8 a leitura no celular, a variedade e o ritmo. Os três vêm de colocar todas as funções num Reels de até 3 minutos; resolver de verdade pede dividir o conteúdo em uma série de vídeos.

## Limitações que continuam

- A conta de produção não foi acessada (sem credenciais no ambiente). As telas vêm de uma instância local do código do repositório com os dados de demonstração dele.
- Nenhuma reserva, venda, cobrança ou envio foi testado; o funcionamento descrito vem do site, do código e da navegação de leitura.
- Histórico do Instagram: o embed mostrou 6 dos 26 posts. Por isso o gancho foi trocado; isso não prova que o perfil inteiro foi conferido.
- O site ainda diz "Tudo incluso, em todos os planos", o que contradiz o Solo atual. O vídeo não repete essa frase.
