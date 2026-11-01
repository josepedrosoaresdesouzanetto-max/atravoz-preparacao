# Política de recursos da Rede Solidária

| Recurso | Padrão / limite |
|---|---|
| Participação | Desligada até adesão explícita; preferência persistida |
| Internet de terceiros | Wi-Fi confirmado pelo usuário; móvel/desconhecida bloqueada por padrão |
| Cota diária reservada | 1 MiB; seleção 256 KiB, 1 MiB ou 5 MiB |
| Espaço relay | 2 MiB; seleção 256 KiB, 2 MiB ou 8 MiB |
| Mensagens relay | 64 simultâneas; contrato máximo 128 |
| Cache de envelopes próprios | 100; original continua no armazenamento anterior |
| Fanout | Até dois destinos por envelope/aparelho; contrato máximo três |
| Tentativas | Seis por envelope; erro aplica backoff até cinco minutos |
| Mensagens por encontro/ciclo | Quatro; recibos primeiro |
| Saltos / TTL | Quatro / até 12 horas |
| Energia | Pausa abaixo de 20%, configurável; modo sobrevivência pausa mesh |
| Revisão da fila | 60 segundos, configurável; somente página visível |
| Concorrência | Uma transferência de saída por instalação com Web Locks; duas operações pendentes por canal |
| Proteção contra replay | 2.048 tombstones, 2.048 recibos, 256 sessões; quotas recusam novas entradas |

Reduzir cotas não apaga ocorrências próprias; passa a recusar novas cópias. Limpeza remove cópias relay expiradas/entregues; os recibos permanecem até 24 horas para retorno e tombstones até expiração do envelope + 24 horas. Envelopes próprios expirados ficam preservados; uma preparação posterior pode produzir novo envelope para o mesmo incident_id. O servidor continua idempotente nesse caso. A origem não perde os dados ao atingir a cota de envelopes.

O navegador nem sempre informa bateria ou tipo de conexão. A tela indica bateria desconhecida; controle automático só opera quando há medição. Confirmação de Wi-Fi é uma declaração do usuário para a sessão, reiniciada ao recarregar ou mudar online/offline; não é medidor de interface de rede. Troca silenciosa Wi-Fi→móvel pode não ser detectada. Em uso que exija garantia estrita de não usar dados móveis, desligue-os nas configurações do aparelho.

A cota de internet reserva tamanho do envelope + 8 KiB antes da tentativa, inclusive se falhar; não contabiliza com precisão cabeçalhos, DTLS/TLS, tráfego de sistema, recebimento de credenciais ou cobrança da operadora. Intervalo é revisão de fila, não busca Bluetooth. Não há escaneamento automático nem execução garantida em segundo plano. Sessões encerram ao desativar/pausar a participação e quando a bateria conhecida está abaixo do mínimo.

Não foram medidos consumo energético, autonomia, alcance, capacidade de dezenas de aparelhos ou resistência a tráfego adversarial prolongado. Estes limites são parâmetros conservadores do protótipo, não resultados de laboratório móvel.
