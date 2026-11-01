# Desempenho e otimização

Medidas locais em `docs/evidence/benchmark.json`, geradas por `.venv/Scripts/python scripts/benchmark.py`: 100 análises de regras e 50 submissões FastAPI/TestClient com commit SQLite; mediana e p95 registrados. É microbenchmark desktop em processo, não rede móvel, capacidade de produção ou teste de carga.

O build registra bytes brutos/gzip por asset. Bundle compartilhado é aproximadamente 313 KB bruto/96 KB gzip; cidadão aproximadamente 23 KB bruto/8,5 KB gzip; central aproximadamente 12 KB bruto/4,3 KB gzip; CSS aproximadamente 5 KB bruto/1,8 KB gzip. Valores exatos no JSON e build. Servidor local não habilita compressão HTTP: gzip indica potencial de transporte, não economia já aplicada no servidor.

Otimizações implementadas: fontes do sistema, sem bibliotecas visuais pesadas/mapas/gráficos decorativos; entradas separadas para central/cidadão; fotos reduzidas uma vez para maior dimensão 1600 px, JPEG qualidade 0,85; original preservado localmente; áudio em 32 kbps quando suportado, limite 30 s; envio de essenciais antes de anexos; backoff e lote limitado; sem IA no celular; Modo Sobrevivência altera verificações de 15 para 60 s, sem controlar outros aplicativos.

Metas ainda não comprovadas: registro em até dez segundos por pessoa, abertura em celular modesto, consumo de energia e desempenho em desastre. Ficha de medição em 23_PRODUCT_VALIDATION.md. Nenhum alcance Bluetooth, ganho de bateria ou capacidade mundial foi declarado. Lista local carrega registros do aparelho; paginação local/virtualização é melhoria futura para volume alto.

## Medição posterior à evolução mesh

O JSON de benchmark foi atualizado após a integração. Regras: mediana 0,041 ms, p95 0,082 ms (100 casos); API em processo: mediana 15,562 ms, p95 17,882 ms (50 commits). Build atual acrescenta chunk mesh carregado separadamente, aproximadamente 64 KB bruto/21 KB gzip; o cache offline prepara esse asset. Não são números de rede, criptografia mesh em celulares ou bateria.
