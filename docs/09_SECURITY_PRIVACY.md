# Segurança e privacidade da preparação

Limite de uso: demonstração local com dados sintéticos, não produção. A API rejeita synthetic=false. Essa marca não detecta automaticamente pessoas que escrevam dados reais; orientações de uso continuam necessárias.

Controles implementados: central fechada sem chave forte configurada; Bearer de operador só em memória no navegador; capacidade aleatória por ocorrência para reenvio/anexo/status; hash da chave no SQLite; validação estrita; UUIDs e queries parametrizadas; limites de corpo, tamanho, registros e mídia; rate limit; imagens decodificadas/verificadas; integridade SHA-256; UI escapa texto; downloads autenticados; CSP/nosniff/no-referrer; API no-store; nenhuma resposta administrativa no Service Worker; logs de acesso desativados no script.

Auditoria de mudanças registra ator demonstrativo único e justificativa, incluindo correções/invalidações. Original é preservado. Não há botão para confirmação de atendimento real. AI não recebe capacidades de escrita, shell ou envio externo. Conexão com modelo externo é bloqueada no adaptador atual.

Lacunas: SQLite/IndexedDB não têm cifragem aplicada pelo produto; arquivos no disco dependem da proteção do SO. Token único não identifica pessoas individualmente, não há MFA/RBAC/SSO/revogação centralizada; reiniciar com outra chave revoga o operador anterior. Áudio recebe verificação de contêiner, não antivírus nem decodificação integral. Exaustão distribuída de recursos, backups, chaveamento/criptografia de transporte BLE e segurança de implantação não estão resolvidos.

Retenção proposta para preparação: somente dados fictícios; encerrar cada rodada de demonstração, conferir pendências e exportar as evidências técnicas necessárias antes de limpeza manual. Não existe exclusão automática, prazo legal definido ou alegação de conformidade LGPD. Não aplicar essa política a incidentes reais. Retenção operacional e direitos de titulares dependem de responsável humano/jurídico.

Servidor limita bind a loopback e é HTTP local. Acesso de celular/rede exige HTTPS confiável e avaliação de autenticação; não foi publicado túnel. Credenciais não pertencem ao Git; `.env`, `.local` e `runtime` são ignorados. Relatórios de testes usam somente dados sintéticos. Nenhuma foto real de vítima foi usada.

Auditorias de dependência: `npm audit --json` e `pip-audit` dos requisitos fixados, este último instalado num ambiente isolado em work, sem acrescentá-lo ao runtime. Relatórios antes/depois em docs/evidence. O Pillow inicial foi atualizado localmente de 12.3.0 para 13.0.0 após alertas. O remoto ainda retém o lock inicial por restrição explícita de novos pushes. Auditoria sem alertas conhecidos não é garantia de segurança nem substitui teste de invasão/revisão humana.
