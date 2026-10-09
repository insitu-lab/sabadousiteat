# Sabadou — site da atualização

Versão **2.1.0**. Inclui aviso de atualização configurável, atalhos entre seções e histórico de fanarts com horário do servidor e CSV. Ative as migrações na ordem de `../ATIVAR-MELHORIAS.md`; os riscos encontrados estão em `../REVISAO-SEGURANCA-NAVEGACAO.md`.

Esta é a versão completa preparada para o lançamento: contas de fãs, lojinha, ranking, envio e análise de fanarts, painel admin e avisos em vídeo.

## Publicar no Git

Abra `../PREPARAR-ATUALIZACAO.cmd` e copie **todo o conteúdo do pacote gerado em publicar/** para a raiz do repositório. O pacote inclui o `index.html` da atualização e os arquivos de `comum/`, com os caminhos ajustados.

Esta pasta usa `../comum/` para configuração, imagens, música, manutenção e jogo; não depende de `site-oficial/` ou `motions/`. Os arquivos SQL e `supabase/` contêm a configuração do banco e a Edge Function; copiar para o Git não executa SQL nem publica a função no Supabase.

O site antigo destinado ao público está separado em `../site-oficial/`. O vídeo e os arquivos para editar motions estão em `../motions/`.

## Manutenção e horário de volta

Execute uma vez `../comum/supabase-manutencao.sql` no SQL Editor do Supabase. Na mesma seção em que você ativa ou desativa a manutenção, escolha **Data e hora da volta (Brasília)** e clique em **salvar volta**. **Sem prazo** mantém a manutenção até você desativá-la manualmente.

O prazo fica no Supabase. A página de espera atualiza a contagem e busca alterações a cada 15 segundos; no horário escolhido, os visitantes podem voltar ao site. Como o projeto Supabase é o mesmo nas duas versões, basta executar o SQL uma vez e o horário salvo vale para os dois sites.

## Exclusão de contas pelo painel admin

O botão de exclusão usa a Edge Function `admin-delete-account`. Publique-a no projeto Supabase com:

```sh
supabase functions deploy admin-delete-account
```

A função usa `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` no ambiente servidor do Supabase. Nunca coloque a chave `service_role` em `config.js` ou no navegador. O botão só aparece para contas listadas no painel e pede confirmação antes de apagar Auth, cliques, votos e fanarts.

## Fluxo semanal de fanarts

Depois de atualizar o projeto, execute novamente `supabase-fanarts.sql` no SQL Editor do Supabase. Ele aplica o limite de uma fanart por semana, a liberação administrativa de um reenvio e o registro de avisos vistos. O site consulta a situação enquanto a pessoa está online; decisões não vistas permanecem no banco para aparecerem em um pop-up quando ela voltar.

Depois desse SQL, execute `../comum/supabase-seguranca-base.sql` e `supabase-fanarts-seguranca.sql` por último para manter as proteções desta versão. O registro de horário confirmado vale para novos envios; registros antigos conservam sua data anterior.
