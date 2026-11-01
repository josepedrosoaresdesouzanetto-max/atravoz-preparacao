# Segurança da comunicação de emergência

Interface informa que é protótipo e não aciona socorro. Nunca dizer “Bombeiros acionados” ou “resgate enviado” por receber HTTP 200. RECEBIDO_SERVIDOR é confirmação técnica. VERIFICADO indica revisão do operador demonstrativo, não atendimento de organização real. API rejeita ATENDIMENTO_CONFIRMADO.

O app oferece links de chamada, acionados somente pelo usuário, para Bombeiros 193 e Defesa Civil 199. Esses contatos constam em [Telefones úteis da Defensoria Pública de Pernambuco](https://www.defensoria.pe.def.br/telefones_uteis/). A adequação local deve ser revisada pela equipe antes da demonstração. Não há chamada, mensagem ou integração automática com autoridades.

Não fornece diagnóstico médico, rota segura, profundidade da água ou decisão autônoma de resgate. Não promete transmissão com aparelho desligado, alcance Bluetooth fixo ou funcionamento através de escombros. Modo Sobrevivência altera somente tarefas do próprio aplicativo. Modo Me Ache não foi implementado e não deve ser anunciado como detector de vítimas.

Falha ao salvar exige mensagem explícita, sem falsa confirmação. Falha de envio mantém registro. Falha de IA não impede envio. Anexo não recebido é apresentado como pendente. Todas essas distinções precisam de validação com pessoas, ainda pendente.
