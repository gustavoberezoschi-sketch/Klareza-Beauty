-- Estoque por unidade. O estoque atual de cada produto vai para a primeira
-- unidade da salao (a "Unidade principal"); as outras começam zeradas.

CREATE TABLE "EstoqueFilial" (
    "id" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "filialId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL DEFAULT 0,
    "minimo" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "EstoqueFilial_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EstoqueFilial_produtoId_filialId_key" ON "EstoqueFilial"("produtoId", "filialId");
ALTER TABLE "EstoqueFilial" ADD CONSTRAINT "EstoqueFilial_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EstoqueFilial" ADD CONSTRAINT "EstoqueFilial_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Primeira unidade de cada salao
CREATE TEMP TABLE "_principal" AS
SELECT DISTINCT ON ("salaoId") "salaoId", "id" AS "filialId"
FROM "Filial" ORDER BY "salaoId", "ordem", "criadoEm";

-- Estoque atual -> unidade principal (o mínimo vale para todas as unidades)
INSERT INTO "EstoqueFilial" ("id", "produtoId", "filialId", "quantidade", "minimo")
SELECT 'est_' || p."id" || '_' || f."id", p."id", f."id",
       CASE WHEN f."id" = pr."filialId" THEN p."estoque" ELSE 0 END, p."estoqueMinimo"
FROM "Produto" p
JOIN "Filial" f ON f."salaoId" = p."salaoId"
JOIN "_principal" pr ON pr."salaoId" = p."salaoId";

-- Histórico de movimentações fica na unidade principal
ALTER TABLE "MovimentoEstoque" ADD COLUMN "filialId" TEXT;
UPDATE "MovimentoEstoque" m SET "filialId" = pr."filialId"
FROM "Produto" p JOIN "_principal" pr ON pr."salaoId" = p."salaoId"
WHERE m."produtoId" = p."id";
ALTER TABLE "MovimentoEstoque" ALTER COLUMN "filialId" SET NOT NULL;
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_filialId_fkey" FOREIGN KEY ("filialId") REFERENCES "Filial"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Produto" DROP COLUMN "estoque", DROP COLUMN "estoqueMinimo";
DROP TABLE "_principal";
