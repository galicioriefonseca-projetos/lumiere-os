import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { SEGMENTS, detectBusinessSegment, BusinessSegment, SegmentLexicon, SegmentConfig } from '../config/segments';

export function useLexicon() {
  const { salonData } = useAuth();

  const segment: BusinessSegment = useMemo(() => {
    return detectBusinessSegment(salonData);
  }, [salonData?.segment, salonData?.businessType, salonData?.name]);

  const segmentConfig: SegmentConfig = useMemo(() => {
    return SEGMENTS[segment] || SEGMENTS.beauty;
  }, [segment]);

  const lexicon: SegmentLexicon = segmentConfig.lexicon;

  const isModuleEnabled = (moduleId: keyof SegmentConfig['defaultModules']): boolean => {
    if (!salonData) return true;
    if (salonData.enabledModules && typeof salonData.enabledModules[moduleId] === 'boolean') {
      return salonData.enabledModules[moduleId];
    }
    return segmentConfig.defaultModules[moduleId] !== false;
  };

  const t = (key: keyof SegmentLexicon, fallback?: string): string => {
    return lexicon[key] || fallback || key;
  };

  return {
    segment,
    segmentConfig,
    lexicon,
    lex: lexicon,
    t,
    isModuleEnabled,
    isAgency: segment === 'agency',
    isConsulting: segment === 'consulting',
    isHealth: segment === 'health',
    isBeauty: segment === 'beauty'
  };
}
