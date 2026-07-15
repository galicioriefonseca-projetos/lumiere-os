import { describe, it, expect, vi, beforeEach } from "vitest";

// Mocks do Firestore estruturados para diferenciar "settings", "salons" e "onboarding"
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
const mockOnboardingGet = vi.fn().mockResolvedValue({ exists: false });
const mockOnboardingSet = vi.fn();

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
        if (colName === "onboarding") {
          return {
            doc: () => ({
              get: mockOnboardingGet,
              set: mockOnboardingSet
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
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyIdToken).mockReset();
    vi.mocked(canManageBilling).mockReset();
    process.env = { ...originalEnv };
    process.env.CAKTO_SANDBOX_MODE = "true"; // Ativar simulação por padrão nos testes
    mockOnboardingGet.mockResolvedValue({ exists: false });
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

    // 9. Ordem de busca de e-mail: Preferir billingEmail
    it("deve preferir billingEmail quando determinado o e-mail de cobrança para salão existente", async () => {
      const req: any = { 
        method: "POST", 
        body: { salonId: "salon_exists", planId: "start", email: "extra@test.com" } 
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123", email: "user@test.com" } as any);
      mockSalonGet.mockResolvedValueOnce({ 
        exists: true, 
        data: () => ({ plan: "start", ownerEmail: "owner@test.com", billingEmail: "billing@test.com" }) 
      });
      vi.mocked(canManageBilling).mockResolvedValueOnce({ authorized: true, role: "owner" });

      await checkoutHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockSalonSet).toHaveBeenCalledWith(
        expect.objectContaining({
          pendingCheckoutEmail: "billing@test.com"
        }),
        { merge: true }
      );
    });

    // 10. Ordem de busca de e-mail: Usar e-mail informado se billingEmail não existir
    it("deve usar o e-mail informado quando billingEmail não existir para salão existente", async () => {
      const req: any = { 
        method: "POST", 
        body: { salonId: "salon_exists", planId: "start", email: "extra@test.com" } 
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123", email: "user@test.com" } as any);
      mockSalonGet.mockResolvedValueOnce({ 
        exists: true, 
        data: () => ({ plan: "start", ownerEmail: "owner@test.com" }) 
      });
      vi.mocked(canManageBilling).mockResolvedValueOnce({ authorized: true, role: "owner" });

      await checkoutHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockSalonSet).toHaveBeenCalledWith(
        expect.objectContaining({
          pendingCheckoutEmail: "extra@test.com"
        }),
        { merge: true }
      );
    });

    // 11. Ordem de busca de e-mail: Usar ownerEmail se billingEmail e e-mail informado não existirem
    it("deve usar o ownerEmail quando billingEmail e email informado não existirem para salão existente", async () => {
      const req: any = { 
        method: "POST", 
        body: { salonId: "salon_exists", planId: "start" } 
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123", email: "user@test.com" } as any);
      mockSalonGet.mockResolvedValueOnce({ 
        exists: true, 
        data: () => ({ plan: "start", ownerEmail: "owner@test.com" }) 
      });
      vi.mocked(canManageBilling).mockResolvedValueOnce({ authorized: true, role: "owner" });

      await checkoutHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockSalonSet).toHaveBeenCalledWith(
        expect.objectContaining({
          pendingCheckoutEmail: "owner@test.com"
        }),
        { merge: true }
      );
    });

    // 12. Ordem de busca de e-mail: Usar user.email como fallback
    it("deve usar user.email como fallback final quando nenhuma outra opção existir para salão existente", async () => {
      const req: any = { 
        method: "POST", 
        body: { salonId: "salon_exists", planId: "start" } 
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123", email: "user@test.com" } as any);
      mockSalonGet.mockResolvedValueOnce({ 
        exists: true, 
        data: () => ({ plan: "start" }) 
      });
      vi.mocked(canManageBilling).mockResolvedValueOnce({ authorized: true, role: "owner" });

      await checkoutHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockSalonSet).toHaveBeenCalledWith(
        expect.objectContaining({
          pendingCheckoutEmail: "user@test.com"
        }),
        { merge: true }
      );
    });

    // 13. Rejeitar simulação se Sandbox/Emulator não estiverem ativos e credenciais Cakto ausentes
    it("deve retornar 503 se simulação for desativada e credenciais da Cakto estiverem ausentes", async () => {
      process.env.CAKTO_SANDBOX_MODE = "false";
      process.env.VITE_CAKTO_SANDBOX_MODE = "false";
      delete process.env.FIRESTORE_EMULATOR_HOST;
      delete process.env.CAKTO_CLIENT_ID;
      delete process.env.CAKTO_CLIENT_SECRET;

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
      vi.mocked(canManageBilling).mockResolvedValueOnce({ authorized: true, role: "owner" });

      await checkoutHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        error: "Credenciais de faturamento não configuradas."
      });
    });

    // 14. Gravação estrita para salão existente: salvar somente campos pending* e updatedAt
    it("deve salvar apenas campos pending* e updatedAt para salão existente, preservando ownerEmail e plano atual", async () => {
      const req: any = { 
        method: "POST", 
        body: { salonId: "salon_exists", planId: "start" } 
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123", email: "user@test.com" } as any);
      mockSalonGet.mockResolvedValueOnce({ 
        exists: true, 
        data: () => ({ plan: "performance", ownerEmail: "owner@test.com" }) 
      });
      vi.mocked(canManageBilling).mockResolvedValueOnce({ authorized: true, role: "owner" });

      await checkoutHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockSalonSet).toHaveBeenCalledOnce();
      
      const savedKeys = Object.keys(mockSalonSet.mock.calls[0][0]);
      const unexpectedKeys = savedKeys.filter(
        key => !key.startsWith("pending") && key !== "updatedAt" && !key.startsWith("homologation")
      );
      
      // Deve salvar apenas pending*, updatedAt ou homologation*
      expect(unexpectedKeys.length).toBe(0);
    });

    // 15. Salvar onboarding com regras estritas: preferir user.email, salvar em onboarding/ e ter ownerId
    it("deve salvar somente em onboarding/{salonId} com ownerId, createdBy, createdAt, updatedAt se salão não existir, preferindo user.email como proprietário", async () => {
      const req: any = { 
        method: "POST", 
        body: { 
          salonId: "salon_new", 
          planId: "start", 
          email: "extra@test.com",
          salonName: "Novo Salão"
        } 
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValue({ uid: "user_123", email: "owner@test.com" } as any);
      mockSalonGet.mockResolvedValueOnce({ exists: false });

      await checkoutHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockOnboardingSet).toHaveBeenCalledOnce();
      
      const savedData = mockOnboardingSet.mock.calls[0][0];
      expect(savedData.ownerEmail).toBe("owner@test.com"); // Prefere user.email como proprietário definitivo
      expect(savedData.pendingCheckoutEmail).toBe("extra@test.com"); // Corpo salvou como pending
      expect(savedData.ownerId).toBe("user_123");
      expect(savedData.createdBy).toBe("user_123");
      expect(savedData.createdAt).toBeDefined();
      expect(savedData.updatedAt).toBeDefined();
    });

    // 16. Impedir sobrescrever onboarding pertencente a outro usuário
    it("deve impedir sobrescrever onboarding se o documento já existir e pertencer a outro usuário", async () => {
      const req: any = { 
        method: "POST", 
        body: { salonId: "salon_new", planId: "start" } 
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123" } as any);
      mockSalonGet.mockResolvedValueOnce({ exists: false });
      mockOnboardingGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ ownerId: "user_different" })
      });
      vi.mocked(canManageBilling).mockResolvedValue({ authorized: false });

      await checkoutHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        error: "Este onboarding pertence a outro usuário."
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
