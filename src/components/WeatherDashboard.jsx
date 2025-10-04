import { Container, Typography, Box, AppBar, Toolbar } from '@mui/material';
import { weatherData } from '../data/weatherData';
import WeatherCard from './WeatherCard';

const WeatherDashboard = () => {
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