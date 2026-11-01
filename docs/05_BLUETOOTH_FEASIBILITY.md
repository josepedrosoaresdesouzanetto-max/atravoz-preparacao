# Viabilidade Bluetooth

Status físico: **não iniciado**. Zero aparelhos usados; SDK Android/adb não encontrados e somente Java 8 identificado. Não foi gerado APK que pudesse aparentar validação. A versão web não oferece transferência entre celulares.

O [Chrome documenta](https://developer.chrome.com/docs/capabilities/bluetooth) acesso web a serviços GATT remotos em plataformas específicas. Isso não fornece uma combinação universal de anúncio/servidor BLE entre duas PWAs. Portanto a arquitetura propõe módulo Android separado; esta é uma inferência técnica, não uma prova em aparelhos.

O [Android documenta](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions) permissões de scan, anúncio e conexão, com autorização em tempo de execução em Android 12+. A implementação futura deverá escolher SDK/minSdk, verificar suporte a advertising, negociar payload e confirmar gravação antes do ACK. Não basta descobrir o aparelho.

Software disponível: `experiments/bluetooth-android/protocol.py`, fragmentação, integridade, reordenação, recebimento SQLite e ACK. Quatro testes automatizados não medem rádio, distância, obstáculos, bateria ou segundo plano. Sem criptografia/autenticidade; dados sintéticos somente. MTU padrão não suportado pelo formato atual. Não transporta a chave de envio da API, logo não integra o relay B→servidor.

Validação futura: dois Android identificados por modelo/SO, permissões aceitas/negadas, anúncios, transferência, desconexão, corrupção, repetição, encerramento, retorno e sincronização. Registrar IDs e recibos reais. iPhone/Android depende de investigação própria; nenhuma interoperabilidade prometida. QR é contingência secundária não implementada. Me Ache é apenas proposta futura e não é radar/sonar.
