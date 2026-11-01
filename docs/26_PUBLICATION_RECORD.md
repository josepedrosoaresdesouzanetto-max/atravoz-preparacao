# Registro da publicação inicial

- Data: 2026-11-01.
- Conta verificada: josepedrosoaresdesouzanetto-max.
- Repositório novo e privado: https://github.com/josepedrosoaresdesouzanetto-max/atravoz-preparacao
- Branch: main.
- Commit inicial: `406a3df28e4e956058878860545f88ce815600de`.
- Um único envio, por `gh repo create --private --source . --remote origin --push`.
- Verificação posterior confirmou `isPrivate: true`.
- O remoto contém somente o esqueleto inicial. Toda implementação posterior é local.
- Não há autorização para novo push, PR, release, tag remota ou deploy.
- Os resultados finais locais não são resultados de CI remota.
- [CI inicial aprovada](https://github.com/josepedrosoaresdesouzanetto-max/atravoz-preparacao/actions/runs/41274626854): três testes Python e dois TypeScript.
- Verificação remota ao fim da implementação confirmou a mesma branch/hash e privacidade.
- A auditoria posterior identificou alertas no Pillow 12.3.0 do lock inicial. A atualização para 13.0.0 está somente local; o esqueleto remoto não usa o parser de imagens, mas conserva a dependência antiga. Usar o lock local atualizado, e não confundir aprovação de testes do esqueleto com auditoria de segurança da versão final.
