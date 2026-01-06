/**
 * Universal Battery Card
 * A generic Home Assistant Lovelace card for any battery system
 *
 * Installation:
 * 1. Copy this file to your Home Assistant config/www/ folder
 * 2. Add as a resource: /local/universal-battery-card.js (type: module)
 */

const LitElement = Object.getPrototypeOf(customElements.get('ha-panel-lovelace'));
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

// ============================================================================
// CONSTANTS
// ============================================================================

const CARD_NAME = 'Universal Battery Card';
const CARD_DESCRIPTION = 'A generic battery card for any Home Assistant battery system';

const DEFAULT_CONFIG = {
  name: 'Battery',
  soc_threshold_very_high: 80,
  soc_threshold_high: 60,
  soc_threshold_medium: 40,
  soc_threshold_low: 20,
  soc_colour_very_high: [0, 69, 23],
  soc_colour_high: [67, 160, 71],
  soc_colour_medium: [255, 166, 0],
  soc_colour_low: [219, 68, 55],
  soc_colour_very_low: [94, 0, 0],
  display_type: 2, // 0=Wh, 1=kWh, 2=Dynamic
  decimal_places: 2,
  display_abs_power: false,
  show_rates: true,
  show_daily_energy: true,
  icon_charging: 'mdi:lightning-bolt',
  icon_discharging: 'mdi:home-battery',
  icon_idle: 'mdi:sleep',
  enable_trickle_charge_filter: false,
  trickle_charge_threshold: 25,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function getEntityValue(hass, entityId) {
  if (!entityId) return { value: null, unit: '', available: false };

  const entity = hass.states[entityId];
  if (!entity) return { value: null, unit: '', available: false };

  const state = parseFloat(entity.state);
  if (isNaN(state)) return { value: null, unit: '', available: false };

  const unit = entity.attributes.unit_of_measurement || '';
  return { value: state, unit, available: true };
}

function entityExists(hass, entityId) {
  return entityId && entityId in hass.states;
}

function formatPower(watts, displayType, decimalPlaces, useAbsolute = false) {
  const absValue = useAbsolute ? Math.abs(watts) : watts;

  if (displayType === 1) { // kWh
    return { value: (absValue / 1000).toFixed(decimalPlaces), unit: 'kW' };
  }

  if (displayType === 2 && Math.abs(absValue) >= 1000) { // Dynamic
    return { value: (absValue / 1000).toFixed(decimalPlaces), unit: 'kW' };
  }

  return { value: absValue.toFixed(decimalPlaces), unit: 'W' };
}

function formatEnergy(wattHours, displayType, decimalPlaces) {
  if (displayType === 1) { // kWh
    return { value: (wattHours / 1000).toFixed(decimalPlaces), unit: 'kWh' };
  }

  if (displayType === 2 && Math.abs(wattHours) >= 1000) { // Dynamic
    return { value: (wattHours / 1000).toFixed(decimalPlaces), unit: 'kWh' };
  }

  return { value: wattHours.toFixed(decimalPlaces), unit: 'Wh' };
}

function normalizeToWh(value, unit) {
  const lowerUnit = unit.toLowerCase();
  if (lowerUnit === 'kwh' || lowerUnit === 'kw') {
    return value * 1000;
  }
  return value;
}

function calculateTimeToTarget(currentEnergy, targetEnergy, powerWatts) {
  if (powerWatts === 0) return null;

  const energyDiff = targetEnergy - currentEnergy;
  if ((energyDiff > 0 && powerWatts < 0) || (energyDiff < 0 && powerWatts > 0)) {
    return null;
  }

  const hours = Math.abs(energyDiff) / Math.abs(powerWatts);
  return Math.round(hours * 60);
}

function formatDuration(minutes) {
  if (minutes === null || minutes < 0) return '--:--';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours > 99) return '99:59+';

  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

function getBatteryStatus(power, threshold = 0) {
  if (power > threshold) return 'charging';
  if (power < -threshold) return 'discharging';
  return 'idle';
}

function getSocColor(socPercent, config) {
  const thresholdVeryHigh = config.soc_threshold_very_high ?? 80;
  const thresholdHigh = config.soc_threshold_high ?? 60;
  const thresholdMedium = config.soc_threshold_medium ?? 40;
  const thresholdLow = config.soc_threshold_low ?? 20;

  let color;
  if (socPercent >= thresholdVeryHigh) {
    color = config.soc_colour_very_high ?? [0, 69, 23];
  } else if (socPercent >= thresholdHigh) {
    color = config.soc_colour_high ?? [67, 160, 71];
  } else if (socPercent >= thresholdMedium) {
    color = config.soc_colour_medium ?? [255, 166, 0];
  } else if (socPercent >= thresholdLow) {
    color = config.soc_colour_low ?? [219, 68, 55];
  } else {
    color = config.soc_colour_very_low ?? [94, 0, 0];
  }

  if (typeof color === 'string') return `var(${color})`;
  if (Array.isArray(color) && color.length >= 3) {
    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
  }
  return 'var(--primary-color)';
}

function getStatusIcon(status, config) {
  switch (status) {
    case 'charging': return config.icon_charging ?? 'mdi:lightning-bolt';
    case 'discharging': return config.icon_discharging ?? 'mdi:home-battery';
    default: return config.icon_idle ?? 'mdi:sleep';
  }
}

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

function fireEvent(node, type, detail = {}) {
  const event = new CustomEvent(type, {
    bubbles: true,
    composed: true,
    detail,
  });
  node.dispatchEvent(event);
}

// ============================================================================
// STYLES
// ============================================================================

const cardStyles = css`
  :host {
    --ubc-primary-color: var(--primary-color);
    --ubc-text-color: var(--primary-text-color);
    --ubc-secondary-text-color: var(--secondary-text-color);
  }

  ha-card {
    padding: 16px;
    box-sizing: border-box;
  }

  .card-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 16px;
  }

  .card-header .name {
    font-size: 1.2em;
    font-weight: 500;
    color: var(--ubc-text-color);
  }

  .card-content {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .battery-main {
    display: flex;
    align-items: center;
    gap: 16px;
  }

  .battery-icon-container {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
  }

  .battery-icon-container ha-icon {
    --mdc-icon-size: 48px;
    color: var(--battery-color, var(--ubc-primary-color));
  }

  .battery-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .soc-display {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }

  .soc-percent {
    font-size: 2em;
    font-weight: bold;
  }

  .soc-energy {
    font-size: 1em;
    color: var(--ubc-secondary-text-color);
  }

  .status-display {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--ubc-secondary-text-color);
  }

  .status-display ha-icon {
    --mdc-icon-size: 18px;
  }

  .status-display .power {
    font-weight: 500;
  }

  .power-bar-container {
    width: 100%;
    margin-top: 8px;
  }

  .power-bar {
    height: 8px;
    background: var(--divider-color, #e0e0e0);
    border-radius: 4px;
    overflow: hidden;
  }

  .power-bar-fill {
    height: 100%;
    border-radius: 4px;
    transition: width 0.3s ease;
  }

  .power-bar-fill.charging {
    background: var(--success-color, #43a047);
  }

  .power-bar-fill.discharging {
    background: var(--warning-color, #ffa000);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-top: 8px;
  }

  .stat-item {
    display: flex;
    flex-direction: column;
    padding: 8px;
    background: var(--secondary-background-color, rgba(0, 0, 0, 0.05));
    border-radius: 8px;
  }

  .stat-label {
    font-size: 0.8em;
    color: var(--ubc-secondary-text-color);
    margin-bottom: 4px;
  }

  .stat-value {
    font-size: 1.1em;
    font-weight: 500;
    color: var(--ubc-text-color);
  }

  .stat-value.time {
    font-family: monospace;
  }

  .rates-section {
    display: flex;
    gap: 16px;
    margin-top: 8px;
  }

  .rate-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .rate-label {
    font-size: 0.8em;
    color: var(--ubc-secondary-text-color);
  }

  .rate-bar {
    height: 6px;
    background: var(--divider-color, #e0e0e0);
    border-radius: 3px;
    overflow: hidden;
  }

  .rate-bar-fill {
    height: 100%;
    border-radius: 3px;
    transition: width 0.3s ease;
  }

  .rate-bar-fill.charge {
    background: var(--success-color, #43a047);
  }

  .rate-bar-fill.discharge {
    background: var(--warning-color, #ffa000);
  }

  .rate-value {
    font-size: 0.85em;
    color: var(--ubc-text-color);
  }

  .daily-energy {
    display: flex;
    gap: 16px;
    padding-top: 8px;
    border-top: 1px solid var(--divider-color, #e0e0e0);
  }

  .daily-item {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .daily-item ha-icon {
    --mdc-icon-size: 20px;
    color: var(--ubc-secondary-text-color);
  }

  .daily-item.charge ha-icon {
    color: var(--success-color, #43a047);
  }

  .daily-item.discharge ha-icon {
    color: var(--warning-color, #ffa000);
  }

  .daily-info {
    display: flex;
    flex-direction: column;
  }

  .daily-label {
    font-size: 0.75em;
    color: var(--ubc-secondary-text-color);
  }

  .daily-value {
    font-size: 0.95em;
    font-weight: 500;
    color: var(--ubc-text-color);
  }

  .error-container {
    padding: 16px;
    text-align: center;
    color: var(--error-color, #db4437);
  }

  .error-container ha-icon {
    --mdc-icon-size: 48px;
    margin-bottom: 8px;
  }

  .error-message {
    font-size: 0.9em;
  }

  .missing-entities {
    margin-top: 8px;
    font-size: 0.8em;
    color: var(--ubc-secondary-text-color);
  }

  .missing-entities ul {
    list-style: none;
    padding: 0;
    margin: 8px 0 0 0;
  }

  .missing-entities li {
    padding: 2px 0;
  }
`;

const editorStyles = css`
  :host {
    display: block;
  }

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
    transition: border-color 0.2s;
    font-size: 0.9em;
  }

  .tab:hover {
    background: var(--secondary-background-color);
  }

  .tab.active {
    border-bottom-color: var(--primary-color);
    color: var(--primary-color);
  }

  .tab-content {
    padding: 8px 0;
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
  { id: 'soc', label: 'SOC Colors' },
  { id: 'display', label: 'Display' },
  { id: 'icons', label: 'Icons' },
  { id: 'filters', label: 'Filters' },
];

const GENERAL_SCHEMA = [
  { name: 'name', label: 'Card Name', selector: { text: {} } },
];

const ENTITIES_SCHEMA = [
  {
    name: 'soc_entity',
    label: 'SOC Entity (Required)',
    selector: { entity: { domain: 'sensor' } },
  },
  {
    name: 'power_entity',
    label: 'Power Entity (Required)',
    selector: { entity: { domain: 'sensor' } },
  },
  {
    name: 'soc_energy_entity',
    label: 'SOC Energy Entity',
    selector: { entity: { domain: 'sensor' } },
  },
  {
    name: 'capacity_entity',
    label: 'Capacity Entity',
    selector: { entity: { domain: 'sensor' } },
  },
  {
    name: 'charge_rate_entity',
    label: 'Max Charge Rate Entity',
    selector: { entity: { domain: ['sensor', 'number'] } },
  },
  {
    name: 'discharge_rate_entity',
    label: 'Max Discharge Rate Entity',
    selector: { entity: { domain: ['sensor', 'number'] } },
  },
  {
    name: 'reserve_entity',
    label: 'Reserve Entity',
    selector: { entity: { domain: ['sensor', 'number'] } },
  },
  {
    name: 'daily_charge_entity',
    label: 'Daily Charge Entity',
    selector: { entity: { domain: 'sensor' } },
  },
  {
    name: 'daily_discharge_entity',
    label: 'Daily Discharge Entity',
    selector: { entity: { domain: 'sensor' } },
  },
];

const SOC_SCHEMA = [
  {
    name: 'soc_threshold_very_high',
    label: 'Very High Threshold (%)',
    selector: { number: { min: 0, max: 100, mode: 'slider' } },
  },
  {
    name: 'soc_colour_very_high',
    label: 'Very High Color',
    selector: { color_rgb: {} },
  },
  {
    name: 'soc_threshold_high',
    label: 'High Threshold (%)',
    selector: { number: { min: 0, max: 100, mode: 'slider' } },
  },
  {
    name: 'soc_colour_high',
    label: 'High Color',
    selector: { color_rgb: {} },
  },
  {
    name: 'soc_threshold_medium',
    label: 'Medium Threshold (%)',
    selector: { number: { min: 0, max: 100, mode: 'slider' } },
  },
  {
    name: 'soc_colour_medium',
    label: 'Medium Color',
    selector: { color_rgb: {} },
  },
  {
    name: 'soc_threshold_low',
    label: 'Low Threshold (%)',
    selector: { number: { min: 0, max: 100, mode: 'slider' } },
  },
  {
    name: 'soc_colour_low',
    label: 'Low Color',
    selector: { color_rgb: {} },
  },
  {
    name: 'soc_colour_very_low',
    label: 'Very Low Color',
    selector: { color_rgb: {} },
  },
];

const DISPLAY_SCHEMA = [
  {
    name: 'display_type',
    label: 'Display Units',
    selector: {
      select: {
        options: [
          { value: 0, label: 'Wh / W' },
          { value: 1, label: 'kWh / kW' },
          { value: 2, label: 'Dynamic (auto-scale)' },
        ],
      },
    },
  },
  {
    name: 'decimal_places',
    label: 'Decimal Places',
    selector: { number: { min: 0, max: 4, mode: 'slider' } },
  },
  {
    name: 'display_abs_power',
    label: 'Display Absolute Power Values',
    selector: { boolean: {} },
  },
  {
    name: 'show_rates',
    label: 'Show Charge/Discharge Rates',
    selector: { boolean: {} },
  },
  {
    name: 'show_daily_energy',
    label: 'Show Daily Energy Statistics',
    selector: { boolean: {} },
  },
];

const ICONS_SCHEMA = [
  { name: 'icon_charging', label: 'Charging Icon', selector: { icon: {} } },
  { name: 'icon_discharging', label: 'Discharging Icon', selector: { icon: {} } },
  { name: 'icon_idle', label: 'Idle Icon', selector: { icon: {} } },
];

const FILTERS_SCHEMA = [
  {
    name: 'enable_trickle_charge_filter',
    label: 'Enable Trickle Charge Filter',
    selector: { boolean: {} },
  },
  {
    name: 'trickle_charge_threshold',
    label: 'Filter Threshold (W)',
    selector: { number: { min: 0, max: 100, mode: 'slider' } },
  },
];

function getSchemaForTab(tabId) {
  switch (tabId) {
    case 'general': return GENERAL_SCHEMA;
    case 'entities': return ENTITIES_SCHEMA;
    case 'soc': return SOC_SCHEMA;
    case 'display': return DISPLAY_SCHEMA;
    case 'icons': return ICONS_SCHEMA;
    case 'filters': return FILTERS_SCHEMA;
    default: return [];
  }
}

// ============================================================================
// EDITOR COMPONENT
// ============================================================================

class UniversalBatteryCardEditor extends LitElement {
  static get properties() {
    return {
      hass: { attribute: false },
      _config: { state: true },
      _currentTab: { state: true },
    };
  }

  static get styles() {
    return editorStyles;
  }

  constructor() {
    super();
    this._currentTab = 'general';
  }

  setConfig(config) {
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  _handleTabChange(tabId) {
    this._currentTab = tabId;
  }

  _valueChanged(ev) {
    if (!this._config || !this.hass) return;

    const detail = ev.detail;
    if (detail && detail.value !== undefined) {
      this._config = { ...this._config, ...detail.value };
      fireEvent(this, 'config-changed', { config: this._config });
    }
  }

  _computeLabel(schema) {
    return schema.label || schema.name;
  }

  render() {
    if (!this.hass || !this._config) return html``;

    return html`
      <div class="card-config">
        ${this._renderTabs()}
        <div class="tab-content">
          ${this._renderTabContent()}
        </div>
      </div>
    `;
  }

  _renderTabs() {
    return html`
      <div class="tab-bar">
        ${EDITOR_TABS.map(
          (tab) => html`
            <div
              class="tab ${this._currentTab === tab.id ? 'active' : ''}"
              @click=${() => this._handleTabChange(tab.id)}
            >
              ${tab.label}
            </div>
          `
        )}
      </div>
    `;
  }

  _renderTabContent() {
    const schema = getSchemaForTab(this._currentTab);

    const helperText =
      this._currentTab === 'entities'
        ? html`
            <div class="helper-text">
              Configure the Home Assistant entities for your battery system. Only SOC
              and Power entities are required.
            </div>
          `
        : '';

    return html`
      ${helperText}
      <ha-form
        .hass=${this.hass}
        .data=${this._config}
        .schema=${schema}
        .computeLabel=${this._computeLabel}
        @value-changed=${this._valueChanged}
      ></ha-form>
    `;
  }
}

customElements.define('universal-battery-card-editor', UniversalBatteryCardEditor);

// ============================================================================
// MAIN CARD COMPONENT
// ============================================================================

class UniversalBatteryCard extends LitElement {
  static get properties() {
    return {
      hass: { attribute: false },
      _config: { state: true },
    };
  }

  static get styles() {
    return cardStyles;
  }

  static getConfigElement() {
    return document.createElement('universal-battery-card-editor');
  }

  static getStubConfig() {
    return {
      type: 'custom:universal-battery-card',
      name: 'Battery',
      soc_entity: '',
      power_entity: '',
    };
  }

  setConfig(config) {
    if (!config) throw new Error('Invalid configuration');
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  getCardSize() {
    return 3;
  }

  _getMissingEntities() {
    const missing = [];

    if (!this._config.soc_entity) {
      missing.push('SOC Entity (required)');
    } else if (!entityExists(this.hass, this._config.soc_entity)) {
      missing.push(`SOC Entity: ${this._config.soc_entity}`);
    }

    if (!this._config.power_entity) {
      missing.push('Power Entity (required)');
    } else if (!entityExists(this.hass, this._config.power_entity)) {
      missing.push(`Power Entity: ${this._config.power_entity}`);
    }

    return missing;
  }

  _calculateStats() {
    if (!this.hass || !this._config) return null;

    const config = this._config;
    const displayType = config.display_type ?? 2;
    const decimals = config.decimal_places ?? 2;

    // Required values
    const socValue = getEntityValue(this.hass, config.soc_entity);
    const powerValue = getEntityValue(this.hass, config.power_entity);

    if (!socValue.available || socValue.value === null) return null;
    if (!powerValue.available || powerValue.value === null) return null;

    // Normalize and filter power
    let power = powerValue.value;
    if (powerValue.unit.toLowerCase() === 'kw') {
      power = power * 1000;
    }

    if (config.enable_trickle_charge_filter && Math.abs(power) < (config.trickle_charge_threshold ?? 25)) {
      power = 0;
    }

    const status = getBatteryStatus(power, 0);
    const powerFormatted = formatPower(power, displayType, decimals, config.display_abs_power ?? false);

    // Optional values
    const socEnergyValue = getEntityValue(this.hass, config.soc_energy_entity);
    const capacityValue = getEntityValue(this.hass, config.capacity_entity);
    const chargeRateValue = getEntityValue(this.hass, config.charge_rate_entity);
    const dischargeRateValue = getEntityValue(this.hass, config.discharge_rate_entity);
    const reserveValue = getEntityValue(this.hass, config.reserve_entity);
    const dailyChargeValue = getEntityValue(this.hass, config.daily_charge_entity);
    const dailyDischargeValue = getEntityValue(this.hass, config.daily_discharge_entity);

    // Process SOC energy
    let socEnergy = null;
    let socEnergyUnit = '';
    if (socEnergyValue.available && socEnergyValue.value !== null) {
      socEnergy = socEnergyValue.value;
      socEnergyUnit = socEnergyValue.unit;
    }

    // Process capacity
    let capacity = null;
    let usableCapacity = null;
    if (capacityValue.available && capacityValue.value !== null) {
      capacity = normalizeToWh(capacityValue.value, capacityValue.unit);
      usableCapacity = capacity;
    }

    // Process rates
    let chargeRate = null;
    let dischargeRate = null;
    let chargeRatePercent = null;
    let dischargeRatePercent = null;

    if (chargeRateValue.available && chargeRateValue.value !== null) {
      chargeRate = normalizeToWh(chargeRateValue.value, chargeRateValue.unit);
      if (power > 0 && chargeRate > 0) {
        chargeRatePercent = Math.min(100, (Math.abs(power) / chargeRate) * 100);
      }
    }

    if (dischargeRateValue.available && dischargeRateValue.value !== null) {
      dischargeRate = normalizeToWh(dischargeRateValue.value, dischargeRateValue.unit);
      if (power < 0 && dischargeRate > 0) {
        dischargeRatePercent = Math.min(100, (Math.abs(power) / dischargeRate) * 100);
      }
    }

    // Process reserve
    let reserve = null;
    if (reserveValue.available && reserveValue.value !== null) {
      reserve = reserveValue.value;
    }

    // Process daily energy
    let dailyCharge = null;
    let dailyChargeUnit = '';
    let dailyDischarge = null;
    let dailyDischargeUnit = '';

    if (dailyChargeValue.available && dailyChargeValue.value !== null) {
      const formatted = formatEnergy(
        normalizeToWh(dailyChargeValue.value, dailyChargeValue.unit),
        displayType,
        decimals
      );
      dailyCharge = parseFloat(formatted.value);
      dailyChargeUnit = formatted.unit;
    }

    if (dailyDischargeValue.available && dailyDischargeValue.value !== null) {
      const formatted = formatEnergy(
        normalizeToWh(dailyDischargeValue.value, dailyDischargeValue.unit),
        displayType,
        decimals
      );
      dailyDischarge = parseFloat(formatted.value);
      dailyDischargeUnit = formatted.unit;
    }

    // Calculate time estimates
    let timeToFull = null;
    let timeToReserve = null;

    if (socEnergy !== null && capacity !== null) {
      const socEnergyWh = normalizeToWh(socEnergy, socEnergyUnit);

      if (status === 'charging') {
        timeToFull = calculateTimeToTarget(socEnergyWh, capacity, power);
      }

      if (status === 'discharging' && reserve !== null) {
        const reserveEnergy = capacity * (reserve / 100);
        timeToReserve = calculateTimeToTarget(socEnergyWh, reserveEnergy, power);
      }
    }

    return {
      socPercent: socValue.value,
      socEnergy,
      socEnergyUnit,
      power,
      powerDisplay: powerFormatted.value,
      powerUnit: powerFormatted.unit,
      status,
      capacity,
      usableCapacity,
      chargeRate,
      dischargeRate,
      chargeRatePercent,
      dischargeRatePercent,
      reserve,
      dailyCharge,
      dailyChargeUnit,
      dailyDischarge,
      dailyDischargeUnit,
      timeToFull,
      timeToReserve,
    };
  }

  render() {
    if (!this.hass || !this._config) return html``;

    const missingEntities = this._getMissingEntities();
    if (missingEntities.length > 0) {
      return this._renderError(missingEntities);
    }

    const stats = this._calculateStats();
    if (!stats) {
      return this._renderError(['Unable to read sensor values']);
    }

    const socColor = getSocColor(stats.socPercent, this._config);
    const statusIcon = getStatusIcon(stats.status, this._config);

    return html`
      <ha-card>
        ${this._config.name
          ? html`
              <div class="card-header">
                <span class="name">${this._config.name}</span>
              </div>
            `
          : ''}

        <div class="card-content">
          ${this._renderBatteryMain(stats, socColor, statusIcon)}
          ${this._renderPowerBar(stats)}
          ${this._renderTimeEstimates(stats)}
          ${this._config.show_rates !== false ? this._renderRates(stats) : ''}
          ${this._config.show_daily_energy !== false ? this._renderDailyEnergy(stats) : ''}
        </div>
      </ha-card>
    `;
  }

  _renderError(missingEntities) {
    return html`
      <ha-card>
        <div class="error-container">
          <ha-icon icon="mdi:alert-circle"></ha-icon>
          <div class="error-message">Configuration Error</div>
          <div class="missing-entities">
            Missing or invalid entities:
            <ul>
              ${missingEntities.map((entity) => html`<li>${entity}</li>`)}
            </ul>
          </div>
        </div>
      </ha-card>
    `;
  }

  _renderBatteryMain(stats, socColor, statusIcon) {
    const batteryIcon = getBatteryIcon(stats.socPercent);

    return html`
      <div class="battery-main">
        <div class="battery-icon-container" style="--battery-color: ${socColor}">
          <ha-icon icon="${batteryIcon}"></ha-icon>
        </div>

        <div class="battery-info">
          <div class="soc-display">
            <span class="soc-percent" style="color: ${socColor}">
              ${Math.round(stats.socPercent)}%
            </span>
            ${stats.socEnergy !== null
              ? html`
                  <span class="soc-energy">
                    ${stats.socEnergy.toFixed(this._config.decimal_places ?? 2)}
                    ${stats.socEnergyUnit}
                  </span>
                `
              : ''}
          </div>

          <div class="status-display">
            <ha-icon icon="${statusIcon}"></ha-icon>
            <span class="power">
              ${stats.status === 'idle'
                ? 'Idle'
                : `${stats.powerDisplay} ${stats.powerUnit}`}
            </span>
            <span class="status-text">
              ${stats.status === 'charging'
                ? 'Charging'
                : stats.status === 'discharging'
                  ? 'Discharging'
                  : ''}
            </span>
          </div>
        </div>
      </div>
    `;
  }

  _renderPowerBar(stats) {
    if (stats.status === 'idle') return '';

    let percent = 0;
    if (stats.status === 'charging' && stats.chargeRatePercent !== null) {
      percent = stats.chargeRatePercent;
    } else if (stats.status === 'discharging' && stats.dischargeRatePercent !== null) {
      percent = stats.dischargeRatePercent;
    } else {
      percent = Math.min(100, (Math.abs(stats.power) / 5000) * 100);
    }

    const barClass = stats.status === 'charging' ? 'charging' : 'discharging';

    return html`
      <div class="power-bar-container">
        <div class="power-bar">
          <div class="power-bar-fill ${barClass}" style="width: ${percent}%"></div>
        </div>
      </div>
    `;
  }

  _renderTimeEstimates(stats) {
    if (stats.timeToFull === null && stats.timeToReserve === null &&
        stats.reserve === null && stats.usableCapacity === null) {
      return '';
    }

    return html`
      <div class="stats-grid">
        ${stats.timeToFull !== null
          ? html`
              <div class="stat-item">
                <span class="stat-label">Time to Full</span>
                <span class="stat-value time">${formatDuration(stats.timeToFull)}</span>
              </div>
            `
          : ''}
        ${stats.timeToReserve !== null
          ? html`
              <div class="stat-item">
                <span class="stat-label">Time to Reserve</span>
                <span class="stat-value time">${formatDuration(stats.timeToReserve)}</span>
              </div>
            `
          : ''}
        ${stats.reserve !== null
          ? html`
              <div class="stat-item">
                <span class="stat-label">Reserve</span>
                <span class="stat-value">${stats.reserve}%</span>
              </div>
            `
          : ''}
        ${stats.usableCapacity !== null
          ? html`
              <div class="stat-item">
                <span class="stat-label">Usable Capacity</span>
                <span class="stat-value">
                  ${(stats.usableCapacity / 1000).toFixed(this._config.decimal_places ?? 2)} kWh
                </span>
              </div>
            `
          : ''}
      </div>
    `;
  }

  _renderRates(stats) {
    if (stats.chargeRate === null && stats.dischargeRate === null) return '';

    return html`
      <div class="rates-section">
        ${stats.chargeRate !== null
          ? html`
              <div class="rate-item">
                <span class="rate-label">Charge Rate</span>
                <div class="rate-bar">
                  <div class="rate-bar-fill charge" style="width: ${stats.chargeRatePercent ?? 0}%"></div>
                </div>
                <span class="rate-value">
                  ${Math.round(stats.chargeRatePercent ?? 0)}% of ${(stats.chargeRate / 1000).toFixed(1)} kW
                </span>
              </div>
            `
          : ''}
        ${stats.dischargeRate !== null
          ? html`
              <div class="rate-item">
                <span class="rate-label">Discharge Rate</span>
                <div class="rate-bar">
                  <div class="rate-bar-fill discharge" style="width: ${stats.dischargeRatePercent ?? 0}%"></div>
                </div>
                <span class="rate-value">
                  ${Math.round(stats.dischargeRatePercent ?? 0)}% of ${(stats.dischargeRate / 1000).toFixed(1)} kW
                </span>
              </div>
            `
          : ''}
      </div>
    `;
  }

  _renderDailyEnergy(stats) {
    if (stats.dailyCharge === null && stats.dailyDischarge === null) return '';

    return html`
      <div class="daily-energy">
        ${stats.dailyCharge !== null
          ? html`
              <div class="daily-item charge">
                <ha-icon icon="mdi:arrow-down-bold"></ha-icon>
                <div class="daily-info">
                  <span class="daily-label">Charged Today</span>
                  <span class="daily-value">${stats.dailyCharge} ${stats.dailyChargeUnit}</span>
                </div>
              </div>
            `
          : ''}
        ${stats.dailyDischarge !== null
          ? html`
              <div class="daily-item discharge">
                <ha-icon icon="mdi:arrow-up-bold"></ha-icon>
                <div class="daily-info">
                  <span class="daily-label">Discharged Today</span>
                  <span class="daily-value">${stats.dailyDischarge} ${stats.dailyDischargeUnit}</span>
                </div>
              </div>
            `
          : ''}
      </div>
    `;
  }
}

customElements.define('universal-battery-card', UniversalBatteryCard);

// Register with HA custom cards picker
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'universal-battery-card',
  name: CARD_NAME,
  description: CARD_DESCRIPTION,
  preview: true,
});

console.info(
  `%c UNIVERSAL-BATTERY-CARD %c v1.0.0 `,
  'color: white; background: #3498db; font-weight: bold;',
  'color: #3498db; background: white; font-weight: bold;'
);
