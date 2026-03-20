import { useEffect, useState } from 'react';

const MOCK = [
  { location_id: 1, location_city: 'Austin',  location_state: 'TX', location_address: '100 Main St',  location_zip: '78701' },
  { location_id: 2, location_city: 'Dallas',  location_state: 'TX', location_address: '200 Oak Ave',  location_zip: '75201' },
  { location_id: 3, location_city: 'Houston', location_state: 'TX', location_address: '300 Elm Blvd', location_zip: '77001' },
];

function Locations() {
  const [locations, setLocations] = useState(MOCK);

  useEffect(() => {
    fetch('/api/locations')
      .then(r => r.json())
      .then(data => { if (Array.isArray(data) && data.length > 0) setLocations(data); })
      .catch(() => {});
  }, []);

  return (
    <div style={{ padding: '32px 36px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: '#1a2332' }}>Locations</h2>
        <button style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '9px 18px', background: '#2d7a6e', color: '#fff', border: 'none', borderRadius: '8px', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer' }}>
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Location
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
        {locations.map(loc => (
          <div key={loc.location_id} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '20px', display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
            <div style={{ width: '36px', height: '36px', background: '#d6eae6', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" fill="none" stroke="#2d7a6e" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#111827' }}>{loc.location_city}, {loc.location_state}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '2px' }}>{loc.location_address}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>{loc.location_zip}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default Locations;
