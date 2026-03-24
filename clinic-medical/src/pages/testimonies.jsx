import '../styles/testimonies.css';

export default function Testimonies() {
  return (
    <section className="testimonies-page">
      <div className="testimonies-container">
        <h1>Testimonials</h1>
        <p className="subheading">Real stories from real patients who trust Bright Dental.</p>

        <div className="testimonials-grid">
          <article className="testimonial-card">
            <div className="card-icon">“</div>
            <div className="stars">⭐⭐⭐⭐⭐</div>
            <p className="quote">
              <strong className="highlight">Bright Dental transformed my smile and gave me confidence.</strong> The staff is friendly and professional, and the treatment plan was tailored perfectly to my needs and <strong className="highlight">compassionately guided.</strong>
            </p>
            <div className="author">
              <span className="name">Emily R.</span>
              <span className="role">Satisfied Patient</span>
            </div>
          </article>

          <article className="testimonial-card">
            <div className="card-icon">“</div>
            <div className="stars">⭐⭐⭐⭐⭐</div>
            <p className="quote">
              <strong className="highlight">I was impressed by the quick follow-up and comfort-focused care.</strong> The clinic feels modern and clean, and <strong className="highlight">the results speak for themselves.</strong> The staff is supportive.
            </p>
            <div className="author">
              <span className="name">Michael S.</span>
              <span className="role">Returning Client</span>
            </div>
          </article>

          <article className="testimonial-card">
            <div className="card-icon">“</div>
            <div className="stars">⭐⭐⭐⭐⭐</div>
            <p className="quote">
              <strong className="highlight">From check-in to check-out, everything was seamless.</strong> The clinical team explained everything clearly and <strong className="highlight">made me feel at ease.</strong> It was the best dental experience I've had.
            </p>
            <div className="author">
              <span className="name">Alicia K.</span>
              <span className="role">New Patient</span>
            </div>
          </article>

          <article className="testimonial-card">
            <div className="card-icon">“</div>
            <div className="stars">⭐⭐⭐⭐⭐</div>
            <p className="quote">
              <strong className="highlight">Adrian Figueroa at the front desk greeted me with exceptional warmth and professionalism.</strong> His attention to detail and clear communication made the appointment setup effortless and comfortable.
            </p>
            <div className="author">
              <span className="name">Sarah F.</span>
              <span className="role">Front Desk</span>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}

