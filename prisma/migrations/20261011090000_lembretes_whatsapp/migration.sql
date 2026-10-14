-- AlterTable
ALTER TABLE "Agendamento" ADD COLUMN     "confirmacaoEnviadaEm" TIMESTAMP(3),
ADD COLUMN     "lembreteEnviadoEm" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Salao" ADD COLUMN     "msgConfirmacao" TEXT,
ADD COLUMN     "msgLembrete" TEXT;

