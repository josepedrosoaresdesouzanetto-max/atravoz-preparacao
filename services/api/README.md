# API e banco

Objetivo: persistir antes de confirmar, controlar idempotência e proteger a central. Responsabilidade sugerida: desenvolvedor 2. Dependências: FastAPI, Pydantic, SQLite padrão do Python, Pillow para imagens, inteligência para processamento opcional. Não depende das interfaces.

Entrada: `Submission {incident,write_key}` e uploads binários. Saída: `ServerReceipt` somente após commit; detalhes/página autenticados; recibos separados de anexos. Contratos e erros em `docs/07_API_CONTRACT.md`; exemplos em `packages/contracts/examples.json`.

Executar da raiz: `.venv/Scripts/python.exe scripts/serve.py`; fornece API e build se `dist` existir. OPERATOR_TOKEN precisa ter pelo menos 32 caracteres; DATABASE_PATH configura arquivo, padrão runtime/incidents.sqlite3. Testes: `.venv/Scripts/python.exe -m pytest services/api/tests -q`.

Arquivos: `main.py` rotas/integração; `database.py` transações e projeção de detalhes; `security.py` autenticação/limites; `media.py` verificação de contêiner/imagens. Esquema v1 embutido é inicializado idempotentemente e recusa versões desconhecidas. Banco runtime e credenciais nunca entram no Git.

Estado: API, SQLite, reenvio concorrente, colisão, anexos, proteção, análise, revisão/histórico e falhas testados localmente. Pendências: PostgreSQL/migrações, contas individuais/RBAC, antivírus/codec completo, limite distribuído, retenção, HTTPS e backup operacional. Riscos: um token compartilhado de demonstração não fornece autoria individual; SQLite/arquivos não cifrados pelo aplicativo. Próximo passo é revisão de segurança antes de implantação autorizada.
