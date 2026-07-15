import { useState, useEffect, useCallback, useMemo } from 'react';
import { LumiIntelligenceEngine } from '../engine/LumiIntelligenceEngine';
import { GeminiProvider } from '../providers/GeminiProvider';
import { OpenAIProvider } from '../providers/OpenAIProvider';
import { MockProvider } from '../providers/MockProvider';
import { 
  BusinessContext, 
  BusinessMetric, 
  HealthScore, 
  Insight, 
  Recommendation, 
  Alert 
} from '../types';

export type SupportedProvider = 'gemini' | 'openai' | 'mock';

export function getLumiProviderType(): SupportedProvider {
  const enableDemoData = import.meta.env.VITE_ENABLE_DEMO_DATA === 'true';
  if (enableDemoData) {
    return 'mock';
  }
  return 'gemini';
}

export function useLumi(salonId: string | undefined) {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [context, setContext] = useState<BusinessContext | null>(null);
  const [metrics, setMetrics] = useState<BusinessMetric | null>(null);
  const [healthScore, setHealthScore] = useState<HealthScore | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [aiNarrative, setAiNarrative] = useState<string>('');
  
  // Track selected provider in local state
  const [providerType, setProviderType] = useState<SupportedProvider>(getLumiProviderType());

  // Instantiate the engine with the memoized selected provider
  const engine = useMemo(() => {
    let selectedProvider;
    switch (providerType) {
      case 'gemini':
        selectedProvider = new GeminiProvider();
        break;
      case 'openai':
        selectedProvider = new OpenAIProvider();
        break;
      case 'mock':
      default:
        selectedProvider = new MockProvider();
        break;
    }
    return new LumiIntelligenceEngine(selectedProvider);
  }, [providerType]);

  /**
   * Triggers the full intelligence processing pipeline.
   */
  const runAnalysis = useCallback(async () => {
    if (!salonId) return;

    setLoading(true);
    setError(null);

    try {
      const results = await engine.runFullAnalysis(salonId);
      
      setContext(results.context);
      setMetrics(results.metrics);
      setHealthScore(results.healthScore);
      setAlerts(results.alerts);
      setInsights(results.insights);
      setRecommendations(results.recommendations);
      setAiNarrative(results.aiNarrative);
    } catch (err: any) {
      console.error('[useLumi] Error running Lumi engine analysis:', err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [salonId, engine]);

  // Re-run analysis automatically when the salonId or provider change
  useEffect(() => {
    if (salonId) {
      runAnalysis();
    }
  }, [salonId, providerType, runAnalysis]);

  /**
   * Switches the active AI provider
   */
  const switchProvider = useCallback((type: SupportedProvider) => {
    const enableDemoData = import.meta.env.VITE_ENABLE_DEMO_DATA === 'true';
    if (type === 'mock' && !enableDemoData) {
      console.warn('[useLumi] Mock provider is disabled in this environment.');
      return;
    }
    setProviderType(type);
    console.log(`[useLumi] Switched AI provider to: ${type}`);
  }, []);

  return {
    loading,
    error,
    context,
    metrics,
    healthScore,
    alerts,
    insights,
    recommendations,
    aiNarrative,
    runAnalysis,
    activeProvider: engine.getProvider().name,
    providerType,
    switchProvider
  };
}
