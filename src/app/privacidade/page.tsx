import type { Metadata } from "next";
import { Contato, Documento } from "../_landing/Documento";
import { db } from "@/lib/db";
import { EMPRESA } from "@/lib/empresa";

export const metadata: Metadata = {
  title: { absolute: "Política de Privacidade · Klareza Beauty" },
  description: "Como o Klareza Beauty trata dados pessoais, de acordo com a Lei Geral de Proteção de Dados (Lei 13.709/2018).",
};
export const dynamic = "force-dynamic";

export default async function Privacidade() {
  const whatsapp = (await db.configSistema.findUnique({ where: { id: "geral" } }).catch(() => null))?.whatsappSuporte ?? null;
  const contato = <Contato whatsapp={whatsapp} />;
  const quem = `, de propriedade da ${EMPRESA.razaoSocial ?? EMPRESA.proprietaria}${EMPRESA.cnpj ? ` (CNPJ ${EMPRESA.cnpj})` : ""},`;

  return (
    <Documento
      titulo="Política de Privacidade"
      resumo="Explicamos aqui, em linguagem simples, quais dados pessoais o Klareza Beauty trata, para quê, com quem compartilha e como você exerce os seus direitos, de acordo com a Lei Geral de Proteção de Dados (LGPD, Lei 13.709/2018)."
    >
      <section>
        <h2>1. Quem somos e qual é o nosso papel</h2>
        <p>
          O Klareza Beauty{quem} é um sistema de gestão para salões: agenda, agendamento online, clube de assinatura, comandas, caixa, estoque e
          financeiro.
        </p>
        <ul>
          <li>
            <strong>Somos controladores</strong> dos dados dos salões que contratam o sistema e das pessoas da equipe que usam o painel (donos,
            gerentes e profissionais), além dos dados de quem visita este site.
          </li>
          <li>
            <strong>Somos operadores</strong> dos dados dos clientes dos salões. Esses dados são tratados em nome de cada salão, que é a
            controladora e decide como usá-los no atendimento.
          </li>
        </ul>
      </section>

      <section>
        <h2>2. Quais dados tratamos</h2>
        <h3>Salões e equipe</h3>
        <ul>
          <li>Nome, e-mail, telefone e senha de acesso (guardada apenas de forma criptografada, com hash).</li>
          <li>Dados do salão: nome, endereço, Instagram, logo, horários, serviços, preços e unidades.</li>
          <li>
            Para quem ativa os pagamentos online: CPF ou CNPJ, data de nascimento, endereço, celular e faturamento mensal aproximado, enviados ao Asaas
            para a abertura da conta de recebimento.
          </li>
        </ul>
        <h3>Clientes dos salões</h3>
        <ul>
          <li>Nome e WhatsApp, informados ao agendar ou ao criar a conta.</li>
          <li>Senha da área do cliente, quando criada (guardada apenas de forma criptografada, com hash).</li>
          <li>E-mail, data de nascimento e observações, quando informados pelo salão ou pelo cliente.</li>
          <li>CPF, somente para quem assina o clube com pagamento online.</li>
          <li>Histórico de agendamentos, serviços, compras, assinaturas, pagamentos e saldo de cashback.</li>
          <li>
            Ficha de anamnese (alergias, gestação, uso de lentes, condições de pele e saúde, medicamentos e procedimentos recentes) e fotos de
            antes e depois, quando o salão as registra. São dados de saúde e imagem, tratados só para a segurança do procedimento (tutela da
            saúde) e com o consentimento do cliente, registrado na ficha. Ficam visíveis apenas para o dono e os gerentes do salão.
          </li>
          <li>Pacotes de sessões comprados e as sessões já usadas.</li>
        </ul>
        <h3>Visitantes do site</h3>
        <ul>
          <li>Registros técnicos de acesso (como endereço IP, data e hora), mantidos pelos nossos provedores de hospedagem.</li>
        </ul>
      </section>

      <section>
        <h2>3. Para que usamos e com qual base legal</h2>
        <ul>
          <li>
            <strong>Prestar o serviço</strong> (execução de contrato, art. 7º, V): criar e gerenciar agendamentos, contas, comandas, assinaturas e
            cobranças; permitir o login da equipe e dos clientes.
          </li>
          <li>
            <strong>Cumprir obrigações legais</strong> (art. 7º, II): guardar registros de acesso pelo prazo do Marco Civil da Internet e documentos
            fiscais e de cobrança pelo prazo legal.
          </li>
          <li>
            <strong>Segurança e melhoria do sistema</strong> (legítimo interesse, art. 7º, IX): prevenir fraudes e acessos indevidos, corrigir erros e
            melhorar o funcionamento.
          </li>
          <li>
            <strong>Atendimento</strong>: responder dúvidas, solicitações e pedidos de suporte.
          </li>
        </ul>
        <p>
          Os lembretes e confirmações por WhatsApp são enviados pelo próprio salão, a partir do aparelho dela. O Klareza Beauty apenas monta a
          mensagem; não envia mensagens em nome de ninguém.
        </p>
        <p>Não vendemos dados pessoais e não usamos os dados dos clientes dos salões para publicidade.</p>
      </section>

      <section>
        <h2>4. Com quem compartilhamos</h2>
        <ul>
          <li><strong>O salão</strong> onde o cliente é atendido, que acessa os dados dos próprios clientes pelo painel.</li>
          <li><strong>Supabase</strong>: banco de dados onde as informações ficam guardadas.</li>
          <li><strong>Vercel</strong>: hospedagem do site e do sistema.</li>
          <li>
            <strong>Asaas</strong> (Asaas Gestão Financeira, instituição de pagamento autorizada pelo Banco Central): somente quando o salão usa os
            pagamentos online, para criar a conta de recebimento e processar as cobranças.
          </li>
          <li><strong>Autoridades públicas</strong>, quando houver obrigação legal ou ordem judicial.</li>
        </ul>
      </section>

      <section>
        <h2>5. Transferência internacional</h2>
        <p>
          Os servidores do Supabase e da Vercel ficam fora do Brasil (Estados Unidos). Essa transferência é feita para a prestação do serviço, com
          provedores que adotam cláusulas contratuais e medidas de segurança compatíveis com a LGPD (art. 33).
        </p>
      </section>

      <section id="cookies">
        <h2>6. Cookies e armazenamento no navegador</h2>
        <p>Usamos apenas cookies essenciais, necessários para o login funcionar. Não usamos cookies de rastreamento, de análise ou de anúncios.</p>
        <ul>
          <li><strong>sessao</strong>: mantém a equipe do salão conectada ao painel (até 30 dias).</li>
          <li><strong>cliente_*</strong>: mantém o cliente conectado à área dele em cada salão (até 180 dias).</li>
          <li><strong>filial_*</strong>: lembra a unidade escolhida no painel.</li>
          <li><strong>admin</strong>: sessão da administração do sistema (até 12 horas).</li>
        </ul>
        <p>
          No seu próprio navegador também guardamos o nome e o WhatsApp informados no último agendamento, para preencher o próximo, e se você já viu o
          aviso de cookies. Você pode apagar tudo isso a qualquer momento nas configurações do navegador.
        </p>
      </section>

      <section>
        <h2>7. Por quanto tempo guardamos</h2>
        <p>
          Guardamos os dados enquanto o salão usar o Klareza Beauty ou enquanto forem necessários para as finalidades acima. Depois disso, eles são
          excluídos ou anonimizados, exceto quando a lei exigir que sejam mantidos por mais tempo, como registros de acesso e documentos fiscais.
        </p>
      </section>

      <section>
        <h2>8. Como protegemos</h2>
        <ul>
          <li>Conexão criptografada (HTTPS) em todo o site.</li>
          <li>Senhas guardadas apenas com hash (bcrypt), nunca em texto.</li>
          <li>Chaves de acesso aos pagamentos guardadas com criptografia (AES-256).</li>
          <li>Acesso por login, com cada salão enxergando apenas os próprios dados e cada profissional apenas o que lhe cabe.</li>
        </ul>
        <p>Se ocorrer um incidente de segurança que possa causar risco relevante, comunicaremos os afetados e a ANPD, como prevê a lei.</p>
      </section>

      <section id="direitos">
        <h2>9. Seus direitos</h2>
        <p>Pela LGPD (art. 18), você pode pedir, a qualquer momento:</p>
        <ul>
          <li>a confirmação de que tratamos seus dados e o acesso a eles;</li>
          <li>a correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>a anonimização, o bloqueio ou a eliminação de dados desnecessários ou tratados em desconformidade com a lei;</li>
          <li>a portabilidade dos dados;</li>
          <li>a eliminação dos dados tratados com base no seu consentimento;</li>
          <li>informações sobre com quem compartilhamos seus dados;</li>
          <li>a revisão de decisões tomadas apenas com base em tratamento automatizado.</li>
        </ul>
        <p>
          <strong>Se você é cliente de um salão</strong>, pode falar diretamente com ela, que é a controladora dos seus dados, ou com a gente, que
          ajudamos o salão a atender o seu pedido. Você também pode corrigir seu nome e seus dados na área do cliente, em “Perfil”.
        </p>
        <p>
          Para exercer seus direitos, fale com a gente por {contato}. Respondemos em até 15 dias. Você também pode apresentar reclamação à Autoridade
          Nacional de Proteção de Dados (ANPD).
        </p>
      </section>

      <section>
        <h2>10. Encarregado pelo tratamento de dados</h2>
        <p>
          Fale com o encarregado pelo tratamento de dados (DPO) do Klareza Beauty por {contato}.
        </p>
      </section>

      <section>
        <h2>11. Crianças e adolescentes</h2>
        <p>
          O sistema não é direcionado a menores de 18 anos. Agendamentos para menores devem ser feitos pelos pais ou responsáveis, que fornecem os dados
          necessários ao atendimento.
        </p>
      </section>

      <section>
        <h2>12. Mudanças nesta política</h2>
        <p>
          Podemos atualizar esta política para refletir mudanças no sistema ou na lei. A data da última atualização fica no topo da página, e mudanças
          importantes serão avisadas aos salões pelo painel ou pelos canais de contato.
        </p>
      </section>
    </Documento>
  );
}
