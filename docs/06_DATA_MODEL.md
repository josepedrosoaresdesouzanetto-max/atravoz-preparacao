# Modelo de dados v1

Fonte canônica Python: `services/intelligence/src/intelligence/contracts.py`; schemas JSON exportados em `packages/contracts`; cliente valida Zod e compartilha exemplos positivos/negativos com pytest. `check_contracts.py` detecta divergência do JSON publicado. Versões desconhecidas são rejeitadas.

| Entidade | Persistência / campos principais |
|---|---|
| Incident | UUID, versão, criação/atualização com timezone, help/witness, original até 4000 caracteres, localização opcional, manifesto de até dois anexos, synthetic=true |
| Location | source gps/last_known/manual, coordenadas pareadas, referência, precisão, horário, confirmed=false por padrão |
| Attachment | UUID, kind, MIME permitido, tamanho até 4 MiB, SHA-256; recebido somente após commit do BLOB |
| ServerReceipt | UUID de recibo e ocorrência, horário do servidor, PERSISTED, RECEBIDO_SERVIDOR |
| SyncAttempt | Campos persistentes do registro local: contador, última/próxima tentativa, erro e recibos |
| IncidentStatusHistory | Linhas append-only pela API: estado, horário, ator, justificativa |
| AIAnalysis | Original, normalizado, saída bruta limitada, campos extraídos, lacunas, duplicidades sugeridas, provedor, estado/erro e duração |
| Operator | Operador único demonstrativo autenticado por token; sem tabela de contas fictícia |
| AuditEvent | Criação, anexo, solicitação de análise e alteração de estado, sem conteúdo sensível em log |
| TransferReceipt | Somente laboratório: transferência, receptor, digest e confirmação de armazenamento local |

`has_audio`/`has_photo` são derivados de manifestos; `received_attachments` é separado. `verification_status` vem do servidor; status local não pode declarar atendimento. `origin_device_id` é opcional e o aplicativo o deixa nulo, evitando rastreamento persistente desnecessário. Chave de envio é aleatória por ocorrência, mantida no cliente e somente hash no servidor.

Idempotência por UUID + payload imutável + posse da chave. Mesmo ID/conteúdo devolve recibo original; mesmo ID/conteúdo diferente gera 409. Relatos independentes semelhantes não são fundidos. Correção é nota histórica vinculada, preservando o original.
