// Mapa de cenas v2 (ordem cronológica: dona do salão → cliente). Tempos amarrados às palavras narradas (tempos.js).
// Peças = cartões reais do painel capturados um a um (v2/pecas). Celular = telas reais capturadas no celular.
(function (raiz) {
  const P = raiz.TEMPOS.palavras;
  function W(f, palavra, n = 0) {
    const alvo = palavra.toLowerCase(); let k = 0;
    for (const p of P) if (p.f === f && p.w.toLowerCase() === alvo) { if (k === n) return p.s; k++; }
    throw new Error(`palavra não encontrada: [${f}] ${palavra} #${n}`);
  }
  const L0 = (f) => P.find((p) => p.f === f).s; // início do parágrafo
  const FIM_VOZ = raiz.TEMPOS.duracao_voz;
  const DURACAO = Math.ceil((FIM_VOZ + 2.6) * 30) / 30;
  const pc = (n) => `pecas/${n}.png`, C = (n) => `../assets/capturas/${n}.png`, LD = (n) => `../assets/landing/${n}`;
  const DONA = 'Para a dona do salão', CLI = 'Para a cliente';
  // atalhos de objetos
  const leque = (tE, src, call = []) => ({ tipo: 'peca', modo: 'leque', tE, src, call });
  const grade = (tE, src, r, extra = {}) => ({ tipo: 'peca', modo: 'grade', tE, src, r, ...extra });
  const S = [];
  const cena = (o) => S.push(o);

  // ---------- abertura ----------
  cena({ t: L0(1), tag: null, titulo: ['O salão inteiro', '{num lugar só.}'], subs: [[W(1, 'Primeiro'), 'Primeiro, o que ele faz pela dona do salão. Depois, o que a cliente vê.']],
    objs: [{ tipo: 'duo', tE: L0(1) + 0.2, painel: C('painel_inicio_com_menu'), cel: C('cel_pagina_salao'), rotA: W(1, 'você'), rotB: W(1, 'cliente') }] });

  // ---------- DONA DO SALÃO ----------
  cena({ t: L0(2), tag: DONA, titulo: ['Tudo começa nas', '{configurações.}'], subs: [[L0(2), 'Sua marca na página de agendamento.'], [W(2, 'define'), 'E as regras da agenda.']],
    objs: [leque(L0(2) + 0.1, pc('cfg_identidade'), [[W(2, 'logo'), 0.2, 0.2, 'Logo'], [W(2, 'capa'), 0.62, 0.2, 'Foto de capa'], [W(2, 'cor'), 0.2, 0.92, 'Cor da marca'], [W(2, 'Instagram'), 0.7, 0.66, 'Instagram']]),
      leque(W(2, 'define'), pc('cfg_regras'), [[W(2, 'tempo'), 0.2, 0.32, 'Horários a cada…'], [W(2, 'antecedência'), 0.7, 0.32, 'Agendar até X dias'], [W(2, 'cancelar'), 0.2, 0.62, 'Cancela até X horas antes']])] });
  cena({ t: L0(3), tag: DONA, titulo: ['Várias', '{unidades.}'], subs: [[L0(3), 'Cada unidade com endereço, horário, equipe, agenda e caixa próprios.'], [W(3, 'Clientes'), 'Clientes, serviços e planos valem para todas.']],
    objs: [grade(L0(3) + 0.1, pc('un_centro'), [0.04, 0.16, 0.6]), grade(L0(3) + 0.35, pc('un_norte'), [0.36, 0.5, 0.6])] });
  cena({ t: L0(4), tag: DONA, titulo: ['Serviços com', '{variações.}'], subs: [[L0(4), 'Preço, duração, foto e quem faz.'], [W(4, 'variações'), 'Variações: cada tipo com preço e tempo próprios.'], [W(4, 'adicionais'), 'Adicionais somam preço e tempo na agenda.']],
    objs: [leque(L0(4) + 0.1, pc('sv_card_ext')), leque(W(4, 'preço'), pc('sv_basico'), [[W(4, 'preço'), 0.62, 0.32, 'Preço'], [W(4, 'duração'), 0.86, 0.32, 'Duração']]),
      leque(W(4, 'quem'), pc('sv_quemfaz'), [[W(4, 'quem'), 0.3, 0.6, 'Quem faz']]),
      leque(W(4, 'variações'), pc('sv_variacoes'), [[W(4, 'clássico'), 0.3, 0.4, 'Clássico'], [W(4, 'híbrido'), 0.3, 0.56, 'Híbrido'], [W(4, 'volume'), 0.3, 0.72, 'Volume russo']]),
      leque(W(4, 'adicionais'), pc('sv_adicionais'), [[W(4, 'remoção'), 0.3, 0.5, 'Remoção +R$ 30 · +20 min']])] });
  cena({ t: L0(5), tag: DONA, titulo: ['Manutenção com', '{preço por prazo.}'], subs: [[L0(5), 'Você define em quantos dias a cliente deve voltar.'], [W(5, 'faixas'), 'O preço sai pelo último atendimento.']],
    objs: [leque(L0(5) + 0.1, pc('sv_comissao'), [[W(5, 'dias'), 0.78, 0.5, 'Lembrar após 18 dias']]), leque(W(5, 'faixas'), pc('sv_faixas'))],
    notas: [[W(5, 'quinze'), W(5, 'O'), ['Até 15 dias', 'R$ 100']], [W(5, 'vinte'), W(5, 'O'), ['Até 21 dias', 'R$ 130']], [W(5, 'Passou'), L0(6), ['Passou do prazo', '{aplicação nova}']]] });
  cena({ t: L0(6), tag: DONA, titulo: ['Material e', '{custo.}'], subs: [[L0(6), 'Quanto de cada produto vai em um atendimento.']],
    objs: [leque(L0(6) + 0.1, pc('sv_material'), [[W(6, 'fios'), 0.35, 0.36, 'Fios: 0,3 bandeja'], [W(6, 'cola'), 0.35, 0.56, 'Cola: 0,1 frasco'], [W(6, 'custa'), 0.82, 0.88, 'Custo por atendimento']])] });
  cena({ t: L0(7), tag: DONA, titulo: ['Equipe e', '{comissões.}'], subs: [[L0(7), 'Comissão de serviço e de produto por profissional.'], [W(7, 'auxiliar'), 'A auxiliar ganha a porcentagem dela no serviço.'], [W(7, 'login'), 'Login próprio: só a agenda, as comandas e as comissões dela.']],
    objs: [grade(L0(7) + 0.1, pc('eq_carla'), [0.0, 0.05, 0.62]), grade(L0(7) + 0.3, pc('eq_diana'), [0.38, 0.3, 0.62]), grade(L0(7) + 0.5, pc('eq_rafaela'), [0.0, 0.56, 0.62], { sai: W(7, 'comissão') }),
      leque(W(7, 'comissão'), pc('eq_comissoes'), [[W(7, 'serviço'), 0.12, 0.42, 'Serviços %'], [W(7, 'produto'), 0.45, 0.42, 'Produtos %'], [W(7, 'auxiliar'), 0.8, 0.42, 'Como auxiliar %']]),
      { tipo: 'monitor', tE: W(7, 'login'), src: C('profissional_painel') }] });
  cena({ t: L0(8), tag: DONA, titulo: ['Produtos e', '{estoque.}'], subs: [[L0(8), 'Preço, custo e margem de cada produto.'], [W(8, 'mínimo'), 'Estoque por unidade, com aviso de reposição.'], [W(8, 'entradas'), 'Entradas, contagem e transferência entre unidades.']],
    objs: [leque(L0(8) + 0.1, pc('pr_tabela'), [[W(8, 'custo'), 0.4, 0.06, 'Preço · Margem']]), leque(W(8, 'estoque'), pc('pr_estoque_un'), [[W(8, 'mínimo'), 0.7, 0.36, 'Avisar com…']]),
      leque(W(8, 'entradas'), pc('pr_movimentar'), [[W(8, 'contagem'), 0.4, 0.3, 'Entrada · Saída · Contagem']]), leque(W(8, 'transferência'), pc('pr_transferir'))] });
  cena({ t: L0(9), tag: DONA, titulo: ['A página do', '{seu salão.}'], subs: [[L0(9), 'QR code para o balcão, banners e parceiros.'], [W(9, 'cupons'), 'Clube de vantagens: cupons de lojas parceiras para as suas clientes.']],
    objs: [leque(L0(9) + 0.1, pc('vt_qr'), [[W(9, 'QR'), 0.08, 0.55, 'QR code']]), leque(W(9, 'banners'), pc('vt_banners')), leque(W(9, 'parceiros'), pc('vt_parceiros'), [[W(9, 'cupons'), 0.3, 0.88, 'Cupom']])] });
  cena({ t: L0(10), tag: DONA, titulo: ['Clube de', '{assinatura.}'], subs: [[L0(10), 'Planos mensais: ilimitados ou com limite de usos.'], [W(10, 'comanda'), 'Os serviços do plano saem sem cobrança na comanda.'], [W(10, 'conta'), 'Cobrança mensal com conta de recebimento aprovada (Asaas, com taxas). Bairro ou superior.']],
    objs: [leque(L0(10) + 0.1, pc('cl_planos'), [[W(10, 'ilimitada'), 0.26, 0.62, 'Uso ilimitado'], [W(10, 'usos'), 0.74, 0.62, '4 usos por mês']]), leque(W(10, 'comanda'), pc('cm_itens'), [[W(10, 'cobrança'), 0.8, 0.6, 'Incluso no plano']]),
      leque(W(10, 'conta'), pc('cl_kpis'))] });
  cena({ t: L0(11), tag: DONA, titulo: ['Pacotes de', '{sessões.}'], subs: [[L0(11), 'Vende o pacote na comanda; cada sessão é abatida sozinha.']],
    objs: [leque(L0(11) + 0.1, pc('pc_manicure')), leque(W(11, 'quatro'), pc('pc_cilios'), [[W(11, 'desconto'), 0.5, 0.42, '4 sessões · 13% mais barato'], [W(11, 'validade'), 0.5, 0.62, 'Vale 120 dias']])] });
  cena({ t: L0(12), tag: DONA, titulo: ['O seu dia', 'começa no {início.}'], subs: [[L0(12), 'Faturamento do dia e do mês, próximos atendimentos.'], [W(12, 'avisos'), 'Avisos: estoque baixo, contas, mensalidades e aniversários.']],
    objs: [grade(L0(12) + 0.1, pc('in_k1'), [0.0, 0.0, 0.49]), grade(L0(12) + 0.2, pc('in_k3'), [0.51, 0.0, 0.49]), grade(L0(12) + 0.3, pc('in_grafico'), [0.0, 0.22, 1.0]),
      grade(W(12, 'próximos'), pc('in_proximos'), [0.0, 0.62, 0.62]), grade(W(12, 'avisos'), pc('in_avisos'), [0.42, 0.48, 0.58], { foco: [[W(12, 'estoque'), L0(13)]] })] });
  cena({ t: L0(13), tag: DONA, titulo: ['A agenda se', '{organiza.}'], subs: [[L0(13), 'Uma coluna por profissional; clique num horário vazio para agendar.'], [W(13, 'bloqueia'), 'Almoço, folga, férias ou feriado bloqueados.'], [W(13, 'encaixe'), 'Encaixe, remarcação, falta e cancelamento.'], [W(13, 'mesmo'), 'Serviços simultâneos com profissionais diferentes.'], [W(13, 'site'), 'O que a cliente marca pelo site aparece na hora.']],
    objs: [leque(L0(13) + 0.1, pc('ag_grade'), [[W(13, 'coluna'), 0.2, 0.05, 'Uma coluna por profissional'], [W(13, 'site'), 0.5, 0.14, 'Agendado · online']]),
      leque(W(13, 'bloqueia'), pc('ag_bloq_novo'), [[W(13, 'feriado'), 0.5, 0.15, 'Salão todo ou uma profissional']]), leque(W(13, 'encaixe'), pc('ag_novo'), [[W(13, 'encaixe'), 0.3, 0.86, 'Encaixe']]),
      leque(W(13, 'site'), pc('ag_grade'), [[W(13, 'site'), 0.5, 0.14, 'Agendado · online']])] });
  cena({ t: L0(14), tag: DONA, titulo: ['Lembretes', '{prontos.}'], subs: [[L0(14), 'Quem vem amanhã e hoje, e confirmação de quem agendou pelo site.'], [W(14, 'manutenção'), 'Quem está na hora da manutenção e quem espera uma vaga.'], [W(14, 'cuidados'), 'Cuidados depois do atendimento.'], [W(14, 'toca'), 'Você toca, o WhatsApp abre com o texto, você envia.'], [W(14, 'custo'), 'Sem custo por mensagem. Textos editáveis.']],
    objs: [leque(L0(14) + 0.1, pc('lb_amanha'), [[W(14, 'amanhã'), 0.9, 0.36, 'Lembrar']]), leque(W(14, 'confirmação'), pc('lb_site')), leque(W(14, 'manutenção'), pc('lb_manut')), leque(W(14, 'espera'), pc('lb_espera')),
      leque(W(14, 'cuidados'), pc('sv_cuidados')), { tipo: 'whats', tE: W(14, 'toca'), envia: W(14, 'envia') }, leque(W(14, 'custo'), pc('lb_textos'), [[W(14, 'edita'), 0.5, 0.2, 'Texto editável']])] });
  cena({ t: L0(15), tag: DONA, titulo: ['A ficha', 'da {cliente.}'], subs: [[L0(15), 'Histórico, total gasto, frequência, serviço preferido e faltas.']],
    objs: [leque(L0(15) + 0.1, pc('fc_kpis'), [[W(15, 'gastou'), 0.32, 0.5, 'Total gasto'], [W(15, 'volta'), 0.72, 0.5, 'Volta a cada…']]), leque(W(15, 'histórico'), pc('fc_hist'))] });
  cena({ t: L0(16), tag: DONA, titulo: ['Ficha de', '{anamnese.}'], subs: [[L0(16), 'Tudo o que importa saber antes de começar, com o consentimento da cliente.'], [W(16, 'pontos'), 'Pontos de atenção em destaque, na ficha e na comanda.']],
    objs: [leque(L0(16) + 0.1, pc('fc_anamnese'), [[W(16, 'alergias'), 0.72, 0.62, 'Alergias'], [W(16, 'gestação'), 0.3, 0.14, 'Gestação'], [W(16, 'lentes'), 0.3, 0.21, 'Lentes de contato'], [W(16, 'pele'), 0.3, 0.35, 'Condição de pele'], [W(16, 'medicamentos'), 0.3, 0.62, 'Medicamentos'], [W(16, 'procedimentos'), 0.3, 0.76, 'Procedimentos recentes']]),
      leque(W(16, 'pontos'), pc('cm_aviso'), [[W(16, 'destaque'), 0.2, 0.75, 'Aparece antes de começar']])] });
  cena({ t: L0(17), tag: DONA, titulo: ['Fórmulas de', '{coloração.}'], subs: [[L0(17), 'A receita de cada cliente fica guardada.'], [W(17, 'Na'), 'Na próxima visita, é só repetir.']],
    objs: [leque(L0(17) + 0.1, pc('fc_formulas'), [[W(17, 'gramas'), 0.3, 0.2, '30 g 6.1 + 30 g OX 20 vol'], [W(17, 'pausa'), 0.3, 0.3, '35 min de pausa']])],
    notas: [[W(17, 'gramas'), L0(18), ['Tinta, oxidante e pausa', '{anotados}']]] });
  cena({ t: L0(18), tag: DONA, titulo: ['Antes e', '{depois.}'], subs: [[L0(18), 'Fotos de antes e depois na ficha da cliente.'], [W(18, 'autorização'), 'Com autorização, viram a galeria da página do salão.']],
    objs: [leque(L0(18) + 0.1, pc('fc_fotos'), [[W(18, 'fotos'), 0.6, 0.6, 'Antes · Depois']])] });
  cena({ t: L0(19), tag: DONA, titulo: ['A', '{comanda.}'], subs: [[L0(19), 'Abre ao iniciar o atendimento pela agenda.'], [W(19, 'soma'), 'Produtos, desconto, cashback, pagamento e recibo.'], [W(19, 'fechar'), 'Ao fechar, o estoque dá baixa.']],
    objs: [{ tipo: 'peca', modo: 'leque', tE: L0(19) + 0.1, src: LD('comandas.webp'), u: 1 }, leque(W(19, 'soma'), pc('cm_resumo'), [[W(19, 'desconto'), 0.5, 0.28, 'Plano, pacote, desconto'], [W(19, 'recibo'), 0.5, 0.8, 'Recibo por WhatsApp']]),
      leque(W(19, 'estoque'), pc('pr_kpis'), [[W(19, 'baixa'), 0.5, 0.5, 'Estoque baixo']])] });
  cena({ t: L0(20), tag: DONA, titulo: ['O', '{caixa.}'], subs: [[L0(20), 'Abertura com o troco da gaveta.'], [W(20, 'sangria'), 'Sangria, suprimento e despesas do dia.'], [W(20, 'fecha'), 'Fechamento conferindo o dinheiro.']],
    objs: [leque(L0(20) + 0.1, pc('cx_unidade'), [[W(20, 'troco'), 0.4, 0.62, 'Troco']]),
      { tipo: 'fluxo', tE: W(20, 'sangria'), itens: [[W(20, 'sangria'), 'Sangria'], [W(20, 'suprimento'), 'Suprimento'], [W(20, 'despesas'), 'Despesas'], [W(20, 'soma'), 'Total por forma de pagamento'], [W(20, 'fecha'), 'Fechamento conferido']] }] });
  cena({ t: L0(21), tag: DONA, titulo: ['O fim do', '{mês.}'], subs: [[L0(21), 'Contas a pagar, inclusive as que se repetem.'], [W(21, 'resultado'), 'Resultado: entradas − comissões − despesas.']],
    objs: [leque(L0(21) + 0.1, pc('fi_contas')), leque(W(21, 'repetem'), pc('fi_lancar'), [[W(21, 'repetem'), 0.3, 0.8, 'Repetir por meses']]), leque(W(21, 'resultado'), pc('fi_kpis'), [[W(21, 'resultado'), 0.88, 0.5, 'Resultado']])] });
  cena({ t: L0(22), tag: DONA, titulo: ['Os', '{relatórios.}'], subs: [[L0(22), 'Faturamento, ticket médio, comissões e mais vendidos.'], [W(22, 'online'), 'Agendamento online e faltas.'], [W(22, 'margem'), 'Margem: receita − material − comissões.']],
    objs: [grade(L0(22) + 0.1, pc('rl_kpis'), [0.0, 0.0, 1.0]), grade(W(22, 'faturamento'), pc('rl_grafico'), [0.0, 0.17, 1.0]), grade(W(22, 'comissões'), pc('rl_comissoes'), [0.0, 0.42, 1.0]),
      grade(W(22, 'serviços'), pc('rl_servicos'), [0.0, 0.62, 0.32]), grade(W(22, 'produtos'), pc('rl_produtos'), [0.34, 0.62, 0.32]), grade(W(22, 'formas'), pc('rl_pagamentos'), [0.68, 0.62, 0.32]),
      grade(W(22, 'margem'), pc('rl_margem'), [0.0, 0.2, 1.0], { foco: [[W(22, 'margem'), L0(23)]] })] });
  cena({ t: L0(23), tag: DONA, titulo: ['Quem', '{sumiu?}'], subs: [[L0(23), 'Filtros: sumidas há 45+ dias, assinantes e com cashback.']],
    objs: [leque(L0(23) + 0.1, pc('ct_lista'), [[W(23, 'sumiu'), 0.3, 0.04, 'Sumidos há 45+ dias'], [W(23, 'assinante'), 0.5, 0.04, 'Assinantes'], [W(23, 'cashback'), 0.7, 0.04, 'Com cashback']])] });

  // ---------- CLIENTE ----------
  const cel = (tE, telas, extra = {}) => ({ tipo: 'cel', tE, telas, ...extra });
  cena({ t: L0(24), tag: CLI, secao: ['Agora, a sua', '{cliente.}'], titulo: ['Ela encontra', 'o {salão.}'], subs: [[W(24, 'encontra'), 'Link na bio, no WhatsApp ou QR code no balcão.'], [W(24, 'página'), 'Marca, banners, profissionais, serviços, planos e unidades.']],
    objs: [cel(L0(24) + 1.2, [[L0(24) + 1.2, C('cel_pagina_salao'), 0], [W(24, 'profissionais'), C('cel_pagina_salao'), 520], [W(24, 'serviços'), C('cel_pagina_salao'), 760], [W(24, 'planos'), C('cel_pagina_salao'), 1830], [W(24, 'unidades'), C('cel_pagina_salao'), 2380]], { mesmaTela: true })] });
  cena({ t: L0(25), tag: CLI, titulo: ['Ela agenda', '{sozinha.}'], subs: [[L0(25), 'Unidade, profissional, um ou vários serviços.'], [W(25, 'variação'), 'Variação e adicionais, com o tempo certo na agenda.'], [W(25, 'horário'), 'Um horário livre. Total e duração no rodapé.'], [W(25, 'navegador'), 'Pelo navegador, sem baixar aplicativo.']],
    objs: [cel(L0(25), [[L0(25), C('cel_agendar_inicio'), 0], [W(25, 'profissional'), C('cel_agendar_1_profissional'), 100], [W(25, 'serviços'), C('cel_agendar_3_variacao'), 300], [W(25, 'adicionais'), C('cel_agendar_4_escolhido'), 300], [W(25, 'horário'), C('cel_agendar_5_horario'), 120], [W(25, 'total'), C('cel_agendar_6_horario_escolhido'), 100]],
      { taps: [[W(25, 'unidade'), 200, 280], [W(25, 'profissional') + 0.4, 195, 400], [W(25, 'variação'), 120, 621], [W(25, 'horário') + 0.4, 237, 479]] })] });
  cena({ t: L0(26), tag: CLI, titulo: ['Sinal', '{por Pix.}'], subs: [[L0(26), 'Opcional, do Bairro para cima, com conta de recebimento aprovada.']],
    objs: [leque(L0(26) + 0.1, pc('cfg_sinal'), [[W(26, 'ativar'), 0.25, 0.14, 'Sinal (%)']]),
      { tipo: 'fluxo', tE: W(26, 'Pix'), itens: [[W(26, 'Pix'), 'Paga uma parte por Pix'], [W(26, 'trinta'), 'Horário reservado por 30 min'], [W(26, 'descontado'), 'Descontado na comanda'], [W(26, 'cancelar'), 'Cancelou no prazo: vira crédito'], [W(26, 'faltar'), 'Faltou: fica com o salão']] }] });
  cena({ t: L0(27), tag: CLI, titulo: ['A ficha', 'antes de {chegar.}'], subs: [[L0(27), 'Anamnese preenchida pelo celular.'], [W(27, 'assina'), 'E o termo de consentimento assinado com o dedo.']],
    objs: [cel(L0(27), [[L0(27), C('cel_ficha_preatendimento'), 180], [W(27, 'anamnese'), C('cel_ficha_preatendimento'), 640], [W(27, 'assina'), C('cel_ficha_preatendimento'), 1260]], { mesmaTela: true })] });
  cena({ t: L0(28), tag: CLI, titulo: ['Lembrete na', '{véspera.}'], subs: [[L0(28), 'Você envia pelo WhatsApp, com o link para confirmar ou cancelar.'], [W(28, 'notificações'), 'Se ela ativar as notificações, o celular avisa sozinho um dia antes.']],
    objs: [cel(L0(28), [[L0(28), C('cel_conta_agendamento_afebfaedbef'), 200]], { taps: [[W(28, 'confirmar'), 195, 494]], sai: W(28, 'notificações') }), { tipo: 'push', tE: W(28, 'notificações') }] });
  cena({ t: L0(29), tag: CLI, titulo: ['Depois do', '{atendimento.}'], subs: [[L0(29), 'Os cuidados de cada serviço, com pedido de foto.'], [W(29, 'avaliar'), 'E o link para avaliar o salão.']],
    objs: [leque(L0(29) + 0.1, pc('sv_cuidados'), [[W(29, 'cuidados'), 0.4, 0.42, 'Cuidados do serviço']]), leque(W(29, 'avaliar'), pc('cfg_sinal'), [[W(29, 'avaliar'), 0.5, 0.36, 'Link de avaliação']])] });
  cena({ t: L0(30), tag: CLI, titulo: ['A área', '{dela.}'], subs: [[L0(30), 'Entra com o WhatsApp e uma senha.'], [W(30, 'salva'), 'Salva o horário na agenda do celular.'], [W(30, 'plano'), 'O plano do clube e os usos do mês.']],
    objs: [cel(L0(30), [[L0(30), C('cel_conta_conta_agendamentos'), 0], [W(30, 'salva'), C('cel_conta_agendamento_afebfaedbef'), 0], [W(30, 'plano'), C('cel_conta_conta_plano'), 0]])] });
  cena({ t: L0(31), tag: CLI, titulo: ['Cashback, cupons', 'e {indicação.}'], subs: [[L0(31), 'O cashback vira crédito para a próxima visita.'], [W(31, 'cupons'), 'Cupons dos parceiros no clube de vantagens.'], [W(31, 'indica'), 'Indique uma amiga: as duas ganham crédito.']],
    objs: [cel(L0(31), [[L0(31), LD('cel-conta.webp'), 300, 1.5], [W(31, 'cupons'), C('cel_conta_conta_vantagens'), 0], [W(31, 'indica'), C('cel_conta_conta'), 300]], { taps: [[W(31, 'cupons') + 0.5, 92, 283]], hl: [[W(31, 'cashback'), W(31, 'cupons'), [16, 590, 358, 75]], [W(31, 'código'), L0(32), [20, 600, 350, 200]]] })] });

  // ---------- planos e fechamento ----------
  cena({ t: L0(32), tag: null, titulo: ['Quatro', '{planos.}'], subs: [[L0(32), 'Valores conferidos em 06/11/2026.'], [W(32, 'Solo'), 'Solo: R$ 59,90/mês ou R$ 599/ano · 1 profissional, 1 unidade.'], [W(32, 'Bairro'), 'Bairro: R$ 149,90/mês ou R$ 1.499/ano · equipe ilimitada, 1 unidade.'], [W(32, 'equipe'), 'Cidade: R$ 299,90/mês, até 2 unidades · Nacional: R$ 524,90/mês, ilimitadas.'], [W(32, 'partir'), 'Todas as funções a partir do Bairro: R$ 149,90/mês.']],
    condicao: 'Clube no cartão e sinal por Pix: conta de recebimento aprovada (Asaas) e taxas. Placa com QR code: brinde do Bairro para cima, após a 1ª mensalidade paga.',
    objs: [grade(L0(32) + 0.1, pc('pl_solo'), [0.0, 0.08, 0.245], { foco: [[W(32, 'Solo'), W(32, 'Do')]], real: true }), grade(L0(32) + 0.25, pc('pl_bairro'), [0.252, 0.08, 0.245], { foco: [[W(32, 'Bairro'), W(32, 'equipe')], [W(32, 'partir'), L0(33)]], real: true }),
      grade(L0(32) + 0.4, pc('pl_cidade'), [0.504, 0.08, 0.245], { real: true }), grade(L0(32) + 0.55, pc('pl_nacional'), [0.756, 0.08, 0.245], { real: true })] });
  cena({ t: L0(33) - 0.15, tipo: 'fim' });

  const EVENTOS = [];
  S.forEach((s, i) => {
    if (i > 0) EVENTOS.push({ t: s.t, tipo: s.tipo === 'fim' ? 'assinatura' : (s.secao ? 'capitulo' : 'corte') });
    (s.objs || []).forEach((o) => {
      if (o.tE > s.t + 0.5) EVENTOS.push({ t: o.tE, tipo: 'peca' });
      (o.taps || []).forEach((tp) => EVENTOS.push({ t: tp[0], tipo: 'toque' }));
      (o.call || []).forEach((c) => EVENTOS.push({ t: c[0], tipo: 'chamada' }));
      if (o.tipo === 'whats') EVENTOS.push({ t: o.envia + 0.15, tipo: 'enviar' });
    });
  });
  const CENAS = { W, L0, DURACAO, FIM_VOZ, S, EVENTOS, GANCHO: [[W(0, 'Agenda'), 'Agenda no caderno,'], [W(0, 'caixa'), 'caixa na planilha'], [W(0, 'e'), 'e cliente no {WhatsApp?}']] };
  if (typeof module !== 'undefined') module.exports = CENAS; else raiz.CENAS = CENAS;
})(typeof window !== 'undefined' ? window : globalThis);
