# Uso de inteligência artificial na construção

Ferramenta utilizada: Codex, agente baseado em GPT-6 conforme identificação da sessão. O pedido chama o agente de Astra; isso não foi tratado como comprovação independente de um modelo específico. Skill Sites aplicada ao trabalho web em modo local, sem registro ou deploy de Site. Não foram usados subagentes.

Objetivo: converter concepção/especificação humana em base modular, código executável, testes, investigação técnica e documentação. Componentes gerados: cidadão React/IndexedDB/fila/mídia; central; API/SQLite/autenticação/recibos; contratos; regras e adaptador de modelo; protocolo experimental; scripts; CI; testes; documentação. O agente executou instalações locais, comandos, testes e inspeção de capturas.

Correções efetivamente aplicadas: regra de negação que descartava contagem válida; rejeição não tratada da transação IndexedDB; caminho do Python no runner Windows; contexto incorreto do fetch no navegador; fechamento de tag JSX; impedimento de iniciar API quando modelo estava mal configurado; limpeza atômica de rascunho; consistência de booleano sintético entre Python e TypeScript; substituição de linter com dependências vulneráveis. Detalhes/resultados no diário.

IA no produto: adaptador Ollama implementado e testado com HTTP simulado; modelo real não instalado/executado. Regras determinísticas são rotuladas como tal. Não foi inventada transcrição nem análise de imagem. Todas as saídas exigem revisão. Testes simulados não demonstram qualidade de modelo real.

Intervenção humana efetivamente recebida: fornecimento do prompt mestre, concepção e requisitos, limites de publicação e papéis propostos. Não há revisão humana do código ou validação de UX registrada nesta execução. Não foram inventadas horas, commits humanos, feedbacks ou avaliações Pró-Criança. Os commits gerados usam identidade explícita de assistente, não identidade manual do usuário.

Pendências: ler/entender código, revisar corpus e segurança, testar dispositivos, validar com público, registrar correções humanas reais e obter orientação da organização sobre reutilização prévia.

Correção posterior de segurança: atualização local de Pillow 12.3.0 para 13.0.0 com base no resultado de pip-audit, seguida de repetição dos testes. O repositório remoto foi preservado no commit inicial conforme a restrição do usuário.

## Evolução mesh

Novo requisito humano: Rede Mesh Oportunista Antena Humana, consentimento, segurança, cotas e preservação do fluxo anterior, mantendo ATRAVOZ. Codex implementou os novos módulos, testes, correções e documentação. Nenhuma contribuição manual de implementação ou revisão humana foi inventada. Sem subagentes. Bibliotecas JOSE reconhecidas foram usadas; desenho de protocolo ainda requer auditoria humana.

Ensaio de software real com três contextos Edge e Python; ausência de WAN representada por HTTP 503 para A/B. Não houve três telefones, rádio Bluetooth, instalação móvel ou revisão humana. Ferramenta de IA no produto continua opcional e sem inferência de modelo real nesta execução. Métricas de transporte são determinísticas e não estimam vítimas ou prioridade de resgate.
