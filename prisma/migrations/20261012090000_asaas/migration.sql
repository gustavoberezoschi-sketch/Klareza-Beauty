-- AlterTable
ALTER TABLE "Assinatura" ADD COLUMN     "asaasId" TEXT,
ADD COLUMN     "linkPagamento" TEXT;

-- AlterTable
ALTER TABLE "Salao" ADD COLUMN     "asaasApiKey" TEXT,
ADD COLUMN     "asaasAssinaturaSistema" TEXT,
ADD COLUMN     "asaasClienteSistemaId" TEXT,
ADD COLUMN     "asaasContaId" TEXT,
ADD COLUMN     "asaasStatus" TEXT,
ADD COLUMN     "asaasWalletId" TEXT,
ADD COLUMN     "cobrancaOnlineClube" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "linkPagamentoSistema" TEXT;

-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "asaasClienteId" TEXT,
ADD COLUMN     "cpf" TEXT;

-- AlterTable
ALTER TABLE "ConfigSistema" ADD COLUMN     "asaasWalletId" TEXT,
ADD COLUMN     "taxaPlataformaPct" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PagamentoAssinatura" ADD COLUMN     "asaasPagamentoId" TEXT,
ADD COLUMN     "valorLiquidoCentavos" INTEGER;

-- AlterTable
ALTER TABLE "PagamentoSistema" ADD COLUMN     "asaasPagamentoId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Assinatura_asaasId_key" ON "Assinatura"("asaasId");

-- CreateIndex
CREATE UNIQUE INDEX "Salao_asaasAssinaturaSistema_key" ON "Salao"("asaasAssinaturaSistema");

-- CreateIndex
CREATE UNIQUE INDEX "PagamentoAssinatura_asaasPagamentoId_key" ON "PagamentoAssinatura"("asaasPagamentoId");

-- CreateIndex
CREATE UNIQUE INDEX "PagamentoSistema_asaasPagamentoId_key" ON "PagamentoSistema"("asaasPagamentoId");

