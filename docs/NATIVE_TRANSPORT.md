# Android — transporte de proximidade e roteiro físico

## Escolha e implementação

Bluetooth Classic com socket RFCOMM seguro foi escolhido para o primeiro transporte nativo: fluxo de bytes ordenado, pareamento do Android, descoberta iniciada pelo usuário, compatibilidade Android e ausência de dependência do Google Play Services. A API está documentada pelo [Android](https://developer.android.com/develop/connectivity/bluetooth/connect-bluetooth-devices), com [permissões por versão](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions).

BLE exigiria mais trabalho de fragmentação/GATT e limites de MTU; Wi-Fi Direct acrescentaria formação e gerenciamento de grupo IP; Wi-Fi Aware depende de suporte de hardware; Nearby Connections acrescentaria [dependência do Google Play Services](https://developers.google.com/nearby/connections/android/get-started). Não foram implementados cinco transportes. WebRTC manual anterior continua disponível e não substitui descoberta sem infraestrutura.

`ProximityPlugin.java` abre um socket por vez, descoberta até 15 s/30 aparelhos, visibilidade até 120 s, conexão com limite de 20 s e sessão de até 5 minutos. Leitura limitada a 100 quadros/s, quadro UTF-8 de até 16 KiB, fila de até 16 escritas. A camada TypeScript limita 128 quadros pendentes, 2 remontagens, 70 KB por mensagem, RPC único e timeout de 15 s. Ao parar a Activity/encerrar participação, fecha o rádio. Pausar brevemente para o diálogo do Android não encerra por si só a conexão; suspensão pelo sistema ainda exige validação física. Sem serviço em segundo plano ou promessa de retransmissão com tela bloqueada.

Participação voluntária desligada por padrão. Primeiro prepara credencial com autoridade confiável, depois ativa Rede Solidária. Bluetooth pareado não basta: desafio mútuo JWS/ES256 com nonce, posse da chave, expiração/revogação, sessão e sequência. Envelopes JWE do núcleo continuam cifrados para a central; intermediário não lê o relato. Recibo intermediário só é assinado após armazenamento. TTL, até quatro saltos, deduplicação, quotas, limite de cópias e recibos da central foram preservados. A origem mantém o registro. Fotos/áudio não são retransmitidos por este protocolo; o essencial precede envio direto de anexos.

Nenhum celular foi usado nesta fase. Compilação, testes JVM e conexão de protocolo em memória comprovam partes de software; não comprovam alcance, pareamento, consumo, gravação nativa ou entrega pelo rádio. A credencial dura até 24 h; convites duram 10 min, são de uso único. Sem provisionamento prévio por HTTPS o rádio não autentica participantes. Revogações novas só são conhecidas após atualizar a lista.

## Dois celulares, sem USB — executar quando disponíveis

1. Compartilhe o APK como arquivo, confira hash e instale em A e B conforme o guia. Registre modelo, Android, versão do app e horário, sem número de série/IMEI.
2. Com rede e a **mesma API HTTPS confiável**, configure a central nos dois. Na central, crie um convite por aparelho. Confira o identificador da autoridade por canal confiável; em cada app abra preparação da Rede Solidária, informe convite e identificador e prepare a participação. Não entregue chave de operador a voluntários.
3. Ative a participação nos dois e confira quotas; deixe o Modo Sobrevivência desligado para este teste. Registre horários antes de a credencial expirar. Negar permissão ou desativar rede solidária deve manter o registro próprio intacto.
4. Desligue Wi-Fi e dados móveis em A e B, mantendo Bluetooth ativo. Se usar modo avião, reative somente Bluetooth e confirme as conexões. Mantenha apps abertos; não pressuponha execução com tela bloqueada.
5. Crie em A um pedido marcado fictício. Feche e reabra A ainda offline; confira relato e ID preservados. Não desinstale nem limpe dados.
6. Em B, escolha **Receber conexão Bluetooth** e aceite visibilidade. Em A, **Procurar Androids**, escolha B e confirme o pareamento solicitado pelo Android. Espere **Participante autenticado**; nome do aparelho não é prova de identidade.
7. Em A, escolha **Trocar por Bluetooth**. Registre o número de envelopes confirmados e os estados por ID. Em B, confira a cópia cifrada armazenada; em A, confirme que a origem continua salva. Recibo intermediário não é recibo da central.
8. Repita a troca e confira ausência de nova ocorrência na origem/armazenamento; provoque interrupção/desativação Bluetooth e confira fila preservada. Teste recusa de permissão, pausa e retomada. Exporte JSON/Markdown em ambos.
9. Para fechar o ciclo com dois aparelhos, reconecte apenas B à API, permita gateway conforme política e confirme na central **uma** ocorrência com o ID de A. Depois retorne recibo B→A por Bluetooth. Conteúdo aberto pela central deve ser o original. Não marque atendimento com base nesse teste.

Resultado esperado não é resultado observado. Preencha uma ficha com: data, versões, passos, IDs fictícios, esperados/observados, recibos, contagem no banco, interrupções, diagnósticos e duração. Alcance e bateria ainda não possuem medição.

## Três celulares

Provisione A/B/C na mesma autoridade antes de desligar rede. A→B offline; feche conexão, afaste A; B→C offline em outro encontro; reconecte somente C à API. Confira uma ocorrência na central. Retorne recibo C→B→A em encontros separados. Para demonstrar store-carry-forward, evite deixar A ligado diretamente a C ou à API. Registre as conexões observadas, não apenas telas. Este roteiro não foi executado fisicamente. A demonstração já executada A→B→C→API usou três perfis Edge no mesmo PC com WebRTC real.

## Continuidade

Dev 1: compatibilidade de rádio/câmera/microfone/atualização Android. Dev 2: autoridade, gateway, TLS e revisão de segurança. Dev 3: distribuição e interfaces central Desktop/Mobile. Idealizador: Dados, IA, qualidade, métricas e diagnósticos. Validador: teste de entendimento e uso. Distribuição provisória, preservando autoria humana da concepção e autoria de IA do código desta fase. Revisão independente e testes em celulares são necessários antes de uso fora de preparação fictícia.
