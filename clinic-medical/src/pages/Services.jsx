import '../styles/Services.css';

export default function Services() {
  const services = [
    {
      title: 'PROFESSIONAL CLEANING',
      description: 'Professional cleanings to maintain healthy teeth and gums.',
      icon: '✨'
    },
    {
      title: 'TEETH WHITENING',
      description: 'Brighten your smile with safe and effective whitening.',
      icon: '💎'
    },
    {
      title: 'DENTAL IMPLANTS',
      description: 'Permanent solutions for missing teeth.',
      icon: '🦷'
    },
    {
      title: 'INVISALIGN',
      description: 'Straighten your teeth with clear aligners.',
      icon: '✓'
    },
    {
      title: 'EMERGENCY CARE',
      description: 'Fast treatment when you need urgent dental care.',
      icon: '⚡'
    },
    {
      title: 'COSMETIC DENTISTRY',
      description: 'Enhance your smile with modern cosmetic treatments.',
      icon: '🎨'
    }
  ];

  return (
    <section className="services-section">
      <div className="services-background"></div>
      
      <div className="services-container">
        <div className="services-header">
          <h1 className="services-main-title">OUR DENTAL SERVICES</h1>
          <p className="services-tagline">Comprehensive dental care tailored for your comfort and confidence.</p>
        </div>

        <div className="services-grid">
          {services.map((service, index) => (
            <div key={index} className="service-card">
              <div className="service-icon-wrapper">
                <div className="service-icon">{service.icon}</div>
              </div>
              <h3 className="service-title">{service.title}</h3>
              <p className="service-description">{service.description}</p>
              <div className="service-flourish"></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
