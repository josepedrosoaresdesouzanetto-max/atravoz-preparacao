# Central demonstrativa

Objetivo: consultar o que foi persistido e apoiar revisão humana. Responsabilidade sugerida: desenvolvedor 3. React/TypeScript/Zod; depende somente de contratos e API. Entrada: página/detalhe autenticado; saída: solicitações explícitas de análise, download e revisão com justificativa.

`src/api.ts` valida respostas; `Dashboard.tsx` apresenta lista paginada, filtros na página carregada, original, localização, anexos efetivamente recebidos, análises e histórico. Chave do operador em memória, limpa ao sair/recarregar. Não usa armazenamento offline para relatos administrativos nem recebe token do cidadão.

Na raiz: `npm run dev` e `/central.html` para desenvolvimento; build + scripts/serve.py para versão local em 8000/central.html. Teste principal: `npm run test:e2e`; API tem testes próprios de autorização. Exemplo: criar relato fictício no cidadão e localizar seu UUID, sem semeadura automática.

Estado: consultas, paginação, busca/tipo, detalhes, análise e revisão auditada implementados; fluxo autenticado verificado no Edge desktop. Downloads e mídia têm testes de API; não foram revisados por operador humano. Riscos: token único não identifica cada pessoa; filtros abrangem só a página atual (rotulada). Pendências: validação de UX, contas reais, filtros no servidor para escala, acessibilidade com leitores e correções iniciadas pelo cidadão.
