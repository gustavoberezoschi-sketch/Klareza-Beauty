-- AlterTable
ALTER TABLE "Cliente" ADD COLUMN     "aceiteTermosEm" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "LimiteTentativa" (
    "id" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LimiteTentativa_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LimiteTentativa_chave_criadoEm_idx" ON "LimiteTentativa"("chave", "criadoEm");


-- Supabase expõe as tabelas do schema "public" pela Data API (PostgREST) para quem tiver a chave anon.
-- O sistema acessa o banco só pelo servidor (Prisma, dono das tabelas, que ignora RLS). Ligar RLS sem
-- nenhuma policy bloqueia todo acesso pela Data API; e, no Supabase, tira os privilégios de anon/authenticated.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    EXECUTE 'REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM authenticated';
  END IF;
END $$;
