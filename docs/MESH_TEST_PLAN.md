# Testes e critérios de aceitação

Baseline repetida antes da mudança: 53 pytest + 18 Vitest + 5 Playwright, todos aprovados. Nenhum teste anterior foi removido. A suite final e evidências estão em [estado atual](MESH_CURRENT_STATUS.md) e `evidence/mesh-test-summary.json`.

Testes novos verificam: cifragem real e decriptação interoperável; chaves não extraíveis; reabertura IndexedDB; A→B→C; ACK só depois de gravação; erro de armazenamento; duplicação; conflito de identidade; envelopes independentes; alteração de cifra/assinatura; revogação; expiração; ciclos; TTL/hops; quotas; bateria; pausa; replay de sessão; backoff; fanout; concorrência; corrupção, duplicidade e timeout de fragmentos; recibo falso; recuperação de atualização interrompida na origem; convites de uso único; gateway concorrente idempotente; métricas sem multiplicar ocorrências; visualização explícita do operador; logout durante resposta pendente; prioridade essenciais próprios → relay → mídia.

Ensaio Playwright mesh: três contextos isolados do Edge, chaves reais temporárias e API local Python. A cria relato sintético com HTTP da API indisponível; A→B por RTCDataChannel; B reabre; B→C; C reabre e tenta gateway com internet desconhecida (recusado); confirma Wi-Fi e entrega; API conserva um incident_id e dois saltos; A ainda pendente; recibo volta C→B→A; A reabre com recibo persistido. Sem mock de criptografia nem de DataChannel. Relatório limita explicitamente o ensaio ao computador.

## Roteiro físico ainda não executado

1. Registrar fabricante/modelo, Android/iOS e versão, navegador, bateria inicial, rede, permissões, endereço HTTPS, autoridade pública e horário real. Usar somente dados sintéticos.
2. Preparar PWA/credencial enquanto online; fechar, reabrir sem WAN e verificar original e mídia. Não limpar dados.
3. Em dois aparelhos, impedir saída de A para API, permitir o caminho local A/B, trocar códigos assinados, confirmar que B não mostra plaintext e que ACK persiste depois de fechar/reabrir. Interromper no meio e verificar ausência de falsa confirmação.
4. Em três aparelhos, fazer A→B; encerrar encontro; levar B até C; fazer B→C; C envia à API. Registrar recibo e banco. A deve continuar pendente até retorno efetivo do recibo.
5. Exercitar duplicatas, quota cheia, bateria baixa, dados móveis bloqueados, app suspenso, perda de conexão, credencial expirada/revogada, relógio incorreto e rota cíclica. Guardar falhas, não apenas sucessos.
6. Anotar bytes medidos externamente, duração, energia e alcance apenas quando realmente medidos. Critério mínimo: nenhum dado próprio perdido, nenhuma confirmação falsa e autorização/cifra verificadas.

Não atribuir execução ou revisão a uma pessoa sem evidência. Os testes físicos, autonomia, alcance, iOS e revisão de segurança permanecem bloqueios para a alegação de mesh móvel confiável.
