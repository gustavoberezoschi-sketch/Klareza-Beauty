import type { Metadata } from "next";
import { fontesLanding } from "../_landing/fontes";
import { Simbolo } from "./Simbolo";
import "./marca.css";

export const metadata: Metadata = { title: "Marca", robots: { index: false } };

/** Folha de marca do Klareza Beauty (para exportar as imagens da logo). */
export default function Marca() {
  return (
    <main className={`marca ${fontesLanding}`}>
      <section id="simbolo" className="quadro claro sq">
        <Simbolo tamanho={640} id="a" />
      </section>

      <section id="perfil" className="quadro escuro sq">
        <Simbolo tamanho={760} id="b" />
      </section>

      <section id="horizontal-escuro" className="quadro escuro largo">
        <div className="assinatura">
          <Simbolo tamanho={220} id="c" />
          <p className="nome">
            klareza<b>beauty</b>
          </p>
        </div>
      </section>

      <section id="horizontal-claro" className="quadro claro largo">
        <div className="assinatura">
          <Simbolo tamanho={220} id="d" />
          <p className="nome tinta">
            klareza<b>beauty</b>
          </p>
        </div>
      </section>

      <section id="vertical" className="quadro escuro sq">
        <div className="assinatura col">
          <Simbolo tamanho={420} id="e" />
          <p className="nome">
            klareza<b>beauty</b>
          </p>
          <p className="slogan">seu salão no automático</p>
        </div>
      </section>

      <section id="familia" className="quadro claro largo alto">
        <div className="familia">
          {[
            ["beauty", "#145c3c", "#23a06a"],
            ["contábil", "#1f3f73", "#3a6fc4"],
            ["beauty", "#7a2e52", "#c4588a"],
          ].map(([ramo, a, b]) => (
            <div key={ramo} className="item">
              <span className="k" style={{ background: `linear-gradient(135deg, ${b}, ${a})` }}>
                {ramo === "beauty" ? <Simbolo tamanho={130} fundo={false} id="f" /> : "K"}
              </span>
              <p className="nome tinta pequeno">
                klareza<b style={{ color: b }}>{ramo}</b>
              </p>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
