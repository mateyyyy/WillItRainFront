import { Container, Typography, Box, AppBar, Toolbar, Paper, Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField, RadioGroup, FormControlLabel, Radio, FormControl, FormLabel, Tooltip, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
// ...existing code...
import MapClick from './MapClick';
import { useState, useEffect } from 'react';

// ...existing code...

const WeatherDashboard = () => {
  const [selected, setSelected] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [position, setPosition] = useState(null); // controlled position for the map marker
  const [markerExists, setMarkerExists] = useState(false);
  const [locality, setLocality] = useState(null);
  const [mode, setMode] = useState('days'); // 'days' or 'date'
  const [days, setDays] = useState(1);
  const [date, setDate] = useState('');
  const [willItRainResult, setWillItRainResult] = useState(null);
  const [climatology, setClimatology] = useState(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [showMap, setShowMap] = useState(true); // Controla si mostrar el mapa o los resultados
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

    setDialogOpen(false);
    setShowMap(false); // Ocultar el mapa después de confirmar

    // Fire request to backend to compute precipitation possibility
    (async () => {
      try {
        setRequestLoading(true);
        setWillItRainResult(null);
        setClimatology(null);
        const params = new URLSearchParams();
        params.set('lat', String(selected.lat));
        params.set('lon', String(selected.lng));
        // If user picked a specific date, send it; otherwise send hours (days->date used here)
        if (targetDate) params.set('date', targetDate);
        else params.set('hours', String(Number(days) * 24));

  const url = `http://localhost:8000/climatology/?${params.toString()}`;
        const res = await fetch(url);
        if (!res.ok) {
          const t = await res.text();
          throw new Error(`Server error ${res.status}: ${t}`);
        }
        const json = await res.json();
        setWillItRainResult(json);
        // After main prediction is ready, request climatology probabilities for the same date/location
        try {
          // prefer ISO date YYYY-MM-DD (targetDate is already in that format when mode==='date' or computed above)
          if (targetDate) await fetchClimatology(selected.lat, selected.lng, targetDate);
        } catch (e) {
          // non-fatal
          console.warn('Error fetching climatology after willitrain response', e);
        }
      } catch (err) {
        console.error('Error requesting willitrain:', err);
        alert('Error al consultar el servidor: ' + (err.message || err));
      } finally {
        setRequestLoading(false);
      }
    })();
  };

  // Fetch climatology probabilities from backend endpoint
  async function fetchClimatology(lat, lon, dateISO) {
    if (!lat || !lon || !dateISO) return;
    try {
      const url = `http://localhost:8000/climatology/?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}&date=${encodeURIComponent(dateISO)}`;
      const res = await fetch(url);
      if (!res.ok) {
        console.warn('Climatology fetch failed', res.status, await res.text());
        setClimatology(null);
        return;
      }
      const data = await res.json();
      console.log(data)
      setClimatology(data);
    } catch (e) {
      console.warn('Error fetching climatology', e);
      setClimatology(null);
    }
  }

  // User selects between using the map pin or searching by city
  const [selectMode, setSelectMode] = useState('map'); // 'map' or 'city'

  // search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
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

  const handleCloseProfileDialog = () => {
    try {
      if (selectedProfile) {
        localStorage.setItem('userProfile', JSON.stringify(selectedProfile));
      }
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

  const handleBackToMap = () => {
    setShowMap(true);
    setWillItRainResult(null);
    setSelected(null);
    setPosition(null);
    setMarkerExists(false);
    setLocality(null);
  };

  return (
    <Box sx={{
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    
    position: 'fixed',
    top: 0,
    left: 0,
    background: 'linear-gradient(135deg, #0c1445 0%, #1a237e 50%, #0d47a1 100%)',
    fontSize: { xs: '0.85rem', sm: '1rem' }, // escala textos
  }}>
      <AppBar position="static" sx={{ mb: 0, backgroundColor: 'transparent', boxShadow: 'none' }}>
        <Toolbar sx={{ minHeight: 48, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
          {/* profile block top-right */}
          <Box sx={{ position: 'absolute', right: 12, top: 8, display: 'flex', gap: 1, alignItems: 'center' }}>
            
            <Button onClick={() => setProfileDialogOpen(true)} size="small" sx={{ ml: 0, border: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'white', px: 1, py: 0.25, borderRadius: 1, fontSize: '0.8rem' }}>Cambiar perfil</Button>
          </Box>
          {/* Botón para volver al mapa - Abajo, mismo ancho */}
  {!showMap && 
  <Box sx={{ textAlign: 'center' }}>
   <Button 
    variant="contained" 
    onClick={handleBackToMap}
    sx={{ 
      borderRadius: 2,

      fontSize: '0.9rem',
      fontWeight: 600,
      backgroundColor: '#fff',
      color: '#1a237e',
      '&:hover': { backgroundColor: '#f0f0f0' }
    }}
  >
    🗺️ Volver al mapa
  </Button>
</Box>}
        </Toolbar>
        
      </AppBar>
      
      
      {showMap ? (
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
          overflowY: 'auto',
          px: 2,
          py: 2
        }}>
          <Paper sx={{ 
            p: 3, 
            borderRadius: 3,
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            maxWidth: '600px',
            width: '100%'
          }}>
            <Typography variant="h5" gutterBottom sx={{ 
              textAlign: 'center', 
              mb: 3, 
              color: '#1a237e',
              fontWeight: 'bold'
            }}>
              🌍 Seleccione una ubicación
            </Typography>
            
            <Box sx={{ display: 'flex', gap: 1, mb: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
              <Button 
                variant={selectMode === 'map' ? 'contained' : 'outlined'} 
                onClick={() => setSelectMode('map')}
                size="small"
                sx={{ borderRadius: 2 }}
              >
                🗺️ Mapa
              </Button>
              <Button 
                variant={selectMode === 'city' ? 'contained' : 'outlined'} 
                onClick={() => setSelectMode('city')}
                size="small"
                sx={{ borderRadius: 2 }}
              >
                🔍 Buscar
              </Button>
              <Button 
                variant={selectMode === 'device' ? 'contained' : 'outlined'} 
                onClick={() => { setSelectMode('device'); handleUseDeviceLocation(); }}
                size="small"
                sx={{ borderRadius: 2 }}
              >
                📍 Mi ubicación
              </Button>
            </Box>

            <Box sx={{ 
              display: 'flex', 
              justifyContent: 'center', 
              mb: 2,
              borderRadius: 2,
              overflow: 'hidden',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)'
            }}>
              <MapClick 
                onClick={handleMapClick} 
                initialCenter={[20,0]} 
                initialZoom={2} 
                height={300} 
                width={300}
                position={position} 
                onMarkerCreated={(exists) => setMarkerExists(Boolean(exists))} 
                onLocation={(info) => { setLocality(info.locality || info.display_name); setMarkerExists(true); }} 
              />
            </Box>

            {selectMode === 'city' ? (
              <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                <TextField 
                  fullWidth 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  placeholder="Ciudad, Provincia, País" 
                  size="small"
                  sx={{ borderRadius: 2 }}
                />
                <Button 
                  onClick={handleSearchCity} 
                  disabled={searching}
                  size="small"
                  sx={{ borderRadius: 2 }}
                >
                  {searching ? 'Buscando...' : 'Buscar'}
                </Button>
              </Box>
            ) : null}
            
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <Button 
                variant="contained" 
                disabled={!markerExists} 
                onClick={() => { if (selected) { openDialogIfReady(); } else { alert('Primero selecciona una ubicación en el mapa o busca una ciudad'); } }} 
                size="large"
                sx={{ 
                  borderRadius: 2,
                  px: 4,
                  py: 1.5,
                  fontSize: '1.1rem',
                  fontWeight: 'bold'
                }}
              >
                {markerExists ? '➡️ Siguiente' : '📍 Selecciona un punto'}
              </Button>
            </Box>
            
            {locality ? (
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" sx={{ 
                  fontSize: '0.9rem',
                  color: '#666',
                  fontStyle: 'italic'
                }}>
                  📍 {locality}
                </Typography>
              </Box>
            ) : null}
          </Paper>
        </Box>
      ) : null}

      {/* Profile selection dialog on first load */}  
        <Dialog open={profileDialogOpen} onClose={handleCloseProfileDialog} fullWidth maxWidth="sm">
          <DialogTitle sx={{ fontSize: '1.25rem', pb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Box component="span">¿Qué opción encaja más con su perfil?</Box>
              <IconButton edge="end" onClick={handleCloseProfileDialog} aria-label="close">
                <CloseIcon sx={{ color: '#000' }} />
              </IconButton>
            </Box>
          </DialogTitle>
          <DialogContent sx={{ pt: 0 }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2, mt: 1 }}>
              <Tooltip title={"Conocer el clima permite planificar siembra, cosecha y riego, proteger cultivos de lluvias fuertes o heladas, y anticipar eventos extremos que podrían afectar animales y plantas."} arrow>
                <Button
                  variant={selectedProfile && selectedProfile.key === 'agri' ? 'contained' : 'outlined'}
                  onClick={() => { setSelectedProfile({ key: 'agri', label: 'Agricultura / Ganadería', emoji: '🌾' }); handleCloseProfileDialog()}}
                  sx={{ py: 2.5, px: 2, minHeight: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, fontSize: '1rem', transition: 'transform 180ms ease', '&:hover': { transform: 'scale(1.04)' } }}
                >
                  <Box component="span" sx={{ fontSize: '3rem', lineHeight: 1 }}>{'🌾'}</Box>
                  <Box component="span" sx={{ fontSize: '0.95rem', textAlign: 'center' }}>Agricultura / Ganadería</Box>
                </Button>
              </Tooltip>

              <Tooltip title={"La previsión del clima ayuda a decidir la fecha y logística de eventos al aire libre, evitando cancelaciones, accidentes o incomodidades por lluvia, calor extremo o viento fuerte."} arrow>
                <Button
                  variant={selectedProfile && selectedProfile.key === 'events' ? 'contained' : 'outlined'}
                  onClick={() => { setSelectedProfile({ key: 'events', label: 'Eventos al aire libre / Recreación', emoji: '🎪' }); handleCloseProfileDialog();}}
                  sx={{ py: 2.5, px: 2, minHeight: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, fontSize: '1rem', transition: 'transform 180ms ease', '&:hover': { transform: 'scale(1.04)' } }}
                >
                  <Box component="span" sx={{ fontSize: '3rem', lineHeight: 1 }}>{'🎪'}</Box>
                  <Box component="span" sx={{ fontSize: '0.95rem', textAlign: 'center' }}>Eventos / Recreación</Box>
                </Button>
              </Tooltip>

              <Tooltip title={"La prevención del clima permite planificar rutas seguras en carreteras, vías férreas, puertos y aeropuertos, reduciendo riesgos de accidentes por lluvia intensa, tormentas o visibilidad limitada."} arrow>
                <Button
                  variant={selectedProfile && selectedProfile.key === 'transport' ? 'contained' : 'outlined'}
                  onClick={() => { setSelectedProfile({ key: 'transport', label: 'Transporte / Navegación', emoji: '🚢' }); handleCloseProfileDialog(); }}
                  sx={{ py: 2.5, px: 2, minHeight: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, fontSize: '1rem', transition: 'transform 180ms ease', '&:hover': { transform: 'scale(1.04)' } }}
                >
                  <Box component="span" sx={{ fontSize: '3rem', lineHeight: 1 }}>{'🚢'}</Box>
                  <Box component="span" sx={{ fontSize: '0.95rem', textAlign: 'center' }}>Transporte / Navegación</Box>
                </Button>
              </Tooltip>

              <Tooltip title={"Conocer la previsión meteorológica ayuda a tomar decisiones cotidianas: vestimenta, protección de viviendas, evitar actividades peligrosas bajo lluvia o tormentas y optimizar consumo de energía en días extremos."} arrow>
                <Button
                  variant={selectedProfile && selectedProfile.key === 'home' ? 'contained' : 'outlined'}
                  onClick={() => { setSelectedProfile({ key: 'home', label: 'Uso diario / Hogar', emoji: '🏠' }); handleCloseProfileDialog(); }}
                  sx={{ py: 2.5, px: 2, minHeight: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, fontSize: '1rem', transition: 'transform 180ms ease', '&:hover': { transform: 'scale(1.04)' } }}
                >
                  <Box component="span" sx={{ fontSize: '3rem', lineHeight: 1 }}>{'🏠'}</Box>
                  <Box component="span" sx={{ fontSize: '0.95rem', textAlign: 'center' }}>Uso diario / Hogar</Box>
                </Button>
              </Tooltip>
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

        {!showMap && (
            <Box sx={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center',
              justifyContent: 'flex-start',
              overflowY: 'auto',
              px: 2,
              gap: 1,

              // allow the results area to scroll without hiding content
            }}>
            {/* Contenido centrado - Predicción */}
            <Box sx={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: '100%', 
              maxWidth: '600px',
              flex: 1
            }}>
              {requestLoading && !climatology && (
                <Paper sx={{ 
                  p: 3, 
                  borderRadius: 3,
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                  width: '100%',
                  textAlign: 'center'
                }}>
                  <Typography sx={{ fontSize: '1.1rem', color: '#1a237e', fontWeight: 'bold' }}>
                    🔄 Consultando al servidor...
                  </Typography>
                </Paper>
              )}

              {willItRainResult && climatology && (
                <Paper sx={{ 
                  p: 3, 
                  borderRadius: 3,
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                  width: '100%',
                  // constrain height so the content doesn't overflow the viewport
                  maxHeight: 'auto',
                  overflowY: 'auto',
                  '&::-webkit-scrollbar': { width: 8 }
                }}>
                  <Box sx={{ width: '100%' }}>
                <Typography variant="h6" sx={{ mb: 2, color: '#1976d2' }}>
                  🌤️ Predicción Meteorológica
                </Typography>
                
                {willItRainResult.mode === 'specific_date' ? (
                  <Box>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      📅 <strong>Fecha:</strong> {new Date(willItRainResult.requestedDate).toLocaleDateString('es-ES', { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                      })}
                    </Typography>
                  </Box>
                ) : (
                  null
                )}
                
                <Box sx={{ mt: 2}}>
                  {willItRainResult.temperatureData && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body1" sx={{ mb: 1 }}>
                        🌡️ <strong>Temperatura máxima:</strong> {willItRainResult.temperatureData.max}°C
                      </Typography>
                      <Typography variant="body1" sx={{ mb: 1 }}>
                        🌡️ <strong>Temperatura mínima:</strong> {willItRainResult.temperatureData.min}°C
                      </Typography>
                      <Typography variant="body1" sx={{ mb: 1 }}>
                        🌡️ <strong>Temperatura promedio:</strong> {willItRainResult.temperatureData.average}°C
                      </Typography>
                      
                      {willItRainResult.temperatureData.status !== 'normal' && (
                        <Box sx={{ mt: 1, p: 1, backgroundColor: willItRainResult.temperatureData.status === 'muy_alta' || willItRainResult.temperatureData.status === 'muy_baja' ? '#ffebee' : '#fff3e0', borderRadius: 1 }}>
                          <Typography variant="body2" sx={{ color: willItRainResult.temperatureData.status === 'muy_alta' || willItRainResult.temperatureData.status === 'muy_baja' ? '#d32f2f' : '#f57c00' }}>
                            ⚠️ <strong>Alerta de temperatura:</strong> {
                              willItRainResult.temperatureData.status === 'muy_alta' ? 'Temperatura muy alta' :
                              willItRainResult.temperatureData.status === 'muy_baja' ? 'Temperatura muy baja' :
                              willItRainResult.temperatureData.status === 'alta' ? 'Temperatura alta' :
                              'Temperatura baja'
                            }
                          </Typography>
                        </Box>
                      )}
                    </Box>
                  )}

                  {willItRainResult.windData && (
                    <Box sx={{ mt: 2 }}>
                      <Typography variant="body1" sx={{ mb: 1 }}>
                        💨 <strong>Viento:</strong> {willItRainResult.windData.status}
                      </Typography>
                      <Typography variant="body1" sx={{ mb: 1 }}>
                        💨 <strong>Velocidad máxima:</strong> {willItRainResult.windData.max} km/h
                      </Typography>
                      <Typography variant="body1" sx={{ mb: 1 }}>
                        💨 <strong>Velocidad promedio:</strong> {willItRainResult.windData.average} km/h
                      </Typography>
                    </Box>
                  )}
                  
                  {willItRainResult.maxPrecipitationMm > 0 && (
                    <Typography variant="body2" sx={{ mt: 1, color: '#666' }}>
                      💧 Precipitación máxima esperada: {willItRainResult.maxPrecipitationMm}mm
                    </Typography>
                  )}
                  {/* Climatology probabilities returned from backend */}
                 {/* Probabilidades históricas (climatología) */}
                {climatology && climatology.probabilities && (
                  <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>📊 Probabilidades históricas (climatología)</Typography>

                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {[ // barras de probabilidad
                        {
                          label: '🔥 Muy caliente',
                          value: (climatology.probabilities.prob_very_hot_above_33C * 100).toFixed(0),
                          color: '#e53935',
                          icon: '🔥'
                        },
                        {
                          label: '💨 Muy ventoso',
                          value: (climatology.probabilities.prob_very_windy_above_8ms * 100).toFixed(0),
                          color: '#1e88e5',
                          icon: '💨'
                        },
                        {
                          label: '💧 Muy húmedo',
                          value: (climatology.probabilities.prob_very_wet_above_5mm * 100).toFixed(0),
                          color: '#43a047',
                          icon: '💧'
                        },
                        {
                          label: '❄️ Muy frío',
                          value: (climatology.probabilities.prob_very_cold_below_0C * 100).toFixed(0),
                          color: '#2196f3',
                          icon: '❄️'
                        }
                      ].map((item, idx) => (
                        <Paper key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.9)' }}>
                          <Box sx={{ fontSize: '1.8rem' }}>{item.icon}</Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 'bold' }}>{item.label}</Typography>
                            <Box sx={{ height: 10, borderRadius: 1, backgroundColor: '#eee', mt: 0.5 }}>
                              <Box sx={{ width: `${item.value}%`, height: '100%', borderRadius: 1, backgroundColor: item.color, transition: 'width 0.5s ease' }} />
                            </Box>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: 35, textAlign: 'right' }}>{item.value}%</Typography>
                        </Paper>
                      ))}
{selectedProfile && climatology && (
                  <Box sx={{ mt: 3 }}>
                    <Typography variant="subtitle1" sx={{ mb: 1 }}>💡 Recomendaciones para ti ({selectedProfile.label})</Typography>
                    <Paper sx={{ p: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.9)' }}>
                      <Typography variant="body2">
                        {(() => {
                          const { key } = selectedProfile;
                          const rainProb = (climatology.probabilities.prob_very_wet_above_5mm || 0) * 100;
                          const windProb = (climatology.probabilities.prob_very_windy_above_8ms || 0) * 100;
                          const hotProb = (climatology.probabilities.prob_very_hot_above_33C || 0) * 100;
                          const coldProb = (climatology.probabilities.prob_very_cold_below_0C || 0) * 100;

                          switch (key) {
                            case 'agri':
                              if (rainProb > 60) return '🌱 Buen momento para sembrar o regar tus cultivos.';
                              if (hotProb > 50) return '🌾 Calor intenso: protege los cultivos del estrés térmico.';
                              if (coldProb > 40) return '❄️ Riesgo de heladas: resguarda tus plantas sensibles.';
                              return '🌿 Condiciones estables para la agricultura.';

                            case 'events':
                              if (rainProb > 40) return '☔ Considera posponer o mover tu evento, podría llover.';
                              if (windProb > 50) return '💨 Atención al viento: estructuras y carpas podrían verse afectadas.';
                              if (coldProb > 40) return '🥶 Clima muy frío: asegurá abrigo y calefacción para los asistentes.';
                              if (hotProb > 50) return '🌡️ Calor extremo: hidratación y sombra recomendadas.';
                              return '🎉 Buen clima para actividades al aire libre.';

                            case 'transport':
                              if (rainProb > 50) return '🚢 Riesgo de lluvia: revisa navegación y rutas de transporte.';
                              if (windProb > 60) return '💨 Viento fuerte: prudencia en rutas marítimas o aéreas.';
                              if (coldProb > 50) return '❄️ Posibles heladas o hielo en rutas: conduce con precaución.';
                              return '🛳️ Condiciones seguras para transporte y navegación.';

                            case 'home':
                              if (rainProb > 50) return '🏠 Lluvia prevista: revisa ventanas y techos, lleva paraguas.';
                              if (hotProb > 50) return '🌡️ Calor intenso: hidrátate y usa protección solar.';
                              if (coldProb > 40) return '🧊 Frío intenso: revisa calefacción y evita salir sin abrigo.';
                              return '😊 Clima estable para tu día a día.';

                            default:
                              return '🌤️ Clima estable, disfruta tu día.';
                          }
                        })()}
                      </Typography>
                    </Paper>
                  </Box>
                )}
                      {/* Umbrales en fila */}

                      <Typography 
                        variant="subtitle1" 
                        sx={{ textAlign: 'center', fontWeight: 'bold', mb: 1, color: '#0d2833' }}
                      >
                        🌡️ Umbrales de Referencia
                      </Typography>

                      <Paper
                        sx={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                          gap: 2,
                          p: 1,
                          borderRadius: 3,
                          background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(245,245,245,0.9))',
                          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
                        }}
                      >
                        {[
                          { icon: '💧', label: 'Lluvia', value: climatology.thresholds_used?.wet_mm ?? '?', unit: 'mm', color: '#4fc3f7' },
                          { icon: '💨', label: 'Viento', value: climatology.thresholds_used?.windy_ms ?? '?', unit: 'm/s', color: '#90caf9' },
                          { icon: '🔥', label: 'Calor', value: climatology.thresholds_used?.hot_C ?? '?', unit: '°C', color: '#ff8a65' },
                          { icon: '❄️', label: 'Frío', value: climatology.thresholds_used?.cold_C ?? '?', unit: '°C', color: '#81d4fa' },
                        ].map((item, idx) => (
                          <Box key={idx} sx={{ textAlign: 'center' }}>
                            <Box sx={{ fontSize: '1.8rem', mb: 0.5 }}>{item.icon}</Box>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', color: '#333' }}>
                              {item.label}
                            </Typography>
                            <Typography variant="body2" sx={{ color: item.color }}>
                              <strong>{item.value}</strong> {item.unit}
                            </Typography>
                          </Box>
                        ))}
                      </Paper>


                      {/* Índice de incomodidad climática */}
                      {(() => {
                        const pHot = climatology.probabilities.prob_very_hot_above_33C || 0;
                        const pWindy = climatology.probabilities.prob_very_windy_above_8ms || 0;
                        const pWet = climatology.probabilities.prob_very_wet_above_5mm || 0;
                        const pCold = climatology.probabilities.prob_very_cold_below_0C || 0;
                        const IIC = (pHot + pWindy + pWet + pCold - (pHot * pWindy * pWet * pCold)) * 100;
                        const IICClamped = Math.min(Math.max(IIC, 0), 100).toFixed(0);
                        let color = '#43a047';
                        if (IICClamped > 30) color = '#fbc02d';
                        if (IICClamped > 60) color = '#d32f2f';

                        return (
                          <Paper sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.9)', mt: 1 }}>
                            <Box sx={{ fontSize: '1.8rem' }}>⚠️</Box>
                            <Box sx={{ flex: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>Incomodidad Climática</Typography>
                              <Box sx={{ height: 10, borderRadius: 1, backgroundColor: '#eee', mt: 0.5 }}>
                                <Box sx={{ width: `${IICClamped}%`, height: '100%', borderRadius: 1, backgroundColor: color, transition: 'width 0.5s ease' }} />
                              </Box>
                            </Box>
                            <Typography variant="body2" sx={{ fontWeight: 'bold', minWidth: 35, textAlign: 'right' }}>{IICClamped}%</Typography>
                          </Paper>
                        );
                      })()}

                      <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#666' }}>
                        Periodo histórico: {climatology.historical_period ?? '—'} • Día objetivo: {climatology.target_day_month ?? '—'}
                      </Typography>
                    </Box>
                  </Box>
                )}

                </Box>
                  </Box>
              </Paper>
              )}
            </Box>
          </Box>
        )}
    </Box>
  );
};

export default WeatherDashboard;