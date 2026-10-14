import { linkWhatsApp } from "./formato";
import { diaLocal, formatarDiaExtenso, horaLocal, somarDias } from "./tempo";

export const MSG_CONFIRMACAO_PADRAO =
  "Olá, {nome}! Seu horário no {salão} está agendado ✨\n\n📅 {data} às {hora}\n💖 {servico} com {profissional}\n📍 {endereco}\n\nPara confirmar ou cancelar: {link}";

export const MSG_LEMBRETE_PADRAO =
  "Oi, {nome}! Passando para lembrar do seu horário no {salão} {quando} às {hora} ✨\n\n💖 {servico} com {profissional}\n📍 {endereco}\n\nConfirme sua presença aqui: {link}\nTe esperamos!";

export const VARIAVEIS = [
  ["{nome}", "primeiro nome do cliente"],
  ["{salão}", "nome do salão"],
  ["{data}", "ex.: sexta-feira, 10 de outubro"],
  ["{quando}", "hoje, amanhã ou a data"],
  ["{hora}", "horário"],
  ["{servico}", "serviço(s)"],
  ["{profissional}", "profissional"],
  ["{unidade}", "nome da unidade"],
  ["{endereco}", "endereço da unidade"],
  ["{link}", "link para o cliente confirmar ou cancelar"],
] as const;

export type DadosMensagem = {
  cliente: string;
  salao: string;
  inicio: Date;
  servicos: string[];
  profissional: string;
  unidade: string;
  endereco: string | null;
  link: string;
};

export function preencherMensagem(modelo: string, d: DadosMensagem) {
  const dia = diaLocal(d.inicio);
  const hoje = diaLocal();
  const data = formatarDiaExtenso(dia);
  const quando = dia === hoje ? "hoje" : dia === somarDias(hoje, 1) ? "amanhã" : `${data}`;
  const valores: Record<string, string> = {
    "{nome}": d.cliente.split(" ")[0],
    "{salão}": d.salao,
    "{data}": data,
    "{quando}": quando,
    "{hora}": horaLocal(d.inicio),
    "{servico}": d.servicos.join(" + "),
    "{profissional}": d.profissional,
    "{unidade}": d.unidade,
    "{endereco}": d.endereco ?? "",
    "{link}": d.link,
  };
  return modelo
    .replace(/\{(nome|salão|salao|data|quando|hora|servico|profissional|unidade|endereco|link)\}/g, (v) => valores[v] ?? valores[v.replace("salao", "salão")] ?? v)
    .split("\n")
    .filter((linha) => !/^📍\s*$/.test(linha.trim())) // some a linha do endereço se não tiver endereço
    .join("\n");
}

export function linkDaMensagem(telefone: string, modelo: string, d: DadosMensagem) {
  return linkWhatsApp(telefone, preencherMensagem(modelo, d));
}
