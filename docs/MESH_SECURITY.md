# Segurança implementada e limites

Bibliotecas: [jose](https://github.com/panva/jose) no cliente e [JWCrypto](https://jwcrypto.readthedocs.io/en/latest/jwe.html) no servidor. Foram usados JWE/JWS e algoritmos padronizados, sem implementação própria de primitivas criptográficas. O protocolo de aplicação é experimental e ainda requer revisão de segurança independente.

## Provisionamento e confiança

Operador autenticado emite convite aleatório de uso único, válido por dez minutos. O banco guarda somente seu hash. Enrollment exige prova de posse da chave P-256 e vínculo ao convite. Credencial assinada vale até 24 horas. Papel é participante, sem autorização administrativa. Não existe cadastro público irrestrito.

O participante confere o thumbprint da autoridade por canal confiável, antes de aceitar suas chaves públicas. A origem web deve ser localhost de desenvolvimento ou HTTPS confiável. Atualizações rejeitam troca da autoridade ou de suas chaves; lista de revogações vem da mesma origem HTTPS. Receber uma revogação de si mesmo pausa a participação. Offline, não há consulta instantânea: uma credencial revogada pode ser aceita por pares com lista antiga até atualizar/expirar. Esta limitação não é resolvida por criptografia.

Chave privada participante é CryptoKey não extraível, armazenada por structured clone no IndexedDB. Os testes verificam reabertura e recusa de exportação. Isso não equivale a keystore seguro por hardware: XSS, comprometimento do navegador/OS ou acesso à sessão podem usar a chave. Ocorrência original e mídia continuam legíveis no banco local da origem. O armazenamento de relay contém apenas ciphertext do relato.

As chaves privadas da autoridade são PEM cifrados com senha, gerados por `scripts/provision_mesh.py`, fora do Git em runtime. Senha vem do ambiente; sem ela o mesh fica indisponível e a API direta continua funcionando. Senha/chaves precisam de backup e controle de acesso do operador. Não persistir senha em código, documentos ou captura de tela. Regerar autoridade pode tornar envelopes pendentes indecifráveis; não há rotação automática implementada.

## Controles exercitados

Validação estrita de tipos/algoritmos, assinatura da origem e cada salto, hash do ciphertext, autenticidade e replay da sessão, ciclos, limite de saltos, identidade do gateway, corrupção, expiração, quotas e recibos assinados. O relógio mantém marca máxima persistida: retrocesso superior a cinco minutos pausa operações. Avanço indevido ainda pode expirar envelopes; registros próprios são preservados.

Transações impedem ACK anterior à gravação e criação duplicada sob concorrência. Se o processo cair depois de guardar recibo central e antes de atualizar o registro cidadão, a próxima abertura reaplica o recibo idempotentemente. Web Locks serializam transferências entre abas compatíveis; sem esse recurso, usar apenas uma aba por instalação.

## Ameaças residuais

Não é sistema de produção auditado. Autoridade comprometida, participante malicioso autorizado, cópias fora do aplicativo, conluio, inferência de metadados, relógios ruins, roubo de sessão e negação de serviço não estão eliminados. Assinaturas validam declarações dos participantes, não distância física, condição da vítima ou boa-fé. Fanout é cota por instalação, não prova global de número de cópias. Recibos não garantem resgate.

Sem forward secrecy do conteúdo armazenado: comprometimento futuro da chave central pode expor ciphertext preservado. Não há rotação/recuperação automatizada de chaves, atestação de dispositivo, contas individuais de operadores, isolamento de produção, backup operacional ou política legal de retenção validada. Revogação offline é eventual. SDP revela metadados de rede; não publicar códigos de conexão.

Auditorias de dependências atuais: zero vulnerabilidades conhecidas em npm audit e pip-audit, conforme JSON em evidence. Isso não prova ausência de falhas. Auditoria anterior encontrou Pillow 12.3.0 vulnerável; correção para 13.0.0 permaneceu somente local por restrição de push. CI e lockfile do remoto inicial não recebem automaticamente essa correção.
