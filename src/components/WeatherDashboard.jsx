import { Container, Typography, Box, AppBar, Toolbar, Paper } from '@mui/material';
import { weatherData } from '../data/weatherData';
import WeatherCard from './WeatherCard';
import MapClick from './MapClick';
import { useState } from 'react';

const WeatherDashboard = () => {
  const [selected, setSelected] = useState(null);

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" sx={{ mb: 4 }}>
        <Toolbar>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Will It Rain?
          </Typography>
        </Toolbar>
      </AppBar>
      <Container>
        <Typography variant="h4" component="h1" gutterBottom>
          Today's Weather Forecast
        </Typography>
        <Paper sx={{ p: 2, mb: 4 }} elevation={2}>
          <Typography variant="h6" gutterBottom>
            Selecciona un punto en el mapa
          </Typography>
          <MapClick onClick={(coords) => setSelected(coords)} initialCenter={[20,0]} initialZoom={2} height={360} />
          <Box sx={{ mt: 2 }}>
            <Typography variant="body1">Coordenadas seleccionadas:</Typography>
            <Typography variant="subtitle1">{selected ? `${selected.lat.toFixed(6)}, ${selected.lng.toFixed(6)}` : 'Ninguna'}</Typography>
          </Box>
        </Paper>
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 2,
          my: 4
        }}>
          {weatherData.map((data) => (
            <WeatherCard key={data.id} {...data} />
          ))}
        </Box>
      </Container>
    </Box>
  );
};

export default WeatherDashboard;