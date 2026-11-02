> Histórico da fase anterior (pré-0.2.0). Para o estado atual de APK, Bluetooth nativo, Windows, PWA, diagnósticos e IA, leia [INSTALLERS_FINAL_REPORT.md](INSTALLERS_FINAL_REPORT.md) e [INSTALLATION_PHASE.md](INSTALLATION_PHASE.md).

# Limitações conhecidas

- Sem internet: salva localmente, não garante entrega remota imediata. Primeira abertura requer carregar o shell.
- Sem aparelho próximo: nenhum transporte por proximidade nesta versão. Bluetooth nativo não iniciado; protocolo em software não equivale a rádio.
- Bluetooth: sem medição de alcance, obstáculos, bateria ou interoperabilidade; laboratório sem criptografia/autenticidade e sem relay integrado.
- Câmera quebrada: registro mínimo e texto/áudio continuam possíveis; QR não é obrigatório nem implementado.
- Microfone indisponível: salvar sem áudio; teste de gravação usou fonte artificial, não hardware real.
- GPS indisponível: referência manual ou ausência; coordenadas nunca inventadas. Permissões/sensor real pendentes.
- Bateria descarregada/aplicativo encerrado: sem garantia de execução ou transmissão; fila é retomada ao reabrir quando há armazenamento.
- Navegador: dados podem ser apagados/evictados; solicitação de persistência não é garantia. Instalação como PWA e compatibilidade iOS/Android não validadas fisicamente.
- IA indisponível: envio continua; fallback por regras não é modelo generativo. Ollama real não executado. Sem transcrição efetiva, análise de imagem ou confiança calibrada.
- Anexo não transferido: permanece pendente separadamente. Limite 4 MiB de envio; foto original até 12 MiB local. Áudio possui só validação de contêiner no servidor.
- Sem integração oficial: central não é Bombeiros/Defesa Civil. Nenhum atendimento real é acionado ou confirmado.
- Segurança operacional: token único, armazenamento sem cifragem da aplicação, sem contas/RBAC/MFA, sem infraestrutura/backup/retenção de produção.
- Correção pelo cidadão: mediada pelo operador; ainda não há autoedição auditada pelo cidadão.
- Volume: lista local sem paginação; API paginada; heurística de duplicidade considera só 200 candidatos recentes. SQLite/limites demonstrativos não provam escala.
- Deploy público, instalação em celular, QR, malha multissalto, Modo Me Ache, sinal sonoro, voluntários, recursos humanitários, multidioma e vídeo não implementados.
- Regras do evento e licença dependem de confirmação humana. Preparação não equivale a entrega oficial.

Nenhum bloqueio foi tratado como validação concluída. Consulte a matriz de aceitação e os testes efetivamente executados.

## Evolução posterior

Estado atualizado em MESH_CURRENT_STATUS.md, MESH_SECURITY.md e MESH_COMPATIBILITY.md. O antigo experimento sem rádio permanece como histórico. Agora existe WebRTC manual real validado em três perfis desktop, mas não Bluetooth, Wi-Fi Direct, descoberta, operação contínua em segundo plano ou demonstração física. Não confundir essa evolução com remoção dos limites de produção, privacidade ou atendimento.
