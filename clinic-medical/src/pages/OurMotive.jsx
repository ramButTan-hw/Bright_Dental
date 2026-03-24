import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/our-motive.css';

export default function OurMotive() {
    const navigate = useNavigate();

    return (
        <div className="our-motive">
            <div className="our-motive-container">
                <h1 className="our-motive-title">Our Motive</h1>
                <p className="our-motive-description">
                    Our mission is to provide exceptional healthcare services with compassion,
                    integrity, and excellence.
                </p>

                <h2 style={{ fontSize: '28px', fontWeight: 'bold', color: '#333', marginTop: '40px' }}>Our Core Values</h2>
                <div className="motive-items">
                    <div className="motive-item">
                        <div className="motive-item-icon">❤️</div>
                        <h3 className="motive-item-title">Patient Care</h3>
                        <p className="motive-item-text">Putting patient well-being at the center of everything we do.</p>
                    </div>
                    <div className="motive-item">
                        <div className="motive-item-icon">⭐</div>
                        <h3 className="motive-item-title">Excellence</h3>
                        <p className="motive-item-text">Delivering high-quality medical services and outcomes.</p>
                    </div>
                    <div className="motive-item">
                        <div className="motive-item-icon">🛡️</div>
                        <h3 className="motive-item-title">Integrity</h3>
                        <p className="motive-item-text">Acting with honesty and strong moral principles.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}