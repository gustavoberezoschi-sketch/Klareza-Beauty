import { FormAcao } from "@/components/FormAcao";
import { FotoUpload } from "@/components/FotoUpload";
import { Avatar } from "@/components/ui";
import { salvarServico } from "../actions";

type Servico = {
  id: string;
  nome: string;
  categoria: string;
  descricao: string | null;
  foto: string | null;
  precoCentavos: number;
  duracaoMin: number;
  comissaoPct: number | null;
  retornoDias: number | null;
  exibirOnline: boolean;
  profissionais: { id: string }[];
};

export function FormServico({
  servico,
  categorias,
  profissionais,
}: {
  servico?: Servico;
  categorias: string[];
  profissionais: { id: string; nome: string; foto: string | null; comissaoPct: number }[];
}) {
  const marcados = new Set(servico?.profissionais.map((b) => b.id));
  return (
    <FormAcao acao={salvarServico} className="grid gap-4 lg:grid-cols-[1fr_340px]">
      {servico && <input type="hidden" name="id" value={servico.id} />}
      <div className="card grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="nome">Nome do serviço</label>
          <input id="nome" name="nome" defaultValue={servico?.nome} className="input" placeholder="Extensão de cílios fio a fio" required />
        </div>
        <div>
          <label className="label" htmlFor="categoria">Categoria</label>
          <input id="categoria" name="categoria" defaultValue={servico?.categoria ?? "Cabelo"} list="categorias" className="input" />
          <datalist id="categorias">
            {[...new Set([...categorias, "Cabelo", "Unhas", "Cílios", "Sobrancelha", "Estética", "Depilação", "Maquiagem", "Combos"])].map((c) => <option key={c} value={c} />)}
          </datalist>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="preco">Preço (R$)</label>
            <input id="preco" name="preco" defaultValue={servico ? (servico.precoCentavos / 100).toFixed(2).replace(".", ",") : ""} className="input" placeholder="45,00" inputMode="decimal" required />
          </div>
          <div>
            <label className="label" htmlFor="duracao">Duração (min)</label>
            <input id="duracao" name="duracao" type="number" min={5} max={480} step={5} defaultValue={servico?.duracaoMin ?? 30} className="input" required />
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="descricao">Descrição para o cliente</label>
          <textarea id="descricao" name="descricao" defaultValue={servico?.descricao ?? ""} rows={3} className="input" placeholder="Ex.: Extensão de cílios fio a fio, com manutenção a cada 15 dias." />
        </div>
        <div>
          <label className="label" htmlFor="comissao">Comissão específica (%)</label>
          <input id="comissao" name="comissao" type="number" min={0} max={100} defaultValue={servico?.comissaoPct ?? ""} className="input" placeholder="Usar a de cada profissional" />
          <p className="mt-1 text-xs text-couro-400">Deixe vazio para usar a comissão padrão de cada profissional.</p>
        </div>
        <div>
          <label className="label" htmlFor="retornoDias">Manutenção: lembrar após (dias)</label>
          <input id="retornoDias" name="retornoDias" type="number" min={1} max={365} defaultValue={servico?.retornoDias ?? ""} className="input" placeholder="Ex.: 15 para cílios, 21 para unhas" />
          <p className="mt-1 text-xs text-couro-400">O cliente aparece em Lembretes quando chegar a hora de voltar. Vazio = sem lembrete.</p>
        </div>
        <label className="flex items-start gap-2 self-center text-sm">
          <input type="checkbox" name="exibirOnline" defaultChecked={servico?.exibirOnline ?? true} className="mt-0.5" />
          <span>
            <span className="font-medium">Aparece no agendamento online</span>
            <span className="block text-xs text-couro-400">Desmarque para serviços só de balcão.</span>
          </span>
        </label>
      </div>

      <div className="space-y-4">
        <div className="card">
          <FotoUpload nome="foto" inicial={servico?.foto} rotulo="Foto do serviço (aparece para o cliente)" formato="largo" tamanho={360} />
        </div>
        <fieldset className="card">
          <legend className="sr-only">Quem faz</legend>
          <p className="label">Quem faz este serviço</p>
          <p className="mb-3 text-xs text-couro-400">Nenhum marcado = todos fazem.</p>
          <div className="space-y-1">
            {profissionais.map((b) => (
              <label key={b.id} className="flex cursor-pointer items-center gap-3 rounded-xl p-1.5 hover:bg-fundo">
                <input type="checkbox" name="profissionais" value={b.id} defaultChecked={marcados.has(b.id)} />
                <Avatar nome={b.nome} foto={b.foto} tamanho={28} />
                <span className="text-sm font-medium">{b.nome}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <button className="btn-destaque w-full py-3">{servico ? "Salvar alterações" : "Cadastrar serviço"}</button>
      </div>
    </FormAcao>
  );
}
