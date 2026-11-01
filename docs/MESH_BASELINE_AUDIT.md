# Baseline antes da evolução mesh — 2026-11-01

Pedido de continuação lido integralmente antes de modificar código. Diretório real: outputs/atravoz, preservado. Branch main; HEAD encontrado `2bc26b33fae2509c1713ffab48ffd98a6234fa89`; remoto configurado para repositório privado atravoz-preparacao na conta josepedrosoaresdesouzanetto-max; último commit remoto verificado anteriormente `406a3df28e4e956058878860545f88ce815600de`. Nenhum novo push autorizado.

Estado Git inicial: 31 entradas no status, principalmente README/documentação/evidências da execução anterior ainda não commitados. O código já estava no commit local 2bc26b3. Nada foi descartado. README referenciava um relatório final ainda em elaboração quando chegou a continuação; será atualizado para o relatório desta evolução.

Leitura: README, arquitetura, fila de sincronização, banco/rotas, contratos e módulos implementados nesta sessão. API FastAPI/SQLite com dados imutáveis e recibos; React/IndexedDB e Service Worker; central separada/autenticada; inteligência opcional; protocolo experimental sem rádio. Não há mesh funcional anterior.

Comando repetido: `./scripts/check.ps1`. Resultado: 53 pytest, 18 Vitest, cinco Playwright/Microsoft Edge aprovados; Ruff, Biome, schemas, TypeScript e build aprovados; avaliação determinística 12/12 casos. Log completo em work/mesh-baseline-validation.log. Testes preservados. Avisos conhecidos: depreciação httpx/TestClient, comentários Zod removidos pelo bundler e cores do runner; nenhum teste falho nesta baseline.

Provas existentes: registro mínimo offline, reabertura, sincronização idempotente, anexos separados, central e mídia sintética. São provas de navegador desktop com viewport móvel, não hardware móvel. Nenhuma revisão humana ou teste físico atribuídos a alguém.

Ambiente reinspecionado: Windows, Node 24, Python 3.13; adb, gradle, javac, Docker e Ollama não encontrados; SDK Android padrão ausente. Não há aparelhos disponíveis através das ferramentas verificadas. Bibliotecas atuais incluem Pillow 13.0.0 após correção de segurança exclusivamente local.

Plano incremental: novo mesh-core isolado; banco local de relay separado, sem migrar/destruir IndexedDB de ocorrências; tabelas mesh aditivas; gateway reutiliza a transação idempotente atual. Mesh desativada por padrão e incapaz de bloquear registro ou envio direto. Transportes nativos dependem de ambiente/hardware. WebRTC com sinalização manual será ensaio de transporte entre navegadores, sem alegar descoberta BLE/Wi-Fi Direct.
