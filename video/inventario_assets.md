# Inventário de assets — 06/11/2026

Detalhe técnico (viewport, escala, caixa CSS, dimensões físicas) em `assets/meta.json`. Toda tela com dados entra no vídeo com a etiqueta **"Exemplo"**.

## Marca e fontes (site público)

| Arquivo | Origem | Observação |
|---|---|---|
| `assets/logo_klareza_beauty_original.svg` | `https://klareza-beauty.vercel.app/icon.svg` (idêntico a `src/app/icon.svg`) | Símbolo oficial, gradiente `#C4588A→#5E2140`, sem redesenho |
| `assets/fonts/Geist-latin.woff2` | `/_next/static/media/22a5144ee8d83bca-s.p.woff2` | Geist variável; título 600, 112 px, −5,04 px confirmado |
| `assets/fonts/Figtree-latin.woff2` | `/_next/static/media/de42cfb9a3b980ae-s.p.woff2` | Corpo/interface |
| `assets/fonts/InstrumentSerif-Italic-latin.woff2` | `/_next/static/media/9cc5b37ab1350db7-s.p.woff2` | Palavra-chave |

Wordmark: "Klareza" tinta + "Beauty" vinho, Figtree 600 (`src/components/Marca.tsx`). Cores: vinho `#7A2E52` (também `corDestaque` padrão no schema), rosa `#E7A3C3` confirmado em CSS; demais valores da FICHA mantidos.

## Demonstrações oficiais publicadas (site público, rodapé: "dados de demonstração")

| Arquivo | Dimensão | Uso |
|---|---|---|
| `landing/inicio.webp` | 1600×1000 | Início |
| `landing/agenda.webp` | 1600×1000 | Agenda |
| `landing/lembretes.webp` | 1600×1000 | Lembretes |
| `landing/comandas.webp` | 1600×1000 | Comandas |
| `landing/assinaturas.webp` | 1600×1000 | Clube |
| `landing/financeiro.webp` | 1600×1000 | Financeiro |
| `landing/relatorios.webp` | 1600×1000 | Relatórios |
| `landing/cel-agendar.webp`, `cel-conta.webp`, `cel-plano.webp` | 585×1266 | Celular |

## Capturas novas em 2× — instância local de demonstração

Playwright, `deviceScaleFactor: 2`, desktop 1440×1000 (elemento `main`, 2368 px de largura física) e celular 390×844 (780×1688). Dados = seed fictício do repositório ("Studio Flor de Lótus"). Aviso de cookies dispensado pelo botão "Entendi"; nenhum texto do DOM alterado.

| Área | Arquivo(s) em `assets/capturas/` |
|---|---|
| Início / menu completo | `painel_inicio.png`, `painel_inicio_com_menu.png` |
| Agenda, bloqueios, encaixe | `painel_agenda.png`, `painel_agenda_bloqueios.png`, `painel_agenda_novo.png` |
| Lembretes (6 listas) | `painel_lembretes.png` |
| Comandas | `painel_comandas.png`, `painel_comanda_detalhe.png` |
| Caixa | `painel_caixa.png` |
| Clientes / ficha (anamnese, fotos, fórmulas) | `painel_clientes.png`, `painel_cliente_ficha.png` |
| Clube de assinatura | `painel_assinaturas.png` |
| Pacotes | `painel_pacotes.png` |
| Página do cliente (QR, banners, parceiros) | `painel_vitrine.png` |
| Serviços (variações, adicionais, manutenção por prazo, material) | `painel_servicos.png`, `painel_servico_extensao.png`, `painel_servico_alongamento.png`, `painel_servico_manutencao.png` |
| Produtos e estoque | `painel_produtos.png`, `painel_produto_detalhe.png` |
| Equipe / comissões | `painel_equipe.png`, `painel_equipe_detalhe.png` |
| Financeiro | `painel_financeiro.png` |
| Pagamentos online | `painel_pagamentos.png` (demo local sem Asaas: "Ainda não disponível") |
| Unidades | `painel_unidades.png` |
| Relatórios | `painel_relatorios.png` |
| Configurações | `painel_configuracoes.png` |
| Meu plano (4 planos) | `painel_plano.png` |
| Profissional (acesso restrito) | `profissional_painel.png` |
| Celular: página do salão | `cel_pagina_salao.png` |
| Celular: agendamento (sem confirmar) | `cel_agendar_inicio.png` … `cel_agendar_6_horario_escolhido.png` |
| Celular: área do cliente | `cel_conta_conta.png`, `cel_conta_conta_agendamentos.png`, `cel_conta_conta_vantagens.png`, `cel_conta_conta_plano.png`, `cel_conta_conta_perfil.png`, `cel_conta_agendamento_*.png` |

## Limitações

- Não são telas da conta de produção nem resultados reais; servem para mostrar a interface real com dados fictícios.
- Em `painel_vitrine.png` e `painel_configuracoes.png` aparece `http://localhost:3100/...` na barra do link: **recortar essa faixa** no vídeo.
- Telas com anamnese mostram dados de saúde **fictícios**; no vídeo, mostrar só o cabeçalho/estrutura da ficha, sem zoom em campos de saúde.
- Clube no cartão e sinal por Pix não têm tela de pagamento ativa na demo: mostrar com a condição "requer conta de recebimento aprovada".
- Login da conta de produção não feito (credenciais não fornecidas).
