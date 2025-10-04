import { Container, Typography, Box, AppBar, Toolbar, Paper, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, RadioGroup, FormControlLabel, Radio, FormControl, FormLabel } from '@mui/material';
// ...existing code...
import MapClick from './MapClick';
import { useState, useEffect } from 'react';

const WeatherDashboard = () => {
  const [selected, setSelected] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [position, setPosition] = useState(null); // controlled position for the map marker
  const [markerExists, setMarkerExists] = useState(false);
  const [locality, setLocality] = useState(null);
  const [mode, setMode] = useState('days'); // 'days' or 'date'
  const [days, setDays] = useState(1);
  const [date, setDate] = useState('');
  const [savedRequest, setSavedRequest] = useState(null);
  // location text fields removed; selection comes from map pin or search

  const handleMapClick = (coords) => {
    setSelected(coords);
    setPosition([coords.lat, coords.lng]);
  };

  const handleConfirm = () => {
    if (!selected) return;
    let targetDate;
    if (mode === 'days') {
      const d = new Date();
      d.setDate(d.getDate() + Number(days));
      targetDate = d.toISOString().slice(0, 10);
    } else {
      // date input is expected in YYYY-MM-DD
      targetDate = date;
    }

    setSavedRequest({ 
      coords: selected, 
      mode, 
      days: mode === 'days' ? Number(days) : null, 
      date: targetDate
    });
    setDialogOpen(false);
  };

  // User selects between using the map pin or searching by city
  const [selectMode, setSelectMode] = useState('map'); // 'map' or 'city'

  // search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [showCoordsDisplay, setShowCoordsDisplay] = useState(false);
  // user profile selection
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState(null);

  useEffect(() => {
    // check if user profile is stored
    try {
      const stored = localStorage.getItem('userProfile');
      if (stored) {
        setSelectedProfile(JSON.parse(stored));
        setProfileDialogOpen(false);
      } else {
        setProfileDialogOpen(true);
      }
    } catch (e) {
      setProfileDialogOpen(true);
    }
  }, []);

  const handleConfirmProfile = () => {
    if (!selectedProfile) return;
    try {
      localStorage.setItem('userProfile', JSON.stringify(selectedProfile));
    } catch (e) {
      // ignore
    }
    setProfileDialogOpen(false);
  };

  const handleUseDeviceLocation = () => {
    if (!navigator.geolocation) {
      alert('Geolocalización no disponible en este navegador');
      return;
    }
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      setSelected({ lat, lng: lon });
      setPosition([lat, lon]);
      setMarkerExists(true);
      // reverse geocode quickly to set locality
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=jsonv2&addressdetails=1`);
        const data = await res.json();
        if (data && data.address) {
          const a = data.address;
          // prefer more specific parts for device location
          const place = a.suburb || a.neighbourhood || a.hamlet || a.village || a.town || a.city || a.county || null;
          const state = a.state || a.region || null;
          const loc = place && state ? `${place}, ${state}` : (place || state || a.country || data.display_name);
          setLocality(loc || null);
        }
      } catch (e) {
        // ignore
      }
    }, (err) => {
      alert('No se pudo obtener la ubicación del dispositivo');
    });
  };

  const handleSearchCity = async () => {
    if (!searchQuery) return;
    setSearching(true);
    setShowCoordsDisplay(false);
    try {
      const q = encodeURIComponent(searchQuery);
      // Using Nominatim public API for forward geocoding
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${q}&format=jsonv2&addressdetails=1&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const item = data[0];
        const lat = parseFloat(item.lat);
        const lon = parseFloat(item.lon);
        const coords = { lat, lng: lon };
        setSelected(coords);
        setPosition([lat, lon]);
        setMarkerExists(true);
        // attempt to set a simple locality name from the result
        const addr = item.address || {};
        const loc = addr.city || addr.town || addr.village || addr.county || addr.state || item.display_name;
        setLocality(loc || null);
      } else {
        alert('No se encontró la ubicación');
      }
    } catch (err) {
      console.error(err);
      alert('Error buscando la ciudad');
    } finally {
      setSearching(false);
    }
  };

  const openDialogIfReady = () => {
    // only open dialog if we have coordinates (from pin or search)
    if (selected) setDialogOpen(true);
    else alert('Primero selecciona una ubicación en el mapa o busca una ciudad');
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" sx={{ mb: 0, backgroundColor: 'transparent', boxShadow: 'none' }}>
        <Toolbar sx={{ minHeight: 56, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          {/* profile block top-right */}
          <Box sx={{ position: 'absolute', right: 12, top: 8, display: 'flex', gap: 1, alignItems: 'center' }}>
            {selectedProfile ? (
              <Typography variant="subtitle2" sx={{ color: '#9FE8FF' }}>{selectedProfile.emoji} {selectedProfile.label}</Typography>
            ) : null}
            <Button onClick={() => setProfileDialogOpen(true)} sx={{ ml: 0, border: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.02)', px: 1, py: 0.35, borderRadius: 1 }}>Cambiar perfil</Button>
          </Box>
        </Toolbar>
      </AppBar>
      <Container>
        <Paper sx={{ p: 2, mb: 4 }} elevation={2}>
          <Typography variant="h6" gutterBottom>
            Seleccione una ubicacion en el mapa
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <Button variant={selectMode === 'map' ? 'contained' : 'outlined'} onClick={() => setSelectMode('map')}>Usar mapa</Button>
            <Button variant={selectMode === 'city' ? 'contained' : 'outlined'} onClick={() => setSelectMode('city')}>Buscar ciudad</Button>
            <Button variant={selectMode === 'device' ? 'contained' : 'outlined'} onClick={() => { setSelectMode('device'); handleUseDeviceLocation(); }}>Usar mi ubicación</Button>
          </Box>

          <MapClick onClick={handleMapClick} initialCenter={[20,0]} initialZoom={2} height={360} position={position} onMarkerCreated={(exists) => setMarkerExists(Boolean(exists))} onLocation={(info) => { setLocality(info.locality || info.display_name); setMarkerExists(true); }} />

          {selectMode === 'city' ? (
            <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
              <TextField fullWidth value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Ciudad, Provincia, País" />
              <Button onClick={handleSearchCity} disabled={searching}>{searching ? 'Buscando...' : 'Buscar'}</Button>
            </Box>
          ) : null}
          <Box sx={{ mt: 2, display: 'flex', gap: 2, alignItems: 'center' }}>
            <Button variant="contained" disabled={!markerExists} onClick={() => { if (selected) { setShowCoordsDisplay(true); openDialogIfReady(); } else { alert('Primero selecciona una ubicación en el mapa o busca una ciudad'); } }}>{markerExists ? 'Siguiente' : 'Selecciona un punto'}</Button>
          </Box>
          {locality ? (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2">Localidad: {locality}</Typography>
            </Box>
          ) : null}
        </Paper>

        {/* Profile selection dialog on first load */}
        <Dialog open={profileDialogOpen} onClose={() => setProfileDialogOpen(false)}>
          <DialogTitle>¿Qué opción encaja más con su perfil?</DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 1 }}>
              <Button variant={selectedProfile && selectedProfile.key === 'agri' ? 'contained' : 'outlined'} onClick={() => { setSelectedProfile({ key: 'agri', label: 'Agricultura / Ganadería', emoji: '🌾' }); handleConfirmProfile(); }}>🌾 Agricultura / Ganadería</Button>
              <Button variant={selectedProfile && selectedProfile.key === 'events' ? 'contained' : 'outlined'} onClick={() => { setSelectedProfile({ key: 'events', label: 'Eventos al aire libre / Recreación', emoji: '🎪' }); handleConfirmProfile(); }}>🎪 Eventos / Recreación</Button>
              <Button variant={selectedProfile && selectedProfile.key === 'transport' ? 'contained' : 'outlined'} onClick={() => { setSelectedProfile({ key: 'transport', label: 'Transporte / Navegación', emoji: '🚢' }); handleConfirmProfile(); }}>🚢 Transporte / Navegación</Button>
              <Button variant={selectedProfile && selectedProfile.key === 'home' ? 'contained' : 'outlined'} onClick={() => { setSelectedProfile({ key: 'home', label: 'Uso diario / Hogar', emoji: '🏠' }); handleConfirmProfile(); }}>🏠 Uso diario / Hogar</Button>
            </Box>
          </DialogContent>
        </Dialog>
        {/* Removed WeatherCard grid from the homepage as requested */}

        {/* Dialog to ask user when they want to check the rain for the selected location */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)}>
          <DialogTitle>¿Cuándo quieres saber si lloverá?</DialogTitle>
          <DialogContent>
            {selected && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="body2">Coordenadas seleccionadas: {`${selected.lat.toFixed(6)}, ${selected.lng.toFixed(6)}`}</Typography>
              </Box>
            )}
            <FormControl component="fieldset" sx={{ mt: 1 }}>
              <FormLabel component="legend">Selecciona el formato</FormLabel>
              <RadioGroup value={mode} onChange={(e) => setMode(e.target.value)}>
                <FormControlLabel value="days" control={<Radio />} label="Dentro de X días" />
                <FormControlLabel value="date" control={<Radio />} label="Fecha específica" />
              </RadioGroup>
            </FormControl>

            {mode === 'days' ? (
              <TextField
                label="Cuántos días"
                type="number"
                value={days}
                onChange={(e) => setDays(e.target.value)}
                inputProps={{ min: 0 }}
                sx={{ mt: 2 }}
                fullWidth
              />
            ) : (
              <TextField
                label="Fecha"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                sx={{ mt: 2 }}
                fullWidth
                InputLabelProps={{ shrink: true }}
              />
            )}

            {/* Location already selected; do not ask again here. */}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button variant="contained" onClick={handleConfirm} disabled={mode === 'date' && !date}>Confirmar</Button>
          </DialogActions>
        </Dialog>

        {savedRequest && showCoordsDisplay && (
          <Paper sx={{ p: 2, mt: 4 }} elevation={1}>
            <Typography variant="h6">Solicitud guardada</Typography>
            <Typography>Coordenadas: {`${savedRequest.coords.lat.toFixed(6)}, ${savedRequest.coords.lng.toFixed(6)}`}</Typography>
            <Typography>Tipo: {savedRequest.mode === 'days' ? `En ${savedRequest.days} días` : `Fecha ${savedRequest.date}`}</Typography>
            {savedRequest.locationText ? (
              <Box sx={{ mt: 1 }}>
                <Typography variant="subtitle2">Ubicación ingresada:</Typography>
                <Typography>{`${savedRequest.locationText.city || ''}${savedRequest.locationText.province ? ', ' + savedRequest.locationText.province : ''}${savedRequest.locationText.country ? ', ' + savedRequest.locationText.country : ''}`}</Typography>
              </Box>
            ) : null}
          </Paper>
        )}
      </Container>
    </Box>
  );
};

export default WeatherDashboard;