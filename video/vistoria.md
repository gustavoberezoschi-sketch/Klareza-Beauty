# Vistoria — Klareza Beauty · 06/11/2026

Revalidação da FICHA (30/10/2026) para o vídeo "todas as funções". Somente leitura.

## Fontes desta vistoria

| Fonte | O que foi feito | Limite |
|---|---|---|
| Site público (Playwright) | Landing, FAQ aberta, `/planos`, `/termos`, `/privacidade`, `/saloes`, `/login`; CSS computado, fontes, imagens | — |
| Código-fonte (`src/`, `README.md`, `prisma/seed.ts`) | Leitura de regras de plano (`src/lib/planosSistema.ts`), contatos (`src/lib/empresa.ts`), comandas, lembretes, agenda | Código descreve o que o app faz; não é teste em produção |
| Instância **local** de demonstração | Postgres local + `npm run db:seed` (dados fictícios do próprio repositório: "Studio Flor de Lótus") + `next start` em localhost. Navegação de leitura nas 18 áreas, 2 logins (dono e profissional), página do salão e área do cliente no celular | Ambiente separado, sem Asaas. Não é a conta de produção. Nenhum agendamento confirmado, nenhuma comanda/caixa aberto, nada enviado |
| Conta de produção (painel autenticado) | **Não acessada nesta sessão**: não há `KLAREZA_BEAUTY_EMAIL`/`KLAREZA_BEAUTY_PASSWORD` no ambiente | Dados e configurações da conta real ficaram intactos |

## ⚠️ Mudanças desde a FICHA de 30/10/2026

| Item | FICHA (30/10) | Agora (site ao vivo + código, 06/11) |
|---|---|---|
| WhatsApp comercial | (41) 99966-9004 | **(41) 98709-0321** (rodapé, termos, `empresa.ts`) |
| E-mail | gustavoberezoschi@gmail.com | **rottadigitaloficial@gmail.com** |
| Solo inclui | comandas, caixa, estoque, relatórios, pacotes, placa | **Não inclui mais**: comandas, caixa e pacotes; produtos e estoque; comissões e relatórios; financeiro; sinal por Pix; clube de assinatura e de vantagens; parceiros e cupons; **placa de acrílico** |
| Brinde da placa | todos os planos | **só Bairro, Cidade e Nacional**, após a 1ª mensalidade paga, uma por salão |
| Preços | Solo 59,90 · Bairro 149,90 · Cidade 299,90 · Nacional 524,90 (anual 599 / 1.499 / 2.999 / 5.249) | **iguais** |

**Consequência para este vídeo:** o pedido exige *todas as funções*. O único plano que tem todas com 1 unidade é o **Bairro (R$ 149,90/mês ou R$ 1.499/ano)**. Várias unidades = Cidade (até 2) ou Nacional (ilimitadas). Anunciar Solo com essas funções seria falso.

## Áreas observadas (instância local, plano Nacional do seed)

Início · Agenda (grade, bloqueios, novo agendamento com encaixe) · Lembretes (amanhã, hoje, site, manutenção, lista de espera, cuidados) · Comandas (lista + detalhe) · Caixa · Clientes (lista, filtros, ficha com anamnese/fotos/fórmulas) · Clube de assinatura · Pacotes · Página do cliente (QR code, banners, parceiros) · Serviços (variações, adicionais, manutenção por prazo, material, cuidados) · Produtos e estoque (por unidade) · Equipe (comissões, auxiliar, login) · Financeiro · Pagamentos online · Unidades · Relatórios (faturamento, comissões, margem, por unidade, faltas, % online) · Configurações (regras, cashback, sinal, indicação, avaliação, termo) · Meu plano.
Celular: página do salão, agendamento em etapas (filial → profissional → serviços com variação/adicional → horário → dados), área do cliente (início, agendamentos, vantagens, plano, perfil, detalhe do agendamento com "Confirmar presença").
Profissional: menu restrito — Minha agenda, Lembretes, Comandas, Minhas comissões.

## Funcionamento confirmado no código (não testado em produção)

- Fechar comanda aplica desconto e cashback, **baixa o estoque** e conclui o agendamento (`src/lib/comandas.ts:292`).
- Lembretes: o botão abre o WhatsApp com a mensagem pronta e marca como enviado; **quem envia é o salão** (FAQ: "Você só aperta enviar").
- Atendimento simultâneo com profissionais diferentes (`src/lib/agenda.ts:62`).
- Recursos bloqueados por plano redirecionam para "Meu plano" (`exigirRecurso`).

## Dependências e condições

- Clube no cartão e sinal por Pix exigem conta de recebimento Asaas aprovada e ativada, com taxas do Asaas. Na demo local, "Pagamentos online" mostra "Ainda não disponível".
- Manutenção depende de prazo cadastrado no serviço e histórico. Lista de espera e cuidados: aviso com ação do operador.
- Encaixe manual existe: não dizer que conflito de horário é impossível.

## Contradições que continuam no site

- "Tudo incluso, em todos os planos" e "sem cobrança por profissional" vs. Solo com 1 profissional e muitos recursos riscados.
- "Nenhum horário marcado duas vezes" vs. encaixe manual.
- Botões "Agendar demonstração"/"Quero o …" apontam para `/login`.

## Não executado

Reserva confirmada, venda/comanda, abertura/fechamento de caixa, envio de WhatsApp, cobrança, ativação Asaas, login na conta de produção, checagem do Instagram (perfil não informado).
