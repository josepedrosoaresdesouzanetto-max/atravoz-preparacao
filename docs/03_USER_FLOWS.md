# Fluxos e estados

**Registro mínimo:** abrir aplicativo preparado → tocar PRECISO DE SOCORRO ou INFORMAR UMA OCORRÊNCIA → transação local → confirmação. Nenhum campo opcional é exigido. Detalhes podem ser escritos antes do toque. Durante gravação/finalização de mídia os botões aguardam a conclusão dessa operação escolhida pelo usuário.

**Cenário B:** SALVO_LOCALMENTE → AGUARDANDO_CONEXAO ao tentar envio → RECEBIDO_SERVIDOR somente com recibo válido do mesmo UUID. Falha mantém conteúdo e agenda nova tentativa. RECEBIDO_SERVIDOR não regride por falha em anexo. Fotos/áudios têm recibos independentes.

**Operador:** chave na memória → listar → selecionar → consultar original/anexos/histórico → solicitar análise opcional → registrar justificativa. RECEBIDO_SERVIDOR permite EM_VERIFICACAO, CORRIGIDO ou INVALIDADO. EM_VERIFICACAO permite VERIFICADO, CORRIGIDO ou INVALIDADO. CORRIGIDO/INVALIDADO podem retornar a EM_VERIFICACAO. Há proteção contra revisão baseada em estado antigo (409).

RASCUNHO é conteúdo local ainda não finalizado. TRANSFERIDO_PARA_DISPOSITIVO existe no protocolo de laboratório, sem UI que finja Bluetooth. ATENDIMENTO_CONFIRMADO é conceito reservado; a API recusa esse estado nesta demonstração. Não há serviço autorizado para confirmar resgate.

**Correção:** usuário informa ID ao operador local; operador escreve retificação auditada. Relato original nunca é sobrescrito. Correção autônoma pelo cidadão é uma evolução pendente, não impede correção legítima via operador.
