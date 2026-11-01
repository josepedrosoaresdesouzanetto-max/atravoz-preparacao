# Persistência e sincronização

IndexedDB `resilient-records`, versão 1: stores `incidents`, `media`, `settings`. `incidents` guarda UUID, payload imutável, chave aleatória por ocorrência, estado, tentativas, datas, próxima tentativa, erro, bloqueio e recibos. `media` guarda Blob de envio e original da foto quando selecionado. `settings` guarda rascunho e modo de economia.

O salvamento de ocorrência, arquivos e remoção do rascunho é uma transação. A UI confirma só após `tx.done`. Erros de armazenamento não viram sucesso. O rascunho é atualizado com atraso de 300 ms; fechar imediatamente pode perder apenas as últimas teclas ainda não confirmadas, não um registro cuja gravação concluiu.

Fila recuperada na abertura, evento online, retorno à página e intervalos de 15 s (60 s no Modo Sobrevivência). O navegador pode suspender todos esses gatilhos. Lotes de até dez ocorrências; dados essenciais de todo lote precedem áudio e foto. Backoff de 5 s até 5 min com variação aleatória ±20%. Tentativa manual permite antecipação. Lock entre abas quando Web Locks está disponível; recibos/idempotência continuam protegendo no servidor sem esse recurso.

HTTP 200 sem recibo, UUID incorreto, tempo limite ou desconexão não confirmam entrega. Erros permanentes 400/401/403/409/413/415/422 suspendem retentativas automáticas para revisão, sem apagar conteúdo. Wi-Fi detectado é indicação, não prova de entrega.

Service Worker guarda somente shell e assets de build, nunca respostas de `/api` ou HTML da central. Precisa instalar uma vez online. A atualização de versão aguarda fechamento das páginas antigas. Persistência do navegador é solicitada após salvar; concessão não é garantida. Limpar dados, modo privado ou remoção pelo sistema podem eliminar o armazenamento. Não existe garantia com aparelho desligado.

Migrações: esquema inicial não possui versão anterior com registros. Próxima mudança deve aumentar a versão do IndexedDB, migrar dentro de `upgrade`, manter backup e testar com banco anterior. Não apagar/recriar stores para corrigir incompatibilidade. SQLite recusa `user_version` desconhecido; migração futura requer script revisado.
