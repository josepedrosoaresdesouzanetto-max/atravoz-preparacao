# Aplicativo do cidadão

Objetivo: salvar um mínimo com um toque antes da transmissão. Responsabilidade sugerida: desenvolvedor 1. Dependências: React/TypeScript, Zod/contratos, idb; API apenas para envio. Entrada: ajuda/ocorrência, texto, referência/GPS e mídia opcionais. Saída: registro UUID persistido, fila e recibos verdadeiros.

`src/App.tsx` compõe a interface; `features/offline-storage` guarda transações/rascunho; `sync` agenda/reenvia; `media` otimiza foto/grava áudio; `location` captura com consentimento. Estilo compartilhado em apps/shared. Exemplo sintético em testes E2E e fixtures/synthetic/photo.png.

Na raiz: `npm run dev` para desenvolvimento (5173, API em 8000); `npm run build` e `.venv/Scripts/python.exe scripts/serve.py` para PWA/offline. Testes: `npm test`, `npm run test:e2e`. Service Worker não é registrado no modo dev. O app precisa carregar uma vez antes de abrir sem rede.

Estado: mínimo, texto, rascunho, fila, reabertura offline, recibos, foto, fonte de áudio artificial e economia manual testados no desktop. GPS real, câmera/microfone físicos, instalação PWA e celulares precisam de teste. Bluetooth não está integrado. Não há botão que finja proximidade.

Riscos: evicção/limpeza de IndexedDB, quota, suspensão do navegador, dados sem cifragem da aplicação, estados mal compreendidos por pessoas ainda não observadas. Pendências: validação física/humana, exportação/recuperação de dados, migração futura, melhorias de grandes listas. Não apague registros pendentes para resolver um erro.
