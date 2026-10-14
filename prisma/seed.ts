// Dados de demonstração: dois salões com equipe, serviços, produtos, clube,
// clientes e 3 semanas de movimento. Uso: npm run db:seed
// Logins (senha 123456): dono@flordelotus.com · dono@bellalash.com · carla@flordelotus.com (profissional)
// Área do cliente: /b/flor-de-lotus/entrar com WhatsApp 11987654321 e senha 123456
import bcrypt from "bcryptjs";
import { abrirComanda, adicionarProduto, fecharComanda } from "../src/lib/comandas";
import { db } from "../src/lib/db";
import { criarDataHora, diaDaSemana, diaLocal, somarDias, somarMeses } from "../src/lib/tempo";

function bannerSvg(fundo: string, destaque: string, titulo: string, sub: string) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1300" height="500"><rect width="1300" height="500" fill="${fundo}"/><g opacity=".18">${Array.from({ length: 30 }, (_, i) => `<rect x="${i * 60 - 300}" y="-50" width="22" height="700" fill="${destaque}" transform="rotate(35 ${i * 60} 250)"/>`).join("")}</g><text x="80" y="230" font-family="Arial Black,Arial" font-weight="900" font-size="84" fill="#fff">${titulo}</text><text x="84" y="310" font-family="Arial" font-size="40" fill="${destaque}">${sub}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

const DEMOS = [
  {
    nome: "Studio Flor de Lótus", slug: "flor-de-lotus", email: "dono@flordelotus.com", cor: "#145c3c",
    filiais: [
      { nome: "Centro", endereco: "Rua Augusta, 1200 - Consolação, São Paulo", profissionais: ["Carla Mendes", "Rafaela Lima"] },
      { nome: "Shopping Norte", endereco: "Av. Otto Baumgart, 500 - Loja 210, São Paulo", profissionais: ["Diana Souza"] },
    ],
  },
  {
    nome: "Bella Lash & Nails", slug: "bella-lash", email: "dono@bellalash.com", cor: "#2f5d8a",
    filiais: [{ nome: "Unidade principal", endereco: "Rua XV de Novembro, 300 - Centro", profissionais: ["Lúcia Prado", "Marta Rocha"] }],
  },
];

const SERVICOS = [
  { nome: "Corte feminino", categoria: "Cabelo", precoCentavos: 6500, duracaoMin: 60, descricao: "Lavagem, corte e finalização." },
  { nome: "Escova", categoria: "Cabelo", precoCentavos: 5000, duracaoMin: 45, descricao: "Lavagem e escova modelada." },
  { nome: "Manicure", categoria: "Unhas", precoCentavos: 4000, duracaoMin: 45, descricao: "Cutilagem, esmaltação e hidratação." },
  { nome: "Mãos e pés", categoria: "Combos", precoCentavos: 7500, duracaoMin: 90, descricao: "Manicure e pedicure no mesmo horário." },
  { nome: "Pedicure", categoria: "Unhas", precoCentavos: 4500, duracaoMin: 50, descricao: null },
  { nome: "Design de sobrancelha", categoria: "Sobrancelha", precoCentavos: 4500, duracaoMin: 30, descricao: "Design com pinça e henna opcional." },
  { nome: "Extensão de cílios", categoria: "Cílios", precoCentavos: 16000, duracaoMin: 120, descricao: "Fio a fio, com manutenção a cada 15 a 20 dias." },
  { nome: "Alongamento de unhas em gel", categoria: "Unhas", precoCentavos: 14000, duracaoMin: 150, descricao: "Aplicação em gel com acabamento e esmaltação." },
];

const PRODUTOS = [
  { nome: "Máscara de hidratação", categoria: "Cabelo", precoCentavos: 4500, custoCentavos: 2000, estoque: 12, estoqueMinimo: 3 },
  { nome: "Óleo de cutícula", categoria: "Unhas", precoCentavos: 3900, custoCentavos: 1500, estoque: 2, estoqueMinimo: 3 },
  { nome: "Shampoo para cabelos tingidos", categoria: "Cabelo", precoCentavos: 3200, custoCentavos: 1400, estoque: 8, estoqueMinimo: 2 },
  { nome: "Água com gás", categoria: "Bebidas", precoCentavos: 1200, custoCentavos: 500, estoque: 24, estoqueMinimo: 6 },
];

const CLIENTES = [
  ["Joana Silva", "11987654321", "1990-10-12"], ["Patrícia Souza", "11976543210", null], ["Marina Lima", "11965432109", "1988-03-02"],
  ["Aline Costa", "11954321098", null], ["Bruna Alves", "11943210987", "1995-10-14"], ["Fernanda Rocha", "11932109876", null],
  ["Gabriela Reis", "11921098765", null], ["Helena Dias", "11910987654", "1992-07-30"], ["Isabela Martins", "11909876543", null],
  ["Tatiane Nunes", "11998765432", null],
] as const;

async function main() {
  const senhaHash = await bcrypt.hash("123456", 10);
  const hoje = diaLocal();

  for (const [n, demo] of DEMOS.entries()) {
    const antiga = await db.salao.findUnique({ where: { slug: demo.slug } });
    if (antiga) {
      await db.comanda.deleteMany({ where: { salaoId: antiga.id } });
      await db.assinatura.deleteMany({ where: { salaoId: antiga.id } });
      await db.agendamento.deleteMany({ where: { salaoId: antiga.id } });
      await db.salao.delete({ where: { id: antiga.id } });
    }
    const b = await db.salao.create({
      data: {
        nome: demo.nome,
        slug: demo.slug,
        telefone: "11999990000",
        endereco: "Rua Augusta, 1200 - Consolação, São Paulo",
        instagram: demo.slug.replace(/-/g, ""),
        descricao: "Salão clássica com atendimento sem pressa, café passado na hora e cerveja gelada.",
        corDestaque: demo.cor,
        plano: n === 0 ? "NACIONAL" : "BAIRRO",
        ciclo: n === 0 ? "ANUAL" : "MENSAL",
        pagoAte: n === 0 ? somarMeses(hoje, 11) : somarDias(hoje, 3),
        cashbackPct: 5,
        filiais: {
          create: demo.filiais.map((f, i) => ({
            nome: f.nome,
            endereco: f.endereco,
            ordem: i,
            // A unidade do shopping abre também no domingo e fecha mais tarde
            horarios: {
              create: (i === 1 ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6]).map((diaSemana) => ({
                diaSemana,
                abre: i === 1 ? "10:00" : "09:00",
                fecha: i === 1 ? "22:00" : diaSemana === 6 ? "17:00" : "20:00",
              })),
            },
          })),
        },
        usuarios: { create: { nome: "Renata", email: demo.email, senhaHash } },
        banners: {
          create: [
            { imagem: bannerSvg("#121211", "#d6d6cf", "Corte + barba", "R$ 75 · toalha quente inclusa"), ordem: 0 },
            { imagem: bannerSvg("#1f1f1d", "#d6d6cf", "Clube da beleza", "Escova e manicure por R$ 99,90/mês"), ordem: 1 },
          ],
        },
        parceiros: {
          create: [
            { nome: "Stilo Cell", descricao: "15% de desconto em capinhas e películas", cupom: "BELA15" },
            { nome: "Academia Força Total", descricao: "Isenção da matrícula para clientes do salão", cupom: "BELAFIT" },
          ],
        },
        servicos: { create: SERVICOS },
        produtos: { create: PRODUTOS.map(({ estoque: _e, estoqueMinimo: _m, ...p }) => p) },
        clientes: { create: CLIENTES.map(([nome, telefone, nascimento], i) => ({ nome, telefone, nascimento, senhaHash: i === 0 ? senhaHash : null })) },
      },
      include: { filiais: { orderBy: { ordem: "asc" } }, servicos: true, clientes: true, produtos: true },
    });
    let ordem = 0;
    for (const [i, f] of demo.filiais.entries()) {
      for (const nome of f.profissionais) {
        await db.profissional.create({ data: { salaoId: b.id, filialId: b.filiais[i].id, nome, comissaoPct: ordem === 0 ? 50 : 45, destaque: ordem < 2 } });
        ordem++;
      }
    }
    const profissionais = await db.profissional.findMany({ where: { salaoId: b.id }, orderBy: { criadoEm: "asc" } });

    // Estoque por unidade: a segunda unidade começa com metade
    for (const produto of b.produtos) {
      const ref = PRODUTOS.find((x) => x.nome === produto.nome)!;
      for (const [i, f] of b.filiais.entries()) {
        const quantidade = i === 0 ? ref.estoque : Math.floor(ref.estoque / 2);
        await db.estoqueFilial.create({ data: { produtoId: produto.id, filialId: f.id, quantidade, minimo: ref.estoqueMinimo } });
        if (quantidade) await db.movimentoEstoque.create({ data: { produtoId: produto.id, filialId: f.id, quantidade, tipo: "ENTRADA", observacao: "Estoque inicial" } });
      }
    }
    const [s] = [b.servicos];
    const porNome = (nome: string) => s.find((x) => x.nome === nome)!;

    // Só o primeiro profissional faz luzes
    await db.servico.update({ where: { id: porNome("Extensão de cílios").id }, data: { profissionais: { connect: { id: profissionais[0].id } } } });

    if (n === 0) {
      await db.usuario.create({ data: { salaoId: b.id, profissionalId: profissionais[0].id, nome: "Carla Mendes", email: "carla@flordelotus.com", papel: "PROFISSIONAL", senhaHash } });
    }

    // Almoço de todos os profissionais hoje
    for (const bb of profissionais) {
      await db.bloqueio.create({ data: { salaoId: b.id, profissionalId: bb.id, inicio: criarDataHora(hoje, "12:00"), fim: criarDataHora(hoje, "13:00"), motivo: "Almoço" } });
    }

    // Clube de assinatura
    const plano = await db.plano.create({
      data: { salaoId: b.id, nome: "Clube da escova", descricao: "Escovas ilimitadas no mês.", precoCentavos: 9990, servicos: { connect: [{ id: porNome("Escova").id }, { id: porNome("Corte feminino").id }] } },
    });
    await db.plano.create({
      data: { salaoId: b.id, nome: "Clube completo", descricao: "4 sessões de mãos e pés por mês.", precoCentavos: 19990, usosPorMes: 4, servicos: { connect: [{ id: porNome("Mãos e pés").id }] } },
    });
    const porNomeCliente = (nome: string) => b.clientes.find((c) => c.nome === nome)!;
    for (const [i, cli] of [porNomeCliente("Joana Silva"), porNomeCliente("Patrícia Souza")].entries()) {
      const ass = await db.assinatura.create({ data: { salaoId: b.id, clienteId: cli.id, planoId: plano.id, pagoAte: i === 0 ? somarMeses(hoje, 1) : somarDias(hoje, -3) } });
      await db.pagamentoAssinatura.create({ data: { assinaturaId: ass.id, valorCentavos: plano.precoCentavos, formaPagamento: "PIX", pagoEm: criarDataHora(somarDias(hoje, -20 - i * 5), "10:00") } });
    }

    // Contas a pagar
    await db.contaPagar.createMany({
      data: [
        { salaoId: b.id, descricao: "Aluguel", categoria: "Aluguel", valorCentavos: 250000, vencimento: somarDias(hoje, 3) },
        { salaoId: b.id, descricao: "Conta de luz", categoria: "Água e luz", valorCentavos: 38000, vencimento: somarDias(hoje, -1) },
        { salaoId: b.id, descricao: "Internet", categoria: "Internet e telefone", valorCentavos: 12000, vencimento: somarDias(hoje, -8), pagoEm: criarDataHora(somarDias(hoje, -8), "11:00"), formaPagamento: "PIX" },
      ],
    });

    // 3 semanas de atendimentos concluídos + agenda de hoje e amanhã
    const comuns = ["Corte feminino", "Escova", "Manicure", "Mãos e pés", "Escova", "Pedicure"].map(porNome);
    let k = 0;
    for (let d = -20; d <= 1; d++) {
      const dia = somarDias(hoje, d);
      if (diaDaSemana(dia) === 0) continue;
      const horas = d === 0 ? ["09:00", "10:00", "11:00", "14:00", "15:30", "17:00", "18:30"] : d === 1 ? ["09:30", "11:00", "15:00"] : ["09:00", "10:30", "14:00", "16:00", "18:00"].slice(0, 3 + (k % 3));
      for (const [j, hora] of horas.entries()) {
        k++;
        const servico = comuns[(k + j) % comuns.length];
        const profissional = profissionais[(k + j) % profissionais.length];
        const cliente = b.clientes[(k * 3 + j) % b.clientes.length];
        const inicio = criarDataHora(dia, hora);
        const passado = inicio.getTime() + servico.duracaoMin * 60_000 < Date.now();
        const falta = passado && k % 13 === 0;
        const ag = await db.agendamento.create({
          data: {
            salaoId: b.id, filialId: profissional.filialId, profissionalId: profissional.id, servicoId: servico.id, clienteId: cliente.id, inicio,
            fim: new Date(inicio.getTime() + servico.duracaoMin * 60_000), precoCentavos: servico.precoCentavos,
            origem: k % 3 === 0 ? "PAINEL" : "ONLINE", status: falta ? "FALTOU" : k % 4 === 0 && !passado ? "CONFIRMADO" : "AGENDADO",
          },
        });
        if (!passado || falta) continue;
        const comanda = await abrirComanda({ salaoId: b.id, agendamentoId: ag.id });
        if (k % 4 === 0) await adicionarProduto(b.id, comanda.id, b.produtos[k % b.produtos.length].id, 1, profissional.id);
        await fecharComanda(b.id, comanda.id, { formaPagamento: ["PIX", "CARTAO_DEBITO", "DINHEIRO", "CARTAO_CREDITO"][k % 4], descontoCentavos: 0, usarCashback: k % 5 === 0 });
        const fechada = new Date(inicio.getTime() + servico.duracaoMin * 60_000);
        await db.comanda.update({ where: { id: comanda.id }, data: { fechadaEm: fechada, abertaEm: inicio } });
      }
    }
    console.log(`✅ ${demo.nome}: login ${demo.email} / 123456 · link /b/${demo.slug}`);
  }
  await db.configSistema.upsert({ where: { id: "geral" }, update: { whatsappSuporte: "41999998888" }, create: { id: "geral", whatsappSuporte: "41999998888" } });
  console.log("✅ Profissional: carla@flordelotus.com / 123456");
  console.log("✅ Cliente (área do cliente): WhatsApp 11987654321 / 123456");
}

main().finally(() => db.$disconnect());
