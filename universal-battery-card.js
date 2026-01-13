/**
 * Universal Battery Card
 * A generic Home Assistant Lovelace card for any battery system
 */

const LitElement = Object.getPrototypeOf(customElements.get('ha-panel-lovelace'));
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

const CARD_NAME = 'Universal Battery Card';
const CARD_DESCRIPTION = 'A generic battery card for any Home Assistant battery system';
const VERSION = '2.0.0';

const DEFAULT_CONFIG = {
  name: 'Battery',
  soc_threshold_very_high: 80,
  soc_threshold_high: 60,
  soc_threshold_medium: 40,
  soc_threshold_low: 20,
  soc_colour_very_high: [0, 128, 0],
  soc_colour_high: [0, 128, 0],
  soc_colour_medium: [255, 166, 0],
  soc_colour_low: [219, 68, 55],
  soc_colour_very_low: [139, 0, 0],
  decimal_places: 3,
  icon_charging: 'mdi:lightning-bolt',
  icon_discharging: 'mdi:home-export-outline',
  icon_idle: 'mdi:sleep',
  enable_trickle_charge_filter: false,
  trickle_charge_threshold: 25,
  compact: false,
  // New v2.0 options
  temp_entity: null,
  cycles_entity: null,
  health_entity: null,
  cutoff_entity: null,
  cutoff: null,
  gauge_thickness: 15, // Ring thickness as % of gauge (5-15, default 15)
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Gets a value from either a fixed config value or an entity state
 * @param {Object} hass - Home Assistant instance
 * @param {Object} config - Card configuration
 * @param {string} entityKey - Config key for entity ID
 * @param {string} fixedKey - Config key for fixed value
 * @param {string} [defaultUnit=''] - Default unit if not provided
 * @returns {{value: number|null, unit: string, available: boolean, isFixed: boolean}}
 */
function getEntityOrFixedValue(hass, config, entityKey, fixedKey, defaultUnit = '') {
  // Check for fixed value first
  const fixedValue = config[fixedKey];
  if (fixedValue !== undefined && fixedValue !== null && fixedValue !== '') {
    return { value: parseFloat(fixedValue), unit: defaultUnit, available: true, isFixed: true };
  }

  // Fall back to entity
  const entityId = config[entityKey];
  if (!entityId) return { value: null, unit: '', available: false, isFixed: false };

  const entity = hass.states[entityId];
  if (!entity) return { value: null, unit: '', available: false, isFixed: false };

  const state = parseFloat(entity.state);
  if (isNaN(state)) return { value: null, unit: '', available: false, isFixed: false };

  const unit = entity.attributes.unit_of_measurement || defaultUnit;
  return { value: state, unit, available: true, isFixed: false };
}

/**
 * Gets a numeric value from an entity state
 * @param {Object} hass - Home Assistant instance
 * @param {string} entityId - Entity ID to read
 * @returns {{value: number|null, unit: string, available: boolean}}
 */
function getEntityValue(hass, entityId) {
  if (!entityId) return { value: null, unit: '', available: false };
  const entity = hass.states[entityId];
  if (!entity) return { value: null, unit: '', available: false };
  const state = parseFloat(entity.state);
  if (isNaN(state)) return { value: null, unit: '', available: false };
  const unit = entity.attributes.unit_of_measurement || '';
  return { value: state, unit, available: true };
}

/**
 * Checks if an entity exists in Home Assistant
 * @param {Object} hass - Home Assistant instance
 * @param {string} entityId - Entity ID to check
 * @returns {boolean}
 */
function entityExists(hass, entityId) {
  return entityId && entityId in hass.states;
}

/**
 * Converts kW/kWh values to W/Wh (multiplies by 1000)
 * @param {number} value - The value to normalize
 * @param {string} unit - The unit (kW, kWh, W, Wh)
 * @returns {number} Value in base units (W or Wh)
 */
function normalizeUnit(value, unit) {
  const lowerUnit = (unit || '').toLowerCase();
  if (lowerUnit === 'kwh' || lowerUnit === 'kw') return value * 1000;
  return value;
}

/**
 * Formats energy value with appropriate unit (Wh or kWh)
 * @param {number} wh - Energy in watt-hours
 * @param {number} [decimals=3] - Decimal places for kWh
 * @returns {{value: string, unit: string}}
 */
function formatEnergy(wh, decimals = 3) {
  if (Math.abs(wh) >= 1000) {
    return { value: (wh / 1000).toFixed(decimals), unit: 'kWh' };
  }
  return { value: wh.toFixed(0), unit: 'Wh' };
}

/**
 * Formats power value with appropriate unit (W or kW)
 * @param {number} watts - Power in watts
 * @param {number} [decimals=0] - Decimal places
 * @returns {{value: string, unit: string}}
 */
function formatPower(watts, decimals = 0) {
  if (Math.abs(watts) >= 1000) {
    return { value: (watts / 1000).toFixed(decimals || 1), unit: 'kW' };
  }
  return { value: Math.round(watts).toString(), unit: 'W' };
}

/**
 * Formats minutes as HH:MM:SS duration string
 * @param {number|null} minutes - Duration in minutes
 * @returns {string} Formatted duration or '--:--:--'
 */
function formatDuration(minutes) {
  if (minutes === null || minutes < 0) return '--:--:--';
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  const secs = Math.floor((minutes * 60) % 60);
  if (hours > 99) return '99:59:59+';
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Calculates and formats estimated time of arrival
 * @param {number|null} minutes - Minutes from now
 * @returns {string} Formatted as 'MM/DD HH:MM' or '--/-- --:--'
 */
function formatTimeOfArrival(minutes) {
  if (minutes === null || minutes < 0) return '--/-- --:--';
  const now = new Date();
  const arrival = new Date(now.getTime() + minutes * 60000);
  const month = (arrival.getMonth() + 1).toString().padStart(2, '0');
  const day = arrival.getDate().toString().padStart(2, '0');
  const hours = arrival.getHours().toString().padStart(2, '0');
  const mins = arrival.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${mins}`;
}

/**
 * Calculates time to reach target energy level
 * @param {number} currentEnergy - Current energy in Wh
 * @param {number} targetEnergy - Target energy in Wh
 * @param {number} powerWatts - Current power (+ charging, - discharging)
 * @returns {number|null} Minutes to target or null if unreachable
 */
function calculateTimeToTarget(currentEnergy, targetEnergy, powerWatts) {
  if (powerWatts === 0) return null;
  const energyDiff = targetEnergy - currentEnergy;
  if ((energyDiff > 0 && powerWatts < 0) || (energyDiff < 0 && powerWatts > 0)) return null;
  const hours = Math.abs(energyDiff) / Math.abs(powerWatts);
  return hours * 60;
}

/**
 * Determines battery status from power value
 * @param {number} power - Power in watts (+ charging, - discharging)
 * @param {number} [threshold=0] - Minimum power to consider active
 * @returns {'charging'|'discharging'|'idle'}
 */
function getBatteryStatus(power, threshold = 0) {
  if (power > threshold) return 'charging';
  if (power < -threshold) return 'discharging';
  return 'idle';
}

/**
 * Gets the color for a SOC percentage based on thresholds
 * @param {number} socPercent - State of charge percentage
 * @param {Object} config - Card configuration with threshold/color settings
 * @returns {string} CSS color value (rgb() or var())
 */
function getSocColor(socPercent, config) {
  const thresholds = [
    { threshold: config.soc_threshold_very_high ?? 80, color: config.soc_colour_very_high ?? [0, 128, 0] },
    { threshold: config.soc_threshold_high ?? 60, color: config.soc_colour_high ?? [0, 128, 0] },
    { threshold: config.soc_threshold_medium ?? 40, color: config.soc_colour_medium ?? [255, 166, 0] },
    { threshold: config.soc_threshold_low ?? 20, color: config.soc_colour_low ?? [219, 68, 55] },
  ];

  for (const t of thresholds) {
    if (socPercent >= t.threshold) {
      if (typeof t.color === 'string') return `var(${t.color})`;
      if (Array.isArray(t.color)) return `rgb(${t.color[0]}, ${t.color[1]}, ${t.color[2]})`;
    }
  }

  const veryLow = config.soc_colour_very_low ?? [139, 0, 0];
  if (typeof veryLow === 'string') return `var(${veryLow})`;
  return `rgb(${veryLow[0]}, ${veryLow[1]}, ${veryLow[2]})`;
}

/**
 * Gets the MDI icon for a battery status
 * @param {'charging'|'discharging'|'idle'} status - Battery status
 * @param {Object} config - Card configuration with icon settings
 * @returns {string} MDI icon name
 */
function getStatusIcon(status, config) {
  switch (status) {
    case 'charging': return config.icon_charging ?? 'mdi:lightning-bolt';
    case 'discharging': return config.icon_discharging ?? 'mdi:home-export-outline';
    default: return config.icon_idle ?? 'mdi:sleep';
  }
}

/**
 * Gets the battery level icon for a SOC percentage
 * @param {number} socPercent - State of charge percentage
 * @returns {string} MDI battery icon name
 */
function getBatteryIcon(socPercent) {
  if (socPercent >= 95) return 'mdi:battery';
  if (socPercent >= 85) return 'mdi:battery-90';
  if (socPercent >= 75) return 'mdi:battery-80';
  if (socPercent >= 65) return 'mdi:battery-70';
  if (socPercent >= 55) return 'mdi:battery-60';
  if (socPercent >= 45) return 'mdi:battery-50';
  if (socPercent >= 35) return 'mdi:battery-40';
  if (socPercent >= 25) return 'mdi:battery-30';
  if (socPercent >= 15) return 'mdi:battery-20';
  if (socPercent >= 5) return 'mdi:battery-10';
  return 'mdi:battery-outline';
}

/**
 * Fires a custom DOM event
 * @param {HTMLElement} node - Element to dispatch from
 * @param {string} type - Event type name
 * @param {Object} [detail={}] - Event detail data
 */
function fireEvent(node, type, detail = {}) {
  node.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

/**
 * Handles tap/hold/double-tap actions
 * @param {HTMLElement} node - Element that triggered the action
 * @param {Object} hass - Home Assistant instance
 * @param {Object} config - Card configuration
 * @param {Object} action - Action configuration (action, entity, etc.)
 */
function handleAction(node, hass, config, action) {
  if (!action || action.action === 'none') return;

  switch (action.action) {
    case 'more-info':
      fireEvent(node, 'hass-more-info', { entityId: action.entity || config.soc_entity });
      break;
    case 'navigate':
      if (action.navigation_path) {
        window.history.pushState(null, '', action.navigation_path);
        fireEvent(window, 'location-changed');
      }
      break;
    case 'url':
      if (action.url_path) {
        window.open(action.url_path, action.new_tab ? '_blank' : '_self');
      }
      break;
    case 'call-service':
      if (action.service) {
        const [domain, service] = action.service.split('.');
        hass.callService(domain, service, action.service_data || {}, action.target || {});
      }
      break;
    case 'fire-dom-event':
      fireEvent(node, 'll-custom', action);
      break;
  }
}

// ============================================================================
// STYLES
// ============================================================================

const cardStyles = css`
  :host {
    --ubc-text-color: var(--primary-text-color);
    --ubc-secondary-text: var(--secondary-text-color);
    --ubc-gauge-bg: var(--divider-color, #3a3a3a);
    --ubc-gauge-size: 180px;
    --ubc-power-gauge-size: 140px;
  }

  ha-card {
    padding: 16px;
    cursor: pointer;
    -webkit-tap-highlight-color: transparent;
    transition: filter 0.2s ease;
  }

  ha-card:hover {
    filter: brightness(1.1);
  }

  ha-card:active {
    filter: brightness(1.2);
  }

  /* Header Section */
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 16px;
  }

  .header-left {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .title-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .title {
    font-size: 1.4em;
    font-weight: bold;
    color: var(--ubc-text-color);
  }

  .mode {
    font-size: 1em;
    color: var(--ubc-secondary-text);
  }

  .title-row ha-icon {
    --mdc-icon-size: 18px;
    color: var(--ubc-secondary-text);
    opacity: 0.7;
  }

  .state-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 1.1em;
    color: var(--ubc-text-color);
  }

  .state-row ha-icon {
    --mdc-icon-size: 20px;
    color: var(--ubc-secondary-text);
  }

  .capacity-row {
    font-size: 0.9em;
    color: var(--ubc-secondary-text);
  }

  /* Stats Panel */
  .stats-panel {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }

  .stat {
    font-size: 0.85em;
    color: var(--ubc-secondary-text);
  }

  .stat span {
    color: var(--ubc-text-color);
    font-weight: 500;
  }

  /* Gauges Container */
  .gauges-container {
    display: flex;
    justify-content: space-around;
    align-items: center;
    gap: 20px;
    padding: 10px 0;
  }

  /* Gauge Base Styles */
  .gauge-wrapper {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .gauge {
    position: relative;
    width: var(--ubc-gauge-size);
    height: var(--ubc-gauge-size);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .gauge::before {
    content: '';
    position: absolute;
    inset: var(--ring-thickness, 15%);
    border-radius: 50%;
    background: var(--ha-card-background, var(--card-background-color, #1c1c1c));
    z-index: 1;
  }

  .gauge-cap {
    position: absolute;
    width: var(--ring-thickness, 15%);
    height: var(--ring-thickness, 15%);
    border-radius: 50%;
    z-index: 2;
    transform: translate(-50%, -50%);
  }

  .gauge-center {
    position: relative;
    z-index: 2;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  /* Main SOC Gauge */
  .main-gauge .gauge-center ha-icon {
    --mdc-icon-size: 48px;
  }

  .main-gauge .soc-value {
    font-size: 2.5em;
    font-weight: bold;
    line-height: 1;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .main-gauge .energy-value {
    font-size: 1.1em;
    color: var(--ubc-text-color);
    margin-top: 4px;
  }

  /* Gauge Labels (Reserve/Cutoff) */
  .gauge-labels {
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    pointer-events: none;
  }

  .gauge-label {
    position: absolute;
    font-size: 0.75em;
    color: var(--ubc-secondary-text);
    white-space: nowrap;
  }

  .gauge-label.reserve {
    top: -5px;
    left: 10%;
    transform: translateY(-100%);
  }

  .gauge-label.cutoff {
    top: -5px;
    right: 10%;
    transform: translateY(-100%);
  }

  /* Gauge Markers */
  .marker {
    position: absolute;
    width: 4px;
    height: 14px;
    border-radius: 2px;
    top: 0;
    left: 50%;
    margin-left: -2px;
    z-index: 3;
  }

  .marker.reserve {
    background: var(--error-color, #db4437);
  }

  .marker.cutoff {
    background: var(--success-color, #43a047);
  }

  /* Power Gauge */
  .power-gauge-wrapper .gauge {
    width: var(--ubc-power-gauge-size);
    height: var(--ubc-power-gauge-size);
  }

  .power-gauge .gauge-center {
    gap: 2px;
  }

  .power-gauge .power-percent {
    font-size: 1.3em;
    color: var(--ubc-text-color);
  }

  .power-gauge .power-value {
    font-size: 1.8em;
    font-weight: bold;
    line-height: 1;
  }

  .power-gauge .power-direction {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 0.9em;
    color: var(--ubc-secondary-text);
  }

  .power-gauge .power-direction ha-icon {
    --mdc-icon-size: 20px;
  }

  /* Rate Labels under power gauge */
  .rate-labels {
    display: flex;
    justify-content: space-between;
    width: 100%;
    margin-top: 8px;
    padding: 0 10px;
  }

  .rate-label-item {
    font-size: 0.7em;
    color: var(--ubc-secondary-text);
    text-align: center;
  }

  .rate-label-item span {
    display: block;
    color: var(--ubc-text-color);
    font-weight: 500;
  }

  /* Footer */
  .footer {
    text-align: center;
    margin-top: 16px;
    padding-top: 12px;
    border-top: 1px solid var(--divider-color, rgba(255,255,255,0.1));
    font-size: 0.95em;
    color: var(--ubc-secondary-text);
  }

  /* Error and Loading States */
  .error-container {
    padding: 16px;
    text-align: center;
    color: var(--error-color, #db4437);
  }

  .error-container ha-icon {
    --mdc-icon-size: 48px;
    margin-bottom: 8px;
  }

  .skeleton {
    opacity: 0.5;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 0.5; }
    50% { opacity: 0.3; }
  }

  /* Compact Mode */
  ha-card.compact {
    padding: 12px;
  }

  ha-card.compact .header {
    margin-bottom: 8px;
  }

  ha-card.compact .header-left {
    width: 100%;
  }

  ha-card.compact .title-row {
    justify-content: center;
  }

  ha-card.compact .title {
    font-size: 1em;
  }

  ha-card.compact .mode,
  ha-card.compact .title-row ha-icon,
  ha-card.compact .state-row,
  ha-card.compact .capacity-row,
  ha-card.compact .stats-panel {
    display: none;
  }

  ha-card.compact .gauges-container {
    padding: 0;
  }

  ha-card.compact .power-gauge-wrapper,
  ha-card.compact .gauge-labels,
  ha-card.compact .footer {
    display: none;
  }

  ha-card.compact .gauge {
    --ubc-gauge-size: 100px;
  }

  ha-card.compact .main-gauge .gauge-center ha-icon {
    --mdc-icon-size: 28px;
  }

  ha-card.compact .main-gauge .soc-value {
    font-size: 1.4em;
  }

  ha-card.compact .main-gauge .energy-value {
    display: none;
  }
`;

const editorStyles = css`
  .tab-bar {
    display: flex;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--divider-color);
    margin-bottom: 16px;
  }
  .tab {
    padding: 8px 16px;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    font-size: 0.9em;
  }
  .tab:hover { background: var(--secondary-background-color); }
  .tab.active {
    border-bottom-color: var(--primary-color);
    color: var(--primary-color);
  }
  .helper-text {
    font-size: 0.85em;
    color: var(--secondary-text-color);
    margin-bottom: 16px;
  }
`;

// ============================================================================
// SCHEMAS
// ============================================================================

const EDITOR_TABS = [
  { id: 'general', label: 'General' },
  { id: 'entities', label: 'Entities' },
  { id: 'stats', label: 'Stats' },
  { id: 'actions', label: 'Actions' },
  { id: 'soc', label: 'SOC Colors' },
  { id: 'icons', label: 'Icons' },
  { id: 'filters', label: 'Filters' },
];

const GENERAL_SCHEMA = [
  { name: 'name', label: 'Card Name', selector: { text: {} } },
  { name: 'decimal_places', label: 'Decimal Places', selector: { number: { min: 0, max: 4, mode: 'box' } } },
  { name: 'compact', label: 'Compact Mode', selector: { boolean: {} } },
  { name: 'gauge_thickness', label: 'Gauge Ring Thickness (%)', selector: { number: { min: 5, max: 15, mode: 'slider' } } },
];

const ENTITIES_SCHEMA = [
  // Required Sensors
  { name: 'soc_entity', label: 'SOC Entity', selector: { entity: { domain: 'sensor' } } },
  { name: 'power_entity', label: 'Power Entity', selector: { entity: { domain: 'sensor' } } },
  // Status Display (Optional)
  { name: 'state_entity', label: 'State Entity (overrides auto-detect)', selector: { entity: {} } },
  { name: 'mode_entity', label: 'Mode Entity (e.g. input_select)', selector: { entity: { domain: ['input_select', 'select', 'sensor'] } } },
  // Energy (Entity or Fixed Value)
  { name: 'soc_energy_entity', label: 'SOC Energy Entity', selector: { entity: { domain: 'sensor' } } },
  // Capacity (Entity or Fixed Value)
  { name: 'capacity_entity', label: 'Capacity Entity', selector: { entity: { domain: 'sensor' } } },
  { name: 'capacity', label: 'OR Fixed Capacity (kWh)', selector: { number: { min: 0, max: 1000, step: 0.1, mode: 'box' } } },
  // Reserve (Entity or Fixed Value)
  { name: 'reserve_entity', label: 'Reserve Entity', selector: { entity: { domain: ['sensor', 'number'] } } },
  { name: 'reserve', label: 'OR Fixed Reserve (%)', selector: { number: { min: 0, max: 100, mode: 'box' } } },
  // Rates (Entity or Fixed Value)
  { name: 'charge_rate_entity', label: 'Max Charge Rate Entity', selector: { entity: { domain: ['sensor', 'number'] } } },
  { name: 'charge_rate', label: 'OR Fixed Max Charge Rate (W)', selector: { number: { min: 0, max: 50000, mode: 'box' } } },
  { name: 'discharge_rate_entity', label: 'Max Discharge Rate Entity', selector: { entity: { domain: ['sensor', 'number'] } } },
  { name: 'discharge_rate', label: 'OR Fixed Max Discharge Rate (W)', selector: { number: { min: 0, max: 50000, mode: 'box' } } },
  // Cutoff (max charge limit)
  { name: 'cutoff_entity', label: 'Cutoff Entity (max charge %)', selector: { entity: { domain: ['sensor', 'number'] } } },
  { name: 'cutoff', label: 'OR Fixed Cutoff (%)', selector: { number: { min: 0, max: 100, mode: 'box' } } },
];

const STATS_SCHEMA = [
  { name: 'temp_entity', label: 'Temperature Entity', selector: { entity: { domain: 'sensor' } } },
  { name: 'cycles_entity', label: 'Battery Cycles Entity', selector: { entity: { domain: 'sensor' } } },
  { name: 'health_entity', label: 'Battery Health Entity', selector: { entity: { domain: 'sensor' } } },
];

const SOC_SCHEMA = [
  { name: 'soc_threshold_very_high', label: 'Very High Threshold (%)', selector: { number: { min: 0, max: 100, mode: 'slider' } } },
  { name: 'soc_colour_very_high', label: 'Very High Color', selector: { color_rgb: {} } },
  { name: 'soc_threshold_high', label: 'High Threshold (%)', selector: { number: { min: 0, max: 100, mode: 'slider' } } },
  { name: 'soc_colour_high', label: 'High Color', selector: { color_rgb: {} } },
  { name: 'soc_threshold_medium', label: 'Medium Threshold (%)', selector: { number: { min: 0, max: 100, mode: 'slider' } } },
  { name: 'soc_colour_medium', label: 'Medium Color', selector: { color_rgb: {} } },
  { name: 'soc_threshold_low', label: 'Low Threshold (%)', selector: { number: { min: 0, max: 100, mode: 'slider' } } },
  { name: 'soc_colour_low', label: 'Low Color', selector: { color_rgb: {} } },
  { name: 'soc_colour_very_low', label: 'Very Low Color', selector: { color_rgb: {} } },
];

const ICONS_SCHEMA = [
  { name: 'icon_charging', label: 'Charging Icon', selector: { icon: {} } },
  { name: 'icon_discharging', label: 'Discharging Icon', selector: { icon: {} } },
  { name: 'icon_idle', label: 'Idle Icon', selector: { icon: {} } },
];

const FILTERS_SCHEMA = [
  { name: 'enable_trickle_charge_filter', label: 'Enable Trickle Charge Filter', selector: { boolean: {} } },
  { name: 'trickle_charge_threshold', label: 'Filter Threshold (W)', selector: { number: { min: 0, max: 100, mode: 'slider' } } },
];

const ACTIONS_SCHEMA = [
  {
    name: 'tap_action',
    label: 'Tap Action',
    selector: {
      ui_action: {}
    },
  },
  {
    name: 'hold_action',
    label: 'Hold Action',
    selector: {
      ui_action: {}
    },
  },
  {
    name: 'double_tap_action',
    label: 'Double Tap Action',
    selector: {
      ui_action: {}
    },
  },
];

function getSchemaForTab(tabId) {
  switch (tabId) {
    case 'general': return GENERAL_SCHEMA;
    case 'entities': return ENTITIES_SCHEMA;
    case 'stats': return STATS_SCHEMA;
    case 'actions': return ACTIONS_SCHEMA;
    case 'soc': return SOC_SCHEMA;
    case 'icons': return ICONS_SCHEMA;
    case 'filters': return FILTERS_SCHEMA;
    default: return [];
  }
}

// ============================================================================
// EDITOR
// ============================================================================

class UniversalBatteryCardEditor extends LitElement {
  static get properties() {
    return {
      hass: { attribute: false },
      _config: { state: true },
      _currentTab: { state: true },
    };
  }

  static get styles() { return editorStyles; }

  constructor() {
    super();
    this._currentTab = 'general';
  }

  setConfig(config) {
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) return;
    const detail = ev.detail;
    if (detail && detail.value !== undefined) {
      this._config = { ...this._config, ...detail.value };
      fireEvent(this, 'config-changed', { config: this._config });
    }
  }

  _computeLabel(schema) { return schema.label || schema.name; }

  render() {
    if (!this.hass || !this._config) return html``;

    return html`
      <div class="card-config">
        <div class="tab-bar">
          ${EDITOR_TABS.map(tab => html`
            <div class="tab ${this._currentTab === tab.id ? 'active' : ''}"
                 @click=${() => this._currentTab = tab.id}>
              ${tab.label}
            </div>
          `)}
        </div>
        <div class="tab-content">
          ${this._currentTab === 'entities' ? html`
            <div class="helper-text">
              For static values (capacity, reserve, rates, cutoff), you can either select an entity OR enter a fixed value. Fixed values take priority.
            </div>
          ` : ''}
          ${this._currentTab === 'stats' ? html`
            <div class="helper-text">
              Optional battery stats displayed in top-right panel. Stats panel only appears if at least one entity is configured.
            </div>
          ` : ''}
          ${this._currentTab === 'soc' ? html`
            <div class="helper-text">
              Set color thresholds for SOC levels. "Very Low" color applies to any value below the "Low" threshold.
            </div>
          ` : ''}
          <ha-form
            .hass=${this.hass}
            .data=${this._config}
            .schema=${getSchemaForTab(this._currentTab)}
            .computeLabel=${this._computeLabel}
            @value-changed=${this._valueChanged}
          ></ha-form>
        </div>
      </div>
    `;
  }
}

if (!customElements.get('universal-battery-card-editor')) {
  customElements.define('universal-battery-card-editor', UniversalBatteryCardEditor);
}

// ============================================================================
// MAIN CARD
// ============================================================================

class UniversalBatteryCard extends LitElement {
  static get properties() {
    return {
      hass: { attribute: false },
      _config: { state: true },
    };
  }

  static get styles() { return cardStyles; }

  static getConfigElement() {
    return document.createElement('universal-battery-card-editor');
  }

  static getStubConfig() {
    return { type: 'custom:universal-battery-card', name: 'Battery', soc_entity: '', power_entity: '' };
  }

  constructor() {
    super();
    this._holdTimer = null;
    this._lastTap = 0;
    this._holdTriggered = false;
    // Bind methods for event listeners
    this._handleTapStart = this._handleTapStart.bind(this);
    this._handleTapEnd = this._handleTapEnd.bind(this);
    this._handleTapCancel = this._handleTapCancel.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('touchstart', this._handleTapStart, { passive: true });
    this.addEventListener('touchend', this._handleTapEnd, { passive: true });
    this.addEventListener('touchcancel', this._handleTapCancel, { passive: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('touchstart', this._handleTapStart);
    this.removeEventListener('touchend', this._handleTapEnd);
    this.removeEventListener('touchcancel', this._handleTapCancel);
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }
  }

  setConfig(config) {
    if (!config) throw new Error('Invalid configuration');
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  getCardSize() {
    if (this._config?.compact) return 3;
    // Full design with gauges needs more vertical space
    return 5;
  }

  _handleTapStart(e) {
    this._holdTriggered = false;
    this._holdTimer = setTimeout(() => {
      this._holdTriggered = true;
      if (this._config.hold_action) {
        handleAction(this, this.hass, this._config, this._config.hold_action);
      }
    }, 500);
  }

  _handleTapEnd(e) {
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }

    if (this._holdTriggered) {
      this._holdTriggered = false;
      return;
    }

    const now = Date.now();
    if (now - this._lastTap < 300 && this._config.double_tap_action) {
      handleAction(this, this.hass, this._config, this._config.double_tap_action);
      this._lastTap = 0;
    } else {
      this._lastTap = now;
      setTimeout(() => {
        if (this._lastTap === now && this._config.tap_action) {
          handleAction(this, this.hass, this._config, this._config.tap_action);
        }
      }, 300);
    }
  }

  _handleTapCancel() {
    if (this._holdTimer) {
      clearTimeout(this._holdTimer);
      this._holdTimer = null;
    }
  }

  _calculateStats() {
    if (!this.hass || !this._config) return null;

    const config = this._config;
    const decimals = config.decimal_places ?? 3;

    // Required: SOC
    const socValue = getEntityValue(this.hass, config.soc_entity);
    if (!socValue.available || socValue.value === null) return null;

    // Required: Power
    const powerValue = getEntityValue(this.hass, config.power_entity);
    if (!powerValue.available || powerValue.value === null) return null;

    let power = powerValue.value;
    if ((powerValue.unit || '').toLowerCase() === 'kw') power *= 1000;
    if (config.enable_trickle_charge_filter && Math.abs(power) < (config.trickle_charge_threshold ?? 25)) {
      power = 0;
    }

    const status = getBatteryStatus(power, 0);

    // SOC Energy (entity only)
    const socEnergyValue = getEntityValue(this.hass, config.soc_energy_entity);
    let socEnergyWh = null;
    if (socEnergyValue.available && socEnergyValue.value !== null) {
      socEnergyWh = normalizeUnit(socEnergyValue.value, socEnergyValue.unit);
    }

    // Capacity (entity or fixed, fixed is in kWh)
    const capacityData = getEntityOrFixedValue(this.hass, config, 'capacity_entity', 'capacity', 'kWh');
    let capacityWh = null;
    if (capacityData.available && capacityData.value !== null) {
      capacityWh = capacityData.isFixed ? capacityData.value * 1000 : normalizeUnit(capacityData.value, capacityData.unit);
    }

    // Reserve (entity or fixed, both in %)
    const reserveData = getEntityOrFixedValue(this.hass, config, 'reserve_entity', 'reserve', '%');
    let reservePercent = null;
    if (reserveData.available && reserveData.value !== null) {
      reservePercent = reserveData.value;
    }

    // Calculate reserve in Wh
    let reserveWh = null;
    if (reservePercent !== null && capacityWh !== null) {
      reserveWh = capacityWh * (reservePercent / 100);
    }

    // Time estimates
    let timeToTarget = null;
    let targetPercent = null;

    if (socEnergyWh !== null && capacityWh !== null && power !== 0) {
      if (status === 'charging') {
        targetPercent = 100;
        timeToTarget = calculateTimeToTarget(socEnergyWh, capacityWh, power);
      } else if (status === 'discharging' && reservePercent !== null) {
        targetPercent = reservePercent;
        const targetEnergy = capacityWh * (reservePercent / 100);
        timeToTarget = calculateTimeToTarget(socEnergyWh, targetEnergy, power);
      }
    }

    // Charge/Discharge rates (entity or fixed, fixed is in W)
    const chargeRateData = getEntityOrFixedValue(this.hass, config, 'charge_rate_entity', 'charge_rate', 'W');
    let chargeRateW = null;
    let chargeRatePercent = null;
    if (chargeRateData.available && chargeRateData.value !== null) {
      chargeRateW = chargeRateData.isFixed ? chargeRateData.value : normalizeUnit(chargeRateData.value, chargeRateData.unit);
      if (power > 0 && chargeRateW > 0) {
        chargeRatePercent = Math.min(100, (power / chargeRateW) * 100);
      }
    }

    const dischargeRateData = getEntityOrFixedValue(this.hass, config, 'discharge_rate_entity', 'discharge_rate', 'W');
    let dischargeRateW = null;
    let dischargeRatePercent = null;
    if (dischargeRateData.available && dischargeRateData.value !== null) {
      dischargeRateW = dischargeRateData.isFixed ? dischargeRateData.value : normalizeUnit(dischargeRateData.value, dischargeRateData.unit);
      if (power < 0 && dischargeRateW > 0) {
        dischargeRatePercent = Math.min(100, (Math.abs(power) / dischargeRateW) * 100);
      }
    }

    // Cutoff (max charge limit %)
    const cutoffData = getEntityOrFixedValue(this.hass, config, 'cutoff_entity', 'cutoff', '%');
    let cutoffPercent = null;
    if (cutoffData.available && cutoffData.value !== null) {
      cutoffPercent = cutoffData.value;
    }

    // Power percentage (relative to max rate)
    let powerPercent = 0;
    if (status === 'charging' && chargeRateW && chargeRateW > 0) {
      powerPercent = Math.min(100, (Math.abs(power) / chargeRateW) * 100);
    } else if (status === 'discharging' && dischargeRateW && dischargeRateW > 0) {
      powerPercent = Math.min(100, (Math.abs(power) / dischargeRateW) * 100);
    }

    // Stats panel entities
    const tempValue = getEntityValue(this.hass, config.temp_entity);
    const cyclesValue = getEntityValue(this.hass, config.cycles_entity);
    const healthValue = getEntityValue(this.hass, config.health_entity);

    const temp = tempValue.available ? tempValue.value : null;
    const tempUnit = tempValue.unit || '°C';
    const cycles = cyclesValue.available ? cyclesValue.value : null;
    const health = healthValue.available ? healthValue.value : null;

    const hasStats = temp !== null || cycles !== null || health !== null;

    return {
      socPercent: socValue.value,
      socEnergyWh,
      power,
      status,
      capacityWh,
      reservePercent,
      reserveWh,
      timeToTarget,
      targetPercent,
      chargeRateW,
      chargeRatePercent,
      dischargeRateW,
      dischargeRatePercent,
      cutoffPercent,
      powerPercent,
      temp,
      tempUnit,
      cycles,
      health,
      hasStats,
      decimals,
    };
  }

  /**
   * Generates conic-gradient background for gauge
   * @param {number} value - Percentage (0-100)
   * @param {string} color - CSS color for filled portion
   * @returns {string} CSS background value
   */
  _getGaugeBackground(value, color) {
    // Full 360 degree circle, color starts at top and fills counter-clockwise
    const degrees = Math.min(100, Math.max(0, value)) * 3.6;
    const startAngle = 360 - degrees;
    return `conic-gradient(from 0deg, var(--ubc-gauge-bg) 0deg ${startAngle}deg, ${color} ${startAngle}deg 360deg)`;
  }

  /**
   * Generates conic-gradient background for power gauge with direction support
   * @param {number} value - Percentage (0-100)
   * @param {string} color - CSS color for filled portion
   * @param {boolean} isCharging - If true, fills clockwise; if false, fills counter-clockwise
   * @returns {string} CSS background value
   */
  _getPowerGaugeBackground(value, color, isCharging) {
    const degrees = Math.min(100, Math.max(0, value)) * 3.6;
    if (isCharging) {
      // Clockwise from top: color from 0 to degrees
      return `conic-gradient(from 0deg, ${color} 0deg ${degrees}deg, var(--ubc-gauge-bg) ${degrees}deg 360deg)`;
    } else {
      // Counter-clockwise from top: color from (360-degrees) to 360
      const startAngle = 360 - degrees;
      return `conic-gradient(from 0deg, var(--ubc-gauge-bg) 0deg ${startAngle}deg, ${color} ${startAngle}deg 360deg)`;
    }
  }

  /**
   * Calculates marker rotation for gauge position
   * @param {number} percent - Position as percentage (0-100)
   * @returns {string} CSS transform value
   */
  _getMarkerRotation(percent) {
    // Full circle starting at top (0deg), going counter-clockwise
    // So 0% = 0deg (top), 50% = 180deg (bottom going left), 100% = 360deg
    const rotation = 360 - (percent * 3.6);
    return `rotate(${rotation}deg)`;
  }

  /**
   * Gets the position for a rounded end cap on the gauge
   * @param {number} percent - Position as percentage (0-100)
   * @param {number} thickness - Ring thickness as percentage (default 15)
   * @returns {{x: number, y: number, startY: number}} Position as percentage from top-left
   */
  _getCapPosition(percent, thickness = 15) {
    // Counter-clockwise from top: angle = -(percent * 3.6) degrees
    // Ring midpoint = 50% - (thickness/2)
    const ringRadius = 50 - (thickness / 2);
    const angleRad = -(percent * 3.6) * (Math.PI / 180);
    const x = 50 + ringRadius * Math.sin(angleRad);
    const y = 50 - ringRadius * Math.cos(angleRad);
    const startY = 50 - ringRadius; // Top position for start cap
    return { x, y, startY };
  }

  /**
   * Gets the position for a rounded end cap on the power gauge with direction support
   * @param {number} percent - Position as percentage (0-100)
   * @param {number} thickness - Ring thickness as percentage
   * @param {boolean} isCharging - If true, calculates for clockwise fill; if false, counter-clockwise
   * @returns {{x: number, y: number, startY: number}} Position as percentage from top-left
   */
  _getPowerCapPosition(percent, thickness, isCharging) {
    const ringRadius = 50 - (thickness / 2);
    const direction = isCharging ? 1 : -1; // Clockwise = +, Counter-clockwise = -
    const angleRad = direction * (percent * 3.6) * (Math.PI / 180);
    const x = 50 + ringRadius * Math.sin(angleRad);
    const y = 50 - ringRadius * Math.cos(angleRad);
    const startY = 50 - ringRadius;
    return { x, y, startY };
  }

  render() {
    if (!this.hass || !this._config) return html``;

    // Show loading state if hass.states is empty (initial load)
    if (Object.keys(this.hass.states).length === 0) {
      return this._renderLoading();
    }

    // Check required entities
    if (!this._config.soc_entity || !entityExists(this.hass, this._config.soc_entity)) {
      return this._renderError('SOC Entity not configured or not found');
    }
    if (!this._config.power_entity || !entityExists(this.hass, this._config.power_entity)) {
      return this._renderError('Power Entity not configured or not found');
    }

    const stats = this._calculateStats();
    if (!stats) return this._renderError('Unable to read sensor values');

    const socColor = getSocColor(stats.socPercent, this._config);
    const batteryIcon = getBatteryIcon(stats.socPercent);

    // Get state text - from entity or auto-detect
    let statusText = stats.status.charAt(0).toUpperCase() + stats.status.slice(1);
    let stateEntityText = null;
    if (this._config.state_entity && this.hass.states[this._config.state_entity]) {
      stateEntityText = this.hass.states[this._config.state_entity].state;
    }

    // Get mode text from entity
    let modeText = null;
    if (this._config.mode_entity && this.hass.states[this._config.mode_entity]) {
      modeText = this.hass.states[this._config.mode_entity].state;
    }

    // Format values
    const socEnergyFormatted = stats.socEnergyWh !== null ? formatEnergy(stats.socEnergyWh, stats.decimals) : null;
    const capacityFormatted = stats.capacityWh !== null ? formatEnergy(stats.capacityWh, stats.decimals) : null;
    const powerFormatted = formatPower(Math.abs(stats.power));
    const chargeRateFormatted = stats.chargeRateW !== null ? formatPower(stats.chargeRateW) : null;
    const dischargeRateFormatted = stats.dischargeRateW !== null ? formatPower(stats.dischargeRateW) : null;

    // Power direction
    const powerDirection = stats.status === 'charging' ? 'Charge' : stats.status === 'discharging' ? 'Discharge' : 'Idle';
    const powerIcon = stats.status === 'charging' ? 'mdi:arrow-left' : stats.status === 'discharging' ? 'mdi:arrow-right' : '';

    // Status icon for display
    const statusIcon = stats.status === 'charging' ? 'mdi:power-plug' :
                       stats.status === 'discharging' ? 'mdi:power-plug-off' : 'mdi:power-plug';

    // Gauge backgrounds
    const socGaugeBackground = this._getGaugeBackground(stats.socPercent, socColor);

    // Power gauge: direction and color based on charging/discharging
    const isCharging = stats.status === 'charging';
    const powerGaugeColor = isCharging ? 'rgb(0, 128, 0)' : 'rgb(255, 166, 0)';
    const powerGaugeBackground = this._getPowerGaugeBackground(stats.powerPercent, powerGaugeColor, isCharging);

    // Gauge thickness
    const thickness = this._config.gauge_thickness ?? 15;
    const socCapPos = this._getCapPosition(stats.socPercent, thickness);
    const powerCapPos = this._getPowerCapPosition(stats.powerPercent, thickness, isCharging);

    // Has rates configured for power gauge
    const hasRates = stats.chargeRateW !== null || stats.dischargeRateW !== null;

    // Footer text
    let footerText = '';
    if (stats.status !== 'idle' && stats.timeToTarget !== null) {
      const durationFormatted = formatDuration(stats.timeToTarget);
      const etaFormatted = formatTimeOfArrival(stats.timeToTarget);
      if (stats.status === 'discharging') {
        footerText = `Runtime: ${durationFormatted}  |  Depletes At: ${etaFormatted}`;
      } else {
        footerText = `Time to Full: ${durationFormatted}  |  Full At: ${etaFormatted}`;
      }
    }

    return html`
      <ha-card
        class="${this._config.compact ? 'compact' : ''}"
        @mousedown=${this._handleTapStart}
        @mouseup=${this._handleTapEnd}
        @mouseleave=${this._handleTapCancel}
      >
        <!-- Header -->
        <div class="header">
          <div class="header-left">
            <div class="title-row">
              <span class="title">${this._config.name}</span>
              ${modeText ? html`<span class="mode">| ${modeText}</span>` : ''}
              <ha-icon icon="mdi:cog"></ha-icon>
            </div>
            <div class="state-row">
              Mode: ${stateEntityText ? stateEntityText : statusText}
              <ha-icon icon="${statusIcon}"></ha-icon>
            </div>
            ${capacityFormatted ? html`
              <div class="capacity-row">Capacity: ${capacityFormatted.value} ${capacityFormatted.unit}</div>
            ` : ''}
          </div>
          ${stats.hasStats ? html`
            <div class="stats-panel">
              ${stats.temp !== null ? html`
                <div class="stat">Battery Temp: <span>${stats.temp}${stats.tempUnit}</span></div>
              ` : ''}
              ${stats.cycles !== null ? html`
                <div class="stat">Battery Cycles: <span>${stats.cycles}</span></div>
              ` : ''}
              ${stats.health !== null ? html`
                <div class="stat">Battery Health: <span>${stats.health}%</span></div>
              ` : ''}
            </div>
          ` : ''}
        </div>

        <!-- Gauges -->
        <div class="gauges-container">
          <!-- Main SOC Gauge -->
          <div class="gauge-wrapper main-gauge-wrapper">
            <div class="gauge main-gauge" style="background: ${socGaugeBackground}; --ring-thickness: ${thickness}%">
              <!-- Rounded end caps -->
              ${stats.socPercent > 0 ? html`
                <div class="gauge-cap" style="background: ${socColor}; top: ${socCapPos.startY}%; left: 50%;"></div>
                <div class="gauge-cap" style="background: ${socColor}; top: ${socCapPos.y}%; left: ${socCapPos.x}%;"></div>
              ` : ''}
              <!-- Markers -->
              ${stats.reservePercent !== null ? html`
                <div class="marker reserve" style="transform-origin: center calc(var(--ubc-gauge-size) / 2); transform: ${this._getMarkerRotation(stats.reservePercent)}"></div>
              ` : ''}
              ${stats.cutoffPercent !== null ? html`
                <div class="marker cutoff" style="transform-origin: center calc(var(--ubc-gauge-size) / 2); transform: ${this._getMarkerRotation(stats.cutoffPercent)}"></div>
              ` : ''}
              <div class="gauge-center">
                <ha-icon icon="${batteryIcon}" style="color: ${socColor}"></ha-icon>
                <span class="soc-value" style="color: ${socColor}">${Math.round(stats.socPercent)}%</span>
                ${socEnergyFormatted ? html`
                  <span class="energy-value">${socEnergyFormatted.value} ${socEnergyFormatted.unit}</span>
                ` : ''}
              </div>
            </div>
            <!-- Labels outside gauge -->
            <div class="gauge-labels">
              ${stats.reservePercent !== null ? html`
                <div class="gauge-label reserve">Reserve ${Math.round(stats.reservePercent)}%</div>
              ` : ''}
              ${stats.cutoffPercent !== null ? html`
                <div class="gauge-label cutoff">Cutoff ${Math.round(stats.cutoffPercent)}%</div>
              ` : ''}
            </div>
          </div>

          <!-- Power Gauge (only if rates configured) -->
          ${hasRates ? html`
            <div class="gauge-wrapper power-gauge-wrapper">
              <div class="gauge power-gauge" style="background: ${powerGaugeBackground}; --ring-thickness: ${thickness}%">
                <!-- Rounded end caps -->
                ${stats.powerPercent > 0 ? html`
                  <div class="gauge-cap" style="background: ${powerGaugeColor}; top: ${powerCapPos.startY}%; left: 50%;"></div>
                  <div class="gauge-cap" style="background: ${powerGaugeColor}; top: ${powerCapPos.y}%; left: ${powerCapPos.x}%;"></div>
                ` : ''}
                <div class="gauge-center">
                  <span class="power-percent">${Math.round(stats.powerPercent)}%</span>
                  <span class="power-value" style="color: ${powerGaugeColor}">${powerFormatted.value} ${powerFormatted.unit}</span>
                  <span class="power-direction">
                    ${powerDirection}
                    ${powerIcon ? html`<ha-icon icon="${powerIcon}" style="color: ${powerGaugeColor}"></ha-icon>` : ''}
                  </span>
                </div>
              </div>
              <div class="rate-labels">
                ${dischargeRateFormatted ? html`
                  <div class="rate-label-item">
                    Max Discharge
                    <span>${dischargeRateFormatted.value} ${dischargeRateFormatted.unit}</span>
                  </div>
                ` : ''}
                ${chargeRateFormatted ? html`
                  <div class="rate-label-item">
                    Max Charge
                    <span>${chargeRateFormatted.value} ${chargeRateFormatted.unit}</span>
                  </div>
                ` : ''}
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Footer -->
        ${footerText ? html`
          <div class="footer">${footerText}</div>
        ` : ''}
      </ha-card>
    `;
  }

  _renderError(message) {
    return html`
      <ha-card>
        <div class="error-container">
          <ha-icon icon="mdi:alert-circle"></ha-icon>
          <div>${message}</div>
        </div>
      </ha-card>
    `;
  }

  _renderLoading() {
    return html`
      <ha-card class="${this._config.compact ? 'compact' : ''}">
        <div class="header">
          <div class="header-left">
            <div class="title-row">
              <span class="title">${this._config.name}</span>
            </div>
            <div class="state-row skeleton">Loading...</div>
          </div>
        </div>
        <div class="gauges-container">
          <div class="gauge-wrapper main-gauge-wrapper">
            <div class="gauge main-gauge skeleton" style="background: var(--ubc-gauge-bg)">
              <div class="gauge-center">
                <ha-icon icon="mdi:battery-50" class="skeleton"></ha-icon>
                <span class="soc-value skeleton">--%</span>
              </div>
            </div>
          </div>
        </div>
      </ha-card>
    `;
  }
}

if (!customElements.get('universal-battery-card')) {
  customElements.define('universal-battery-card', UniversalBatteryCard);
}

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'universal-battery-card',
  name: CARD_NAME,
  description: CARD_DESCRIPTION,
  preview: true,
});

console.info(
  `%c UNIVERSAL-BATTERY-CARD %c v${VERSION} `,
  'color: white; background: #3498db; font-weight: bold;',
  'color: #3498db; background: white; font-weight: bold;'
);
