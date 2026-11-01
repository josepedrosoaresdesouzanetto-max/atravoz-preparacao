# Scripts de execução

Todos partem da raiz. `serve.py`: API + build em loopback, sem log de payload/token. `check.ps1`: verificações locais com parada em erro. `export_contracts.py`: gera JSON Schema; `check_contracts.py`: detecta divergência. `evaluate.py`: roda doze relatos sintéticos e grava resultados. `benchmark.py`: tempo de regras/API em processo e tamanhos de build. `build-sw.mjs`: gera cache somente de assets, invocado por npm run build.

Dependências: ambiente Python local e pacotes npm do lock. Não há script de push, deploy, release ou publicação. O workflow CI apenas testa. Banco de benchmark/testes fica em runtime, separado da demonstração. Não remova arquivos de dados para fazer verificações passarem.
