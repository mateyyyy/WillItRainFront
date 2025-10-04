import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const MapClick = ({ onClick, initialCenter = [0, 0], initialZoom = 2, height = 400, position = null, onMarkerCreated, onLocation }) => {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const markerRef = useRef(null);
  const onClickRef = useRef(onClick);
  const lastPosRef = useRef(null);

  // keep latest onClick in a ref to avoid re-creating the map
  useEffect(() => {
    onClickRef.current = onClick;
  }, [onClick]);

  useEffect(() => {
    if (!containerRef.current) return;
    if (mapRef.current) return; // initialize once

    mapRef.current = L.map(containerRef.current).setView(initialCenter, initialZoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapRef.current);

    // marker is NOT created by default. We'll create it on first click or when a position is provided.

    const handleMapClick = (e) => {
      const { lat, lng } = e.latlng;
      const latlngKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
      if (lastPosRef.current === latlngKey) {
        // same position, nothing to do
        return;
      }
      // record last pos early to avoid race with parent updating position
      lastPosRef.current = latlngKey;
      // ensure marker exists, then move it
      if (!markerRef.current) {
          markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current);
          markerRef.current.on('moveend', (ev) => {
            const p = ev.target.getLatLng();
            if (onClickRef.current) onClickRef.current({ lat: p.lat, lng: p.lng });
            // reverse geocode
            reverseGeocode(p.lat, p.lng);
        });
        // notify parent that a marker now exists
        if (typeof onMarkerCreated === 'function') onMarkerCreated(true);
      } else {
        markerRef.current.setLatLng([lat, lng]);
      }
      if (onClickRef.current) onClickRef.current({ lat, lng });
      // center map on marker and bring to front
      try { mapRef.current.setView([lat, lng], mapRef.current.getZoom()); markerRef.current.bringToFront(); } catch (e) { /* ignore */ }
      // reverse geocode for this click
      reverseGeocode(lat, lng);
    };

    mapRef.current.on('click', handleMapClick);

    // small invalidate to ensure tiles render correctly
    setTimeout(() => { try { mapRef.current.invalidateSize(); } catch (e) { /* ignore */ } }, 100);

    return () => {
      if (!mapRef.current) return;
      mapRef.current.off('click', handleMapClick);
      if (markerRef.current) markerRef.current.off();
      mapRef.current.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []); // run once

  // when parent gives a new position prop, create/move the marker there and fix map size
  useEffect(() => {
    if (!position || !mapRef.current) return;
    const [lat, lng] = position;
    const latlngKey = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    if (lastPosRef.current === latlngKey) {
      // position unchanged, nothing to do
      return;
    }
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current);
      markerRef.current.on('moveend', (ev) => {
        const p = ev.target.getLatLng();
        if (onClickRef.current) onClickRef.current({ lat: p.lat, lng: p.lng });
        // reverse geocode only on user drag
        reverseGeocode(p.lat, p.lng);
      });
      if (typeof onMarkerCreated === 'function') onMarkerCreated(true);
    } else {
      markerRef.current.setLatLng([lat, lng]);
    }
    // center the map gently only if view isn't already near the position
    try { mapRef.current.setView([lat, lng], mapRef.current.getZoom()); markerRef.current.bringToFront(); } catch (e) { /* ignore */ }
    // small invalidate to ensure tiles are fine
    try { mapRef.current.invalidateSize(); } catch (e) { /* ignore */ }
  // do NOT notify parent here to avoid an echo loop (parent initiated the position change)
  // Do NOT reverseGeocode here: only perform reverse geocoding for user interactions (click/drag).
  lastPosRef.current = latlngKey;
  }, [position]);

  // If the marker disappears unexpectedly but parent still has a position, recreate it.
  useEffect(() => {
    if (!mapRef.current) return;
    if (!position) return;
    const [lat, lng] = position;
    if (!markerRef.current) {
      markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current);
      markerRef.current.on('moveend', (ev) => {
        const p = ev.target.getLatLng();
        if (onClickRef.current) onClickRef.current({ lat: p.lat, lng: p.lng });
        reverseGeocode(p.lat, p.lng);
      });
      if (typeof onMarkerCreated === 'function') onMarkerCreated(true);
    }
  }, [position]);

  // simple reverse geocode using Nominatim to get a locality-like name
  const reverseGeocode = async (lat, lng) => {
    if (typeof onLocation !== 'function') return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=jsonv2&addressdetails=1`);
      const data = await res.json();
      if (data && data.address) {
        const a = data.address;
        // Prefer: city/town/village, then state. Fallback to county or country.
        const place = a.city || a.town || a.village || a.county || null;
        const state = a.state || a.region || null;
        const locality = place && state ? `${place}, ${state}` : (place || state || a.country || data.display_name);
        onLocation({ lat, lng, display_name: data.display_name, locality });
      } else if (data && data.display_name) {
        onLocation({ lat, lng, display_name: data.display_name, locality: data.display_name });
      }
      // ensure marker exists (in case it disappeared during async roundtrip)
      if (mapRef.current) {
        if (!markerRef.current) {
          markerRef.current = L.marker([lat, lng], { draggable: true }).addTo(mapRef.current);
          markerRef.current.on('moveend', (ev) => {
            const p = ev.target.getLatLng();
            if (onClickRef.current) onClickRef.current({ lat: p.lat, lng: p.lng });
            reverseGeocode(p.lat, p.lng);
          });
          if (typeof onMarkerCreated === 'function') onMarkerCreated(true);
        } else {
          // bring marker to front and ensure position
          try { markerRef.current.setLatLng([lat, lng]); markerRef.current.bringToFront(); } catch (e) { /* ignore */ }
        }
      }
    } catch (e) {
      // ignore errors silently
    }
  };

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height, borderRadius: 8, overflow: 'hidden' }}
    />
  );
};

export default MapClick;
