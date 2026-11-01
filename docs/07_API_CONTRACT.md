# Contrato HTTP v1

Mesmo domínio das interfaces. Implementação em `services/api/app/main.py`; OpenAPI em `/openapi.json`. Somente dados sintéticos são aceitos. Nenhuma autorização administrativa é fornecida ao processamento de IA.

| Método / caminho | Autorização | Resultado |
|---|---|---|
| GET /api/v1/health | pública | processo vivo, modo demonstrativo |
| GET /api/v1/ready | pública | consulta SQLite; IA não é dependência |
| GET /api/v1/config | pública | marca configurável, sem segredos |
| POST /api/v1/incidents | envelope incident + write_key aleatória | recibo após commit; reenvio idempotente |
| GET /api/v1/incidents?limit=100&offset=0 | Bearer operador | items, total, limit e offset; limite máximo 200 |
| GET /api/v1/incidents/{UUID} | Bearer operador | original, localização, anexos recebidos, histórico e análises |
| GET /api/v1/incidents/{UUID}/status | Bearer chave da ocorrência | recibo e estado de verificação, sem relato |
| POST /api/v1/incidents/{UUID}/attachments | Bearer chave da ocorrência, X-Attachment-ID, Content-Type | corpo binário, integridade/tamanho/MIME conferidos, recibo do anexo |
| GET /api/v1/incidents/{UUID}/attachments/{UUID} | Bearer operador | download autenticado, nosniff e disposition attachment |
| POST /api/v1/incidents/{UUID}/analysis | Bearer operador | análise opcional persistida, inclusive fallback |
| POST /api/v1/incidents/{UUID}/review | Bearer operador | status, note e expected_status; histórico e auditoria |

Exemplos de payload em `packages/contracts/examples.json`. Submissão mínima: `{ "incident": <payload válido>, "write_key": <64 caracteres hex aleatórios> }`. A chave não deve aparecer em documentação real, logs ou URLs.

Erros: 401 sem autorização; 404 desconhecido; 409 colisão/conflito de estado; 413 corpo grande; 415 mídia inválida; 422 schema/integridade; 429 excesso de requisições (Retry-After 60); 503 armazenamento ou chave administrativa indisponível; 507 limite demonstrativo. Mensagem técnica em `detail`. Erro não contém recibo de persistência bem-sucedida.

Limite de corpo aplicado antes de parsing (4 MiB + 64 KiB). Rate limit em memória: 120 requisições/minuto/IP, até mil entradas; adequado somente a demonstração em um processo. Cabeçalhos encaminhados não alteram o IP de confiança. Produção requer solução distribuída e revisão de abuso.
