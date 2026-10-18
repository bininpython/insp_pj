# Equipe Inspeção

Painel profissional para controle operacional da equipe de inspeção, cadastro de pessoas e distribuição dos grupos de folga 1–4.

## Tecnologias

- React 18 e TypeScript 5
- Vite 6 para desenvolvimento e build
- Lucide React para ícones
- SheetJS (`xlsx`) para leitura de planilhas Excel
- CSS responsivo próprio, com componentes e tokens visuais consistentes

## Funcionalidades

- Dashboard com indicadores, distribuição de folgas e pendências.
- Cadastro, edição e exclusão de integrantes; busca e filtros por nome, matrícula, turno e grupo.
- Importação `.xlsx`, `.xls` e `.csv`, priorizando a aba **Equipe 2026**.
- Distribuição automática e equilibrada entre Folga 1, 2, 3 e 4.
- Exportação CSV e backup/restauração JSON.
- Layout adaptável a computadores, tablets e celulares.

## Desenvolvimento

Requer Node.js 20.19+ ou 22.12+.

```bash
npm install
npm run dev
```

Antes de publicar, execute as verificações e gere os arquivos estáticos:

```bash
npm run typecheck
npm run build
```

O conteúdo publicável fica na pasta `dist/`.

## Privacidade e dados

O acesso por PIN foi removido. Os cadastros ficam no `localStorage` do navegador atual, sem envio ou sincronização com servidor. Eles não aparecem pré-carregados quando o painel é aberto em outro dispositivo ou navegador. Exporte backups JSON regularmente e guarde-os em local seguro. A aplicação não contém nomes ou matrículas da planilha no repositório.

A antiga tabela `public.inspection_staff` permanece protegida no Supabase, e seus dados não foram removidos. A função de administração usada pelo PIN foi aposentada e responde como indisponível; ela não é usada pelo novo aplicativo.

A planilha de origem não determinava de modo confiável a folga individual. Revise cada integrante e confirme a alocação sugerida antes de usar a distribuição operacionalmente.
