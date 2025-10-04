import { ThemeProvider, CssBaseline } from '@mui/material'
import WeatherDashboard from './components/WeatherDashboard'
import theme from './theme/theme'
import './App.css'

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <WeatherDashboard />
    </ThemeProvider>
  )
}

export default App
