-- Unidades (filiais). Cada salao existente ganha uma "Unidade principal"
-- e todos os dados atuais (horários, equipe, agenda, comandas, caixas) passam para ela.

-- 1. Tabela de unidades
CREATE TABLE "Filial" (
    "id" TEXT NOT NULL,
    "salaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "endereco" TEXT,
    "telefone" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Filial_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Filial_salaoId_idx" ON "Filial"("salaoId");
ALTER TABLE "Filial" ADD CONSTRAINT "Filial_salaoId_fkey" FOREIGN KEY ("salaoId") REFERENCES "Salao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Unidade principal de cada salao (id determinístico para facilitar as atualizações)
INSERT INTO "Filial" ("id", "salaoId", "nome", "endereco", "telefone")
SELECT 'filial_' || "id", "id", 'Unidade principal', "endereco", "telefone" FROM "Salao";

-- 3. Horários de funcionamento passam a ser da unidade
ALTER TABLE "HorarioFuncionamento" ADD COLUMN "filialId" TEXT;
UPDATE "HorarioFuncionamento" SET "filialId" = 'filial_' || "salaoId";
ALTER TABLE "HorarioFuncionamento" ALTER COLUMN "filialId" SET NOT NULL;
ALTER TABLE "HorarioFuncionamento" DROP CONSTRAINT "HorarioFuncionamento_salaoId_fkey";
DROP INDEX "HorarioFuncionamento_salaoId_diaSemana_key";
ALTER TABLE "HorarioFuncionamento" DROP COLUMN "salaoId";
CREATE UNIQUE INDEX "HorarioFuncionamento_filialId_diaSemana_key" ON "HorarioFuncionamento"("filialId", "diaSemana");
ALTER TABLE "HorarioFuncionamento" ADD CONSTRAINT "HorarioFuncionamento_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Equipe, agenda, comandas e caixas ficam na unidade principal
ALTER TABLE "Profissional" ADD COLUMN "filialId" TEXT;
UPDATE "Profissional" SET "filialId" = 'filial_' || "salaoId";
ALTER TABLE "Profissional" ALTER COLUMN "filialId" SET NOT NULL;

ALTER TABLE "Agendamento" ADD COLUMN "filialId" TEXT;
UPDATE "Agendamento" SET "filialId" = 'filial_' || "salaoId";
ALTER TABLE "Agendamento" ALTER COLUMN "filialId" SET NOT NULL;

ALTER TABLE "Comanda" ADD COLUMN "filialId" TEXT;
UPDATE "Comanda" SET "filialId" = 'filial_' || "salaoId";
ALTER TABLE "Comanda" ALTER COLUMN "filialId" SET NOT NULL;

ALTER TABLE "Caixa" ADD COLUMN "filialId" TEXT;
UPDATE "Caixa" SET "filialId" = 'filial_' || "salaoId";
ALTER TABLE "Caixa" ALTER COLUMN "filialId" SET NOT NULL;

-- Bloqueio sem profissional e sem unidade continua valendo para todas as unidades
ALTER TABLE "Bloqueio" ADD COLUMN "filialId" TEXT;

ALTER TABLE "Profissional" ADD CONSTRAINT "Profissional_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Agendamento" ADD CONSTRAINT "Agendamento_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Comanda" ADD CONSTRAINT "Comanda_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Caixa" ADD CONSTRAINT "Caixa_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Bloqueio" ADD CONSTRAINT "Bloqueio_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE CASCADE ON UPDATE CASCADE;
