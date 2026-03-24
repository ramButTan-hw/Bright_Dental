import { Link } from 'react-router-dom';

export default function FAQPage() {
  return (
    <section style={{ padding: '60px 20px', minHeight: 'calc(100vh - 120px)', background: '#f8f9fb' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', background: '#fff', borderRadius: '16px', padding: '40px', boxShadow: '0 10px 28px rgba(0, 0, 0, 0.08)' }}>
        <h1 style={{ color: '#0d7377', marginBottom: '12px' }}>FAQ</h1>
        <p style={{ color: '#5a6c7d', marginBottom: '30px' }}>Frequently asked questions about booking and visit information.</p>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 8px', color: '#0b4d55' }}>How do I book an appointment?</h3>
          <p style={{ margin: 0, color: '#4a5960' }}>Click Book Online from the top banner or the CTA section. You will be directed to our registration page and confirmed by a coordinator.</p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 8px', color: '#0b4d55' }}>Can I call directly?</h3>
          <p style={{ margin: 0, color: '#4a5960' }}>Yes. Tap Call in the header or CTA (832) 461-3355 to reach our scheduling desk immediately.</p>
        </div>

        <div>
          <h3 style={{ margin: '0 0 8px', color: '#0b4d55' }}>Is same-day care available?</h3>
          <p style={{ margin: 0, color: '#4a5960' }}>Depending on availability, we do offer same-day or next-day appointments. Call the number on the site for fastest support.</p>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 8px', color: '#0b4d55' }}>Do you accept my dental insurance?</h3>
          <p style={{ margin: 0, color: '#4a5960' }}>We accept most major PPO insurance plans. Since every plan is different, we recommend calling us at (713) 555-0199 with your provider information so we can verify your coverage before your visit.</p>
        </div>

        <div>
          <h3 style={{ margin: '0 0 8px', color: '#0b4d55' }}>What should I bring to my first appointment?</h3>
          <p style={{ margin: 0, color: '#4a5960' }}>Please bring a valid photo ID, your insurance card, and any recent dental X-rays if you have them. To save time, you can also fill out our New Patient Forms online <Link to="/patient-registration">here</Link>.</p>
        </div>
      </div>
    </section>
  );
}
