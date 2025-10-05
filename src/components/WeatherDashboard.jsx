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

  const url = `http://localhost:8000/climatology/d?${params.toString()}`;
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
      background: 'linear-gradient(135deg, #0c1445 0%, #1a237e 50%, #0d47a1 100%)'
    }}>
      <AppBar position="static" sx={{ mb: 0, backgroundColor: 'transparent', boxShadow: 'none' }}>
        <Toolbar sx={{ minHeight: 48, display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative' }}>
          {/* profile block top-right */}
          <Box sx={{ position: 'absolute', right: 12, top: 8, display: 'flex', gap: 1, alignItems: 'center' }}>
            {selectedProfile ? (
              <Typography variant="subtitle2" sx={{ color: '#9FE8FF' }}>{selectedProfile.emoji} {selectedProfile.label}</Typography>
            ) : null}
            <Button onClick={() => setProfileDialogOpen(true)} size="small" sx={{ ml: 0, border: '1px solid rgba(255,255,255,0.12)', backgroundColor: 'rgba(255,255,255,0.02)', px: 1, py: 0.25, borderRadius: 1, fontSize: '0.8rem' }}>Cambiar perfil</Button>
          </Box>
        </Toolbar>
      </AppBar>
      
      {showMap ? (
        <Box sx={{ 
          flex: 1, 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center',
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
                  onClick={() => { setSelectedProfile({ key: 'agri', label: 'Agricultura / Ganadería', emoji: '🌾' }); }}
                  sx={{ py: 2.5, px: 2, minHeight: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, fontSize: '1rem', transition: 'transform 180ms ease', '&:hover': { transform: 'scale(1.04)' } }}
                >
                  <Box component="span" sx={{ fontSize: '3rem', lineHeight: 1 }}>{'🌾'}</Box>
                  <Box component="span" sx={{ fontSize: '0.95rem', textAlign: 'center' }}>Agricultura / Ganadería</Box>
                </Button>
              </Tooltip>

              <Tooltip title={"La previsión del clima ayuda a decidir la fecha y logística de eventos al aire libre, evitando cancelaciones, accidentes o incomodidades por lluvia, calor extremo o viento fuerte."} arrow>
                <Button
                  variant={selectedProfile && selectedProfile.key === 'events' ? 'contained' : 'outlined'}
                  onClick={() => { setSelectedProfile({ key: 'events', label: 'Eventos al aire libre / Recreación', emoji: '🎪' }); }}
                  sx={{ py: 2.5, px: 2, minHeight: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, fontSize: '1rem', transition: 'transform 180ms ease', '&:hover': { transform: 'scale(1.04)' } }}
                >
                  <Box component="span" sx={{ fontSize: '3rem', lineHeight: 1 }}>{'🎪'}</Box>
                  <Box component="span" sx={{ fontSize: '0.95rem', textAlign: 'center' }}>Eventos / Recreación</Box>
                </Button>
              </Tooltip>

              <Tooltip title={"La prevención del clima permite planificar rutas seguras en carreteras, vías férreas, puertos y aeropuertos, reduciendo riesgos de accidentes por lluvia intensa, tormentas o visibilidad limitada."} arrow>
                <Button
                  variant={selectedProfile && selectedProfile.key === 'transport' ? 'contained' : 'outlined'}
                  onClick={() => { setSelectedProfile({ key: 'transport', label: 'Transporte / Navegación', emoji: '🚢' }); }}
                  sx={{ py: 2.5, px: 2, minHeight: 110, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, fontSize: '1rem', transition: 'transform 180ms ease', '&:hover': { transform: 'scale(1.04)' } }}
                >
                  <Box component="span" sx={{ fontSize: '3rem', lineHeight: 1 }}>{'🚢'}</Box>
                  <Box component="span" sx={{ fontSize: '0.95rem', textAlign: 'center' }}>Transporte / Navegación</Box>
                </Button>
              </Tooltip>

              <Tooltip title={"Conocer la previsión meteorológica ayuda a tomar decisiones cotidianas: vestimenta, protección de viviendas, evitar actividades peligrosas bajo lluvia o tormentas y optimizar consumo de energía en días extremos."} arrow>
                <Button
                  variant={selectedProfile && selectedProfile.key === 'home' ? 'contained' : 'outlined'}
                  onClick={() => { setSelectedProfile({ key: 'home', label: 'Uso diario / Hogar', emoji: '🏠' }); }}
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
            justifyContent: 'center',
            px: 2,
            py: 4,
            gap: 4
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
              {requestLoading && (
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

              {willItRainResult && (
                <Paper sx={{ 
                  p: 3, 
                  borderRadius: 3,
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                  width: '100%'
                }}>
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
                  <Box>
                    <Typography variant="body1" sx={{ mb: 1 }}>
                      📅 <strong>Período:</strong> Próximos {willItRainResult.hoursAnalyzed} horas
                    </Typography>
                  </Box>
                )}
                
                <Box sx={{ mt: 2 }}>
                  <Typography variant="h6" sx={{ color: willItRainResult.rainProbability > 50 ? '#d32f2f' : willItRainResult.rainProbability > 25 ? '#f57c00' : '#388e3c' }}>
                    🌧️ La predicción para esta fecha es de: {willItRainResult.rainProbability}% de probabilidad de precipitación
                  </Typography>
                  
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
                  {climatology && climatology.probabilities && (
                    <Box sx={{ mt: 3, p: 2, borderRadius: 2, backgroundColor: 'rgba(250,250,250,0.6)' }}>
                      <Typography variant="subtitle1" sx={{ mb: 1 }}>📊 Probabilidades históricas (climatología)</Typography>
                      <Typography variant="body2">Muy caliente (&gt; {climatology.thresholds_used?.hot_C ?? '?'}°C): {(climatology.probabilities.prob_very_hot_above_33C * 100).toFixed(0)}%</Typography>
                      <Typography variant="body2">Muy ventoso (&gt; {climatology.thresholds_used?.windy_ms ?? '?'} m/s): {(climatology.probabilities.prob_very_windy_above_8ms * 100).toFixed(0)}%</Typography>
                      <Typography variant="body2">Muy húmedo (&gt; {climatology.thresholds_used?.wet_mm ?? '?'} mm): {(climatology.probabilities.prob_very_wet_above_5mm * 100).toFixed(0)}%</Typography>
                      <Typography variant="caption" sx={{ display: 'block', mt: 1, color: '#666' }}>Periodo histórico: {climatology.historical_period ?? '—'} • Día objetivo: {climatology.target_day_month ?? '—'}</Typography>
                    </Box>
                  )}
                </Box>
              </Paper>
              )}
            </Box>
            
            {/* Botón para volver al mapa - Abajo, mismo ancho */}
            <Box sx={{ 
              width: '100%', 
              maxWidth: '600px',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <Button 
                variant="contained" 
                onClick={handleBackToMap}
                fullWidth
                sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  gap: 2,
                  py: 3,
                  fontSize: '1.3rem',
                  fontWeight: 'bold',
                  borderRadius: 3,
                  backgroundColor: 'rgba(255, 255, 255, 0.9)',
                  color: '#1a237e',
                  '&:hover': {
                    backgroundColor: 'rgba(255, 255, 255, 1)',
                    transform: 'translateY(-2px)',
                    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.2)'
                  },
                  transition: 'all 0.3s ease'
                }}
              >
                🗺️ Volver al mapa
              </Button>
            </Box>
          </Box>
        )}
    </Box>
  );
};

export default WeatherDashboard;