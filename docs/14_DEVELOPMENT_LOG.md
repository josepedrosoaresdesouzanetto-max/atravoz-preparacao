# Diário

## 2026-11-01 — preparação anterior ao evento

Inspeção: Windows, Python 3.13.5 e 3.12 disponíveis; Node 24.14.1, npm 11.11.0, Git 2.53.0, GitHub CLI 2.95.0. Java 8; SDK Android e adb não encontrados. Sem chave de modelo nas variáveis verificadas. Nenhuma validação física foi realizada.

Código gerado: esqueleto React/TypeScript, API FastAPI, normalização e testes iniciais. Execuções serão registradas após os resultados.

Execução do marco inicial: pytest 3 aprovados (um aviso de depreciação httpx/TestClient); Vitest 2 aprovados; Ruff, lint e build aprovados. npm audit inicialmente encontrou dependências vulneráveis no ESLint; substituição por Biome eliminou os alertas (0 na nova instalação). Nenhuma publicação realizada antes desses testes.

### Publicação inicial

Autenticação consultada e conta verificada. Repositório novo `atravoz-preparacao`, privado, criado com um único push em 01/11/2026. Hash: `406a3df28e4e956058878860545f88ce815600de`. GitHub Actions concluiu com sucesso os cinco testes do esqueleto. Referência: docs/26_PUBLICATION_RECORD.md. Nenhum push, PR, release, tag ou deploy posterior.

### Desenvolvimento exclusivamente local

Código gerado e executado: contratos canônicos/JSON/Zod, extração por regras, validação de evidências, adaptador Ollama, falhas/fallback, duplicidades, API/SQLite, autenticação, idempotência, anexos, histórico/auditoria, cidadão offline, mídia/GPS opcionais, central, protocolo de transferência em software, scripts e documentação. Banco real de demonstração não foi semeado com ocorrências que aparentassem ter chegado ao vivo.

### Falhas observadas e correções

- Avaliação inicial da inteligência: 17 testes passaram e um falhou. Negação em “não conseguem sair” descartava a contagem explícita em outra oração. A regra passou a considerar o contexto da quantidade; adicionados casos de negação/contradição.
- Compilação da central identificou fechamento de tag JSX incorreto. Corrigido antes de testes de navegador.
- Vitest inicialmente aprovou 13 asserções, mas reportou uma rejeição de transação IndexedDB não tratada; a execução não foi considerada aprovada. Transação e solicitações passaram a ser aguardadas juntas; testes repetidos sem erro não tratado.
- Runner E2E falhou ao iniciar Python com caminho relativo em Windows. Corrigido com caminho absoluto entre aspas, sem alterar política de execução.
- Três testes E2E falharam com `Illegal invocation` no fetch. O armazenamento preservou os registros, mas envio não funcionava. Corrigido o contexto da chamada; três e depois cinco cenários passaram.
- Revisão acrescentou: configuração inválida da IA não pode impedir inicialização/recibo; remoção do rascunho na mesma transação do registro; booleano synthetic estrito em Python e TS; bloqueio de categoria sob mais formas de negação.
- Auditoria npm inicial detectou vulnerabilidades transitivas do linter; migração para Biome resultou em zero alertas. Dependência python-multipart, sem uso, foi removida.
- Auditoria Python encontrou 39 registros de vulnerabilidade associados ao Pillow 12.3.0 (podem incluir aliases do mesmo problema). Atualizado localmente para Pillow 13.0.0 e repetidos testes. O remoto inicial não foi alterado. Aviso de pasta temporária bloqueada na atualização estava associado ao servidor de preview usando a biblioteca; o servidor foi encerrado.

### Evidências finais e limites

53 testes Python, 18 TypeScript e cinco E2E aprovados na verificação consolidada anterior à auditoria de Pillow; após atualizar a biblioteca, a suíte foi repetida e o resultado final está em `docs/evidence/test-summary.json`. Lint, verificação de schemas, tipos e build também executados. Corpus: 12/12 casos sintéticos nas verificações definidas, sem chamada a modelo.

Microbenchmark executado com 100 análises por regras e 50 submissões locais em processo. Não mede aparelho modesto, energia, throughput público nem rede física. Capturas mobile/desktop dos testes foram inspecionadas pelo agente. Nenhuma revisão humana foi inventada.

Bloqueios: SDK/adb/Ollama não encontrados; nenhum dispositivo físico usado; nenhuma inferência generativa real, transcrição ou validação Pró-Criança realizada. Protocolo fragmenta/valida/persiste em software, mas não implementa Bluetooth nem relay para API. Deploy público não autorizado; nenhum feito.

Decisão de escopo: concluir o máximo do núcleo verificável, preservar autoria e deixar as limitações explícitas. Ficha oficial, papéis, licença, marca, dados reais e autorização de publicação final continuam pendentes.

## Continuação Antena Humana — 01/11/2026

O segundo prompt foi lido integralmente. Auditoria preservou branch main e trabalho anterior; 76 testes foram repetidos antes das mudanças. Documentação pendente foi preservada no commit local 3dcc3dd. Nenhum novo push.

Implementados mesh-core isolado, JWE/JWS, credenciais de curta duração, convites de uso único, chaves privadas protegidas, chain de saltos, quotas, ACK durável, recibos centrais, gateway transacional e WebRTC com sinalização manual. Incluídos participação voluntária, pausa, rede/cotas/bateria, instalação PWA condicional, métricas de transporte e visualização explícita do operador. Regras e IA anterior preservadas.

Problemas encontrados/corrigidos: import/tipos divergentes durante integração; seletor E2E exigia nome exato de botão cujo nome acessível inclui descrição; teste recarregava C antes de aguardar ACK; interface exibia código de conexão antigo durante geração de nova sessão; atualização da origem após recibo poderia ficar incompleta numa interrupção; respostas administrativas em voo podiam restaurar sessão depois de Sair. Corrigidos o código, a sincronização do ensaio e acrescentados testes de regressão. Não foram removidos testes falhos para elevar aprovação. Uma execução E2E usou build anterior após erro TypeScript; foi descartada como validação final, o build foi corrigido e a suite completa repetida.

Resultado final: consultar MESH_CURRENT_STATUS.md/evidências, incluindo 106 testes. Interoperabilidade real entre jose no navegador e JWCrypto no Python exercitada, não só mocks. Três contextos no mesmo Windows, zero celulares. Revisão visual do screenshot pelo agente, sem atribuir validação humana.

Auditorias npm/pip repetidas após novas dependências: zero vulnerabilidades conhecidas. Correção anterior de Pillow permanece local. Limpeza opcional de resíduo temporário do pip foi recusada pela revisão automática, sem razão específica informada; arquivo ignorado preservado, sem efeito nos testes. Nenhuma tentativa de contornar o bloqueio.
