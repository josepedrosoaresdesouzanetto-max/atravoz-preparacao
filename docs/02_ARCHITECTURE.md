# Arquitetura — marco inicial

Decisão técnica assistida por IA, 2026-11-01: React/TypeScript/Vite nas duas interfaces; IndexedDB e Service Worker no cidadão; FastAPI/Pydantic e SQLite transacional na API; módulo Python independente para Dados/IA/Qualidade. Mesmo domínio para API e interfaces evita CORS amplo. SQLite simplifica a preparação local; PostgreSQL exige migração futura, não foi implementado.

Dependências seguem uma direção: interfaces → contratos; API → modelos e inteligência; inteligência não importa API. Banco é exclusivo da API. Não haverá processamento de IA antes do salvamento nem no caminho crítico do recibo.

Publicação: um envio inicial privado, se houver autenticação. Nenhum deploy autorizado. Android nativo depende de SDK e dispositivos ausentes. Contratos de transferência poderão ser testados sem afirmar comunicação física.
