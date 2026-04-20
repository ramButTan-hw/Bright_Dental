import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/HomePage.css';

function HomePage() {
  const navigate = useNavigate();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      image: '/First.png',
      pitch: 'Clinical Sanctuary',
      description: 'Where high-end medical precision meets restorative serenity.'
    },
    {
      image: '/Second.jpg',
      pitch: 'Precision in Every Smile',
      description: 'Advanced diagnostics and restorative artistry combined.'
    },
    {
      image: '/Third.jpg',
      pitch: 'Your Smile, Our Priority',
      description: 'Experience world-class dental care with our expert team.'
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  return (
    <main className="home-page">
      {/* Hero Slider */}
      <section className="hero-slider">
        <div className="slides-container">
          {slides.map((slide, index) => (
            <div
              key={index}
              className={`slide ${index === currentSlide ? 'active' : ''}`}
              style={{
                backgroundImage: `url('${slide.image}')`,
                backgroundSize: 'cover',
                backgroundPosition: 'center'
              }}
            >
              <div className="slide-overlay"></div>
              <div className="slide-content">
                <h1 className="slide-pitch">{slide.pitch}</h1>
                <p className="slide-description">{slide.description}</p>
                <button className="explore-button" onClick={() => navigate('/meet-our-staff')}>Explore Our Expertise</button>
              </div>
            </div>
          ))}
        </div>

        {/* Slide Controls */}
        <button className="slide-nav slide-prev" onClick={prevSlide}>‹</button>
        <button className="slide-nav slide-next" onClick={nextSlide}>›</button>

        {/* Slide Indicators */}
        <div className="slide-indicators">
          {slides.map((_, index) => (
            <div
              key={index}
              className={`indicator ${index === currentSlide ? 'active' : ''}`}
              onClick={() => setCurrentSlide(index)}
            ></div>
          ))}
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section">
        <div className="cta-content">
          <h2>Experience the Bright Dental Standard</h2>
          <p>Ready to redefine your dental journey? Our coordinators are waiting to assist you.</p>
          <div className="cta-buttons">
            <button className="btn-primary" onClick={() => navigate('/patient-registration')}>Book Online</button>
            <button className="btn-secondary" onClick={() => navigate('/meet-our-staff')}>Call (832) 461-3355</button>
          </div>
          <button className="btn-faq-link" onClick={() => navigate('/faq')}>Frequently Asked Questions</button>
        </div>
      </section>
    </main>
  );
}

export default HomePage;
