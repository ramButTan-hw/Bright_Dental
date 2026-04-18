import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../styles/FAQPage.css';

export default function FAQPage() {
  useEffect(() => { document.title = 'FAQ | Bright Dental'; }, []);
  return (
    <section className="faq-page">
      <div className="faq-container">
        <h1 className="faq-title">FAQ</h1>
        <p className="faq-intro">Frequently asked questions about booking and visit information.</p>

        <div className="faq-entry">
          <h3 className="faq-entry__question">How do I book an appointment?</h3>
          <p className="faq-entry__answer">Click Book Online from the top banner or the CTA section. You will be directed to our registration page and confirmed by a coordinator.</p>
        </div>

        <div className="faq-entry">
          <h3 className="faq-entry__question">Can I call directly?</h3>
          <p className="faq-entry__answer">Yes. Tap Call in the header or CTA (832) 461-3355 to reach our scheduling desk immediately.</p>
        </div>

        <div className="faq-entry">
          <h3 className="faq-entry__question">Is same-day care available?</h3>
          <p className="faq-entry__answer">Depending on availability, we do offer same-day or next-day appointments. Call the number on the site for fastest support.</p>
        </div>

        <div className="faq-entry">
          <h3 className="faq-entry__question">Do you accept my dental insurance?</h3>
          <p className="faq-entry__answer">We accept most major PPO insurance plans. Since every plan is different, we recommend calling us at (713) 555-0199 with your provider information so we can verify your coverage before your visit.</p>
        </div>

        <div className="faq-entry">
          <h3 className="faq-entry__question">What should I bring to my first appointment?</h3>
          <p className="faq-entry__answer">Please bring a valid photo ID, your insurance card, and any recent dental X-rays if you have them. To save time, you can also fill out our New Patient Forms online <Link to="/patient-registration">here</Link>.</p>
        </div>
      </div>
    </section>
  );
}
