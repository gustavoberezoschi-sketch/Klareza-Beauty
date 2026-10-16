-- AlterTable
ALTER TABLE "Salao" ADD COLUMN     "indicacaoCreditoCentavos" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "linkAvaliacao" TEXT,
ADD COLUMN     "sinalPct" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "termoConsentimento" TEXT;

-- AlterTable
ALTER TABLE "Servico" ADD COLUMN     "cuidados" TEXT,
ADD COLUMN     "faixasManutencao" JSONB,
ADD COLUMN     "manutencaoDeId" TEXT;

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "codigoIndicacao" TEXT,
ADD COLUMN     "indicacaoCreditadaEm" TIMESTAMP(3),
ADD COLUMN     "indicadoPorId" TEXT,
ADD COLUMN     "termoAssinadoEm" TIMESTAMP(3),
ADD COLUMN     "termoAssinatura" TEXT,
ADD COLUMN     "termoIp" TEXT,
ADD COLUMN     "termoNome" TEXT;

-- AlterTable
ALTER TABLE "Agendamento" ADD COLUMN     "opcoes" JSONB,
ADD COLUMN     "sinalAsaasId" TEXT,
ADD COLUMN     "sinalCentavos" INTEGER,
ADD COLUMN     "sinalDestino" TEXT,
ADD COLUMN     "sinalLink" TEXT,
ADD COLUMN     "sinalPagoEm" TIMESTAMP(3),
ADD COLUMN     "sinalPix" TEXT,
ADD COLUMN     "sinalQrCode" TEXT;

-- AlterTable
ALTER TABLE "Comanda" ADD COLUMN     "cuidadosEnviadosEm" TIMESTAMP(3),
ADD COLUMN     "sinalCentavos" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "FotoCliente" ADD COLUMN     "publica" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ServicoOpcao" (
    "id" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "precoCentavos" INTEGER NOT NULL,
    "duracaoMin" INTEGER NOT NULL,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ServicoOpcao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ServicoInsumo" (
    "id" TEXT NOT NULL,
    "servicoId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "quantidade" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ServicoInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormulaCliente" (
    "id" TEXT NOT NULL,
    "salaoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "formula" TEXT NOT NULL,
    "autor" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormulaCliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListaEspera" (
    "id" TEXT NOT NULL,
    "salaoId" TEXT NOT NULL,
    "filialId" TEXT NOT NULL,
    "servicoIds" TEXT[],
    "nome" TEXT NOT NULL,
    "telefone" TEXT NOT NULL,
    "dia" TEXT NOT NULL,
    "periodo" TEXT NOT NULL DEFAULT 'QUALQUER',
    "avisadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListaEspera_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ServicoOpcao_servicoId_idx" ON "ServicoOpcao"("servicoId");

-- CreateIndex
CREATE UNIQUE INDEX "ServicoInsumo_servicoId_produtoId_key" ON "ServicoInsumo"("servicoId", "produtoId");

-- CreateIndex
CREATE INDEX "FormulaCliente_clienteId_criadoEm_idx" ON "FormulaCliente"("clienteId", "criadoEm");

-- CreateIndex
CREATE INDEX "ListaEspera_salaoId_dia_idx" ON "ListaEspera"("salaoId", "dia");

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_salaoId_codigoIndicacao_key" ON "Cliente"("salaoId", "codigoIndicacao");

-- CreateIndex
CREATE UNIQUE INDEX "Agendamento_sinalAsaasId_key" ON "Agendamento"("sinalAsaasId");

-- CreateIndex
CREATE INDEX "FotoCliente_salaoId_publica_idx" ON "FotoCliente"("salaoId", "publica");

-- AddForeignKey
ALTER TABLE "Servico" ADD CONSTRAINT "Servico_manutencaoDeId_fkey" FOREIGN KEY ("manutencaoDeId") REFERENCES "Servico"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cliente" ADD CONSTRAINT "Cliente_indicadoPorId_fkey" FOREIGN KEY ("indicadoPorId") REFERENCES "Cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicoOpcao" ADD CONSTRAINT "ServicoOpcao_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicoInsumo" ADD CONSTRAINT "ServicoInsumo_servicoId_fkey" FOREIGN KEY ("servicoId") REFERENCES "Servico"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ServicoInsumo" ADD CONSTRAINT "ServicoInsumo_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormulaCliente" ADD CONSTRAINT "FormulaCliente_salaoId_fkey" FOREIGN KEY ("salaoId") REFERENCES "Salao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormulaCliente" ADD CONSTRAINT "FormulaCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListaEspera" ADD CONSTRAINT "ListaEspera_salaoId_fkey" FOREIGN KEY ("salaoId") REFERENCES "Salao"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Tabelas novas também ficam fechadas para a API pública do Supabase (o sistema usa só o Prisma)
ALTER TABLE "ServicoOpcao" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ServicoInsumo" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FormulaCliente" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ListaEspera" ENABLE ROW LEVEL SECURITY;
