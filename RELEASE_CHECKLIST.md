# Checklist de lançamento comercial

## Código

- [ ] `npm ci`
- [ ] `npm run lint`
- [ ] `npm run test:webhook`
- [ ] `npm run test:billing`
- [ ] `npm run test:rules`
- [ ] `npm run build`
- [ ] `npm run check:release`

## Produção

- [ ] Variáveis Firebase Admin válidas na Vercel
- [ ] Projeto Firebase Web e Admin coincidentes
- [ ] Platform Admin cadastrado por UID
- [ ] Ofertas Asaas oficiais cadastradas
- [ ] Segredo e URL do webhook configurados
- [ ] Healthcheck profundo aprovado
- [ ] Logs e alertas configurados
- [ ] Backup e restauração testados

## Billing

- [ ] Founder manual permanece ativa
- [ ] Gerar checkout grava apenas `pending*`
- [ ] Checkout abre no celular e desktop
- [ ] Webhook real reconhece o `offerId`
- [ ] Pagamento controlado atualiza IDs reais
- [ ] Campos `pending*` são removidos após aprovação
- [ ] Cobrança recusada não remove acesso já pago indevidamente

## Negócio

- [ ] Termos de Uso revisados
- [ ] Política de Privacidade revisada
- [ ] Processo LGPD definido
- [ ] Política de cancelamento e reembolso definida
- [ ] Suporte e SLA definidos
- [ ] Emissão fiscal e tributação revisadas
- [ ] Preços, limites e comunicação comercial aprovados

## Dependências

- [ ] Atualização controlada do jsPDF planejada e testada
- [ ] `npm audit --omit=dev` revisado
