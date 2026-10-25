import { getAuth } from 'firebase/auth';
import { ContextConfig, NicheType, VocabularyConfig, UiPreferences } from '../types';

async function getAuthHeader(): Promise<Record<string, string>> {
  const auth = getAuth();
  const token = await auth.currentUser?.getIdToken();
  if (!token) {
    throw new Error('Usuário não autenticado.');
  }
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
}

export const ContextConfigService = {
  /**
   * Obtém os modelos padrão de vocabulário e preferências para cada nicho
   */
  async getNicheTemplates(): Promise<Record<NicheType, Omit<ContextConfig, 'updatedAt'>>> {
    const res = await fetch('/api/context-config/templates');
    if (!res.ok) {
      throw new Error('Falha ao carregar modelos de nicho');
    }
    const data = await res.json();
    return data.templates;
  },

  /**
   * Obtém a configuração de contexto atual do salão/empresa autenticada
   */
  async getContextConfig(): Promise<ContextConfig> {
    const headers = await getAuthHeader();
    const res = await fetch('/api/context-config', { headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao buscar configuração de contexto');
    }
    const data = await res.json();
    return data.contextConfig;
  },

  /**
   * Inicializa o contexto no final do onboarding e persiste no Firestore
   */
  async initializeContextConfig(
    niche?: NicheType,
    customOverrides?: Partial<VocabularyConfig>,
    customPreferences?: Partial<UiPreferences>
  ): Promise<ContextConfig> {
    const headers = await getAuthHeader();
    const res = await fetch('/api/context-config/initialize', {
      method: 'POST',
      headers,
      body: JSON.stringify({ niche, customOverrides, customPreferences })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao inicializar contexto do nicho');
    }
    const data = await res.json();
    return data.contextConfig;
  },

  /**
   * Atualiza as configurações de vocabulário e preferências de UI
   */
  async updateContextConfig(payload: {
    niche?: NicheType;
    customOverrides?: Partial<VocabularyConfig>;
    uiPreferences?: Partial<UiPreferences>;
  }): Promise<ContextConfig> {
    const headers = await getAuthHeader();
    const res = await fetch('/api/context-config', {
      method: 'PUT',
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Falha ao atualizar vocabulário');
    }
    const data = await res.json();
    return data.contextConfig;
  }
};
