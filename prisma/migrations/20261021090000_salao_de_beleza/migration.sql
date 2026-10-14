-- AlterTable
ALTER TABLE "Profissional" ADD COLUMN     "comissaoAuxiliarPct" INTEGER NOT NULL DEFAULT 10;

-- AlterTable
ALTER TABLE "Servico" ADD COLUMN     "retornoDias" INTEGER;

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "anamnese" JSONB,
ADD COLUMN     "anamneseEm" TIMESTAMP(3),
ADD COLUMN     "retornoLembradoEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ComandaItem" ADD COLUMN     "auxiliarId" TEXT,
ADD COLUMN     "comissaoAuxiliarPct" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pacoteClienteId" TEXT,
ADD COLUMN     "pacoteId" TEXT;

-- CreateTable
CREATE TABLE "Pacote" (
    "id" TEXT NOT NULL,
    "salaoId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "sessoes" INTEGER NOT NULL,
    "precoCentavos" INTEGER NOT NULL,
    "validadeDias" INTEGER,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Pacote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PacoteCliente" (
    "id" TEXT NOT NULL,
    "salaoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "pacoteId" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "sessoes" INTEGER NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "validoAte" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ATIVO',
    "itemVendaId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PacoteCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FotoCliente" (
    "id" TEXT NOT NULL,
    "salaoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "imagem" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'ANTES',
    "legenda" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FotoCliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Pacote_salaoId_idx" ON "Pacote"("salaoId");

-- CreateIndex
CREATE UNIQUE INDEX "PacoteCliente_itemVendaId_key" ON "PacoteCliente"("itemVendaId");

-- CreateIndex
CREATE INDEX "PacoteCliente_clienteId_status_idx" ON "PacoteCliente"("clienteId", "status");

-- CreateIndex
CREATE INDEX "FotoCliente_clienteId_criadoEm_idx" ON "FotoCliente"("clienteId", "criadoEm");

-- CreateIndex
CREATE INDEX "ComandaItem_pacoteClienteId_idx" ON "ComandaItem"("pacoteClienteId");

-- AddForeignKey
ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_auxiliarId_fkey" FOREIGN KEY ("auxiliarId") REFERENCES "Profissional"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_pacoteId_fkey" FOREIGN KEY ("pacoteId") REFERENCES "Pacote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComandaItem" ADD CONSTRAINT "ComandaItem_pacoteClienteId_fkey" FOREIGN KEY ("pacoteClienteId") REFERENCES "PacoteCliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pacote" ADD CONSTRAINT "Pacote_salaoId_fkey" FOREIGN KEY ("salaoId") REFERENCES "Salao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pacote" ADD CONSTRAINT "Pacote_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacoteCliente" ADD CONSTRAINT "PacoteCliente_salaoId_fkey" FOREIGN KEY ("salaoId") REFERENCES "Salao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacoteCliente" ADD CONSTRAINT "PacoteCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacoteCliente" ADD CONSTRAINT "PacoteCliente_pacoteId_fkey" FOREIGN KEY ("pacoteId") REFERENCES "Pacote"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PacoteCliente" ADD CONSTRAINT "PacoteCliente_itemVendaId_fkey" FOREIGN KEY ("itemVendaId") REFERENCES "ComandaItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotoCliente" ADD CONSTRAINT "FotoCliente_salaoId_fkey" FOREIGN KEY ("salaoId") REFERENCES "Salao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FotoCliente" ADD CONSTRAINT "FotoCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

