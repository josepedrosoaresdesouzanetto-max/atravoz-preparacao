# Início no VS Code

1. Abrir a pasta `atravoz` ou arquivo `atravoz.code-workspace`.
2. Abrir terminal PowerShell na raiz. Verificar Python 3.13 e Node 24.
3. Criar `.venv` e instalar `requirements.txt`; executar `npm ci`.
4. Executar `npm run build` e `./scripts/check.ps1`.
5. Gerar OPERATOR_TOKEN e iniciar `scripts/serve.py` conforme README.
6. Abrir cidadão em 8000 e central em 8000/central.html. A central requer a chave gerada no terminal.
7. Para mudar interface, rodar `npm run dev` em outro terminal. A versão offline deve ser testada no build servido pela API, não apenas no modo dev.

As extensões são sugestões, não dependências de execução. Workspace define o Python local no Windows; em Linux selecione `.venv/bin/python` manualmente. `.env.example` não é carregado automaticamente. Não coloque chaves em VITE_*: essas variáveis entram no bundle.

Se houver falha: preserve registro pendente; consulte console/testes; não limpe IndexedDB como primeira ação. Porta ocupada: encerre somente o processo que iniciou ou configure PORT e acesso correspondente. Alterar origem/porta cria outro armazenamento no navegador. Feche páginas antigas para ativar atualização do Service Worker.

Revisão inicial por área: cidadão `App.tsx` e `features`; API `main.py`, `database.py`, `security.py`; central `Dashboard.tsx` e `api.ts`; Dados/IA `OWNER_HANDOFF.md`. Testes e limitações fazem parte do handoff.
