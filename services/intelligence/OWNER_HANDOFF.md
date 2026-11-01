# Handoff ao idealizador — Dados, IA e Qualidade

Sua responsabilidade proposta é manter os modelos e a qualidade da informação, a integração da IA, a avaliação dos resultados e os testes. Essa divisão ainda depende do grupo. Sua contribuição já documentada é a concepção/especificação: comunicação resiliente, dois cenários, dados opcionais, prioridade do envio, central, IA auxiliar, confiabilidade, módulos e preparação privada.

O Codex implementou os contratos Python/Zod/JSON, normalização, extração por regras com evidências, lacunas, sugestão de duplicidade, adaptador Ollama, falhas/timeout/fallback, preservação de original/saída bruta, métricas de tempo, dados sintéticos, testes e relatórios. Essa implementação é assistida por IA; não deve ser descrita como código escrito manualmente por você.

## Como compreender e revisar

1. Leia `contracts.py` e exemplos compartilhados. Siga um UUID desde Incident até ServerReceipt/AIAnalysis.
2. Leia `pipeline.py`: o original é preservado, regras/provedor organizam uma cópia, qualquer falha cai em contingência, saída exige revisão.
3. Leia `extraction.py`, identifique negação e evidência. Experimente relatos fora do corpus para observar limitações reais.
4. Leia `deduplication.py`: escore heurístico não é probabilidade nem decisão de fusão.
5. Rode testes e avaliação pelos comandos do README do módulo; compare cada caso em `reports/evaluation.json` com seu original.
6. Na central, peça análise de um relato sintético e confira a indicação rules/fallback/model. O modelo real ainda não foi executado.

## O que você precisa decidir/revisar

Validade das categorias e linguagem; tratamento de ambiguidades; corpus representativo; privacidade; escolha/autorização de provedor; retenção da saída bruta; limites de segurança; transcrição real; métricas e critérios para aceitar saída de modelo. Obtenha revisão de alguém da equipe para código sensível. Não atribua a você revisão antes de fazê-la.

Limites atuais: doze casos escritos junto com regras, sem medição de generalização; nenhuma inferência real com modelo; nenhuma transcrição real; nenhuma validação com população. Testes HTTP simulados verificam contratos, não inteligência do modelo. Aprovações de marca/licença/uso prévio no evento ainda pendentes.

## Como apresentar sua contribuição

“Idealizei o problema, defini os requisitos e a estratégia de comunicação. Estou proposto para Dados, IA e Qualidade. A implementação inicial foi produzida com assistência do Codex; estou revisando os contratos, avaliando saídas e preparando a integração com a equipe.” Use “revisei” ou “validei” somente após executar essas atividades e registrar evidência.

Registro futuro de revisão: data real, arquivos/casos analisados, problemas encontrados, alteração realizada, testes executados e revisor. Nenhum desses campos foi preenchido como se já tivesse ocorrido.
