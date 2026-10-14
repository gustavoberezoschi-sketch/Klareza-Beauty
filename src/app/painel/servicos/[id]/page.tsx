import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Cabecalho } from "@/components/ui";
import { exigirGestor } from "@/lib/auth";
import { db } from "@/lib/db";
import { alternarServico } from "../../actions";
import { FormServico } from "../FormServico";

export const metadata: Metadata = { title: "Serviço" };
export const dynamic = "force-dynamic";

export default async function EditarServico({ params }: { params: Promise<{ id: string }> }) {
  const { salaoId } = await exigirGestor();
  const id = (await params).id;
  const novo = id === "novo";
  const [servico, profissionais, categorias] = await Promise.all([
    novo ? null : db.servico.findFirst({ where: { id, salaoId }, include: { profissionais: { select: { id: true } } } }),
    db.profissional.findMany({ where: { salaoId, ativo: true }, orderBy: { nome: "asc" } }),
    db.servico.findMany({ where: { salaoId }, distinct: ["categoria"], select: { categoria: true } }),
  ]);
  if (!novo && !servico) notFound();

  return (
    <div className="mx-auto max-w-5xl">
      <Cabecalho
        titulo={servico ? servico.nome : "Novo serviço"}
        voltar={{ href: "/painel/servicos", rotulo: "Serviços" }}
        acoes={
          servico && (
            <form action={alternarServico}>
              <input type="hidden" name="id" value={servico.id} />
              <button className={servico.ativo ? "btn-perigo" : "btn-secundario"}>{servico.ativo ? "Desativar serviço" : "Reativar serviço"}</button>
            </form>
          )
        }
      />
      <FormServico servico={servico ?? undefined} profissionais={profissionais} categorias={categorias.map((c) => c.categoria)} />
    </div>
  );
}
