-- AlterTable
ALTER TABLE "Usuario" ADD COLUMN     "profissionalId" TEXT;

-- CreateTable
CREATE TABLE "ContaPagar" (
    "id" TEXT NOT NULL,
    "salaoId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "categoria" TEXT NOT NULL DEFAULT 'Outros',
    "valorCentavos" INTEGER NOT NULL,
    "vencimento" TEXT NOT NULL,
    "pagoEm" TIMESTAMP(3),
    "formaPagamento" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContaPagar_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContaPagar_salaoId_vencimento_idx" ON "ContaPagar"("salaoId", "vencimento");

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_profissionalId_key" ON "Usuario"("profissionalId");

-- AddForeignKey
ALTER TABLE "Usuario" ADD CONSTRAINT "Usuario_profissionalId_fkey" FOREIGN KEY ("profissionalId") REFERENCES "Profissional"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContaPagar" ADD CONSTRAINT "ContaPagar_salaoId_fkey" FOREIGN KEY ("salaoId") REFERENCES "Salao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

