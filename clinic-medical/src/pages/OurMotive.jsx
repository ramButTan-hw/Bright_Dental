import { useNavigate } from 'react-router-dom';
import '../styles/our-motive.css';

export default function OurMotive() {
    const navigate = useNavigate();
    const values = [
        {
            label: '01',
            title: 'Patient Care',
            text: 'Putting patient well-being at the center of everything we do.'
        },
        {
            label: '02',
            title: 'Excellence',
            text: 'Delivering high-quality medical services and outcomes.'
        },
        {
            label: '03',
            title: 'Integrity',
            text: 'Acting with honesty and strong moral principles.'
        }
    ];

    return (
        <div className="our-motive">
            <div className="our-motive-container">
                <p className="our-motive-kicker">Why Patients Trust Our Practice</p>
                <h1 className="our-motive-title">Our Motive</h1>
                <p className="our-motive-description">
                    Our mission is to provide exceptional healthcare services with compassion,
                    integrity, and excellence.
                </p>

                <h2 className="our-motive-section-title">Our Core Values</h2>
                <div className="motive-items">
                    {values.map((value) => (
                        <div key={value.label} className="motive-item">
                            <div className="motive-item-label" aria-hidden="true">{value.label}</div>
                            <h3 className="motive-item-title">{value.title}</h3>
                            <p className="motive-item-text">{value.text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}