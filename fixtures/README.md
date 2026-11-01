# Dados de demonstração

`synthetic/photo.png` é um quadrado de cor sólida criado por código para testar o fluxo de imagens. Não representa uma pessoa ou ocorrência real. O conjunto de relatos e respostas esperadas fica em `services/intelligence/fixtures/synthetic/evaluation.json`.

Nenhuma base é carregada automaticamente na central. O teste E2E cria novos IDs a cada execução e usa banco separado em `runtime/e2e-*`. Nenhum dado de teste deve ser apresentado como atendimento ocorrido.
