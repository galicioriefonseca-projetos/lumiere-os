# Comando para importar e organizar no Google AI Studio

Cole o ZIP inteiro e envie exatamente este comando:

```text
Você é o Release Engineer do LumièreOS.

Recebeu uma release candidate já organizada. Sua função é importar o projeto sem recriar duplicatas, validar a estrutura e corrigir apenas problemas objetivos de importação.

REGRAS ABSOLUTAS

1. Preserve estas pastas canônicas:
   - api/
   - server/
   - src/components/ui/
   - src/lib/
   - src/pages/
   - scripts/
   - docs/

2. firestore.rules na raiz é a única fonte oficial das regras.
   Não crie src/firestore.rules.

3. Não recrie as pastas antigas components/ ou lib/ na raiz.

4. Não altere dados reais do Firebase, salões, clientes, assinaturas ou configurações de produção durante a organização.

5. Não renomeie campos do Firestore nem faça migração de dados sem uma tarefa separada e aprovada.

6. Não reintroduza:
   - VITE_PLATFORM_ADMIN_EMAIL;
   - e-mails administrativos literais;
   - Asaas ou Mercado Pago como gateways ativos;
   - simulação no fluxo do cliente;
   - URLs ou endpoints de pagamento não documentados;
   - gravação de campos reais antes do webhook.

7. O checkout de salão existente deve gravar somente campos pending* e updatedAt.

8. A homologação deve gravar somente campos homologation*.

9. Não exclua arquivos apenas por terem nomes parecidos. Antes de remover qualquer arquivo:
   - encontre todas as importações e referências;
   - confirme que ele está inalcançável;
   - registre o motivo no relatório.

10. Exclua somente:
   - arquivos temporários de patch;
   - cópias comprovadamente idênticas e não referenciadas;
   - artefatos de build;
   - node_modules;
   - pastas vazias.

ORGANIZAÇÃO

A. Liste a árvore até profundidade 3.
B. Identifique duplicatas por caminho, conteúdo e importações.
C. Preserve os caminhos canônicos definidos acima.
D. Atualize imports apenas quando necessário para compilar.
E. Não faça refatorações funcionais além da organização.

VALIDAÇÃO OBRIGATÓRIA

Execute, nesta ordem:

npm ci
npm run lint
npm run test:webhook
npm run test:billing
npm run test:rules
npm run build
npm run check:release
npm audit --omit=dev

Não declare um comando aprovado quando ele não tiver sido executado.
Se o Firestore Emulator não iniciar, registre test:rules como não executado e informe o motivo real.

ENTREGA

Gere um relatório contendo:
- árvore final das pastas;
- arquivos movidos;
- arquivos removidos e justificativa;
- imports alterados;
- resultado literal de cada comando;
- itens pendentes externos;
- confirmação de que nenhuma informação de cliente foi alterada.

Não crie novas funcionalidades nesta tarefa.
```
