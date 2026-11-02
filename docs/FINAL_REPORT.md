> Histórico da fase anterior (pré-0.2.0). Para o estado atual de APK, Bluetooth nativo, Windows, PWA, diagnósticos e IA, leia [INSTALLERS_FINAL_REPORT.md](INSTALLERS_FINAL_REPORT.md) e [INSTALLATION_PHASE.md](INSTALLATION_PHASE.md).

# ATRAVOZ — relatório da evolução Antena Humana

Preparação privada em 01/11/2026. Este documento substitui o relatório anterior em elaboração. Os resultados distinguem implementação, ensaio de software e validação física.

## 1. Estado inicial encontrado

Branch main, implementação local em `2bc26b33fae2509c1713ffab48ffd98a6234fa89`, documentação ainda não commitada. Cidadão offline, API, central, contratos, mídia e inteligência já existiam. A auditoria repetiu 53 testes Python, 18 TypeScript e 5 de navegador: 76 aprovados. O histórico e os arquivos foram preservados no commit local `3dcc3dd`. Não havia mesh física nem SDK/dispositivos Android disponíveis. [Auditoria inicial](MESH_BASELINE_AUDIT.md).

## 2. Arquitetura atualizada

O mesh-core independente prepara essenciais cifrados, guarda e encaminha cópias por participantes autorizados e devolve recibos. Novo IndexedDB separado; tabelas SQLite aditivas; gateway compartilha a gravação idempotente da API direta. Falhas ou ausência de configuração mesh não impedem o fluxo anterior. Essenciais próprios precedem relay, que precede mídia no agendador integrado. [Arquitetura](MESH_ARCHITECTURE.md).

## 3. Arquivos criados e modificados

| Caminho | Objetivo |
|---|---|
| `packages/mesh-core/src/` | Contratos, JOSE, fila, recursos, fragmentação, encaminhamento e WebRTC |
| `apps/citizen-app/src/features/mesh/MeshPanel.tsx` | Adesão, provisionamento, limites, conexão manual e estado de entrega |
| `apps/citizen-app/src/features/sync/queue.ts` | Agendar essenciais relay antes da mídia e isolar falhas |
| `apps/citizen-app/src/features/InstallPanel.tsx`, `public/` | Instalação condicional, manifesto e ícones |
| `services/api/app/mesh.py`, `main.py`, `database.py` | Autoridade, convites, revogação, gateway, transações e evidência de visualização |
| `apps/operations-dashboard/src/` | Exibir saltos verificados, registro explícito de visualização e correção da corrida de logout |
| `services/intelligence/src/intelligence/transport_quality.py` | Contar entregas sem multiplicar ocorrências/pessoas |
| `scripts/provision_mesh.py`, `serve.py`, `build-sw.mjs` | Chaves cifradas, TLS/LAN opcionais e cache PWA |
| Testes Python/TS/Playwright, configurações e lockfiles | Novas verificações, interoperabilidade e dependências reproduzíveis |
| `docs/MESH_*`, `INSTALLATION.md`, `TEAM_HANDOFF.md`, histórico/evidências | Protocolo, segurança, recursos, instalação, autoria e limites |

O commit de implementação alterou/criou 70 arquivos; a lista exata está em [mesh-changes.json](evidence/mesh-changes.json). Os documentos finais são adicionados em commit de documentação posterior.

## 4. Funcionalidades preservadas

Registro mínimo sem GPS obrigatório; rascunho e IndexedDB; reabertura offline; identificador estável; sincronização e backoff; foto/áudio opcionais; anexos separados; central autenticada; análise por regras/fallback; revisão e correção auditadas. Os 76 testes anteriores continuam presentes e aprovados. Banco e ocorrências próprios não foram descartados.

## 5. Núcleo mesh

Envelope imutável de origem, rota assinada por salto, TTL/hop limit, fila persistente, deduplicação, tombstones, cotas, fanout e tentativas limitados; ACK somente depois do commit; recibo central separado e retorno eventual. Fragmentação/remontagem limitada, integridade e timeout. Chave privada participante persistida como CryptoKey não extraível. [Protocolo](MESH_PROTOCOL.md), [roteamento](MESH_ROUTING.md).

## 6. Segurança

JOSE com bibliotecas jose/JWCrypto: JWE RSA-OAEP-256/A256GCM e JWS ES256. Convite de uso único, prova de posse, credenciais de até 24 horas, confiança fixada na autoridade, revogação consultada online, sessão SDP assinada e proteção contra replay. Autoridade em PEM cifrado fora do Git. Testes exercitam corrupção, credenciais, ciclos, expiração, gateway e recibos. Auditorias atuais npm/pip: zero vulnerabilidades conhecidas.

Não houve auditoria independente. Chaves de navegador não têm garantia de hardware; origem guarda seus próprios dados legíveis; revogação offline é eventual; há metadados expostos e não há forward secrecy do conteúdo armazenado. Fanout não limita participantes maliciosos fora do aplicativo. O protocolo não comprova verdade, localização física ou atendimento. [Segurança e pendências](MESH_SECURITY.md).

## 7. Rede Solidária

Desligada por padrão; preparação não ativa participação. Controles de ativar/desativar, pausar, sobreviver com menos atividade, espaço, cota diária, bateria e intervalo de revisão. Dados móveis/desconhecidos bloqueados por padrão; Wi-Fi exige confirmação por sessão. Bateria só é monitorada quando o navegador informa. Intermediários veem contagens e conteúdo cifrado; não o relato protegido. Códigos de conexão são manuais e expiram.

## 8. Transportes

WebRTC DataChannel real, sem STUN/TURN/sinalização externa, validado entre três contextos isolados do Edge no mesmo Windows. Exige caminho de rede compatível e troca manual de oferta/resposta. Não implementa Bluetooth, Wi-Fi Direct, Wi-Fi Aware, descoberta automática ou serviço nativo em segundo plano. O experimento Bluetooth antigo permanece identificado como protocolo sem rádio. [Compatibilidade](MESH_COMPATIBILITY.md).

## 9. Testes

Suite final completa: **63 pytest + 36 Vitest + 7 Playwright = 106 aprovados**, dos quais 30 novos. Ruff, Biome, TypeScript, build e três schemas passaram. Avaliação determinística: 12/12 casos sintéticos. Dependências: zero vulnerabilidades conhecidas nas consultas atuais.

O ensaio real de software fez A→B, reabriu B, B→C, reabriu C, C→API e recibo C→B→A. A continuou pendente até o retorno; a API manteve uma ocorrência com dois saltos e relato original. Falha de WAN foi representada por HTTP 503 para A/B, não por desligamento de rádio. Evidências: [resumo](evidence/mesh-test-summary.json), [WebRTC](evidence/mesh-webrtc.json), [SQLite](evidence/mesh-database-proof.json).

Falhas intermediárias foram corrigidas e registradas no diário, incluindo código de conexão antigo, espera prematura do ensaio, atualização interrompida do recibo e resposta administrativa que restaurava sessão depois de Sair. Nenhuma falha foi escondida removendo testes.

## 10. Testes físicos

**Não houve teste físico em celular. Zero aparelhos utilizados.** Não foram medidos alcance, autonomia, isolamento de rede móvel, Bluetooth, roaming, suspensão do sistema ou instalação Android/iOS. O roteiro de dois aparelhos e depois três está em [MESH_TEST_PLAN.md](MESH_TEST_PLAN.md), com campos/evidências que a equipe deve coletar de verdade.

## 11. Instalação

PWA: manifesto, ícones 192/512, Service Worker e fluxo condicional implementados; reabertura offline testada no desktop. Isso não prova instalação em telefone. APK não foi gerado; SDK/adb/Gradle/javac não estavam disponíveis. A central funciona no servidor local autenticado. TLS/LAN são configuráveis, mas certificado confiável e acesso em celulares permanecem pendentes. [Guia executável](INSTALLATION.md). Nenhum deploy/túnel externo.

## 12. Deduplicação e recursos

Transporte deduplica message_id/hash; servidor deduplica incident_id/write_key/conteúdo. Relatos independentes permanecem separados. Padrões: 64 relays, 2 MiB de espaço, 1 MiB/dia reservado, dois destinos por instalação, seis tentativas, quatro mensagens por encontro, quatro saltos, TTL de até 12 horas. Cotas recusam novas cópias e nunca apagam o original próprio. Limpeza relay, cache de recibos e tombstones têm limites/expiração. Valores não são medições de energia nem faturamento da operadora. [Política](MESH_RESOURCE_POLICY.md).

## 13. Dados e IA

Preservados contratos, normalização, extração com evidências, lacunas, sugestões de duplicidade, incerteza, saída bruta e revisão humana. Novo módulo de qualidade separa envelopes entregues de ocorrências distintas e agrega saltos sem inferir número de vítimas ou proximidade. Modelo generativo real e transcrição não foram executados. O idealizador recebe tarefas concretas no [handoff de Dados/IA](../services/intelligence/OWNER_HANDOFF.md).

## 14. Documentação da autoria

Concepção, requisitos e limites de publicação são contribuição humana do idealizador. Código, testes, investigação e documentação desta preparação foram produzidos com assistência do Codex. Commits usam identidade explícita de assistente. Não houve revisão humana, horas de equipe ou validação Pró-Criança inventadas. [Contribuições](CONTRIBUTIONS.md), [uso de IA](AI_USAGE.md), [diário](DEVELOPMENT_LOG.md). Trabalho anterior ao evento está declarado.

## 15. GitHub

Consulta de leitura confirmou [atravoz-preparacao](https://github.com/josepedrosoaresdesouzanetto-max/atravoz-preparacao) privado, main em `406a3df28e4e956058878860545f88ce815600de`, sem novo push. CI remota comprova somente o esqueleto inicial (3 Python + 2 TS), não esta versão. Nenhum PR, release, alteração de visibilidade ou deploy foi realizado nesta continuação. Correção anterior de Pillow e evolução mesh permanecem locais.

## 16. Estado local

Implementação mesh validada no commit **`421035eb640fc3f3d1863cfe1820ffe14f6c2dde`**. Branch main; histórico anterior preservado. Este relatório e inventário são commitados depois como documentação. O HEAD final, estado limpo, diferença em relação ao remoto e SHA-256 do ZIP estão no manifesto de entrega `outputs/ATRAVOZ_DELIVERY.json`, externo ao repositório para evitar autorreferência do hash do próprio commit. O pacote contém fonte/documentação/evidências versionadas, sem dependências, banco de execução, chaves, credenciais ou rastros privados de teste.

## 17. Limitações

Permanecem: três celulares reais, instalação móvel, BLE/Wi-Fi Direct/Aware, descoberta, segundo plano, alcance/energia, rede sem infraestrutura, iOS, interoperabilidade entre fabricantes, carga prolongada, revisão humana de segurança/UX, operação multiusuário, recuperação/rotação de chaves, backup/retencão operacional e integração oficial. Revogação offline e recibos dependem de atualização/encontros. Não há garantia de entrega ou socorro. A ausência de recursos físicos não foi apresentada como aprovação.

## 18. Próximas tarefas da equipe

Dev 1: validar dois celulares e depois três, instalação e transporte. Dev 2: revisar segurança, autoridade, TLS, retenção e implantação autorizada. Dev 3: validar central, estados, revisão e UX. Dev 4/idealizador: revisar Dados/IA/Qualidade, corpus, duplicação e evidências. Validador: observar uso e obter feedback real quando autorizado. Nomes e participação ainda não confirmados. [Divisão e critérios](TEAM_HANDOFF.md).

## 19. Compatibilidade com o edital

Conforme briefing fornecido, sem verificação independente do edital completo: solução no celular **parcial**, sem validação física; deploy público **pendente/não autorizado**; README/repositório privado **existem**, oficial **pendente**; três testes em CI **atendidos no esqueleto inicial**, atualização local não publicada; pitch de três minutos **roteiro pronto, apresentação pendente**; uso de IA **documentado**; validação Pró-Criança **pendente**; quatro devs + validador **composição não confirmada**. Code freeze e elegibilidade de preparação prévia precisam ser observados/confirmados com a organização. [Matriz](21_HACKATHON_COMPLIANCE.md).

## 20. Avaliação de viabilidade

**Ainda não é possível afirmar que o ATRAVOZ consegue demonstrar retransmissão segura e real entre três celulares com os recursos comprovadamente disponíveis.** Foi demonstrado o fluxo criptográfico e multissalto em software com WebRTC real no desktop. Não há evidência física, SDK nativo preparado, três aparelhos, rede móvel validada ou auditoria de segurança que sustentem a afirmação pedida.

Existe base concreta para a equipe experimentar primeiro dois aparelhos e depois três, em rede compatível e com provisionamento/HTTPS. A viabilidade dentro do hackathon depende dessa prova, do prazo efetivamente disponível à equipe e das entregas obrigatórias. O caminho de demonstração já comprovado é offline→sincronização direta e ensaio desktop A→B→C; potencial móvel não foi tratado como capacidade concluída.

Registro operacional: a revisão automática recusou apenas uma limpeza opcional de resíduo temporário do pip, sem razão específica fornecida. O resíduo ignorado foi preservado; não afetou os testes e não entra no pacote.
