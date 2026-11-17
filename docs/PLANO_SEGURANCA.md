# Plano de segurança — Gestão de Clientes

Este documento registra a preparação de segurança. Não altera o aplicativo publicado, o Firebase, o Cloudflare Worker nem o banco remoto.

## Situação confirmada

- O aplicativo usa Firebase Authentication e Firestore.
- O UID do Firebase identifica a conta autenticada.
- O projeto Cloudflare Worker local possui verificação de Firebase ID token e rotas iniciais para saúde, identidade e clientes.
- O banco D1 local tem migrações para clientes, pagamentos, custos e perfis.
- As quatro migrações foram aplicadas somente ao banco D1 local.
- O banco D1 remoto não foi alterado nesta etapa.
- O código completo do Worker do Cloud Shell não está disponível neste repositório/branch; portanto, não é seguro reconstruir ou substituir esse arquivo por suposição.

## Regras de segurança que devem ser mantidas

1. Nunca colocar UID administrativo, senhas, tokens, chaves privadas ou segredos no HTML/JavaScript público.
2. Não confiar em campos enviados pelo navegador como `isAdmin`, `role` ou `plano` para conceder privilégios.
3. Verificar o Firebase ID token no servidor em toda rota privada.
4. Identificar o administrador no servidor, por configuração secreta/segura ou custom claim emitida por ambiente confiável.
5. Restringir operações administrativas (criar, bloquear e excluir contas de vendedores) a rotas de servidor que verifiquem a identidade administrativa.
6. Manter cada vendedor isolado pelo UID autenticado; nunca aceitar `usuario_id` arbitrário do corpo da requisição para decidir a propriedade dos dados.
7. Aplicar validação de entrada, limites, autorização por recurso e respostas sem dados sensíveis.
8. Não habilitar permissões amplas no Firestore para “resolver” o painel administrativo.
9. Não migrar o aplicativo do Firestore para D1 parcialmente. Primeiro definir e testar uma única fonte oficial de dados e uma estratégia de migração/rollback.

## Arquitetura recomendada

- Firebase Authentication continua responsável pelo login.
- O navegador envia o Firebase ID token ao Worker em cada chamada autenticada.
- O Worker valida assinatura, emissor, público, expiração e UID do token.
- O Worker deriva o UID exclusivamente do token validado.
- Rotas de dados comuns só consultam ou alteram registros daquele UID.
- Rotas administrativas verificam uma autorização administrativa mantida no servidor. A lista/segredo administrativo nunca é entregue ao navegador.
- Para criar, desativar ou excluir usuários do Firebase Authentication, usar Firebase Admin SDK em ambiente confiável com credenciais armazenadas como segredo do provedor. Nunca solicitar que o usuário cole chaves privadas no chat ou no código público.

## Sequência de implementação e testes

- [ ] Recuperar e revisar o Worker completo do Cloud Shell antes de alterar rotas.
- [ ] Confirmar quais telas ainda acessam Firestore diretamente e quais já usam Worker.
- [ ] Definir a fonte oficial de clientes, pagamentos, custos e perfis.
- [ ] Implementar autorização administrativa no servidor.
- [ ] Implementar rotas administrativas com validação e auditoria mínima.
- [ ] Testar: vendedor A não acessa dados do vendedor B.
- [ ] Testar: vendedor comum recebe 403 em todas as rotas administrativas.
- [ ] Testar: administrador autorizado pode executar apenas as operações previstas.
- [ ] Testar token ausente, inválido, expirado, origem não autorizada e dados malformados.
- [ ] Revisar regras do Firestore e permissões do Worker sem abrir acesso público.
- [ ] Só depois de aprovação explícita, aplicar migrações remotas ou publicar o Worker/app.

## Limites desta preparação

Esta branch é apenas de preparação e não deve ser configurada como branch de produção. Nenhuma implantação, migração remota, alteração de regras Firebase, exclusão de contas ou alteração de dados foi executada.
