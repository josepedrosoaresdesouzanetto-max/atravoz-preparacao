# Demonstração honesta

Use apenas relato e imagem fictícios. A central começa sem sementes automáticas; dados de testes usam banco separado. Identifique a ocorrência criada ao vivo pelo UUID e horário, não por uma animação.

## Cenário B — disponível para ensaio

1. Executar build/servidor e carregar cidadão no navegador até indicar cache pronto.
2. Desconectar via ferramenta de rede do navegador. Escrever relato fictício opcional e salvar.
3. Mostrar estado local, ID e horário. Fechar/reabrir a página offline, conferir o mesmo registro.
4. Restaurar rede. Mostrar recibo técnico após envio; repetir envio e conferir não duplicação.
5. Abrir central com chave, localizar o mesmo ID, horário do servidor e texto original.
6. Se houver anexo, mostrar pendente antes do upload e recebido só depois. Solicitar análise; explicar se é regra ou modelo.

Esse fluxo passou em Edge desktop com viewport móvel. Repetir em celular físico é requisito aberto. Provas automatizadas: screenshots, testes E2E e SQLite em runtime/e2e-*; UUID/contagens consolidados em evidence/database-proof.json quando gerado.

## Cenário A — pendente

Dois celulares sem internet, um transfere por rádio real; B confirma gravação, reconecta e envia; central identifica mesmo ID. Não apresentar o protocolo Python ou mocks como transferência física. Sem implementação/hardware, declarar pendente e demonstrar B.

## Pitch de três minutos — roteiro para ensaio, não gravação

- 0:00–0:35: problema de perda de conectividade e quem precisa registrar informação; não citar pesquisa/impacto inventados.
- 0:35–1:35: criar registro fictício offline, reabrir e mostrar estado.
- 1:35–2:15: reconectar, recibo e central; explicar que recebimento não é atendimento.
- 2:15–2:40: organização assistida, original e revisão humana; dizer qual provedor realmente rodou.
- 2:40–3:00: limites, próximos testes e contribuição da equipe/validador.

Contingência: explicar a falha ao vivo e mostrar evidências identificadas como gravação anterior somente se uma gravação real tiver sido produzida. Nesta entrega há capturas de testes, não vídeo de demonstração. Não esconder dependências de rede ou que o desenvolvimento começou antes do evento.
