# Experimento de conectividade — sem rádio implementado

Responsabilidade sugerida: desenvolvedor 1. Estado do Bluetooth nativo: **não iniciado**. Estado do protocolo: implementação Python testável em software, sem teste físico. Nenhum Android/iPhone foi usado. SDK Android e adb ausentes; Java 8 não fornece o ambiente Android moderno necessário.

`protocol.py` implementa envelope v1, UUID estável, digest SHA-256, fragmentação, reordenação, rejeição de corrupção e confirmação após commit SQLite. Não descobre, anuncia, conecta ou transmite via rádio. Não está integrado à fila do cidadão. Receber um pacote nesse laboratório não demonstra o Experimento A.

Entrada: Incident sintético, texto até 320 caracteres, identificador efêmero do remetente. Saída: frames e recibo de armazenamento local. Fotos/áudios não entram, somente metadados. Não truncar o relato e reutilizar seu ID para um conteúdo diferente. Teste: `.venv/Scripts/python -m pytest tests/test_transfer.py -q` na raiz.

Riscos: SHA-256 detecta alteração acidental, mas **não autentica** remetente nem cifra dados. Usar só dados sintéticos. Chaves de envio da API não são transportadas: encaminhamento autenticado B→API é pendência de integração. Quadros requerem payload ATT negociado >=84 bytes; MTU padrão de 23 não serve ao formato atual. Sessão expira em 120s; nova tentativa completa, sem retomada persistente de fragmentos.

Próximos passos: dois Android com BLE peripheral/advertising; SDK e JDK compatíveis; serviço GATT receptor, permissões em tempo de execução, persistência Android antes do ACK, canal autenticado e cifrado, negociação de MTU, desconexão, bateria e alcance medidos. Android 12+: BLUETOOTH_SCAN, BLUETOOTH_ADVERTISE, BLUETOOTH_CONNECT; conferir permissões legadas quando escolher minSdk. Não foi criado APK não verificável.

Referências: [Android](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions), [Chrome Web Bluetooth](https://developer.chrome.com/docs/capabilities/bluetooth). A API web disponível é voltada à conexão com serviços GATT remotos; não oferece uma base universal para duas PWAs anunciarem e receberem como celulares transportadores.
