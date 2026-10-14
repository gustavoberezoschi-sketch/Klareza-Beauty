-- AlterTable
ALTER TABLE "Salao" ADD COLUMN     "saqueAutomatico" TEXT NOT NULL DEFAULT 'NAO',
ADD COLUMN     "saqueChavePix" TEXT,
ADD COLUMN     "saqueTipoChave" TEXT;

-- CreateTable
CREATE TABLE "Saque" (
    "id" TEXT NOT NULL,
    "salaoId" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "chavePix" TEXT NOT NULL,
    "tipoChave" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CRIANDO',
    "asaasId" TEXT,
    "taxaCentavos" INTEGER,
    "erro" TEXT,
    "automatico" BOOLEAN NOT NULL DEFAULT false,
    "pedidoPor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Saque_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Saque_asaasId_key" ON "Saque"("asaasId");

-- CreateIndex
CREATE INDEX "Saque_salaoId_criadoEm_idx" ON "Saque"("salaoId", "criadoEm");

-- AddForeignKey
ALTER TABLE "Saque" ADD CONSTRAINT "Saque_salaoId_fkey" FOREIGN KEY ("salaoId") REFERENCES "Salao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

