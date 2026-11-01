# Matriz de aceitação técnica

| Critério do núcleo | Estado verificado |
|---|---|
| 1. Abre em celular de teste | Pendente; viewport móvel em desktop não é celular físico |
| 2. Cria registro mínimo | Aprovado no E2E desktop |
| 3. Salva sem internet | Aprovado em navegador e teste IndexedDB emulado |
| 4. Recupera após reabertura | Aprovado ao fechar/abrir página offline; reinício físico do aparelho não testado |
| 5. Servidor recebe válidos | Aprovado API/SQLite/E2E |
| 6. Reenvio não duplica | Aprovado sequencial e concorrente |
| 7. Central mostra persistidos | Aprovado E2E autenticado |
| 8. Estado de recebimento correto | Aprovado, inclusive recibo falso/anexo pendente |
| 9. Função IA implementada/testável | Parcial: adaptador testado com mocks; regras locais executadas; modelo real pendente |
| 10. Falha IA não bloqueia fluxo | Aprovado, inclusive configuração inválida |
| 11. README reproduzível | Comandos principais executados nesta máquina |
| 12. Testes automatizados | Executados; contagem no relatório final |
| 13. Configuração CI | Esqueleto aprovado remotamente; configuração ampliada somente local |
| 14. Resultados locais documentados | Relatórios, diário e capturas |
| 15. Uso IA documentado | Sim, sem alegar revisão humana |
| 16. Responsabilidades organizadas | Proposta modular, aguardando equipe |

Bluetooth nativo: NÃO INICIADO. Protocolo: implementado e testado em software, sem rádio nem integração de relay. Áudio físico/GPS/câmera real, bateria, iPhone, aparelhos modestos, deploy e validação humana estão abertos.

Estado de entrega: base local funcional nas partes aprovadas, com bloqueios explícitos; não produto operacional de emergência nem cumprimento integral do hackathon.
