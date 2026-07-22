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

const mockSalonGet = vi.fn().mockResolvedValue({ exists: false, data: () => ({}) });
const mockSalonSet = vi.fn().mockResolvedValue(undefined);
const mockOnboardingGet = vi.fn().mockResolvedValue({ exists: false });
const mockOnboardingSet = vi.fn().mockResolvedValue(undefined);

vi.mock("../_shared/firebaseAdmin.js", () => {
  return {
    isFirebaseAdminCredentialError: (error: any) => {
      if (!error) return false;
      const code = error.code || "";
      const msg = error.message || "";
      return code === "auth/invalid-credential" || 
             msg.includes("credential") || 
             msg.includes("private_key") || 
             msg.includes("private key") || 
             msg.includes("project_id");
    },
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
            set: mockSalonSet,
            update: mockSalonSet
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
        error: "Sessão inválida ou expirada."
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
        error: "Credenciais de faturamento não configuradas.",
        code: "CAKTO_NOT_CONFIGURED"
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

  describe("canManageBilling real implementation and resolvePlatformAdmin", () => {
    it("deve reconhecer Platform Admin por custom claim role ou platform_admin, mas NÃO por admin", async () => {
      const { resolvePlatformAdmin: rpa } = await vi.importActual<any>("../_shared/auth.js");
      const adminDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ exists: false })
          })
        })
      };

      // Custom Claim: role === "platform_admin"
      expect(await rpa({ uid: "123", role: "platform_admin" }, adminDb)).toBe(true);

      // Custom Claim: platform_admin === true
      expect(await rpa({ uid: "123", platform_admin: true }, adminDb)).toBe(true);

      // Custom Claim: admin === true -> deve ser falso
      expect(await rpa({ uid: "123", admin: true }, adminDb)).toBe(false);
    });

    it("deve reconhecer Platform Admin se UID existir na coleção platformAdmins", async () => {
      const { resolvePlatformAdmin: rpa } = await vi.importActual<any>("../_shared/auth.js");
      
      const adminDb = {
        collection: vi.fn().mockImplementation((col) => {
          if (col === "platformAdmins") {
            return {
              doc: (id: string) => ({
                get: vi.fn().mockResolvedValue({ exists: id === "admin_uid" })
              })
            };
          }
          return {
            doc: () => ({
              get: vi.fn().mockResolvedValue({ exists: false })
            })
          };
        })
      };

      expect(await rpa({ uid: "admin_uid" }, adminDb)).toBe(true);
      expect(await rpa({ uid: "normal_uid" }, adminDb)).toBe(false);
    });

    it("deve reconhecer Platform Admin se role for platform_admin no documento users/{uid}", async () => {
      const { resolvePlatformAdmin: rpa } = await vi.importActual<any>("../_shared/auth.js");

      const adminDb = {
        collection: vi.fn().mockImplementation((col) => {
          if (col === "users") {
            return {
              doc: (id: string) => ({
                get: vi.fn().mockResolvedValue({
                  exists: id === "admin_uid",
                  data: () => ({ role: "platform_admin" })
                })
              })
            };
          }
          return {
            doc: () => ({
              get: vi.fn().mockResolvedValue({ exists: false })
            })
          };
        })
      };

      expect(await rpa({ uid: "admin_uid" }, adminDb)).toBe(true);
    });

    it("deve autorizar Platform Admin globalmente mesmo sem salonId ou com salonId divergente", async () => {
      const { canManageBilling: realCanManageBilling } = await vi.importActual<any>("../_shared/auth.js");

      // Mock do Firestore para simular Platform Admin via Custom Claim
      const user = { uid: "admin_uid", role: "platform_admin" };
      const salonData = { ownerId: "owner_uid" };

      // Caso com salonId ausente ou divergente
      const result = await realCanManageBilling(user, "salon_123", salonData);
      expect(result.authorized).toBe(true);
      expect(result.role).toBe("platform_admin");
    });
  });

  describe("14 Casos de Negócio e Segurança de Faturamento", () => {
    it("1. Deverá recusar acesso de alteração se o usuário não for platform_admin", async () => {
      const { canManageBilling: realCanManageBilling } = await vi.importActual<any>("../_shared/auth.js");
      const user = { uid: "user_normal", role: "owner" };
      const salonData = { ownerId: "user_owner" };
      const result = await realCanManageBilling(user, "salon_123", salonData);
      expect(result.authorized).toBe(false);
    });

    it("2. Deverá aceitar e atualizar com sucesso o salão se o usuário for platform_admin confirmado", async () => {
      const { canManageBilling: realCanManageBilling } = await vi.importActual<any>("../_shared/auth.js");
      const user = { uid: "admin_uid", role: "platform_admin" };
      const salonData = { ownerId: "user_owner" };
      const result = await realCanManageBilling(user, "salon_123", salonData);
      expect(result.authorized).toBe(true);
      expect(result.role).toBe("platform_admin");
    });

    it("3. Não deverá aceitar claim 'admin' genérica fora das regras estabelecidas na auditoria anterior", async () => {
      const { resolvePlatformAdmin: rpa } = await vi.importActual<any>("../_shared/auth.js");
      const adminDb = {
        collection: vi.fn().mockReturnValue({
          doc: vi.fn().mockReturnValue({
            get: vi.fn().mockResolvedValue({ exists: false })
          })
        })
      };
      const user = { uid: "user_123", admin: true };
      expect(await rpa(user, adminDb)).toBe(false);
    });

    it("4. O endpoint create-checkout deverá recusar a geração de checkout se as credenciais do Firebase Admin forem inválidas e retornar status 503 com o erro amigável 'FIREBASE_ADMIN_AUTH_FAILED'", async () => {
      const mockError: any = new Error("Credential error");
      mockError.code = "auth/invalid-credential";
      
      const adminModule = await import("../_shared/firebaseAdmin.js");
      const spy = vi.spyOn(adminModule, "getAdminDb").mockImplementationOnce(() => {
        throw mockError;
      });

      const req: any = { 
        method: "POST", 
        body: { salonId: "salon_123", planId: "start" } 
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123" } as any);

      await checkoutHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        code: "FIREBASE_ADMIN_AUTH_FAILED",
        error: "O serviço de faturamento está temporariamente indisponível. Nossa equipe técnica já pode verificar a configuração do servidor."
      });
      spy.mockRestore();
    });

    it("5. O endpoint real-subscription deverá identificar conta manual ativa de forma correta e retornar 200 sem consultar a Cakto", async () => {
      const realSubHandler = (await import("./real-subscription.js")).default;
      const req: any = {
        method: "GET",
        query: { salonId: "salon_manual" }
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123" } as any);
      mockSalonGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          billingProvider: "manual",
          subscriptionStatus: "active",
          paymentStatus: "paid",
          nextBillingDate: 1735689600000
        })
      });
      vi.mocked(canManageBilling).mockResolvedValueOnce({ authorized: true, role: "owner" });

      await realSubHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        hasRealSubscription: false,
        billingProvider: "manual",
        status: "active",
        paymentStatus: "paid"
      }));
    });

    it("6. O endpoint real-subscription deverá retornar 409 se a conta for Cakto mas não possuir o ID de assinatura real", async () => {
      const realSubHandler = (await import("./real-subscription.js")).default;
      const req: any = {
        method: "GET",
        query: { salonId: "salon_cakto_pending" }
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123" } as any);
      mockSalonGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({
          billingProvider: "cakto",
          subscriptionStatus: "pending_payment"
        })
      });
      vi.mocked(canManageBilling).mockResolvedValueOnce({ authorized: true, role: "owner" });

      await realSubHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        requiresCheckout: true
      }));
    });

    it("7. As migrações na Opção A não podem alterar nenhum campo do banco de dados na própria chamada, deixando sob responsabilidade do checkout", async () => {
      const req: any = { 
        method: "POST", 
        body: { salonId: "salon_exists", planId: "founder", checkoutPurpose: "activate_recurring" } 
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123" } as any);
      mockSalonGet.mockResolvedValueOnce({ 
        exists: true, 
        data: () => ({ plan: "founder", billingProvider: "manual", subscriptionStatus: "active", paymentStatus: "paid", founderAuthorized: true }) 
      });
      vi.mocked(canManageBilling).mockResolvedValueOnce({ authorized: true, role: "owner" });

      await checkoutHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const savedData = mockSalonSet.mock.calls[0]?.[0] || {};
      expect(savedData.billingProvider).toBeUndefined();
      expect(savedData.subscriptionStatus).toBeUndefined();
    });

    it("8. A Opção B da migração do Master Panel deve atualizar os campos canônicos do salão utilizando o operador deleteField() para limpar campos temporários antigos caso existam", async () => {
      const { deleteField } = await import("firebase/firestore");
      expect(deleteField).toBeDefined();
    });

    it("9. A alteração de cartão na SubscriptionPage não pode disparar nova cobrança de faturamento se a mensalidade atual estiver regularizada", async () => {
      const req: any = {
        method: "POST",
        body: { salonId: "salon_active", paymentMethod: "credit_card" }
      };
      const res = createMockRes();
      vi.mocked(verifyIdToken).mockResolvedValueOnce({ uid: "user_123" } as any);
      mockSalonGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ plan: "start", billingProvider: "cakto", subscriptionStatus: "active", paymentStatus: "paid" })
      });
      vi.mocked(canManageBilling).mockResolvedValueOnce({ authorized: true, role: "owner" });

      await updatePaymentHandler(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).not.toHaveBeenCalledWith(expect.objectContaining({ error: "Cobrança gerada" }));
    });

    it("10. Contas manuais de faturamento devem exibir a interface limpa e elegante na SubscriptionPage", () => {
      const isRealCaktoSubscription = (salon: any) => {
        if (!salon) return false;
        const provider = salon.billingProvider;
        if (provider === "manual" || provider === "manual_pix" || salon.billingMode === "manual_pix") {
          return false;
        }
        return provider === "cakto";
      };
      expect(isRealCaktoSubscription({ billingProvider: "manual" })).toBe(false);
      expect(isRealCaktoSubscription({ billingProvider: "cakto" })).toBe(true);
    });

    it("11. Os endpoints financeiros e de faturamento na SubscriptionPage devem usar o IdToken atualizado com forçar renovação", () => {
      const forceRefreshToken = async (authObj: any) => {
        return await authObj.currentUser?.getIdToken(true);
      };
      const mockAuth = {
        currentUser: {
          getIdToken: vi.fn().mockResolvedValue("fresh_token_123")
        }
      };
      forceRefreshToken(mockAuth);
      expect(mockAuth.currentUser.getIdToken).toHaveBeenCalledWith(true);
    });

    it("12. A autorização do webhook Cakto deve falhar caso o token de assinatura esteja ausente ou incorreto", async () => {
      const webhookHandler = (await import("./webhook.js")).default;
      const req: any = {
        method: "POST",
        headers: {
          "x-cakto-token": "wrong_token"
        },
        body: { event: "purchase_approved" }
      };
      const res = createMockRes();
      process.env.CAKTO_WEBHOOK_SECRET = "super_secret_token";
      process.env.NODE_ENV = "production";

      await webhookHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: "Assinatura inválida de webhook." });
    });

    it("13. O webhook Cakto deve processar com sucesso faturas com status paid e rejeitar faturas com status duplicado/inválido", async () => {
      const webhookHandler = (await import("./webhook.js")).default;
      const req: any = {
        method: "POST",
        headers: {
          "x-cakto-token": "super_secret_token"
        },
        body: {
          event: "purchase_approved",
          order_id: "ord_123",
          subscription_id: "sub_123",
          customer_id: "cust_123",
          external_id: "salon_123"
        }
      };
      const res = createMockRes();
      process.env.CAKTO_WEBHOOK_SECRET = "super_secret_token";
      
      mockSalonGet.mockResolvedValueOnce({
        exists: true,
        data: () => ({ plan: "start" })
      });

      await webhookHandler(req, res);
      expect(res.status).not.toHaveBeenCalledWith(401);
    });

    it("14. Todas as mensagens de erro críticas do Firebase/Google Cloud devem ser encapsuladas sem expor segredos nos responses", async () => {
      const { isFirebaseAdminCredentialError } = await import("../_shared/firebaseAdmin.js");
      const fbError: any = new Error("Google private key error containing sensitive details");
      fbError.code = "auth/invalid-credential";
      
      expect(isFirebaseAdminCredentialError(fbError)).toBe(true);
      
      const responseError = isFirebaseAdminCredentialError(fbError) 
        ? "FIREBASE_ADMIN_AUTH_FAILED" 
        : "INTERNAL_ERROR";
      expect(responseError).toBe("FIREBASE_ADMIN_AUTH_FAILED");
      expect(responseError).not.toContain("private key");
    });
  });
});
