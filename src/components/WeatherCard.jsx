import PropTypes from 'prop-types';
import { Card, CardContent, Typography, Box } from '@mui/material';
import { WbSunny, Opacity, Air } from '@mui/icons-material';

const WeatherCard = ({ hour, temperature, precipitation, humidity, windSpeed, condition, icon }) => {
  return (
    <Card sx={{ minWidth: 275, m: 1 }}>
      <CardContent>
        <Typography variant="h5" component="div" gutterBottom>
          {hour}
        </Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          <Typography variant="h3" component="span">
            {icon}
          </Typography>
          <Typography variant="h4" component="span" sx={{ ml: 2 }}>
            {temperature}°C
          </Typography>
        </Box>
        <Typography color="text.secondary" gutterBottom>
          {condition}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Opacity sx={{ mr: 1 }} />
            <Typography variant="body2">
              Precipitation: {precipitation}%
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <WbSunny sx={{ mr: 1 }} />
            <Typography variant="body2">
              Humidity: {humidity}%
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            <Air sx={{ mr: 1 }} />
            <Typography variant="body2">
              Wind: {windSpeed} km/h
            </Typography>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
};

WeatherCard.propTypes = {
  hour: PropTypes.string.isRequired,
  temperature: PropTypes.number.isRequired,
  precipitation: PropTypes.number.isRequired,
  humidity: PropTypes.number.isRequired,
  windSpeed: PropTypes.number.isRequired,
  condition: PropTypes.string.isRequired,
  icon: PropTypes.string.isRequired,
};

export default WeatherCard;