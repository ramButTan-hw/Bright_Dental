import '../styles/Services.css';

export default function Services() {
  const services = [
    {
      title: 'GENERAL DENTISTRY',
      description: 'Routine dental care including exams, cleanings, and fillings.',
      marker: 'GD'
    },
    {
      title: 'ORTHODONTICS',
      description: 'Teeth alignment and bite correction including braces and aligners.',
      marker: 'OR'
    },
    {
      title: 'PERIODONTICS',
      description: 'Prevention, diagnosis, and treatment of gum diseases.',
      marker: 'PE'
    },
    {
      title: 'ENDODONTICS',
      description: 'Root canal therapy and treatments of dental pulp.',
      marker: 'EN'
    },
    {
      title: 'ORAL SURGERY',
      description: 'Surgical procedures including extractions and implants.',
      marker: 'OS'
    },
    {
      title: 'PEDIATRIC DENTISTRY',
      description: 'Dental care for children and adolescents.',
      marker: 'PD'
    },
    {
      title: 'PROSTHODONTICS',
      description: 'Crowns, bridges, dentures, and dental prosthetics.',
      marker: 'PR'
    },
    {
      title: 'COSMETIC DENTISTRY',
      description: 'Teeth whitening, veneers, and aesthetic procedures.',
      marker: 'CD'
    }
  ];

  return (
    <section className="services-section">
      <div className="services-background"></div>
      
      <div className="services-container">
        <div className="services-header">
          <h1 className="services-main-title">OUR DEPARTMENTS</h1>
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
