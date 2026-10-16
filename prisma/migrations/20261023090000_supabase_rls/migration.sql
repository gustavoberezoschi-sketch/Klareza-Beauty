-- Supabase expõe o schema "public" por uma API REST. O sistema só acessa o banco pelo Prisma (papel postgres,
-- que ignora RLS). Ligar o RLS sem criar políticas bloqueia qualquer acesso pela API pública (anon/authenticated).
-- Tabelas criadas em migrações futuras também precisam de ALTER TABLE ... ENABLE ROW LEVEL SECURITY.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;
END
$$;
