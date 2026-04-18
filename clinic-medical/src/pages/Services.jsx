import '../styles/Services.css';

export default function Services() {
  const services = [
    {
      title: 'PROFESSIONAL CLEANING',
      description: 'Professional cleanings to maintain healthy teeth and gums.',
      marker: 'CL'
    },
    {
      title: 'TEETH WHITENING',
      description: 'Brighten your smile with safe and effective whitening.',
      marker: 'WH'
    },
    {
      title: 'DENTAL IMPLANTS',
      description: 'Permanent solutions for missing teeth.',
      marker: 'IM'
    },
    {
      title: 'INVISALIGN',
      description: 'Straighten your teeth with clear aligners.',
      marker: 'IN'
    },
    {
      title: 'EMERGENCY CARE',
      description: 'Fast treatment when you need urgent dental care.',
      marker: 'ER'
    },
    {
      title: 'COSMETIC DENTISTRY',
      description: 'Enhance your smile with modern cosmetic treatments.',
      marker: 'CD'
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
                <div className="service-icon" aria-hidden="true">{service.marker}</div>
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
