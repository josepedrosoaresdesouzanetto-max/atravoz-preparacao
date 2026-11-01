# Encaminhamento e retorno de recibos

Estratégia: store-carry-forward com fanout limitado, sem tabela de rotas geográficas ou previsão de quem alcançará a central. O voluntário escolhe manualmente o encontro; o navegador verifica o participante antes do tráfego. A posição de B/C nunca é atribuída à ocorrência de A.

Em cada encontro: recibos centrais conhecidos primeiro, depois envelopes elegíveis, próprios antes de terceiros. Mensagens já encaminhadas àquele participante, com recibo central, expiradas, em backoff, acima do número de tentativas/cópias ou com receptor já visitado não são enviadas. Cada salto conserva a origem e acrescenta prova encadeada. Nenhum novo incident_id é criado pelo intermediário.

Duplicidade de transporte usa message_id + hash da prova de origem. Mesmo identificador e outra prova é conflito. Na central, incident_id + write_key + conteúdo imutável continuam sendo a identidade da ocorrência. Novo envelope do mesmo registro não cria nova ocorrência. Relatos independentes, mesmo com texto semelhante, permanecem separados; o módulo de IA pode apenas sugerir relação para revisão humana.

A confirma armazenamento local. B confirma armazenamento intermediário. C pode confirmar a central só depois do gateway. A só sabe da central ao receber o recibo assinado, por C→B→A ou conexão futura. Perda dos intermediários, ausência de novo encontro, expiração e interrupções podem impedir esse retorno. Não há promessa de entrega, latência máxima ou conhecimento instantâneo.

Rotas assinadas impedem que um participante comum invente assinatura de outro, mas não provam localização física nem impedem participantes em conluio de fabricar uma rota declarada. O painel chama o campo de saltos declarados em cadeia assinada. Não usa saltos como distância, severidade ou prioridade de resgate.
