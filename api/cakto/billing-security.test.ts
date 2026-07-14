import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks do Firestore estruturados para diferenciar "settings" de "salons"
const mockSettingsGet = vi.fn().mockResolvedValue({
  exists: true,
  data: () => ({
    productId: "prod_123",
    startOfferId: "off_start",
    founderOfferId: "off_founder",
    performanceOfferId: "off_performance",
    networkOfferId: "off_network",
    enterpriseOfferId: "off_enterprise"
  })
});

const mockSalonGet = vi.fn();
const mockSalonSet = vi.fn();

vi.mock("../_shared/firebaseAdmin.js", () => {
  return {
    getAdminDb: () => ({
      collection: (colName: string) => {
        if (colName === "settings") {
          return {
            doc: () => ({
              get: mockSettingsGet
            })
          };
        }
        // Para "salons" ou outros
        return {
          doc: () => ({
            get: mockSalonGet,
            set: mockSalonSet
          })
        };
      }
    })
  };
});

vi.mock("../_shared/auth.js", () => ({
  verifyIdToken: vi.fn(),
  canManageBilling: vi.fn()
}));

import { verifyIdToken, canManageBilling } from "../_shared/auth.js";
import checkoutHandler from "./create-checkout.js";
import updatePaymentHandler from "./update-payment-method.js";

function createMockRes() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  res.setHeader = vi.fn().mockReturnValue(res);
  return res;
}

describe("Testes de Segurança de Faturamento (Billing Security)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("create-checkout.ts", () => {
    it("deve exigir autenticação global (retornar 401 se token inválido)", async () => {
      const req: any = { 
        method: "POST", 
        body: { salonId: "salon_123", planId: "start" } 
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockRejectedValueOnce(new Error("Token inválido"));

      await checkoutHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        error: "Token inválido"
      }));
    });

    it("deve impedir criação de checkout Founder para salão inexistente (retornar 403)", async () => {
      const req: any = { 
        method: "POST", 
        body: { salonId: "salon_new", planId: "founder" } 
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123" } as any);
      mockSalonGet.mockResolvedValueOnce({ exists: false });

      await checkoutHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "O plano Founder é exclusivo para contas autorizadas."
      });
    });

    it("deve impedir checkout Founder para salão existente se conta não autorizada (retornar 403)", async () => {
      const req: any = { 
        method: "POST", 
        body: { salonId: "salon_exists", planId: "founder" } 
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123" } as any);
      mockSalonGet.mockResolvedValueOnce({ 
        exists: true, 
        data: () => ({ plan: "start", founderAuthorized: false }) 
      });
      vi.mocked(canManageBilling).mockResolvedValueOnce({ authorized: true, role: "owner" });

      await checkoutHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "O plano Founder é exclusivo para contas autorizadas."
      });
    });

    it("deve permitir checkout Founder se salão autorizado (founderAuthorized === true)", async () => {
      const req: any = { 
        method: "POST", 
        body: { salonId: "salon_exists", planId: "founder" } 
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123" } as any);
      mockSalonGet.mockResolvedValueOnce({ 
        exists: true, 
        data: () => ({ plan: "start", founderAuthorized: true }) 
      });
      vi.mocked(canManageBilling).mockResolvedValueOnce({ authorized: true, role: "owner" });

      await checkoutHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("deve permitir checkout Founder se usuário for platform_admin", async () => {
      const req: any = { 
        method: "POST", 
        body: { salonId: "salon_exists", planId: "founder" } 
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123" } as any);
      mockSalonGet.mockResolvedValueOnce({ 
        exists: true, 
        data: () => ({ plan: "start" }) 
      });
      vi.mocked(canManageBilling).mockResolvedValueOnce({ authorized: true, role: "platform_admin" });

      await checkoutHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it("deve restringir salão inexistente a somente checkoutPurpose 'new_subscription' (retornar 400)", async () => {
      const req: any = { 
        method: "POST", 
        body: { salonId: "salon_new", planId: "start", checkoutPurpose: "activate_recurring" } 
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123" } as any);
      mockSalonGet.mockResolvedValueOnce({ exists: false });

      await checkoutHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Para novos salões, o checkoutPurpose deve ser 'new_subscription'."
      });
    });

    it("deve restringir salão inexistente a somente planos permitidos (start/performance/network/enterprise)", async () => {
      const req: any = { 
        method: "POST", 
        body: { salonId: "salon_new", planId: "invalid_plan", checkoutPurpose: "new_subscription" } 
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123" } as any);

      await checkoutHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "O plano especificado é inválido."
      });
    });

    it("deve validar canManageBilling para salão existente", async () => {
      const req: any = { 
        method: "POST", 
        body: { salonId: "salon_exists", planId: "start" } 
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123" } as any);
      mockSalonGet.mockResolvedValueOnce({ 
        exists: true, 
        data: () => ({ plan: "start" }) 
      });
      vi.mocked(canManageBilling).mockResolvedValueOnce({ authorized: false, reason: "Acesso Negado" });

      await checkoutHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Acesso Negado"
      });
    });

    it("activate_recurring: deve validar que conta é manual ativo", async () => {
      const req: any = { 
        method: "POST", 
        body: { salonId: "salon_exists", planId: "start", checkoutPurpose: "activate_recurring" } 
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123" } as any);
      mockSalonGet.mockResolvedValueOnce({ 
        exists: true, 
        data: () => ({ plan: "start", billingProvider: "cakto", subscriptionStatus: "active" }) 
      });
      vi.mocked(canManageBilling).mockResolvedValueOnce({ authorized: true, role: "owner" });

      await checkoutHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "Apenas contas com plano manual ativo podem ativar a recorrência."
      });
    });
  });

  describe("update-payment-method.ts", () => {
    it("deve retornar exige suporte assistido imediatamente ao tentar alterar método de pagamento", async () => {
      const req: any = { 
        method: "POST", 
        body: { salonId: "salon_123", paymentMethod: "credit_card" } 
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123" } as any);
      mockSalonGet.mockResolvedValueOnce({ 
        exists: true, 
        data: () => ({ plan: "start" }) 
      });
      vi.mocked(canManageBilling).mockResolvedValueOnce({ authorized: true, role: "owner" });

      await updatePaymentHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        requiresSupport: true,
        message: "A alteração desta forma de pagamento requer configuração assistida pela equipe financeira."
      });
    });
  });
});
