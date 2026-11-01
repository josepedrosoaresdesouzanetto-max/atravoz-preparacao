# Arquitetura implementada

Decisão técnica assistida por IA em 01/11/2026, baseada no ambiente disponível: React 19/TypeScript 5/Vite 7; IndexedDB com transações; Service Worker gerado do build; FastAPI/Pydantic 2; SQLite em modo WAL; inteligência Python sem dependência da API. Não foram instalados Android Studio, Docker ou ferramentas globais.

Fluxo: interface → validação Zod → transação IndexedDB (registro, arquivos e remoção do rascunho) → fila persistente → HTTP same-origin → Pydantic → transação SQLite → recibo → atualização local. A central autentica por Bearer e lê dados reais do SQLite. IA roda apenas por solicitação de operador, fora do recebimento.

Dependências unidirecionais: cidadão/central → contratos TS; API → inteligência/contratos Python; inteligência não importa API. O protocolo experimental importa somente os contratos. Não há dependências circulares. Scripts servem o build e exportam/verificam schemas.

SQLite foi escolhido para reduzir operação na preparação local e permitir commits atômicos inclusive de anexos BLOB. Limites: 5 mil registros e 200 MiB de mídia por banco de demonstração. PostgreSQL/objeto externo exigem migração real posterior, não configurada aqui. Não há Docker Compose sem necessidade nem infraestrutura pública criada.

Alternativas avaliadas: aplicativo Android nativo seria necessário para investigar anúncio BLE/recepção, mas faltam SDK e aparelhos; React Native/Capacitor adicionariam instalação sem provar rádio. PWA é suficiente para registro e sincronização no navegador testado, não resolve o cenário A universalmente.
