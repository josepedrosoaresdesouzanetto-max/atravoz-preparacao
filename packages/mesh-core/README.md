# mesh-core

Núcleo independente da interface: protocolos, segurança JOSE, armazenamento, cotas, encaminhamento, fragmentação e adaptador WebRTC manual. Veja [arquitetura](../../docs/MESH_ARCHITECTURE.md), [protocolo](../../docs/MESH_PROTOCOL.md) e [limitações](../../docs/MESH_CURRENT_STATUS.md).

Testar: `npm test` na raiz; integração real de navegador: `npm run build` e `npm run test:e2e`. O transporte em memória de testes é explicitamente identificado como tal. WebRTC não implementa Bluetooth nem Wi-Fi Direct. Nenhum teste físico foi realizado.
