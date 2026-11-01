# Testes de integração e cliente

`unit`: contratos Zod, exemplos compartilhados e fila com fake-indexeddb. `e2e`: Edge desktop real com viewport móvel, API real e SQLite separado; rede simulada, foto sintética e fonte artificial de áudio. `test_shared_contracts.py`: compatibilidade dos exemplos com Python. `test_transfer.py`: protocolo em software, sem BLE. `test_skeleton.py`: verificações do esqueleto preservadas.

Testes específicos também ficam em services/api/tests e services/intelligence/tests. Execute comandos do README raiz. Resultados só valem para o ambiente identificado; mocks não provam rádio, microfone, GPS, comportamento de celular ou qualidade de modelo generativo. Nenhum teste usa dados pessoais reais.
