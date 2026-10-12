# Chelle's Biscoitos — atualização

## O que foi preparado
- Mantém o visual e a estrutura do site original.
- Registra venda por uma função do banco que baixa o estoque na mesma transação.
- Permite cancelar uma venda no Histórico; a função restaura o estoque uma única vez e mantém a venda identificada como cancelada.
- Vendas canceladas não entram no faturamento nem nas unidades vendidas do mês.

## Antes de publicar
1. Faça uma cópia do projeto atual/ZIP original.
2. No Supabase, abra o projeto já conectado ao site e faça backup dos dados antes de executar SQL.
3. Abra SQL Editor e execute o arquivo `supabase.sql` inteiro. Ele cria/ajusta as tabelas, as funções e as permissões necessárias.
4. Confira que o projeto Vercel atual ainda tem `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` com os valores corretos.
5. Rode `npm install` e `npm run build` localmente antes de implantar.
6. Envie os arquivos atualizados para o MESMO projeto do Vercel, não crie um projeto novo.

## Aviso importante sobre não usar login
Esta versão não tem login, conforme solicitado. Para o site conseguir funcionar sem autenticação, o banco permite que visitantes anônimos leiam o catálogo e o histórico e cadastrem produtos; as operações de venda/cancelamento ficam limitadas a funções SQL específicas, mas qualquer pessoa com o endereço pode tentar chamá-las. Não use para dados confidenciais ou se precisar impedir alterações de terceiros. A chave `anon`/publishable pode ficar no frontend; NUNCA coloque `service_role` ou outra chave secreta no site.

## Como testar antes de uso real
- Cadastre um produto de teste com estoque 5.
- Registre venda de 2: estoque deve ficar 3.
- Cancele a venda no Histórico: estoque deve voltar a 5 e a venda aparecer como Cancelada.
- Tente cancelar a mesma venda de novo: deve ser recusado e o estoque não pode mudar.
- Confirme que a venda cancelada não conta no faturamento.
- Apague o produto de teste manualmente pelo Table Editor, se necessário.
