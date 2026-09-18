import { useEffect, useMemo, useState } from "react";
import {
  Search,
  MapPin,
  Wind,
  Droplets,
  Eye,
  Gauge,
  Sun,
  MoonStar,
  CloudRain,
  CloudSun,
  Compass,
} from "lucide-react";

const API_URL = "https://api.open-meteo.com/v1/forecast";
const GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search";
const REVERSE_GEOCODING_URL = "https://nominatim.openstreetmap.org/reverse";

const weatherLabels = {
  0: ["Clear sky", "☀️"],
  1: ["Mainly clear", "🌤️"],
  2: ["Partly cloudy", "🌤️"],
  3: ["Overcast", "☁️"],
  45: ["Fog", "🌫️"],
  48: ["Rime fog", "🌫️"],
  51: ["Light drizzle", "🌦️"],
  53: ["Drizzle", "🌦️"],
  55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"],
  57: ["Heavy freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"],
  63: ["Rain", "🌧️"],
  65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"],
  67: ["Heavy freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"],
  73: ["Snow", "❄️"],
  75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "❄️"],
  80: ["Rain showers", "🌦️"],
  81: ["Rain showers", "🌧️"],
  82: ["Heavy showers", "⛈️"],
  85: ["Light snow showers", "🌨️"],
  86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"],
  96: ["Thunderstorm + hail", "⛈️"],
  99: ["Heavy thunderstorm", "⛈️"],
};

const getWeather = (code) => weatherLabels[code] ?? ["Unknown", "🌤️"];
const formatCity = (result) =>
  [result.name, result.country].filter(Boolean).join(", ");
const formatTime = (time) =>
  new Date(time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const formatDay = (time, index) =>
  index === 0 ? "Today" : new Date(time).toLocaleDateString([], { weekday: "short" });
const formatDate = (time) =>
  new Date(time).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

const weatherThemes = {
  clear: { className: "theme-clear", accent: "#fbbf24" },
  cloud: { className: "theme-cloud", accent: "#60a5fa" },
  rain: { className: "theme-rain", accent: "#38bdf8" },
  snow: { className: "theme-snow", accent: "#a5f3fc" },
  storm: { className: "theme-storm", accent: "#7c3aed" },
  default: { className: "theme-default", accent: "#2563eb" },
};

const getWeatherTheme = (code) => {
  if ([0, 1].includes(code)) return weatherThemes.clear;
  if ([2, 3, 45, 48].includes(code)) return weatherThemes.cloud;
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return weatherThemes.rain;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return weatherThemes.snow;
  if ([95, 96, 99].includes(code)) return weatherThemes.storm;
  return weatherThemes.default;
};

async function fetchWeather(latitude, longitude, signal) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    current:
      "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m,surface_pressure,visibility,is_day",
    hourly: "temperature_2m,weather_code",
    daily:
      "weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,precipitation_probability_max,sunrise,sunset,uv_index_max",
    forecast_days: "7",
    timezone: "auto",
  });
  const response = await fetch(`${API_URL}?${params}`, { signal });
  if (!response.ok) throw new Error("Weather data could not be loaded.");
  return response.json();
}

async function fetchLocationName(latitude, longitude) {
  const params = new URLSearchParams({
    lat: latitude,
    lon: longitude,
    format: "jsonv2",
    zoom: "10",
  });
  const response = await fetch(`${REVERSE_GEOCODING_URL}?${params}`);
  if (!response.ok) throw new Error("Your location name could not be loaded.");
  const data = await response.json();
  const address = data.address ?? {};
  return {
    name: [
      address.city || address.town || address.village || address.municipality,
      address.country,
    ]
      .filter(Boolean)
      .join(", "),
  };
}

function App() {
  const [query, setQuery] = useState("");
  const [city, setCity] = useState({
    name: "Mumbai, India",
    latitude: 19.076,
    longitude: 72.8777,
  });
  const [suggestions, setSuggestions] = useState([]);
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchWeather(city.latitude, city.longitude, controller.signal)
      .then(setWeather)
      .catch((reason) => {
        if (reason.name !== "AbortError") setError(reason.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [city]);

  useEffect(() => {
    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) return undefined;

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        const params = new URLSearchParams({
          name: trimmedQuery,
          count: "6",
          language: "en",
          format: "json",
        });
        const response = await fetch(`${GEOCODING_URL}?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("City suggestions could not be loaded.");
        const data = await response.json();
        setSuggestions(data.results ?? []);
      } catch (reason) {
        if (reason.name !== "AbortError") setSuggestions([]);
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  const selectCity = (result) => {
    setLoading(true);
    setError("");
    setCity({
      name: formatCity(result),
      latitude: result.latitude,
      longitude: result.longitude,
    });
    setQuery("");
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const searchCity = (event) => {
    event.preventDefault();
    if (suggestions[0]) selectCity(suggestions[0]);
  };

  const useLocation = () => {
    if (!navigator.geolocation) {
      setError("Location is not supported by this browser.");
      return;
    }

    setLoading(true);
    setError("");

    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const result = await fetchLocationName(coords.latitude, coords.longitude);
          setCity({
            name: result?.name || "My Location",
            latitude: coords.latitude,
            longitude: coords.longitude,
          });
        } catch (reason) {
          setLoading(false);
          setError(reason.message);
        }
      },
      () => {
        setLoading(false);
        setError("Could not access your location. Please allow location access.");
      },
    );
  };

  const current = weather?.current;
  const currentWeather = current ? getWeather(current.weather_code) : ["", "🌤️"];
  const theme = current ? getWeatherTheme(current.weather_code) : weatherThemes.default;

  const hourly = useMemo(() => {
    if (!weather) return [];
    return weather.hourly.time
      .map((time, index) => ({
        time,
        temperature: weather.hourly.temperature_2m[index],
        code: weather.hourly.weather_code[index],
      }))
      .filter((item) => new Date(item.time) >= new Date())
      .slice(0, 6);
  }, [weather]);

  const activeDayIndex = weather
    ? Math.min(selectedDayIndex, weather.daily.time.length - 1)
    : 0;

  const selectedDay = weather
    ? {
        time: weather.daily.time[activeDayIndex],
        code: weather.daily.weather_code[activeDayIndex],
        high: weather.daily.temperature_2m_max[activeDayIndex],
        low: weather.daily.temperature_2m_min[activeDayIndex],
        wind: weather.daily.wind_speed_10m_max[activeDayIndex],
        rainChance: weather.daily.precipitation_probability_max[activeDayIndex],
        sunrise: weather.daily.sunrise[activeDayIndex],
        sunset: weather.daily.sunset[activeDayIndex],
        uvIndex: weather.daily.uv_index_max[activeDayIndex],
      }
    : null;

  const insightText = loading
    ? "Loading weather insight..."
    : `${currentWeather[0]} in ${city.name}. The air feels ${Math.round(current.apparent_temperature)}° with ${current.relative_humidity_2m}% humidity and a breeze of ${Math.round(current.wind_speed_10m)} km/h.`;

  return (
    <div className={`app ${theme.className}`}>
      <header className="header">
        <div className="logo">
          <span>☁️</span>
          <h1>SkySense</h1>
        </div>

        <form className="search-box" onSubmit={searchCity}>
          <Search size={18} />
          <div className="search-input-wrapper">
            <input
              type="text"
              placeholder="Search city..."
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => window.setTimeout(() => setShowSuggestions(false), 150)}
              aria-label="Search city"
              aria-autocomplete="list"
            />
            {showSuggestions && query.trim() && (
              <div className="suggestions" role="listbox">
                {searching && <p className="no-suggestions">Searching cities...</p>}
                {!searching && suggestions.length === 0 && (
                  <p className="no-suggestions">No cities found</p>
                )}
                {!searching &&
                  suggestions.map((suggestion) => (
                    <button
                      type="button"
                      className="suggestion"
                      key={`${suggestion.id}-${suggestion.latitude}`}
                      onMouseDown={() => selectCity(suggestion)}
                    >
                      <MapPin size={16} />
                      <span>{formatCity(suggestion)}</span>
                    </button>
                  ))}
              </div>
            )}
          </div>
          <button type="submit">Search</button>
        </form>

        <button className="location-btn" onClick={useLocation} type="button">
          <MapPin size={18} /> My Location
        </button>
      </header>

      <main className="container">
        {error && <p className="error-message">{error}</p>}

        <section className="hero">
          <div className="hero-copy">
            <p className="location">
              <MapPin size={17} />
              {city.name}
            </p>
            <p className="date-label">{loading ? "Fetching live conditions" : formatDate(current.time)}</p>
            {loading ? (
              <h2>--°</h2>
            ) : (
              <h2>{Math.round(current.temperature_2m)}°</h2>
            )}
            <p className="condition">{loading ? "Loading..." : currentWeather[0]}</p>
            {!loading && (
              <p className="feels">
                Feels like {Math.round(current.apparent_temperature)}°
              </p>
            )}
          </div>

          <div className="hero-visual">
            <div className="weather-icon">{currentWeather[1]}</div>
            <div className="mood-pill">
              {current && current.is_day ? <Sun size={16} /> : <MoonStar size={16} />}
              <span>{current && current.is_day ? "Daytime" : "Nighttime"}</span>
            </div>
          </div>
        </section>

        <section className="stats">
          {[
            [Droplets, "Humidity", current && `${current.relative_humidity_2m}%`],
            [Wind, "Wind", current && `${Math.round(current.wind_speed_10m)} km/h`],
            [Eye, "Visibility", current && `${(current.visibility / 1000).toFixed(1)} km`],
            [Gauge, "Pressure", current && `${Math.round(current.surface_pressure)} hPa`],
          ].map(([Icon, label, value]) => (
            <div className="stat-card" key={label}>
              <div className="icon-wrap">
                <Icon size={18} />
              </div>
              <div>
                <span>{label}</span>
                <strong>{loading ? "--" : value}</strong>
              </div>
            </div>
          ))}
        </section>

        <section className="section">
          <div className="section-title">
            <h3>Hourly forecast</h3>
            <span>Next 6 hours</span>
          </div>
          <div className="hourly">
            {hourly.map((item, index) => {
              const [label, icon] = getWeather(item.code);
              return (
                <div className={`hour ${index === 0 ? "active" : ""}`} key={item.time}>
                  <span>{index === 0 ? "Now" : formatTime(item.time)}</span>
                  <b title={label}>{icon}</b>
                  <strong>{Math.round(item.temperature)}°</strong>
                </div>
              );
            })}
          </div>
        </section>

        <section className="section details-layout">
          <div className="day-panel">
            <div className="section-title align-start">
              <h3>7-day forecast</h3>
            </div>
            <div className="forecast">
              {weather?.daily.time.map((time, index) => {
                const [label, icon] = getWeather(weather.daily.weather_code[index]);
                const isSelected = index === activeDayIndex;
                return (
                  <button
                    className={`day ${isSelected ? "selected" : ""}`}
                    key={time}
                    type="button"
                    onClick={() => setSelectedDayIndex(index)}
                    aria-pressed={isSelected}
                  >
                    <span>{formatDay(time, index)}</span>
                    <b title={label}>{icon}</b>
                    <strong>
                      {Math.round(weather.daily.temperature_2m_max[index])}° / {Math.round(weather.daily.temperature_2m_min[index])}°
                    </strong>
                    <small>
                      <Wind size={13} /> {Math.round(weather.daily.wind_speed_10m_max[index])} km/h
                    </small>
                    <small>{label}</small>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="detail-panel">
            {selectedDay && (
              <>
                <div className="detail-header">
                  <div>
                    <span>{formatDay(selectedDay.time, activeDayIndex)} overview</span>
                    <h4>{getWeather(selectedDay.code)[0]}</h4>
                  </div>
                  <div className="detail-icon">{getWeather(selectedDay.code)[1]}</div>
                </div>

                <div className="mini-grid">
                  <div className="mini-card">
                    <CloudSun size={18} />
                    <div>
                      <span>Sunrise</span>
                      <strong>{formatTime(selectedDay.sunrise)}</strong>
                    </div>
                  </div>
                  <div className="mini-card">
                    <MoonStar size={18} />
                    <div>
                      <span>Sunset</span>
                      <strong>{formatTime(selectedDay.sunset)}</strong>
                    </div>
                  </div>
                  <div className="mini-card">
                    <Compass size={18} />
                    <div>
                      <span>UV Index</span>
                      <strong>{selectedDay.uvIndex.toFixed(1)}</strong>
                    </div>
                  </div>
                  <div className="mini-card">
                    <CloudRain size={18} />
                    <div>
                      <span>Rain chance</span>
                      <strong>{selectedDay.rainChance}%</strong>
                    </div>
                  </div>
                </div>

                <div className="detail-stats">
                  <div>
                    <span>High / low</span>
                    <strong>
                      {Math.round(selectedDay.high)}° / {Math.round(selectedDay.low)}°
                    </strong>
                  </div>
                  <div>
                    <span>Max wind</span>
                    <strong>{Math.round(selectedDay.wind)} km/h</strong>
                  </div>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="ai-card">
          <div className="ai-title">
            <span>🤖</span>
            <div>
              <h3>AI weather insight</h3>
              <p>Powered by live weather data</p>
            </div>
          </div>
          <p>{insightText}</p>
          <div className="recommendations">
            <span>🌡️ Live conditions</span>
            <span>📍 Local forecast</span>
            <span>💨 Wind tracking</span>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
