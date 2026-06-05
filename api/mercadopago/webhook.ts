import { Request, Response } from 'express';
import * as crypto from 'crypto';
import { MercadoPagoConfig, PreApproval } from 'mercadopago';
import { getAdminDb } from '../../server/firebaseAdmin';

export default async function webhookMP(req: Request, res: Response) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const signatureHeader = req.headers['x-signature'] as string;
    const requestId = req.headers['x-request-id'] as string;
    const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET;

    // Se temos webhook secret, vamos validar e logar. Em ambiente local/sem secret, apenas log para debug.
    if (signatureHeader && requestId && secret) {
      // Validate signature
      try {
        const parts = signatureHeader.split(',');
        let ts = '';
        let v1 = '';
        parts.forEach(part => {
          const [key, value] = part.split('=');
          if (key === 'ts') ts = value;
          if (key === 'v1') v1 = value;
        });

        // The query data is normally the id or topic
        // MP Docs: manifest = "id:12345;request-id:xxxxx;ts:xxxx;-;"
        const payloadData = req.body.data?.id || req.query['data.id'] || '';
        if (payloadData) {
          const manifest = `id:${payloadData};request-id:${requestId};ts:${ts};`;
          const cyphedSignature = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
          
          if (cyphedSignature !== v1) {
            console.warn('[MercadoPago] Assinatura do webhook inválida. Manifest:', manifest);
          }
        }
      } catch (e) {
        console.warn('Erro ao validar assinatura do webhook:', e);
      }
    }

    const { type, action, data } = req.body;
    // O MP também envia topic ou type em req.query
    const eventType = type || req.query.type || req.query.topic;
    const eventId = data?.id || req.query['data.id'];

    if (!eventId) {
      return res.status(200).send('OK (sem data id)');
    }

    const accessToken = process.env.MERCADOPAGO_ACCESS_TOKEN;
    if (!accessToken) {
      console.error('MERCADOPAGO_ACCESS_TOKEN is not configured');
      return res.status(500).json({ error: 'MercadoPago not configured' });
    }

    const client = new MercadoPagoConfig({ accessToken });
    const db = getAdminDb();

    if (eventType === 'subscription_preapproval') {
      const preApproval = new PreApproval(client);
      const subscriptionData: any = await preApproval.get({ id: eventId as string });
      
      const salonId = subscriptionData.external_reference;
      if (!salonId) {
        console.log(`[Webhook MP] Assinatura ${eventId} não possui external_reference. Ignorando.`);
        return res.status(200).send('OK');
      }

      const status = subscriptionData.status; // pending, authorized, paused, cancelled
      
      const batch = db.batch();
      const salonRef = db.collection('salons').doc(salonId);
      const subscriptionRef = salonRef.collection('subscriptions').doc(String(eventId));

      batch.update(subscriptionRef, {
        status,
        updatedAt: new Date().toISOString(),
        rawStatusObj: subscriptionData
      });

      // Atualizar objeto principal do salão
      const updateData: any = {
        subscriptionStatus: status,
        updatedAt: new Date().toISOString()
      };

      if (status === 'authorized') {
         updateData.isActive = true;
         updateData.activationStatus = 'active';
      } else if (status === 'cancelled' || status === 'paused') {
         // Não vamos bloquear automaticamente, apenas atualizar o status
         updateData.subscriptionStatus = status;
      }

      batch.update(salonRef, updateData);
      await batch.commit();

      console.log(`[Webhook MP] Assinatura ${eventId} atualizada de forma segura para ${status} no salão ${salonId}`);
    } 
    else if (eventType === 'subscription_authorized_payment' || eventType === 'authorized_payment' || eventType === 'payment') {
      console.log(`[Webhook MP] Processando pagamento/autorização eventId: ${eventId}`);
      
      let paymentData: any = null;
      let salonId = '';
      let amount = 0;
      let status: 'approved' | 'pending' | 'rejected' | 'cancelled' = 'pending';
      let plan = 'founder';
      let preapprovalId = '';

      // Tentar obter dados do pagamento autorizado vinculado à assinatura
      try {
        const authPaymentResponse = await fetch(`https://api.mercadopago.com/authorized_payments/${eventId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` }
        });
        if (authPaymentResponse.ok) {
          const jp = await authPaymentResponse.json();
          paymentData = jp;
          preapprovalId = jp.preapproval_id || '';
          amount = jp.transaction_amount || 0;
          status = jp.status;
          
          if (preapprovalId) {
            // Encontrar salonId buscando o salonId cuja assinatura ou campo mercadoPagoPreapprovalId possui esse preapproval_id
            const salonsRef = db.collection('salons');
            const querySnapshot = await salonsRef.where('mercadoPagoPreapprovalId', '==', preapprovalId).limit(1).get();
            if (!querySnapshot.empty) {
              const salonDoc = querySnapshot.docs[0];
              salonId = salonDoc.id;
              const subDoc = await salonsRef.doc(salonId).collection('subscriptions').doc(preapprovalId).get();
              if (subDoc.exists) {
                plan = subDoc.data()?.plan || 'founder';
              }
            }
          }
        }
      } catch (err: any) {
        console.log(`[Webhook MP Debug] Evento ${eventId} não processado como authorized_payment: ${err.message}. Buscando como pagamento direto.`);
      }

      // Tentar obter dados como pagamento direto (Payment API) caso não tenha sido resolvido acima
      if (!salonId) {
        try {
          const paymentResponse = await fetch(`https://api.mercadopago.com/v1/payments/${eventId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });
          if (paymentResponse.ok) {
            const jp = await paymentResponse.json();
            paymentData = jp;
            amount = jp.transaction_amount || jp.transaction_details?.total_amount || 0;
            status = jp.status;
            salonId = jp.external_reference || '';
            preapprovalId = jp.subscription_id || '';
          }
        } catch (err: any) {
          console.error(`[Webhook MP] Erro ao buscar pagamento ${eventId} na API do Mercado Pago: ${err.message}`);
        }
      }

      if (!salonId) {
        console.warn(`[Webhook MP] Pagamento ${eventId} não possui associação direta ou indireta a um salonId. Ignorando.`);
        return res.status(200).send('OK (Não pôde identificar salão associado)');
      }

      // Mapear status para o banco de dados do LumiereOS
      let dbStatus: 'reported' | 'paid' | 'rejected' | 'canceled' = 'reported';
      if (status === 'approved') {
        dbStatus = 'paid';
      } else if (status === 'rejected') {
        dbStatus = 'rejected';
      } else if (status === 'cancelled') {
        dbStatus = 'canceled';
      }

      // Salvar de forma estritamente idempotente usando o próprio ID do MP para evitar duplicidade de registros
      const paymentRef = db.collection('salons').doc(salonId).collection('payments').doc(String(eventId));
      
      const paymentObj = {
        id: String(eventId),
        salonId,
        plan: plan,
        amount,
        method: 'credit_card',
        status: dbStatus,
        reportedByUserId: 'system_webhook_mp',
        reportedByEmail: 'mp-webhook@lumiereos.com',
        reportedAt: Date.now(),
        confirmedByUserId: 'system_webhook_mp',
        confirmedByEmail: 'mp-webhook@lumiereos.com',
        confirmedAt: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        provider: 'mercadopago',
        notes: `Pagamento automático processado via Mercado Pago (Sub/Preapproval ID: ${preapprovalId || 'N/A'})`
      };

      await paymentRef.set(paymentObj, { merge: true });
      console.log(`[Webhook MP] Pagamento ID ${eventId} registrado/atualizado de forma segura com status: ${dbStatus}`);

      // Ativar salão em caso de pagamento confirmado com sucesso
      if (dbStatus === 'paid') {
        await db.collection('salons').doc(salonId).update({
          paymentStatus: 'paid',
          subscriptionStatus: 'active',
          isActive: true,
          activationStatus: 'active',
          updatedAt: new Date().toISOString()
        });
      }
    }

    return res.status(200).send('Webhook processado com sucesso');

  } catch (error: any) {
    console.error('Error processando webhook:', error.message || error);
    // Mercado Pago espera 200/201, se voltarmos 500 ele faz retry
    return res.status(200).json({ error: 'Internal server error handled' });
  }
}
