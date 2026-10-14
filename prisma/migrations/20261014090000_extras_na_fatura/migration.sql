-- CreateTable
CREATE TABLE "ExtraFatura" (
    "id" TEXT NOT NULL,
    "salaoId" TEXT NOT NULL,
    "assinaturaId" TEXT NOT NULL,
    "comandaId" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "asaasPagamentoId" TEXT,
    "vencimento" TEXT,
    "erro" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExtraFatura_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExtraFatura_comandaId_key" ON "ExtraFatura"("comandaId");

-- CreateIndex
CREATE INDEX "ExtraFatura_asaasPagamentoId_idx" ON "ExtraFatura"("asaasPagamentoId");

-- CreateIndex
CREATE INDEX "ExtraFatura_assinaturaId_status_idx" ON "ExtraFatura"("assinaturaId", "status");

-- AddForeignKey
ALTER TABLE "ExtraFatura" ADD CONSTRAINT "ExtraFatura_salaoId_fkey" FOREIGN KEY ("salaoId") REFERENCES "Salao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraFatura" ADD CONSTRAINT "ExtraFatura_assinaturaId_fkey" FOREIGN KEY ("assinaturaId") REFERENCES "Assinatura"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExtraFatura" ADD CONSTRAINT "ExtraFatura_comandaId_fkey" FOREIGN KEY ("comandaId") REFERENCES "Comanda"("id") ON DELETE CASCADE ON UPDATE CASCADE;

