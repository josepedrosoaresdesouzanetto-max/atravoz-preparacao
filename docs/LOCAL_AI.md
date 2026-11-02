# IA auxiliar local — execução e limites

Salvar, transportar e receber ocorrências independe da IA. Regras, normalização, fatos com evidência, lacunas, sugestões de duplicidade, incerteza e revisão humana anteriores foram preservados. Não há decisão oficial de prioridade, resgate ou acionamento de órgãos.

## Modelo generativo

Adaptadores Ollama e `LocalChatProvider` configurável estão implementados. O segundo aceita apenas endpoint HTTP de loopback, sem redirecionamento/proxy automático, com timeout de 60 s, resposta até 64 KiB, saída estruturada JSON e validação de evidências antes de aceitar sugestões. Variáveis: `AI_PROVIDER=local-chat`, `AI_MODEL` e `AI_LOCAL_URL` (padrão `http://127.0.0.1:11435`). O servidor compatível com `/v1/chat/completions` precisa existir; a central não o inicia automaticamente. Uma tarefa de IA por vez; ocupação retorna 429. Saída inválida/truncada/indisponibilidade cai nas regras e preserva original.

Os testes usam respostas controladas, incluindo falhas, truncamento e texto malicioso. Não medem resistência geral a prompt injection de um modelo real. A avaliação de regras continua em doze casos sintéticos; seus resultados não podem ser atribuídos ao modelo generativo.

Foi preparado um runtime CPU [llama.cpp](https://github.com/ggml-org/llama.cpp/tree/master/tools/server) e modelo oficial [Qwen2.5-0.5B-Instruct-GGUF](https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF), com hashes de download verificados. A tentativa de iniciar `llama-server.exe` foi rejeitada pela revisão automática do ambiente como **blocked by policy**, sem motivo específico informado. Não houve nova tentativa por outro mecanismo, nem inferência generativa real, nem chamada paga. Modelo/runtime opcionais permanecem em `work/local-ai`; não integram APK ou pacote Windows. A limitação deve ser respeitada, não contornada.

## Transcrição realmente executada

O adaptador `LocalWhisperProvider` usa worker local isolado, [faster-whisper](https://github.com/SYSTRAN/faster-whisper) com CPU int8, dois threads, beam 1 e modelo tiny previamente baixado. Dependências ficam em ambiente separado (`requirements-transcription-lock.txt` registra o ambiente testado). Sem chamada externa durante inferência, telemetria desativada, limite de 4 MiB/31 segundos e timeout de 90 s. A saída exige `human_review_required=true` e não altera texto ou áudio original.

Execução real: áudio **sintético**, voz SAPI Microsoft Maria em português, 8,68 s. Texto esperado: “Teste fictício. Duas pessoas precisam de água. Não é uma emergência real.” Texto reconhecido: “Testifique-te-se. Doas pessoas precisam de água. Não é uma emergência real.” Foram observados erros; um exemplo não mede acurácia, sotaques, ruído ou uso real. Duração registrada da execução: 2,853 s nesta máquina. Evidência em `evidence/local-transcription.json` com hash do áudio; não foi gravada voz de pessoa nem testado microfone físico.

Para habilitar em execução futura, a equipe configura `TRANSCRIPTION_PYTHON` para o Python do ambiente separado e `TRANSCRIPTION_MODEL_DIR` para o modelo local previamente baixado. O worker `scripts/transcribe_local.py` acompanha o código e o pacote central. A interface oferece **Transcrever áudio local** somente para anexos efetivamente recebidos e requer autenticação. Sem runtime configurado, a API retorna indisponível; o áudio permanece disponível. Resultados aparecem como transcrição não revisada na sessão; não substituem o relato nem são persistidos como fato revisado. O APK não inclui pesos/runtime de IA.

O modelo exige licença e revisão da equipe antes de redistribuição. Nenhuma credencial foi criada ou adicionada ao repositório. Próximos passos do idealizador: ampliar corpus sintético representativo, medir erro por caso com referências, revisar contradições/omissões e definir critérios antes de testar dados pessoais reais.
