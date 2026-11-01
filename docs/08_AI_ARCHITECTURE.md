# Dados e inteligência

Pipeline: validar Incident → manter original → normalizar cópia Unicode/espaços → extração por regras ou provedor opcional → validar JSON e evidências → registrar lacunas e sugestões de duplicidade → persistir análise separada. Nunca roda antes do registro nem controla fila, atendimento, permissões, comandos ou mensagens externas.

O padrão `rules` é contingência determinística, explicitamente rotulada na interface. Extrai contagens simples, categorias limitadas e trechos literais; negação/ambiguidade podem reduzir a saída a indeterminado. Não é treinamento de modelo nem IA generativa em funcionamento.

`Provider` é substituível. `OllamaProvider` integra `/api/chat`, JSON Schema, temperatura 0, limites de resposta e timeout. Restrito a loopback nesta demonstração; não transfere relatos para nuvem por padrão. [Contrato de structured outputs do Ollama](https://docs.ollama.com/capabilities/structured-outputs). O adaptador foi testado com MockTransport, não com pesos de modelo executados.

Saída validada por Pydantic. Evidências devem existir literalmente na cópia normalizada; contagem deve concordar com extração explícita conservadora. Isso reduz algumas invenções, mas não prova semântica nem imunidade a prompt injection. Relatos são delimitados como dados não confiáveis, sem ferramentas. Confiança low/medium é qualitativa, não probabilidade calibrada. Revisão humana sempre obrigatória; informação nunca marcada confirmada pelo modelo.

Timeout, JSON inválido, evidência inventada, erro de configuração ou rede produzem fallback e código de erro, mantendo original. Resposta bruta é preservada até 16 mil caracteres em área administrativa. Duplicidade usa tokens, janela de duas horas e proximidade/referência quando disponível; sugere até cinco entre os 200 registros recentes, sem excluir/fundir.

Transcrição tem interface e saída unavailable honesta; nenhum áudio foi transcrito por modelo. Análise de imagem não implementada. Avaliação executada e limites em `services/intelligence/reports/EVALUATION.md`.
