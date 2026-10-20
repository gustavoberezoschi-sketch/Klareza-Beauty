import type { Metadata } from "next";
import Link from "next/link";
import { Contato, Documento } from "../_landing/Documento";
import { db } from "@/lib/db";
import { EMPRESA } from "@/lib/empresa";

export const metadata: Metadata = {
  title: { absolute: "Termos de Uso · Klareza Beauty" },
  description: "Regras de uso do Klareza Beauty para salões e para os clientes que agendam pelo sistema.",
};
export const dynamic = "force-dynamic";

export default async function Termos() {
  const whatsapp = (await db.configSistema.findUnique({ where: { id: "geral" } }).catch(() => null))?.whatsappSuporte ?? null;
  const contato = <Contato whatsapp={whatsapp} />;
  const quem = `, de propriedade da ${EMPRESA.razaoSocial ?? EMPRESA.proprietaria}${EMPRESA.cnpj ? ` (CNPJ ${EMPRESA.cnpj})` : ""},`;

  return (
    <Documento
      titulo="Termos de Uso"
      resumo="Estas são as regras para usar o Klareza Beauty, tanto para os salões que contratam o sistema quanto para os clientes que agendam por ele."
    >
      <section>
        <h2>1. Aceite</h2>
        <p>
          Ao contratar o Klareza Beauty{quem} acessar o painel ou criar uma conta na área do cliente de um salão, você concorda com estes Termos e
          com a <Link href="/privacidade">Política de Privacidade</Link>. Se não concordar, não use o sistema.
        </p>
      </section>

      <section>
        <h2>2. O que é o serviço</h2>
        <p>
          O Klareza Beauty é um software online para gestão de salões: agenda, agendamento online, área do cliente, clube de assinatura, comandas,
          caixa, estoque, financeiro, relatórios e lembretes por WhatsApp. O acesso é feito pela internet, sem instalação.
        </p>
      </section>

      <section>
        <h2>3. Para os salões</h2>
        <h3>Conta e acesso</h3>
        <ul>
          <li>O salão é responsável pelos dados que cadastra e pelos logins que cria para a equipe.</li>
          <li>Senhas são pessoais. Em caso de suspeita de uso indevido, avise a gente imediatamente.</li>
        </ul>
        <h3>Planos e pagamento</h3>
        <ul>
          <li>
            Os planos, preços e limites (unidades e assinantes ativos no clube) estão na <Link href="/#planos">página de planos</Link> e podem ser pagos
            por mês ou por ano.
          </li>
          <li>Ao atingir o limite do plano, o sistema pede a mudança para um plano maior antes de cadastrar novas unidades ou assinantes.</li>
          <li>
            O plano Solo é para uma profissional que atende sozinha: permite uma profissional ativa e não inclui clube de assinatura, comissões, financeiro nem sinal
            por Pix. Salões ou estúdios com mais de uma profissional devem contratar o plano Bairro ou superior, e não vários planos Solo para a
            mesma operação. O Klareza Beauty pode pedir a mudança de plano quando identificar esse uso.
          </li>
          <li>
            Sem o pagamento da mensalidade, o acesso ao painel e o agendamento online podem ser suspensos até a regularização. Os dados não são apagados
            pela suspensão.
          </li>
          <li>Mudanças de preço serão avisadas com antecedência e valem a partir do ciclo seguinte.</li>
          <li>
            Brinde: após a confirmação do pagamento da primeira mensalidade, o salão recebe uma placa de acrílico com o QR code do seu link de
            agendamento (uma por salão).
          </li>
        </ul>
        <h3>Pagamentos online do clube</h3>
        <ul>
          <li>
            Os pagamentos online são processados pelo Asaas, em uma conta de recebimento aberta em nome do próprio salão, sujeita aos termos e às taxas
            do Asaas. O dinheiro dos clientes vai para essa conta.
          </li>
          <li>Eventual taxa de serviço do Klareza Beauty sobre pagamentos online é informada ao salão antes da ativação.</li>
          <li>Reembolsos, contestações e combinados com os clientes são de responsabilidade do salão.</li>
        </ul>
        <h3>Dados dos clientes</h3>
        <ul>
          <li>
            O salão é a controladora dos dados dos seus clientes e deve usá-los apenas para o atendimento, de acordo com a LGPD. O Klareza Beauty atua
            como operador, tratando esses dados em nome do salão.
          </li>
          <li>As mensagens enviadas pelo WhatsApp do salão são de responsabilidade dela.</li>
          <li>Banners, cupons, parceiros e demais conteúdos publicados na página do salão são de responsabilidade dela.</li>
        </ul>
        <h3>Cancelamento</h3>
        <ul>
          <li>O salão pode pedir o cancelamento a qualquer momento pelos nossos canais de atendimento.</li>
          <li>Antes do encerramento, o salão pode pedir uma cópia dos seus dados. Depois, eles são excluídos ou anonimizados, salvo obrigação legal.</li>
        </ul>
      </section>

      <section>
        <h2>4. Para os clientes dos salões</h2>
        <ul>
          <li>Os horários, preços, serviços e regras de cancelamento são definidos por cada salão.</li>
          <li>Informe dados verdadeiros e mantenha sua senha em segredo.</li>
          <li>Se não puder comparecer, cancele pelo link do agendamento dentro do prazo do salão ou fale com ela.</li>
          <li>Planos do clube de assinatura são contratados com o salão, que é quem presta o serviço.</li>
          <li>
            Na assinatura online, o cliente cadastra o cartão de crédito uma vez e autoriza a cobrança automática da mensalidade todo mês, até cancelar.
            Serviços e produtos extras lançados na fatura do clube entram na mesma cobrança.
          </li>
          <li>
            O cancelamento pode ser feito a qualquer momento na área do cliente, em “Plano”. As cobranças param na hora e o plano continua valendo
            até o fim do período já pago.
          </li>
        </ul>
      </section>

      <section>
        <h2>5. Uso permitido</h2>
        <p>
          Não é permitido usar o sistema para atividades ilegais, enviar conteúdo ofensivo, tentar acessar dados de outros salões ou de outros
          clientes, nem interferir no funcionamento do sistema. Contas que violarem estas regras podem ser suspensas.
        </p>
      </section>

      <section>
        <h2>6. Disponibilidade e responsabilidade</h2>
        <ul>
          <li>Trabalhamos para manter o sistema disponível o tempo todo, mas podem ocorrer interrupções para manutenção ou por falhas de terceiros.</li>
          <li>
            O Klareza Beauty não responde por perdas causadas por uso indevido das senhas, por informações cadastradas incorretamente, pela relação entre o
            salão e seus clientes ou por falhas de serviços de terceiros, como internet, WhatsApp e meios de pagamento.
          </li>
        </ul>
      </section>

      <section>
        <h2>7. Propriedade intelectual</h2>
        <p>
          O software, a marca e o visual do Klareza Beauty pertencem à {EMPRESA.proprietaria}. O salão continua dono da própria marca, das fotos e dos
          conteúdos que publicar.
        </p>
      </section>

      <section>
        <h2>8. Mudanças nestes termos</h2>
        <p>
          Podemos atualizar estes Termos. A data da última atualização fica no topo da página, e mudanças importantes serão avisadas aos salões com
          antecedência.
        </p>
      </section>

      <section>
        <h2>9. Contato e foro</h2>
        <p>Dúvidas sobre estes Termos: fale com a gente por {contato}.</p>
        <p>
          Estes Termos seguem as leis brasileiras.
          {EMPRESA.cidadeForo ? ` Fica eleito o foro da comarca de ${EMPRESA.cidadeForo}, ressalvados os direitos do consumidor.` : " Eventuais conflitos serão resolvidos no foro previsto em lei, ressalvados os direitos do consumidor."}
        </p>
      </section>
    </Documento>
  );
}
