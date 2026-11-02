# ATRAVOZ — encerramento da fase de instaladores

Data: 2026-11-01. Versão 0.2.0-test. Preparação privada; não é entrega oficial do evento, central de socorro ou validação operacional. Este documento substitui o estado da fase anterior; preserva os relatórios antigos como histórico.

## 1. Estado recuperado e preservação

Partida em main/fbf2d4d22baeea4d06fef32fca8d9bd0a6ab81a8. Git inicialmente limpo; baseline repetido: 63 Python + 36 TypeScript + 7 navegador = 106 aprovados, build e schemas válidos. Sem SDK/JDK de desenvolvimento, APK, rádio nativo ou pacote Windows no início. Os arquivos da fase interrompida foram preservados e inspecionados. Nenhum novo repositório foi criado.

Foram preservados registro mínimo, relato opcional, foto/áudio/localização, IndexedDB/fila/IDs, API/SQLite, estados/recibos, autenticação, histórico, central, regras de IA, JWE/JWS, múltiplos saltos, deduplicação, quotas e participação voluntária. Os artefatos da fase anterior permanecem em outputs.

## 2. Entregáveis e versões

Pasta: `outputs/entregas/ATRAVOZ-0.2.0-test`. APK, central Desktop/Mobile e eventos usam versão 0.2.0-test; Android versionCode 2. Identificador `br.org.atravoz.cidadao`; nome `ATRAVOZ Cidadão`. Requer Android API 24 ou superior e compatibilidade do aparelho/WebView; alvo 36. Windows: pacote portátil x64 compilado, não assistente Setup. Central Mobile: PWA da mesma aplicação/API, sem APK separado.

- `Android/ATRAVOZ-Cidadao-0.2.0-test.apk` — 4.165.194 bytes; SHA-256 `54800fe11f5fe13ce603aaef6c0b2400d67fad7ded3cc630351ed1d54bfc3bb8`.
- `Windows/ATRAVOZ-Central-Windows-0.2.0-test.zip` — 33.897.390 bytes; SHA-256 `9cf236254949584c59cdeb5471f230d165fcc2f914cf5f16a5aca1ff7d3c27d8`.
- `Windows/ATRAVOZ-Central/ATRAVOZ-Central.exe` — 9.858.940 bytes; SHA-256 `d5c7b530c1ba2cc6ea449516aa64048215119d366fd137afebfadb26548dcb73`.

O EXE depende de `_internal`; distribua o ZIP inteiro. Total descompactado Windows: 68.392.470 bytes. Não há Authenticode de editor nem assinatura de publicação Android. Hashes também estão no manifesto da entrega; fonte possui arquivo separado e hash após commit local.

## 3. APK real e integridade

Capacitor 8.6.0 usa a mesma interface e núcleo; componente Java RFCOMM registrado. JDK/SDK/Gradle portáteis, downloads oficiais com checksum, sem instalação global. APK recompilado com os assets atuais: quinze arquivos web conferidos byte a byte dentro do pacote; ZIP íntegro, AndroidManifest/classes.dex presentes. `aapt` confirmou nome/pacote/versão/SDK/permissões; `apksigner` confirmou assinatura v2 com RSA 3072. Certificado de desenvolvimento SHA-256: `5c4e9546b694e01bc5430f78613c56052fb749040b56c54bb4707cd18d6dc18d`.

**Não instalado em Android. Zero celulares disponíveis.** Instalação manual é por abertura do APK transferido como arquivo, sem cabo. GPS/mídia são opcionais no fluxo; recusa física, captura, reabertura/atualização nativa e comportamento de cada Android ainda precisam ser testados. Abertura/persistência offline foram verificadas no navegador desktop e assets nativos foram empacotados; não são prova de reabertura em celular.

## 4. Bluetooth e mesh

Bluetooth Classic/RFCOMM implementado, compilado e integrado, com descoberta explícita, pareamento, desafio assinado mútuo, sessão/seqüência, quadros limitados, timeouts, armazenamento e recibos. Nenhum teste pelo rádio foi feito: não podemos afirmar que a comunicação física realmente funciona. Dois celulares: pendente. Três celulares: pendente. iOS: transporte nativo não implementado.

A→B→C→API e recibo C→B→A passaram novamente em três contextos Edge no mesmo PC com WebRTC real. O protocolo do adaptador nativo passou em fios de software e a codificação de quadros passou em JVM; isso é evidência separada de rádio físico. Origem/cópia cifrada, deduplicação, expiração e limites preservados. Não mede alcance, bateria ou execução com tela bloqueada. O rádio é encerrado ao sair de primeiro plano; não há serviço persistente.

## 5. Windows empacotado e executado

PyInstaller compilou `ATRAVOZ-Central.exe` com API, bibliotecas e interface. O executável real passou no teste de início, HTTP local, acesso sem credencial recusado, consulta autenticada, gravação, diagnóstico, autoridade mesh protegida por DPAPI, parada, reabertura dos dados e encerramento dos threads. Segunda instância com a mesma pasta foi recusada. A interface Tkinter está incluída; não houve teste humano de cliques no iniciador nem certificação em outra máquina.

Porta loopback livre atribuída pelo SO, sem exposição automática, firewall, autostart ou serviço global. Dados fora do pacote: `%LOCALAPPDATA%/ATRAVOZ/Central`. Chave do operador só em memória por execução; chaves mesh cifradas com senha DPAPI da conta. Atualização portátil preserva pasta de dados; remoção do pacote não apaga histórico. Instruções e limitações de migração em INSTALLATION_PHASE.md.

## 6. Central Mobile

Manifesto, ícones, rota `/central/`, Service Worker restrito à interface e layout responsivo implementados. Reabertura da interface offline testada no Edge; respostas autenticadas da API não ficam no cache. Consulta o mesmo servidor, não cria base de ocorrências independente. Instalável como PWA em contexto HTTPS confiável compatível, mas não instalada em telefone nesta execução.

Celulares não alcançam o PC pelo seu próprio 127.0.0.1. A equipe deve preparar acesso HTTPS à mesma API/banco para provisionamento, sincronização e PWA. Nenhuma publicação, túnel, domínio, certificado ou regra de firewall foi criado. O iniciador portátil mantém loopback por decisão de segurança. Esse pré-requisito está explícito no README da entrega.

## 7. Diagnósticos e importação

Implementados códigos de falha, schema restrito, cota/retencão/repetição, fila separada limitada, consentimento e Wi-Fi declarado, POST assinado autenticado, painel Diagnósticos do Sistema e exportações JSON/Markdown. Testes de exportação no navegador/privacidade/envio/recebimento/importação passaram. Seletor de compartilhamento Android foi compilado, mas não testado fisicamente.

Relatórios não incluem nomes, coordenadas, texto de ocorrências, fotos/áudio, senhas/chaves nem mensagens livres de exceção. Há limites de cobertura: crash antes de JS, sistema operacional e instalação não ficam necessariamente registrados. Modelo do dispositivo é anotado manualmente quando necessário. Logs não viajam pela mesh. Ausência de log não prova ausência de falha.

Para ChatGPT/Codex: exporte, revise e anexe manualmente JSON/Markdown com passos de reprodução. `scripts/analyze_diagnostics.py` valida JSON até 256 KiB e gera análise local, sem executar texto ou enviar dados; rejeita campos extras e não sobrescreve saídas. DIAGNOSTICS.md contém o procedimento completo.

## 8. IA e transcrição

Regras e adapter Ollama preservados; adaptador local compatível com chat completions adicionado, schema/evidências/fallback/limites e testes controlados. Nenhuma chamada generativa real: início de llama-server foi rejeitado pela revisão automática do ambiente como blocked by policy, sem motivo específico. Não foi tentada alternativa para contornar o bloqueio. Nenhum serviço pago ou credencial externa usado.

Transcrição local real executada uma vez com áudio SAPI sintético português de 8,68 s. tiny/faster-whisper retornou texto em 2,853 s neste computador, com erros “Testifique-te-se” e “Doas”. Não é medida de acurácia nem teste de microfone físico. Saída exige revisão humana e preserva original. API/botão implementados, runtime/modelo opcionais fora do pacote; resultado de transcrição não é persistido como fato revisado. LOCAL_AI.md traz evidências/configuração/limites.

## 9. Testes finais e auditorias

| Conjunto executado | Aprovados | Falhas finais |
|---|---:|---:|
| Python/API/IA/integração/importação | 82 | 0 |
| TypeScript/mesh/fila/diagnósticos | 43 | 0 |
| Navegador Edge | 10 | 0 |
| Android JVM/quadros | 6 | 0 |
| **Total de casos automatizados** | **141** | **0** |

Além desses casos: Ruff/Biome/TypeScript/build, três contratos JSON, doze casos sintéticos de avaliação determinística, estrutura/assinatura/assets do APK e teste do EXE real passaram. Não foram contados como testes físicos. A suite existente foi mantida; novos casos não espelham apenas empacotamento.

Auditoria npm: zero vulnerabilidades conhecidas após overrides de glob/minimatch que corrigiram os quatro alertas moderados introduzidos pela CLI Capacitor. Auditoria Python central/build e runtime separado da transcrição: zero alertas conhecidos. Consulta OSV de cinquenta dependências Maven runtime: zero alertas retornados. Isso não cobre toda a cadeia de build nem substitui revisão independente. Evidências em `docs/evidence/*audit*` e `install-validation.json`.

Aviso restante: Starlette deprecia uso de httpx no TestClient em favor de httpx2; testes continuam passando. Avisos de APIs Android/Gradle depreciadas permanecem sem falha de compilação; exigem manutenção e não demonstram compatibilidade física.

## 10. Problemas encontrados e corrigidos

- Empacotamento Windows resolvia `dist` relativo à pasta do `.spec`; agora usa caminhos absolutos e EXE executado com recursos empacotados.
- Build Android inicial precisava de build-tools 35 além de 36; dependência preparada no SDK portátil, compilação final limpa.
- Alertas npm do Capacitor corrigidos por versões resolvidas/overrides; auditoria final zero.
- Codificação Windows do worker quebrava o JSON com acentos; saída JSON ASCII segura corrigida, transcrição real repetida com sucesso técnico, mantendo os erros de reconhecimento visíveis.
- Corrigidos textos antigos de Bluetooth não implementado; limites de fila de rádio, diagnóstico, sessões canceladas e contagem de transferências foram explicitados. Não há confirmação visual de transmissão sem recibo.
- Teste de importaçao adicionou rejeição de campo privado; senha/chave/relato não passam pelo schema de diagnóstico.

## 11. Ações humanas e próximo teste sem USB

Siga INSTALLATION_PHASE.md e NATIVE_TRANSPORT.md: transferir/instalar o APK em dois Androids; preparar HTTPS da mesma API e convites; provisionar ambos, ativar Rede Solidária; retirar Wi-Fi/dados mantendo Bluetooth; criar pedido fictício em A; reabrir offline; B recebe conexão, A descobre/pareia e autentica; trocar envelope; verificar armazenamento em B e original em A; repetir sem duplicata; B reconecta, central recebe uma ocorrência; devolver recibo B→A; exportar diagnósticos. Depois executar roteiro A→B→C em encontros separados.

Continuam pendentes: todos os testes físicos de instalação, rádio, permissões/mídia, alcance/consumo, suspensão, atualização preservando dados e PWA; rede HTTPS de demonstração; revisão independente de segurança, acessibilidade e validação com público; inferência generativa autorizada em ambiente permitido; corpus de transcrição maior; migração/backups de autoridade. Não existe assistência oficial, app iOS nativo ou instalador Setup Windows nesta entrega.

Dev 1 Android/rádio; Dev 2 API/autenticação/gateway/TLS; Dev 3 central/Desktop/Mobile; idealizador Dados/IA/Qualidade/métricas/diagnósticos; validador experiência real. Distribuição provisória. A contribuição humana permanece concepção/requisitos/decisões; implementação desta fase foi realizada pela IA. Não foram atribuídas ao idealizador linhas de código escritas exclusivamente pela IA.

## 12. GitHub e escopo

Remoto consultado somente para leitura: PRIVATE, main em `406a3df28e4e956058878860545f88ce815600de`. **Zero novos pushes.** Nenhum deploy, mensagem externa, envio de diagnóstico a terceiros ou repositório novo. Commits desta fase são locais. Registros de execução usam dados fictícios e não representam teste em vítimas ou funcionamento operacional.
