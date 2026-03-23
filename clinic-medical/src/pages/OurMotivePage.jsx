import { useState } from 'react';
 
function OurMotivePage() {
  const [hoveredCard, setHoveredCard] = useState(null);
 
  const values = [
    {
      title: 'Patient-First Care',
      description:
        'Every decision we make starts with one question — how does this benefit the patient? From flexible scheduling to transparent pricing, your comfort and wellbeing drive everything we do.',
      icon: '🤝',
    },
    {
      title: 'Accessible Dentistry',
      description:
        'Quality dental care should never be out of reach. We work with a wide range of insurance plans and offer affordable options to ensure every smile gets the attention it deserves.',
      icon: '🌍',
    },
    {
      title: 'Modern Technology',
      description:
        'We invest in the latest dental technology so our patients receive faster, safer, and more comfortable treatments — from digital X-rays to advanced sterilization systems.',
      icon: '🔬',
    },
    {
      title: 'Community Impact',
      description:
        "Bright Dental is more than a practice — it's a neighbor. We actively participate in community health drives, school education programs, and free screening events.",
      icon: '💚',
    },
  ];
 
  const milestones = [
    { number: '10+', label: 'Years of Service' },
    { number: '25K+', label: 'Patients Treated' },
    { number: '15+', label: 'Skilled Professionals' },
    { number: '99%', label: 'Patient Satisfaction' },
  ];
 
  return (
    <main style={{ paddingTop: '90px', minHeight: '100vh', background: '#f7faf9' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 1.5rem 4rem' }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p
            style={{
              color: '#005050',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              fontSize: '0.85rem',
              marginBottom: '0.5rem',
            }}
          >
            Why We Do What We Do
          </p>
          <h1
            style={{
              fontSize: '2.25rem',
              fontWeight: 800,
              color: '#181c1c',
              margin: 0,
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            Our Motive
          </h1>
          <p
            style={{
              color: '#3e4948',
              marginTop: '0.75rem',
              fontSize: '1.05rem',
              maxWidth: 600,
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            At Bright Dental, we believe everyone deserves a healthy, confident smile. Our
            mission is to deliver compassionate, high-quality dental care that puts patients
            first — every single time.
          </p>
        </div>
 
        {/* Mission Statement Banner */}
        <div
          style={{
            background: 'linear-gradient(135deg, #005050, #006a6a)',
            borderRadius: '12px',
            padding: '2.5rem 2rem',
            color: '#fff',
            textAlign: 'center',
            marginBottom: '2.5rem',
            boxShadow: '0 4px 16px rgba(0,80,80,0.25)',
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: '1.4rem',
              fontWeight: 700,
              fontFamily: "'Manrope', sans-serif",
            }}
          >
            "Your Smile, Our Priority"
          </h2>
          <p
            style={{
              margin: '0.75rem auto 0',
              maxWidth: 650,
              fontSize: '1rem',
              opacity: 0.9,
              lineHeight: 1.7,
            }}
          >
            Founded on the principle that dental care should be approachable, affordable, and
            exceptional, Bright Dental has grown into a trusted name across multiple communities.
            We combine clinical excellence with genuine compassion to create an experience our
            patients look forward to.
          </p>
        </div>
 
        {/* Core Values */}
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#005050',
            borderBottom: '3px solid #84d4d3',
            paddingBottom: '0.5rem',
            marginBottom: '1.5rem',
            fontFamily: "'Manrope', sans-serif",
          }}
        >
          Our Core Values
        </h2>
 
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2.5rem',
          }}
        >
          {values.map((value, idx) => (
            <div
              key={idx}
              style={{
                background: '#fff',
                borderRadius: '12px',
                boxShadow:
                  hoveredCard === idx
                    ? '0 8px 24px rgba(0,0,0,0.13)'
                    : '0 2px 8px rgba(0,0,0,0.07)',
                transform: hoveredCard === idx ? 'translateY(-3px)' : 'translateY(0)',
                overflow: 'hidden',
                transition: 'box-shadow 0.25s, transform 0.25s',
              }}
              onMouseEnter={() => setHoveredCard(idx)}
              onMouseLeave={() => setHoveredCard(null)}
            >
              {/* Header bar */}
              <div
                style={{
                  background: 'linear-gradient(135deg, #005050, #006a6a)',
                  padding: '1rem 1.25rem',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.65rem',
                }}
              >
                <span style={{ fontSize: '1.5rem' }}>{value.icon}</span>
                <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                  {value.title}
                </h3>
              </div>
 
              {/* Body */}
              <div style={{ padding: '1.25rem' }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: '0.95rem',
                    color: '#3e4948',
                    lineHeight: 1.65,
                  }}
                >
                  {value.description}
                </p>
              </div>
            </div>
          ))}
        </div>
 
        {/* Milestones */}
        <h2
          style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#005050',
            borderBottom: '3px solid #84d4d3',
            paddingBottom: '0.5rem',
            marginBottom: '1.5rem',
            fontFamily: "'Manrope', sans-serif",
          }}
        >
          By the Numbers
        </h2>
 
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: '1.25rem',
            marginBottom: '2.5rem',
          }}
        >
          {milestones.map((item, idx) => (
            <div
              key={idx}
              style={{
                background: '#fff',
                borderRadius: '12px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
                padding: '1.75rem 1rem',
                textAlign: 'center',
              }}
            >
              <p
                style={{
                  margin: 0,
                  fontSize: '2rem',
                  fontWeight: 800,
                  color: '#005050',
                  fontFamily: "'Manrope', sans-serif",
                }}
              >
                {item.number}
              </p>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.92rem', color: '#3e4948' }}>
                {item.label}
              </p>
            </div>
          ))}
        </div>
 
        {/* Bottom CTA */}
        <div
          style={{
            marginTop: '1rem',
            textAlign: 'center',
            padding: '2rem',
            background: '#fff',
            borderRadius: '12px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: '1.25rem',
              fontWeight: 700,
              color: '#181c1c',
            }}
          >
            Join the Bright Dental Family
          </h3>
          <p
            style={{
              color: '#3e4948',
              margin: '0.5rem 0 1.25rem',
              fontSize: '0.95rem',
            }}
          >
            Experience the difference that patient-centered care makes. Schedule your first
            visit today.
          </p>
          <a
            href="/patient-registration"
            style={{
              display: 'inline-block',
              background: '#005050',
              color: '#fff',
              padding: '0.75rem 2rem',
              borderRadius: '0.75rem',
              fontWeight: 700,
              textDecoration: 'none',
              fontSize: '1rem',
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#006a6a';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#005050';
            }}
          >
            Book Appointment
          </a>
        </div>
      </div>
    </main>
  );
}
 
export default OurMotivePage;