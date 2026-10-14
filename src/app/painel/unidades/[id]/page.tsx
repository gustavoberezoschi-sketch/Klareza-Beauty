import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FormAcao } from "@/components/FormAcao";
import { Cabecalho, Secao } from "@/components/ui";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatarTelefone } from "@/lib/formato";
import { NOMES_DIAS } from "@/lib/tempo";
import { alternarFilial, salvarFilial } from "../actions";

export const metadata: Metadata = { title: "Unidade" };
export const dynamic = "force-dynamic";

export default async function Unidade({ params }: { params: Promise<{ id: string }> }) {
  const { salaoId } = await exigirGestor();
  const id = (await params).id;
  const f = id === "nova" ? null : await db.filial.findFirst({ where: { id, salaoId }, include: { horarios: true } });
  if (id !== "nova" && !f) notFound();
  const padrao = !f;

  return (
    <div className="mx-auto max-w-3xl">
      <Cabecalho
        titulo={f ? f.nome : "Nova unidade"}
        voltar={{ href: "/painel/unidades", rotulo: "Unidades" }}
        acoes={
          f && (
            <FormAcao acao={alternarFilial} className="flex flex-col items-end gap-1">
              <input type="hidden" name="id" value={f.id} />
              <button className={f.ativo ? "btn-perigo" : "btn-secundario"}>{f.ativo ? "Desativar unidade" : "Reativar unidade"}</button>
            </FormAcao>
          )
        }
      />
      <FormAcao acao={salvarFilial} className="grid gap-4">
        {f && <input type="hidden" name="id" value={f.id} />}
        <Secao titulo="Dados">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2"><label className="label" htmlFor="nome">Nome da unidade</label><input id="nome" name="nome" defaultValue={f?.nome} className="input" placeholder="Ex.: Centro, Shopping Norte" required /></div>
            <div><label className="label" htmlFor="endereco">Endereço</label><input id="endereco" name="endereco" defaultValue={f?.endereco ?? ""} className="input" /></div>
            <div><label className="label" htmlFor="telefone">WhatsApp da unidade</label><input id="telefone" name="telefone" defaultValue={f?.telefone ? formatarTelefone(f.telefone) : ""} className="input" inputMode="tel" /></div>
          </div>
        </Secao>
        <Secao titulo="Horário de funcionamento">
          <div className="space-y-2">
            {NOMES_DIAS.map((nome, d) => {
              const h = f?.horarios.find((x) => x.diaSemana === d);
              return (
                <div key={d} className="grid grid-cols-[7.5rem_1fr_1fr] items-center gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input type="checkbox" name={`aberto_${d}`} defaultChecked={padrao ? d >= 1 && d <= 6 : !!h} /> {nome}
                  </label>
                  <input type="time" name={`abre_${d}`} className="input py-2" defaultValue={h?.abre ?? "09:00"} aria-label={`${nome}: abre`} />
                  <input type="time" name={`fecha_${d}`} className="input py-2" defaultValue={h?.fecha ?? "19:00"} aria-label={`${nome}: fecha`} />
                </div>
              );
            })}
          </div>
        </Secao>
        <button className="btn-destaque py-3">{f ? "Salvar unidade" : "Cadastrar unidade"}</button>
      </FormAcao>
    </div>
  );
}
