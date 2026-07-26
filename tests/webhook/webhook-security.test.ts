import { describe, it, expect } from "vitest";
import { buildHomologationWebhookUpdate } from "../../server/routes/cakto/webhook.js";

describe("Teste de Segurança do Webhook de Homologação", () => {
  const forbiddenKeys = [
    "updatedAt",
    "plan",
    "billingProvider",
    "subscriptionStatus",
    "paymentStatus",
    "ownerEmail",
    "nextBillingDate",
    "caktoSubscriptionId",
    "pendingPlan"
  ];

  const checkKeysOnlyStartWithHomologationAndNoForbiddenKeys = (payload: Record<string, any>) => {
    const keys = Object.keys(payload);
    expect(keys.length).toBeGreaterThan(0);
    
    // Todas as chaves retornadas começam com 'homologation'
    for (const key of keys) {
      expect(key.startsWith("homologation")).toBe(true);
    }

    // Nenhuma das chaves retornadas deve ser igual a qualquer chave de produção proibida
    for (const forbiddenKey of forbiddenKeys) {
      expect(payload).not.toHaveProperty(forbiddenKey);
    }
  };

  it("deve mapear corretamente o evento 'purchase_approved'", () => {
    const payload = buildHomologationWebhookUpdate({
      eventName: "purchase_approved",
      eventId: "evt_123",
      orderId: "ord_123",
      subscriptionId: "sub_123",
      customerId: "cust_123",
      offerId: "off_123",
      normalizedData: {
        current_period_end: "2026-08-14T12:00:00Z",
        amount: 197
      }
    });

    checkKeysOnlyStartWithHomologationAndNoForbiddenKeys(payload);

    expect(payload.homologationSubscriptionStatus).toBe("active");
    expect(payload.homologationPaymentStatus).toBe("paid");
  });

  it("deve mapear corretamente o evento 'subscription_created'", () => {
    const payload = buildHomologationWebhookUpdate({
      eventName: "subscription_created",
      eventId: "evt_123",
      orderId: "ord_123",
      subscriptionId: "sub_123",
      customerId: "cust_123",
      offerId: "off_123",
      normalizedData: {}
    });

    checkKeysOnlyStartWithHomologationAndNoForbiddenKeys(payload);

    expect(payload.homologationSubscriptionStatus).toBe("pending");
    expect(payload.homologationPaymentStatus).toBe("pending");
  });

  it("deve mapear corretamente o evento 'purchase_refused'", () => {
    const payload = buildHomologationWebhookUpdate({
      eventName: "purchase_refused",
      eventId: "evt_123",
      orderId: "ord_123",
      subscriptionId: "sub_123",
      customerId: "cust_123",
      offerId: "off_123",
      normalizedData: {}
    });

    checkKeysOnlyStartWithHomologationAndNoForbiddenKeys(payload);

    expect(payload.homologationSubscriptionStatus).toBe("overdue");
    expect(payload.homologationPaymentStatus).toBe("refused");
  });

  it("deve mapear corretamente o evento 'subscription_canceled'", () => {
    const payload = buildHomologationWebhookUpdate({
      eventName: "subscription_canceled",
      eventId: "evt_123",
      orderId: "ord_123",
      subscriptionId: "sub_123",
      customerId: "cust_123",
      offerId: "off_123",
      normalizedData: {}
    });

    checkKeysOnlyStartWithHomologationAndNoForbiddenKeys(payload);

    expect(payload.homologationSubscriptionStatus).toBe("canceled");
    expect(payload.homologationPaymentStatus).toBe("canceled");
  });
});
