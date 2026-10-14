-- Nova cor padrão das saloes (verde do KlarezaBeauty).
ALTER TABLE "Salao" ALTER COLUMN "corDestaque" SET DEFAULT '#145c3c';

-- Quem ainda estava com o dourado padrão antigo passa para o verde.
UPDATE "Salao" SET "corDestaque" = '#145c3c' WHERE lower("corDestaque") = '#c9a14a';
