# Changelog

## v1.6.0-rc.1 (2026-07-15)
### Release candidate comercial e consolidação de segurança

- Fluxo Founder manual para recorrência Asaas sem suspensão antecipada da conta.
- Checkout grava somente campos pendentes; confirmação definitiva ocorre pelo webhook validado.
- Homologação isolada em campos próprios e protegida por Platform Admin.
- Onboarding só é promovido para salão após pagamento aprovado e correlação segura.
- Firebase Admin aceita conta de serviço em JSON e retorna erros públicos sanitizados.
- Estrutura consolidada em `src/components/ui`, `src/lib` e uma única `firestore.rules`.
- Endpoints legados de Asaas e Mercado Pago removidos dos fluxos ativos.
- Testes de Billing, webhook, build e verificação estrutural ampliados.
- Links legais, identidade pública e canais de suporte configuráveis por ambiente.

## v1.5.7-founder (2026-06-08)
### Gerente como braço direito operacional

- **Gerente com acesso operacional ampliado**: A role `manager` agora possui poderes equivalentes aos da proprietária (`owner`) para quase todas as ações diárias do salão, promovendo máxima agilidade em operações compartilhadas.
- **Operação Completo de Checklist, Metas, Produção, Clientes e Agenda**: Gerente pode gerenciar checklists operacionais, estipular e acompanhar metas, registrar lançamentos e produções de atendimentos, consultar comissões e operar a agenda completa com agendamentos de serviços e produtos.
- **Bloqueio de Chaves e Ações de Propriedade**: Decisões de nível de plataforma e administração de faturamento — incluindo alteração do plano ou faturamento de assinatura do LumièreOS, exclusão permanente ou transferência de propriedade do salão — permanecem estritamente blindadas e exclusivas da proprietária (`owner`) e do `platform_admin`.
- **Painel Pessoal da Gerente Isolado e Integrado**: O painel pessoal (`Meu Painel`) permanece disponível para que o gestor também consulte suas próprias metas estipuladas, histórico de avaliações, produções e comissões individuais caso cadastrado na equipe.

## v1.5.4-founder (2026-06-08)
### Avaliações unificadas, metas para novos papéis e função de pular nota

- **Inclusão de papéis administrativos**: Gerentes (`manager`) e recepcionistas (`receptionist`) agora também são incluídas ativamente na rotina de Avaliações Diárias e podem possuir Metas individuais no sistema, garantindo um acompanhamento integral.
- **Função unificada de pular notas**: Implementado o botão "Pular e Próximo / Pular" na interface de avaliações, permitindo avançar opcionalmente sem registrar pontuação temporária, mantendo o colaborador com o status pendente original e sem remover alertas de pendência.
- **Avaliação única diária por pessoa**: Unificação das avaliações por colaborador físico (não por função), utilizando o identificador único `{date}_{collaboratorId}` de forma a evitar qualquer duplicidade na listagem, contadores ou nos relatórios analíticos e exportações de PDF.
- **Ajuste visual de listagem**: Listagem de colaboradores agora diferencia visualmente entre cargos técnicos (mostrando função Principal e Extras) e administrativos (mostrando Cargo corporativo).

## v1.5.3-founder (2026-06-08)
### Permissões operacionais da recepcionista

- **Lançamento operacional liberado**: Recepcionista agora mantém acesso operacional a clientes, agenda e lançamentos de atendimentos e serviços.
- **Bloqueio de recursos administrativos**: Checklist e Metas ficam bloqueados para a função de recepcionista e atendente, tanto na interface quanto nas rotas do sistema.
- **Matriz de permissões estrita**: Rotas sensíveis e acessos diretos por URL agora respeitam rigorosamente a matriz de permissões por função.
- **Isolamento de dados estratégicos**: Lançamento de serviços e produtos pode ser feito pela recepção mantendo total confidencialidade de relatórios analíticos, comissões estratégicas e dados financeiros corporativos.

## v1.4.8-founder (2026-06-03)
### Liberação operacional do MVP

- **Liberação do sistema sem barreiras de cobrança**: O sistema LumiereOS agora está permanentemente liberado para uso operacional no MVP, sem qualquer interrupção por status de faturamento ou expiração de assinatura.
- **Ocultação de alertas do trial e assinaturas vencidas**: Removidos do fluxo e do dashboard principal os banners de atenção, avisos de período experimental expirando/expirado e notificações de pagamento em atraso.
- **Preservação consultiva em "Minha Assinatura"**: A tela de faturamento (`/dashboard/assinatura`) foi mantida de forma consultiva no perfil do usuário (acessível por proprietários e gerentes), integrando informações de plano, chaves PIX para futuras renovações manuais e contato direto com o suporte financeiro corporativo.
- **Preparação de Canal do Cartão Recorrente**: Estrutura de faturamento via cartão integrada via Stripe foi mantida intacta sob o capô, exibindo mensagem amigável de lançamento futuro na tela do cliente.
