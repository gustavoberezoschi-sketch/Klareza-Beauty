-- AlterTable
ALTER TABLE "Agendamento" ADD COLUMN     "pushLembreteEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ConfigSistema" ADD COLUMN     "vapidPrivada" TEXT,
ADD COLUMN     "vapidPublica" TEXT;

-- CreateTable
CREATE TABLE "PushInscricao" (
    "id" TEXT NOT NULL,
    "salaoId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushInscricao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PushInscricao_endpoint_key" ON "PushInscricao"("endpoint");

-- CreateIndex
CREATE INDEX "PushInscricao_clienteId_idx" ON "PushInscricao"("clienteId");

-- AddForeignKey
ALTER TABLE "PushInscricao" ADD CONSTRAINT "PushInscricao_salaoId_fkey" FOREIGN KEY ("salaoId") REFERENCES "Salao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushInscricao" ADD CONSTRAINT "PushInscricao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

