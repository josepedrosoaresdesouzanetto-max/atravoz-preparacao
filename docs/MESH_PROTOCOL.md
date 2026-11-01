# Protocolo experimental mesh-v1

O contrato executável está em `packages/mesh-core/src/protocol.ts`, com validação equivalente no gateway Python. Versões, limites, algoritmos e tipos de prova são explícitos; entradas adicionais incompatíveis são recusadas.

1. A origem salva primeiro a ocorrência no fluxo original. Só depois, se autorizada e com participação ativa, prepara o envelope.
2. O plaintext JWE é o Submission existente: ocorrência íntegra e write_key. Foto/áudio binários não entram; seus manifestos continuam no registro, indicando anexos pendentes.
3. `sealed` usa RSA-OAEP-256/A256GCM, com identificador da autoridade. O JWS de origem ES256 fixa message_id aleatório, hash do ciphertext, tamanho, criação, expiração, versão, prioridade normal e limite de saltos.
4. Cada encaminhamento acrescenta JWS ES256 com emissor, receptor, índice, hash da prova anterior, hash da origem, transmissão aleatória e instante. Não reescreve o conteúdo original.
5. O destinatário valida a sessão, credencial, envelope, rota, limites e duplicidade; confirma apenas depois do commit IndexedDB. O ACK intermediário identifica transmissão, receptor e origem. Ele nunca equivale ao recibo do servidor.
6. O gateway exige prova fresca assinada pelo detentor final, valida toda a cadeia, decifra e aplica o Submission original. O recibo central JWS só é retornado depois do commit SQLite. Repetição idêntica retorna o recibo persistido.
7. Recibos centrais podem viajar no caminho inverso em encontros posteriores. A origem continua pendente enquanto não os recebe. O retorno não é garantido; sem encontro ou conexão posterior, o conhecimento pode ficar atrasado.

TTL máximo 12 horas, limitado pela validade da credencial de origem; máximo quatro saltos; ciphertext 16 KiB; envelope serializado 64 KiB; conteúdo antes da cifra até 10.000 bytes. Relatos extensos que excedem esse limite continuam salvos e disponíveis para envio direto. Nenhum truncamento silencioso.

WebRTC usa DataChannel confiável/ordenado. O enquadramento de aplicação tem UUID, índice, total, hash e fragmentos de até 2.000 caracteres; pacote até 70.000 bytes, até 36 fragmentos, duas remontagens simultâneas, timeout de dez segundos. Índices conflitantes e hashes inválidos são recusados. O hash de fragmentos detecta corrupção; a autenticidade vem das assinaturas do envelope e da sessão, não desse hash.

Ofertas/respostas SDP são assinadas por participantes, com nonce, validade de dois minutos e resposta vinculada ao hash da oferta. Isso protege a troca manual, incluindo os fingerprints DTLS do SDP. Sessão aberta dura no máximo cinco minutos; recibo de operação espera até quinze segundos. Sem servidor externo de sinalização, STUN ou TURN.

Estados de transporte permanecem separados da ocorrência: aguardando encontro, recebido por intermediário, recebido pela central, expirado. O status original só passa a RECEBIDO_SERVIDOR após recibo central validado. Registrar visualização é ação explícita e auditada do operador; não declara veracidade, encaminhamento oficial ou atendimento.
