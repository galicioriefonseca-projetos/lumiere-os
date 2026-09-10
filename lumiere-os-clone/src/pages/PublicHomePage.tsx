import LandingPage from './LandingPage';
import PricingPage from './PricingPage';

export default function PublicHomePage() {
  return (
    <>
      <LandingPage />
      <section id="planos-publicos" aria-label="Planos LumièreOS">
        <PricingPage />
      </section>
    </>
  );
}
