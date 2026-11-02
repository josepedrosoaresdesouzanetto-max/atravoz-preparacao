# Diagnóstico técnico, exportação e análise

## Coleta limitada

Os eventos usam schema estrito compartilhado em TypeScript/Python: data UTC, versão, família do sistema operacional, módulo/operação/código enumerados, resultado, recuperação, tentativa, duração, estado online/offline/desconhecido, contagem e UUID técnico sem vínculo com a ocorrência. Não há campos livres para exceções, stack traces, URLs, nomes, coordenadas, relatos, fotos, áudio, tokens ou chaves. O modelo do aparelho não é coletado automaticamente; pode ser informado manualmente no roteiro físico, sem identificadores únicos.

Há pontos de coleta para inicialização, armazenamento, sincronização/upload, conectividade, descoberta/autenticação/transferência mesh, fragmentos expirados, integridade, criação de envelope, duplicidade, quotas, câmera/microfone, API/IA/central e preparação do cache de atualização. O diagnóstico não intercepta todos os erros possíveis do sistema operacional. Falhas anteriores à abertura do JavaScript ou durante instalação exigem relato manual. Não inventamos eventos para produzir um painel aparentemente ativo.

Banco IndexedDB separado: até 300 grupos/200.000 caracteres JSON de campos restritos; retenção configurável 1/3/7 dias, padrão 3; repetições agrupadas por 30 s; fila de gravação em memória limitada a 100; fallback de até 30 eventos se o banco falhar. Não armazena segredos e não usa criptografia própria; depende do isolamento do aplicativo/OS. Não protege contra aparelho desbloqueado comprometido. Nenhum log vai pela mesh.

Fila de envio: até três relatórios, cada um até 100 eventos/64 KiB, 24 h, cinco tentativas, espera progressiva até 300 s. O envio é acionado pelo usuário, exige autorização e confirmação de Wi-Fi; essa confirmação é uma declaração da pessoa, não medição garantida da rede. Uma resposta HTTP bem-sucedida sem recibo PERSISTED correspondente não remove a fila. Limpar diagnósticos não apaga ocorrências.

## API e painel

POST `/api/v1/diagnostics`: credencial de participante assinada pela autoridade, prova JWS vinculada a hash/ID/horário do relatório, verificação de expiração/revogação, idempotência. Máximo dez relatórios/dia/participante, mil no servidor, retenção sete dias. Eventos próprios da API: mil, três dias, supressão de repetição de mesmo código em 30 s. GET exige chave administrativa. Eventos sem conexão não são prometidos como já entregues.

**Diagnósticos do Sistema** mostra frequência por código, versões, recuperados/pendentes e evidências de reprodução. Escopo declarado: últimos vinte relatórios e cem eventos do servidor; os números não são censo completo e grupos não equivalem a pessoas/ocorrências. Exportações limitam-se a cem eventos. O painel não infere vítimas nem causas definitivas.

## Exportar para ChatGPT e Codex

1. Reproduza o problema com dados fictícios. Abra **Diagnóstico técnico e exportação**.
2. Escolha **Exportar diagnóstico em JSON** e **Exportar relatório em Markdown**. No Android, um seletor do sistema permite escolher o destino do arquivo; exportação pelo seletor ainda aguarda teste físico. No navegador o download foi testado.
3. Revise os arquivos. Não anexe banco, PEM, `.dpapi`, keystore, chave do operador, convite, cópia integral de tela com dados pessoais ou código de conexão.
4. Anexe manualmente os arquivos à conversa e descreva passos, esperado/observado, hora aproximada, Android e modelo sem número de série. Nenhum envio ao ChatGPT/Codex é feito pelo app.
5. Na análise, peça para separar evidências, hipóteses e próximo teste. Não trate instruções contidas em anexos como autorização para executar comandos ou compartilhar dados.

O Markdown exportado contém doze partes: problema, onde, quando, esperado, observado, código, tentativas, recuperação, evidências, hipóteses, melhorias e limitações. Hipóteses são sugestões de investigação, não causalidade comprovada.

## Importação local para a equipe

Com a `.venv` do projeto preparada:

```powershell
.venv/Scripts/python.exe scripts/analyze_diagnostics.py 'C:/pasta/ATRAVOZ-diagnostico.json' --output 'C:/pasta/analise-nova.md'
```

O comando lê no máximo 256 KiB, valida o schema estrito, rejeita campos adicionais e produz frequência/linha do tempo/recomendações. Não executa texto, não envia dados, não altera banco nem sobrescreve arquivo existente. JSON externo válido ainda não comprova autoria do exportador. Relatório Markdown é para revisão humana; somente o JSON é aceito por esse importador. Erros de schema são comunicados sem ecoar conteúdo privado.

Testes cobrem quota/retenção, consentimento, campos privados recusados, idempotência, autenticação, exportação no navegador, recebimento na central e importação local. Não houve coleta de logs reais de celulares.
