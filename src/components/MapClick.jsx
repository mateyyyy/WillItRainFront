import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MapClick = ({ onClick, initialCenter = [0, 0], initialZoom = 2, height = 400 }) => {
  const mapRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // initialize map
    mapRef.current = L.map(containerRef.current).setView(initialCenter, initialZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapRef.current);

    // click handler
    const handleMapClick = (e) => {
      const { lat, lng } = e.latlng;
      // add a temporary marker at the clicked location
      L.marker([lat, lng]).addTo(mapRef.current);
      if (typeof onClick === 'function') onClick({ lat, lng });
    };

    mapRef.current.on('click', handleMapClick);

    return () => {
      mapRef.current.off('click', handleMapClick);
      mapRef.current.remove();
      mapRef.current = null;
    };
  }, [onClick, initialCenter, initialZoom]);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height, borderRadius: 8, overflow: 'hidden' }}
    />
  );
};

export default MapClick;
