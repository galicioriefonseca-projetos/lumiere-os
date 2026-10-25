import { useLexicon } from './useLexicon';

export const useLumiLexicon = () => {
  const { lexicon } = useLexicon();
  return lexicon;
};
