# Estratégia e evidências de teste

Comando completo: `./scripts/check.ps1`. O script falha ao primeiro comando com erro. Resultados consolidados em `docs/evidence/validation.log` (local, ignorado pelo Git pelo padrão *.log), `docs/FINAL_REPORT.md` e relatórios de avaliação. Não foi medida cobertura percentual.

Python: contratos e exemplos compartilhados, normalização, textos incompletos/confusos/negados, prompt injection, saída malformada/inventada, timeout, protocolo HTTP simulado do provedor, duplicidade conservadora, SQLite, concorrência, idempotência, colisão, autenticação, anexos, falha de gravação e revisão auditada. Teste do protocolo de transferência verifica fragmentos e ACK após commit, sem rádio.

Vitest/fake-indexeddb: banco emulado, reabertura, falha de escrita, fila, recibos inválidos, rede, anexos pendentes, prioridade de essenciais, backoff, não regressão de estado e exemplos de contratos. Emulação não prova persistência em hardware.

Playwright/Microsoft Edge: navegador real desktop, viewport 390×844; criar offline, fechar/reabrir, reconectar, preservar ID, consultar central, análise por regras, revisão simulada, acesso negado, HTML tratado como texto, foto preservada offline/upload atrasado e MediaRecorder com fonte artificial. Central inspecionada a 1440×1000. Capturas em `docs/evidence`. Áudio artificial não valida microfone físico.

CI remota aprovou somente o commit inicial 406a3df: três testes Python e dois TypeScript. Workflow final local adiciona contratos, avaliação e Chromium E2E; não foi enviado nem executado remotamente. Nenhum resultado local deve ser chamado de CI final aprovada.

Validação pendente: celulares Android/iOS reais, navegador de entrada, quota/evicção em dispositivos reais, screen reader, permissões físicas, GPS, bateria, conectividade móvel, rede sem internet, BLE e teste com Pró-Criança. Falhas encontradas e correções estão no diário.
