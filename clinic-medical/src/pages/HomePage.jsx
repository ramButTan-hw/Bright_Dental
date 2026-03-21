import { useState, useEffect } from 'react';
import '../styles/HomePage.css';

function HomePage() {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      image: 'https://images.unsplash.com/photo-1606811841689-23def381efa3?w=1200&q=80',
      pitch: 'Clinical Sanctuary',
      description: 'Where high-end medical precision meets restorative serenity.'
    },
    {
      image: 'https://images.unsplash.com/photo-1629909613654-28eca340c630?w=1200&q=80',
      pitch: 'Precision in Every Smile',
      description: 'Advanced diagnostics and restorative artistry combined.'
    },
    {
      image: 'https://images.unsplash.com/photo-1666214280291-fbc3d8e60ba5?w=1200&q=80',
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
                <button className="explore-button">Explore Our Expertise</button>
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
            <button className="btn-primary">Book Online</button>
            <button className="btn-secondary">Call (832) 461-3355</button>
          </div>
        </div>
      </section>
    </main>
  );
}

export default HomePage;
