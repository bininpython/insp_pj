# Equipe Inspeção PJ

Aplicação web responsiva para cadastro e gestão da equipe de Inspeção/Laboratório, com grupos de folga 1–4.

## Recursos

- Importa nomes, matrículas, unidade e líder operacional da aba **Equipe 2026** de arquivos .xlsx, .xls ou .csv.
- Mantém turno, função, status e grupo de folga editáveis por integrante.
- Pesquisa e filtros por nome, matrícula, turno e grupo.
- Painel de distribuição com contagem por grupo e sugestão automática para integrantes ainda sem grupo.
- Exporta a equipe em CSV e gera backup JSON.
- Salva os dados no armazenamento local do navegador.

## Executar

Abra index.html em um navegador moderno ou publique o repositório como site estático. A importação de Excel usa a biblioteca SheetJS carregada pelo jsDelivr; por isso, a primeira importação requer conexão à internet.

## Privacidade e sincronização

O repositório contém apenas o código do aplicativo e não inclui nomes nem matrículas da planilha recebida. Os dados importados permanecem no navegador e não são sincronizados entre dispositivos ou usuários. Faça um backup JSON antes de limpar os dados do navegador.

A distribuição real de folgas não foi preenchida automaticamente: atribua cada integrante ao grupo correto após importar, pois a planilha não contém um vínculo individual inequívoco entre matrícula e Folga 1–4.
