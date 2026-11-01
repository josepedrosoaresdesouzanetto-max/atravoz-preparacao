# Compatibilidade e transportes

| Plataforma / capacidade | Estado real nesta execução |
|---|---|
| Edge desktop Windows, três contextos | WebRTC real, IndexedDB e criptografia interoperável com Python aprovados |
| Android Chrome / PWA | Código web candidato; nenhum celular ou instalação física testados |
| iOS Safari / PWA | Não testado; nenhuma equivalência com Android afirmada |
| Bluetooth / BLE | Sem adaptador de rádio implementado; experimento anterior é apenas protocolo em software |
| Wi-Fi Direct / Wi-Fi Aware | Não implementados; WebRTC não cria uma rede Wi-Fi entre aparelhos |
| LAN existente / hotspot | WebRTC com sinalização manual pode usar caminho permitido pela rede; teste físico pendente |
| Descoberta automática | Não implementada |
| Segundo plano / app fechado | Não garantido; este protótipo exige página ativa para transferências |
| APK / pacote Android | Não gerado; SDK, adb, Gradle e javac ausentes na inspeção |
| Infraestrutura externa | Nenhum deploy, túnel, STUN, TURN ou sinalizador externo configurado |

O transporte usa [WebRTC DataChannel](https://www.w3.org/TR/webrtc/) com oferta/resposta manual assinada. A aplicação não usa Web Bluetooth para anunciar uma rede; a disponibilidade de APIs web não comprova comunicação entre celulares. Referências para investigação futura: [Web Bluetooth](https://developer.chrome.com/docs/capabilities/bluetooth), [permissões Bluetooth Android](https://developer.android.com/develop/connectivity/bluetooth/bt-permissions), [Wi-Fi Direct](https://developer.android.com/develop/connectivity/wifi/wifi-direct) e [Wi-Fi Aware](https://developer.android.com/develop/connectivity/wifi/wifi-aware). Implementação nativa e permissões específicas precisam ser verificadas nos aparelhos/versões escolhidos.

Três perfis de navegador no mesmo computador não representam três rádios, três baterias, roaming, suspensão do sistema ou isolamento de clientes de um roteador. A ausência de WAN foi simulada por HTTP 503 para A/B, mantendo canais locais reais. Não chamar este ensaio de rede física desconectada.

Requisito para demonstração móvel: primeiro dois aparelhos autorizados, no ambiente real, com origem HTTPS confiável e caminho de rede compatível; só depois três aparelhos com A/B sem saída para API e C com saída. Se não funcionar, demonstrar honestamente o fluxo offline direto e o ensaio de software, sem alegar Bluetooth ou mesh de celulares.
