// Wind, thermal and scent model. Pure functions over an elevation grid and a forecast;
// no DOM, no map library, so it runs in a worker or on the server as well as the page.
export * from './types';
export { analyzeTerrain, type Terrain } from './terrain';
export { sunPosition, sunTimes } from './sun';
export { weatherAt, sliderHours, type WeatherAt } from './weather';
export {
  fetchNws,
  parseGridData,
  parseObservation,
  parseHourlyForecast,
  type FetchLike,
  type ProviderOptions,
} from './nws';
export { fetchOpenMeteo, parseOpenMeteo } from './openMeteo';
export {
  getForecast,
  memoryCache,
  storageCache,
  forecastKey,
  type ForecastCache,
  type GetForecastOptions,
} from './forecast';
export {
  computeThermals,
  dayPhase,
  thermalWindow,
  mixingWind,
  THERMAL_MIN,
  type ThermalField,
  type DayPhase,
} from './thermal';
export { computeWind, type WindField } from './wind';
export {
  computeScent,
  tracePlume,
  plumeHits,
  checkApproach,
  resample,
  ScentDriver,
  GROUND_WIND,
  type ScentField,
  type Plume,
  type ApproachCheck,
  type ScentHit,
  type ScentCause,
} from './scent';
export { thermalLine, windLine, hourSummary, THERMAL_WORDS } from './describe';
export { createConditionsModel, type ConditionsModel, type HourConditions, type PointReading } from './conditions';
