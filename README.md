# sabadousite
site oficial do sabadou meus calabresos, site oficial do insitulab em parceiria ao @sabadouofficiall

## Exclusão de contas pelo painel admin

O botão de exclusão usa a Edge Function `admin-delete-account`. Publique-a no projeto Supabase com:

```sh
supabase functions deploy admin-delete-account
```

A função usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente servidor do Supabase. Nunca coloque a chave `service_role` em `config.js` ou no navegador. O botão só aparece para contas listadas no painel e pede confirmação antes de apagar Auth, cliques, votos e fanarts.

## Fluxo semanal de fanarts

Depois de atualizar o projeto, execute novamente `supabase-fanarts.sql` no SQL Editor do Supabase. Ele aplica o limite de uma fanart por semana, a liberação administrativa de um reenvio e o registro de avisos vistos. O site consulta a situação enquanto a pessoa está online; decisões não vistas permanecem no banco para aparecerem em um pop-up quando ela voltar.
