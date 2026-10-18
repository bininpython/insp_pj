# Equipe Inspeção PJ

Aplicação web responsiva para cadastro e gestão da equipe de Inspeção/Laboratório, com grupos de folga 1–4.

## Recursos

- Importa nomes, matrículas, unidade e líder operacional da aba **Equipe 2026** de arquivos `.xlsx`, `.xls` ou `.csv`.
- Mantém turno, função, status e grupo de folga editáveis por integrante.
- Pesquisa e filtros por nome, matrícula, turno e grupo.
- Painel de distribuição com contagem por grupo e sugestão automática para integrantes ainda sem grupo.
- Exporta a equipe em CSV e gera backup JSON.
- Sincroniza os cadastros com o Supabase do projeto Petrus.
- Exige o PIN de administrador do Petrus; a sessão expira após 12 horas.

## Executar

Abra `index.html` em um navegador moderno ou publique o repositório como site estático. A importação de Excel usa a biblioteca SheetJS carregada pelo jsDelivr; por isso, a primeira importação requer conexão à internet.

O backend usa a tabela protegida `public.inspection_staff` e a Edge Function `insp-pj-admin` no projeto Supabase `petrus`. A chave publishable configurada no cliente não concede acesso direto à tabela.

## Privacidade e sincronização

O repositório contém apenas o código do aplicativo e não inclui nomes nem matrículas da planilha recebida. A tabela não concede acesso de leitura ou escrita às funções `anon` ou `authenticated`; o app acessa os dados por uma Edge Function que valida o PIN e uma sessão administrativa. Faça um backup JSON antes de limpar os cadastros do servidor.

A distribuição real de folgas não foi preenchida automaticamente: atribua cada integrante ao grupo correto após importar, pois a planilha não contém um vínculo individual inequívoco entre matrícula e Folga 1–4.

O schema aplicado está documentado em `supabase/schema.sql`.
