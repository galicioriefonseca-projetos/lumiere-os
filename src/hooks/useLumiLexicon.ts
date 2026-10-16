import { useAuth } from '../contexts/AuthContext';
import { detectBusinessSegment, SEGMENTS } from '../config/segments';

export const useLumiLexicon = () => {
  const { salonData } = useAuth();
  
  const segment = detectBusinessSegment(salonData);
  const cfg = SEGMENTS[segment] || SEGMENTS.beauty;
  
  return cfg.lexicon;
};
