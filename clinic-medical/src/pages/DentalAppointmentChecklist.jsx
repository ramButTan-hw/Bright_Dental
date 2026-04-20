import React from 'react';

export default function DentalAppointmentChecklist() {
  return (
    <main style={{ padding: '7rem 1rem 3rem 1rem', maxWidth: 600, margin: '0 auto', textAlign: 'left' }}>
      <h1 style={{ textAlign: 'center', color: '#0d7377' }}>Dental Appointment Checklist</h1>
      <p style={{ textAlign: 'center', color: '#5a6c7d' }}>
        Make your visit smooth and stress-free by preparing the following:
      </p>
      <ul style={{ fontSize: '1.1rem', lineHeight: 1.7, color: '#2c3e50', marginTop: 32 }}>
        <li>Bring your photo ID and insurance card (if applicable).</li>
        <li>Arrive 10-15 minutes early to complete any paperwork.</li>
        <li>Prepare a list of current medications and allergies.</li>
        <li>Note any recent changes in your health or medical history.</li>
        <li>Bring previous dental records or x-rays if available.</li>
        <li>Brush and floss before your appointment.</li>
        <li>Write down any questions or concerns for your dentist.</li>
        <li>Arrange for payment or co-pay if required.</li>
        <li>If you need special accommodations, notify the office in advance.</li>
      </ul>
      <p style={{ marginTop: 32, color: '#5a6c7d', textAlign: 'center' }}>
        Thank you for helping us provide you with the best care possible!
      </p>
    </main>
  );
}
