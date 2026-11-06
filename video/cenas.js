// Mapa de cenas e eventos do vídeo. Usado pelo filme (film.html) e pela trilha/efeitos (scripts/trilha.py via node).
// Todos os tempos vêm das palavras realmente narradas (tempos.js). Coordenadas em px CSS da captura.
(function (raiz) {
  const T = raiz.TEMPOS;
  const P = T.palavras;
  // Tempo de início da n-ésima ocorrência de `palavra` no parágrafo f (diferencia repetições).
  function W(f, palavra, n = 0) {
    const alvo = palavra.toLowerCase();
    let k = 0;
    for (const p of P) if (p.f === f && p.w.toLowerCase() === alvo) { if (k === n) return p.s; k++; }
    throw new Error(`palavra não encontrada: [${f}] ${palavra} #${n}`);
  }
  const FIM_VOZ = T.duracao_voz;
  const DURACAO = Math.ceil((FIM_VOZ + 2.6) * 30) / 30;

  // ---------- capítulos (marcador + título) ----------
  const CAP = [
    { t: W(1, 'O'), marcador: 'Klareza Beauty', titulo: ['O salão inteiro', '{num lugar só.}'] },
    { t: W(2, 'Um'), marcador: '1 de 5 · A cliente', titulo: ['Ela agenda', '{sozinha.}'] },
    { t: W(3, 'Na'), marcador: '1 de 5 · A cliente', titulo: ['E acompanha tudo', 'na área {dela.}'] },
    { t: W(4, 'Dois'), marcador: '2 de 5 · Agenda e lembretes', titulo: ['A agenda', 'se {organiza.}'] },
    { t: W(4, 'Em'), marcador: '2 de 5 · Agenda e lembretes', titulo: ['Lembrete pronto,', '{envio seu.}'] },
    { t: W(5, 'Três'), marcador: '3 de 5 · O balcão', titulo: ['Comanda, estoque', 'e {caixa.}'] },
    { t: W(6, 'Quatro'), marcador: '4 de 5 · Clientes e clube', titulo: ['Cada cliente', '{por inteiro.}'] },
    { t: W(6, 'No'), marcador: '4 de 5 · Clientes e clube', titulo: ['Clube de', '{assinatura.}'] },
    { t: W(7, 'Cinco'), marcador: '5 de 5 · A gestão', titulo: ['Equipe, contas', 'e {números.}'] },
    { t: W(8, 'São'), marcador: 'Planos', titulo: ['Quatro', '{planos.}'] },
  ];

  // ---------- tomadas no palco ----------
  // tipo desk: cam = [[t, [x,y,w,h]]]; tipo cel: cam = [[t, y]] (rolagem em px CSS); u = px da imagem por px CSS
  const D = 'assets/capturas/', L = 'assets/landing/';
  const S = [];
  const add = (o) => S.push(o);
  // Ponte
  add({ t: W(1, 'Klareza'), tipo: 'desk', img: D + 'painel_inicio_com_menu.png', u: 2, cam: [[0, [0, 0, 1440, 1000]], [W(1, 'Olha'), [0, 40, 420, 380]], [W(1, 'faz') , [0, 360, 420, 380]]],
    sub: '18 áreas no menu: do início ao plano.', subT: W(1, 'Olha') });
  // Capítulo 1
  add({ t: W(2, 'Um'), tipo: 'cel', img: D + 'cel_pagina_salao.png', u: 2, cam: [[0, 0], [W(2, 'página') + 0.6, 360]], sub: 'Página própria do salão, com a sua marca.', subT: W(2, 'O') });
  add({ t: W(2, 'QR'), tipo: 'desk', img: D + 'painel_vitrine.png', u: 2, cam: [[0, [40, 191, 1104, 894]], [W(2, 'balcão'), [40, 191, 560, 520]]],
    hl: [[W(2, 'QR') + 0.4, W(2, 'Ali'), [56, 247, 170, 170]]], sub: 'Link na bio e QR code. Placa de brinde: Bairro ou superior.', subT: W(2, 'QR') });
  add({ t: W(2, 'Ali'), tipo: 'cel', img: D + 'cel_agendar_inicio.png', u: 2, cam: [[0, 0]], taps: [[W(2, 'unidade'), 200, 280]], sub: 'Escolhe a unidade…', subT: W(2, 'escolhe') });
  add({ t: W(2, 'profissional'), tipo: 'cel', img: D + 'cel_agendar_1_profissional.png', u: 2, cam: [[0, 100]], taps: [[W(2, 'profissional') + 0.35, 195, 400]], sub: '…a profissional…', subT: W(2, 'profissional') });
  add({ t: W(2, 'serviços'), tipo: 'cel', img: D + 'cel_agendar_3_variacao.png', u: 2, cam: [[0, 300]], sub: '…os serviços, com variações e adicionais…', subT: W(2, 'serviços'),
    hl: [[W(2, 'variações'), W(2, 'adicionais') + 0.3, [20, 580, 350, 170]]] });
  add({ t: W(2, 'adicionais') + 0.25, tipo: 'cel', img: D + 'cel_agendar_4_escolhido.png', u: 2, cam: [[0, 300]], taps: [[W(2, 'adicionais') + 0.3, 120, 621]] });
  add({ t: W(2, 'horário'), tipo: 'cel', img: D + 'cel_agendar_5_horario.png', u: 2, cam: [[0, 120]], taps: [[W(2, 'horário') + 0.4, 237, 479]], sub: '…e o horário. O total aparece no rodapé.', subT: W(2, 'horário') });
  add({ t: W(2, 'navegador') - 0.2, tipo: 'cel', img: D + 'cel_agendar_6_horario_escolhido.png', u: 2, cam: [[0, 100]], sub: 'Pelo navegador, sem baixar aplicativo.', subT: W(2, 'navegador') });
  add({ t: W(2, 'Se'), tipo: 'desk', img: D + 'painel_configuracoes.png', u: 2, cam: [[0, [600, 620, 504, 490]]], hl: [[W(2, 'sinal'), W(2, 'E', 3), [612, 690, 480, 90]]],
    sub: 'Sinal por Pix: opcional, Bairro ou superior, com conta de recebimento aprovada.', subT: W(2, 'Se') });
  add({ t: W(2, 'E', 3), tipo: 'cel', img: D + 'cel_conta_agendamento_afebfaedbef.png', u: 2, cam: [[0, 160]], hl: [[W(2, 'ficha'), W(3, 'Na'), [28, 380, 334, 60]]],
    sub: 'Ficha de anamnese e termo assinado pelo celular.', subT: W(2, 'E', 3) });
  // área do cliente
  add({ t: W(3, 'Na'), tipo: 'cel', img: D + 'cel_conta_conta_agendamentos.png', u: 2, cam: [[0, 0]], sub: 'Vê os agendamentos…', subT: W(3, 'vê') });
  add({ t: W(3, 'confirma'), tipo: 'cel', img: D + 'cel_conta_agendamento_afebfaedbef.png', u: 2, cam: [[0, 200]], taps: [[W(3, 'presença'), 195, 494]], sub: '…confirma presença…', subT: W(3, 'confirma') });
  add({ t: W(3, 'acompanha'), tipo: 'cel', img: D + 'cel_conta_conta_plano.png', u: 2, cam: [[0, 0]], sub: '…acompanha o plano…', subT: W(3, 'acompanha') });
  add({ t: W(3, 'usa'), tipo: 'cel', img: L + 'cel-conta.webp', u: 1.5, cam: [[0, 300]], hl: [[W(3, 'cashback'), W(3, 'pega'), [16, 590, 358, 75]]], sub: '…usa o cashback…', subT: W(3, 'usa') });
  add({ t: W(3, 'pega'), tipo: 'cel', img: D + 'cel_conta_conta_vantagens.png', u: 2, cam: [[0, 0]], taps: [[W(3, 'cupons') + 0.3, 92, 283]], sub: '…pega cupons dos parceiros…', subT: W(3, 'pega') });
  add({ t: W(3, 'e'), tipo: 'cel', img: D + 'cel_conta_conta.png', u: 2, cam: [[0, 300]], hl: [[W(3, 'indica'), W(4, 'Dois'), [20, 600, 350, 200]]], sub: '…e indica uma amiga: as duas ganham crédito.', subT: W(3, 'indica') });
  // Capítulo 2
  add({ t: W(4, 'Dois'), tipo: 'desk', img: D + 'painel_inicio.png', u: 2, cam: [[0, [0, 0, 1184, 900]], [W(4, 'faturamento'), [30, 100, 840, 430]], [W(4, 'próximos'), [30, 510, 730, 380]], [W(4, 'avisos'), [750, 380, 410, 330]]],
    sub: 'Início: faturamento, próximos atendimentos e avisos.', subT: W(4, 'Dois') + 0.4 });
  add({ t: W(4, 'A', 1), tipo: 'desk', img: D + 'painel_agenda.png', u: 2, cam: [[0, [30, 100, 1124, 760]], [W(4, 'coluna'), [30, 100, 760, 560]]], sub: 'Uma coluna por profissional.', subT: W(4, 'A', 1),
    hl: [[W(4, 'coluna'), W(4, 'folgas'), [40, 115, 370, 700]]] });
  add({ t: W(4, 'folgas'), tipo: 'desk', img: D + 'painel_agenda_bloqueios.png', u: 2, cam: [[0, [134, 132, 916, 492]]], sub: 'Almoço, folgas, férias e feriados bloqueados.', subT: W(4, 'folgas') });
  add({ t: W(4, 'encaixe'), tipo: 'desk', img: D + 'painel_agenda_novo.png', u: 2, cam: [[0, [246, 108, 692, 760]], [W(4, 'encaixe') + 0.3, [246, 560, 692, 300]]], hl: [[W(4, 'encaixe') + 0.6, W(4, 'remarcação'), [256, 725, 672, 44]]],
    sub: 'Encaixe manual, remarcação e atendimento simultâneo.', subT: W(4, 'encaixe') });
  add({ t: W(4, 'O', 2), tipo: 'desk', img: L + 'agenda.webp', u: 1, cam: [[0, [0, 0, 1600, 1000]], [W(4, 'site') , [400, 120, 1150, 560]]], hl: [[W(4, 'aparece'), W(4, 'Em'), [416, 296, 352, 142]]],
    sub: 'O que a cliente marca pelo site aparece na hora.', subT: W(4, 'O', 2) });
  add({ t: W(4, 'Em'), tipo: 'desk', img: D + 'painel_lembretes.png', u: 2, cam: [[0, [30, 0, 1124, 800]], [W(4, 'amanhã'), [30, 140, 708, 320]], [W(4, 'manutenção'), [30, 1718, 708, 424]], [W(4, 'lista'), [30, 1224, 708, 195]]],
    sub: 'Mensagens prontas: amanhã, hoje, manutenção e lista de espera.', subT: W(4, 'ficam') });
  add({ t: W(4, 'cuidados'), tipo: 'desk', img: D + 'painel_servico_extensao.png', u: 2, cam: [[0, [80, 600, 700, 170]]], sub: 'Cuidados pós-atendimento de cada serviço, com pedido de avaliação.', subT: W(4, 'cuidados') });
  add({ t: W(4, 'Você'), tipo: 'desk', img: D + 'painel_lembretes.png', u: 2, cam: [[0, [30, 140, 708, 320]]], taps: [[W(4, 'toca'), 668, 226]], sub: 'Você toca em “Lembrar”…', subT: W(4, 'Você') });
  add({ t: W(4, 'o', 3), tipo: 'html', html: 'whats', sub: '…o WhatsApp abre com o texto pronto e você envia.', subT: W(4, 'o', 3) });
  // Capítulo 3
  add({ t: W(5, 'Três'), tipo: 'desk', img: L + 'comandas.webp', u: 1, cam: [[0, [370, 0, 1230, 1000]]], sub: 'Ao iniciar o atendimento pela agenda, a comanda abre.', subT: W(5, 'Ao') });
  add({ t: W(5, 'Você'), tipo: 'desk', img: D + 'painel_comanda_detalhe.png', u: 2, cam: [[0, [70, 260, 1044, 350]], [W(5, 'desconto'), [734, 260, 380, 350]]],
    sub: 'Serviços, produtos, desconto, cashback, pagamento e recibo.', subT: W(5, 'Você') });
  add({ t: W(5, 'Pacotes'), tipo: 'desk', img: D + 'painel_pacotes.png', u: 2, cam: [[0, [30, 100, 730, 200]]], hl: [[W(5, 'sessões'), W(5, 'Ao', 1), [400, 115, 348, 164]]],
    sub: 'Pacotes de sessões: vendidos na comanda, abatidos nas visitas.', subT: W(5, 'Pacotes') });
  add({ t: W(5, 'Ao', 1), tipo: 'desk', img: D + 'painel_produtos.png', u: 2, cam: [[0, [30, 100, 1124, 760]], [W(5, 'baixa'), [30, 100, 760, 520]]], hl: [[W(5, 'baixa'), W(5, 'caixa'), [412, 115, 360, 115]]],
    sub: 'Estoque por unidade, com baixa na venda e aviso de reposição.', subT: W(5, 'Ao', 1) });
  add({ t: W(5, 'caixa'), tipo: 'desk', img: L + 'inicio.webp', u: 1, cam: [[0, [1080, 160, 520, 340]]], sub: 'Caixa: troco, sangria, suprimento e fechamento conferido.', subT: W(5, 'caixa') });
  // Capítulo 4
  add({ t: W(6, 'Quatro'), tipo: 'desk', img: D + 'painel_cliente_ficha.png', u: 2, cam: [[0, [30, 196, 1124, 520]], [W(6, 'gasto'), [30, 196, 720, 330]]], hl: [[W(6, 'gasto'), W(6, 'anamnese'), [263, 206, 211, 115]]],
    sub: 'Ficha com histórico, gasto, frequência e cashback.', subT: W(6, 'Cada') });
  add({ t: W(6, 'anamnese'), tipo: 'desk', img: D + 'painel_cliente_ficha.png', u: 2, cam: [[0, [30, 1697, 728, 300]], [W(6, 'fotos'), [30, 1054, 728, 280]], [W(6, 'fórmulas'), [30, 1329, 728, 200]]],
    sub: 'Anamnese, fotos de antes e depois e fórmulas.', subT: W(6, 'anamnese') });
  add({ t: W(6, 'Um'), tipo: 'desk', img: D + 'painel_clientes.png', u: 2, cam: [[0, [30, 105, 1124, 420]]], hl: [[W(6, 'filtro'), W(6, 'No'), [40, 224, 1104, 42]]],
    sub: 'Filtros: sumidas há 45+ dias, assinantes e com cashback.', subT: W(6, 'Um') });
  add({ t: W(6, 'No'), tipo: 'desk', img: D + 'painel_assinaturas.png', u: 2, cam: [[0, [30, 105, 1124, 460]], [W(6, 'mensalidade'), [30, 559, 708, 250]]],
    sub: 'Cobrança no cartão com conta de recebimento aprovada (Asaas, com taxas). Bairro ou superior.', subT: W(6, 'No') });
  // Capítulo 5
  add({ t: W(7, 'Cinco'), tipo: 'desk', img: D + 'painel_equipe.png', u: 2, cam: [[0, [30, 105, 750, 212]]], sub: 'Comissão de serviço e de produto por profissional.', subT: W(7, 'Cada') });
  add({ t: W(7, 'auxiliar'), tipo: 'desk', img: D + 'painel_equipe_detalhe.png', u: 2, cam: [[0, [590, 108, 460, 210]]], sub: 'A auxiliar ganha a parte dela.', subT: W(7, 'auxiliar') });
  add({ t: W(7, 'e', 0), tipo: 'desk', img: D + 'profissional_painel.png', u: 2, cam: [[0, [0, 0, 1440, 1000]], [W(7, 'login'), [0, 0, 620, 420]]], sub: 'Login próprio: a profissional vê a agenda, as comandas e as comissões dela.', subT: W(7, 'e', 0) });
  add({ t: W(7, 'Nos'), tipo: 'desk', img: D + 'painel_servico_extensao.png', u: 2, cam: [[0, [80, 420, 700, 140]], [W(7, 'preço'), [80, 1180, 700, 200]], [W(7, 'material'), [80, 1390, 700, 210]]],
    sub: 'Serviços: manutenção com preço por prazo e material usado.', subT: W(7, 'Nos') });
  add({ t: W(7, 'O', 2), tipo: 'desk', img: D + 'painel_financeiro.png', u: 2, cam: [[0, [30, 105, 1124, 370]]], hl: [[W(7, 'resultado'), W(7, 'Os'), [877, 115, 267, 115]]], sub: 'Contas a pagar, recorrentes, e resultado do mês.', subT: W(7, 'O', 2) });
  add({ t: W(7, 'Os'), tipo: 'desk', img: D + 'painel_relatorios.png', u: 2, cam: [[0, [30, 105, 1124, 430]], [W(7, 'margem'), [30, 1041, 1124, 490]]], sub: 'Faturamento, faltas, % online, comissões e margem por serviço.', subT: W(7, 'Os') });
  add({ t: W(7, 'Com', 1), tipo: 'desk', img: D + 'painel_unidades.png', u: 2, cam: [[0, [30, 105, 752, 200]]], sub: 'Várias unidades: agenda, equipe e caixa próprios (Cidade ou Nacional).', subT: W(7, 'Com', 1) });
  add({ t: W(7, 'E', 5), tipo: 'desk', img: D + 'painel_configuracoes.png', u: 2, cam: [[0, [70, 181, 1044, 848]], [W(7, 'regras'), [590, 341, 524, 285]], [W(7, 'sinal'), [590, 622, 524, 488]]],
    sub: 'Configurações: marca, regras, cashback, sinal e indicação.', subT: W(7, 'E', 5) });
  // Planos
  add({ t: W(8, 'São'), tipo: 'desk', img: D + 'painel_plano.png', u: 2, cam: [[0, [30, 370, 1124, 740]], [W(8, 'Solo') - 0.3, [30, 404, 282, 704]], [W(8, 'Bairro') - 0.3, [310, 404, 282, 704]], [W(8, 'com') - 0.2, [310, 404, 844, 704]], [W(8, 'a') - 0.2, [310, 404, 282, 704]]], hl: [[W(8, 'Solo'), W(8, 'Do'), [40, 414, 262, 684]], [W(8, 'Bairro'), W(9, 'Klareza') - 0.2, [320, 414, 824, 684]]],
    sub: 'Quatro planos, preços conferidos em 06/11/2026.', subT: W(8, 'São') });
  add({ t: W(9, 'Klareza') - 0.15, tipo: 'fim' });

  // ---------- régua de funções (todas as citadas) ----------
  const F = (f, w, txt, n = 0) => ({ t: W(f, w, n), txt });
  const FUNCOES = [
    F(1, 'Olha', 'Início'), F(2, 'página', 'Página do salão'), F(2, 'link', 'Link na bio'), F(2, 'QR', 'QR code'), F(2, 'unidade', 'Escolha da unidade'),
    F(2, 'profissional', 'Escolha da profissional'), F(2, 'serviços', 'Vários serviços'), F(2, 'variações', 'Variações'), F(2, 'adicionais', 'Adicionais'),
    F(2, 'horário', 'Horários livres'), F(2, 'aplicativo', 'Sem aplicativo'), F(2, 'sinal', 'Sinal por Pix'), F(2, 'anamnese', 'Anamnese e termo'),
    F(3, 'agendamentos', 'Meus agendamentos'), F(3, 'confirma', 'Confirmar presença'), F(3, 'plano', 'Meu plano'), F(3, 'cashback', 'Cashback'),
    F(3, 'cupons', 'Clube de vantagens'), F(3, 'indica', 'Indique uma amiga'),
    F(4, 'faturamento', 'Resumo do dia'), F(4, 'avisos', 'Avisos e aniversariantes'), F(4, 'coluna', 'Agenda por profissional'), F(4, 'folgas', 'Folgas e bloqueios'),
    F(4, 'encaixe', 'Encaixe'), F(4, 'remarcação', 'Remarcação'), F(4, 'simultâneo', 'Atendimento simultâneo'), F(4, 'site', 'Agenda online ao vivo'),
    F(4, 'amanhã', 'Lembretes'), F(4, 'manutenção', 'Hora da manutenção'), F(4, 'espera', 'Lista de espera'), F(4, 'cuidados', 'Cuidados pós-atendimento'),
    F(4, 'envia', 'Envio pelo seu WhatsApp'),
    F(5, 'comanda', 'Comandas'), F(5, 'produtos', 'Venda de produtos'), F(5, 'desconto', 'Desconto'), F(5, 'recibo', 'Recibo e estorno'), F(5, 'Pacotes', 'Pacotes de sessões'),
    F(5, 'estoque', 'Estoque por unidade'), F(5, 'caixa', 'Caixa'), F(5, 'sangria', 'Sangria e suprimento'),
    F(6, 'histórico', 'Ficha da cliente'), F(6, 'anamnese', 'Anamnese'), F(6, 'fotos', 'Antes e depois'), F(6, 'fórmulas', 'Fórmulas'), F(6, 'sumiu', 'Clientes sumidas'),
    F(6, 'assinatura', 'Clube de assinatura'), F(6, 'cartão', 'Cobrança no cartão'),
    F(7, 'comissão', 'Comissões'), F(7, 'auxiliar', 'Auxiliar'), F(7, 'login', 'Login da profissional'), F(7, 'manutenção', 'Preço por prazo'), F(7, 'material', 'Material e custo'),
    F(7, 'contas', 'Contas a pagar'), F(7, 'resultado', 'Resultado do mês'), F(7, 'relatórios', 'Relatórios'), F(7, 'margem', 'Margem por serviço'),
    F(7, 'unidades', 'Várias unidades'), F(7, 'marca', 'Sua marca'), F(7, 'regras', 'Regras da agenda'), F(7, 'indicação', 'Indicação'),
  ];

  // ---------- eventos sonoros ----------
  const EVENTOS = [];
  CAP.forEach((c, i) => { if (i > 0) EVENTOS.push({ t: c.t, tipo: 'capitulo' }); });
  S.forEach((s, i) => { if (i > 0) EVENTOS.push({ t: s.t, tipo: 'corte' }); (s.taps || []).forEach(tp => EVENTOS.push({ t: tp[0], tipo: 'toque' })); });
  EVENTOS.push({ t: W(4, 'envia') + 0.15, tipo: 'enviar' });
  EVENTOS.push({ t: W(9, 'Klareza') - 0.15, tipo: 'assinatura' });

  const CENAS = { W, DURACAO, FIM_VOZ, CAP, S, FUNCOES, EVENTOS, GANCHO: [[W(0, 'Agenda'), 'Agenda no caderno,'], [W(0, 'caixa'), 'caixa na planilha'], [W(0, 'e'), 'e cliente no {WhatsApp?}']] };
  if (typeof module !== 'undefined') module.exports = CENAS; else raiz.CENAS = CENAS;
})(typeof window !== 'undefined' ? window : globalThis);
