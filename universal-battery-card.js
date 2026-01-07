/**
 * Universal Battery Card
 * A generic Home Assistant Lovelace card for any battery system
 */

const LitElement = Object.getPrototypeOf(customElements.get('ha-panel-lovelace'));
const html = LitElement.prototype.html;
const css = LitElement.prototype.css;

const CARD_NAME = 'Universal Battery Card';
const CARD_DESCRIPTION = 'A generic battery card for any Home Assistant battery system';

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
  display_type: 2,
  decimal_places: 3,
  icon_charging: 'mdi:lightning-bolt',
  icon_discharging: 'mdi:home-export-outline',
  icon_idle: 'mdi:sleep',
  enable_trickle_charge_filter: false,
  trickle_charge_threshold: 25,
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

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

function normalizeToWh(value, unit) {
  const lowerUnit = (unit || '').toLowerCase();
  if (lowerUnit === 'kwh' || lowerUnit === 'kw') return value * 1000;
  return value;
}

function formatEnergy(wh, decimals = 3) {
  if (Math.abs(wh) >= 1000) {
    return { value: (wh / 1000).toFixed(decimals), unit: 'kWh' };
  }
  return { value: wh.toFixed(0), unit: 'Wh' };
}

function formatPower(watts, decimals = 0) {
  if (Math.abs(watts) >= 1000) {
    return { value: (watts / 1000).toFixed(decimals || 1), unit: 'kW' };
  }
  return { value: Math.round(watts).toString(), unit: 'W' };
}

function formatDuration(minutes) {
  if (minutes === null || minutes < 0) return '--:--:--';
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  const secs = Math.floor((minutes * 60) % 60);
  if (hours > 99) return '99:59:59+';
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function formatTimeOfArrival(minutes) {
  if (minutes === null || minutes < 0) return '--:--';
  const now = new Date();
  const arrival = new Date(now.getTime() + minutes * 60000);
  const month = (arrival.getMonth() + 1).toString().padStart(2, '0');
  const day = arrival.getDate().toString().padStart(2, '0');
  const hours = arrival.getHours().toString().padStart(2, '0');
  const mins = arrival.getMinutes().toString().padStart(2, '0');
  return `${month}/${day} ${hours}:${mins}`;
}

function calculateTimeToTarget(currentEnergy, targetEnergy, powerWatts) {
  if (powerWatts === 0) return null;
  const energyDiff = targetEnergy - currentEnergy;
  if ((energyDiff > 0 && powerWatts < 0) || (energyDiff < 0 && powerWatts > 0)) return null;
  const hours = Math.abs(energyDiff) / Math.abs(powerWatts);
  return hours * 60;
}

function getBatteryStatus(power, threshold = 0) {
  if (power > threshold) return 'charging';
  if (power < -threshold) return 'discharging';
  return 'idle';
}

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

function getStatusIcon(status, config) {
  switch (status) {
    case 'charging': return config.icon_charging ?? 'mdi:lightning-bolt';
    case 'discharging': return config.icon_discharging ?? 'mdi:home-export-outline';
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
  node.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

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
  }

  ha-card {
    padding: 12px;
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

  .card-header {
    text-align: center;
    margin-bottom: 2px;
  }

  .header-title {
    font-size: 0.85em;
    font-weight: bold;
    color: var(--ubc-text-color);
  }

  .header-subtitle {
    font-size: 0.7em;
    color: var(--ubc-secondary-text);
    margin-top: 2px;
  }

  .battery-layout {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 8px;
  }

  .status-icon-section {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 60px;
  }

  .status-icon-section ha-icon {
    --mdc-icon-size: 40px;
    color: var(--ubc-secondary-text);
  }

  .battery-center {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
  }

  .battery-visual {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .battery-icon-wrapper ha-icon {
    --mdc-icon-size: 56px;
  }

  .soc-percent {
    font-size: 2em;
    font-weight: bold;
  }

  .soc-energy {
    font-size: 1em;
    color: var(--ubc-text-color);
    margin-top: 2px;
  }

  .power-display {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 4px;
    color: var(--ubc-secondary-text);
    font-size: 0.95em;
  }

  .power-display ha-icon {
    --mdc-icon-size: 16px;
  }

  .time-section {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
    min-width: 100px;
  }

  .time-item {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
  }

  .time-value {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 1.1em;
    font-weight: 500;
    font-family: monospace;
    color: var(--ubc-text-color);
  }

  .time-value ha-icon {
    --mdc-icon-size: 16px;
    color: var(--ubc-secondary-text);
  }

  .time-label {
    font-size: 0.75em;
    color: var(--ubc-secondary-text);
  }

  .time-value.disabled {
    color: var(--ubc-secondary-text);
    opacity: 0.6;
  }

  .rates-section {
    display: flex;
    gap: 16px;
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px solid var(--divider-color, rgba(255,255,255,0.1));
  }

  .rate-item {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .rate-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .rate-label {
    font-size: 0.75em;
    color: var(--ubc-secondary-text);
  }

  .rate-value {
    font-size: 0.75em;
    color: var(--ubc-text-color);
  }

  .rate-bar {
    height: 4px;
    background: var(--divider-color, rgba(255,255,255,0.1));
    border-radius: 2px;
    overflow: hidden;
  }

  .rate-bar-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .rate-bar-fill.charge {
    background: var(--success-color, #43a047);
  }

  .rate-bar-fill.discharge {
    background: var(--warning-color, #ffa000);
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
  .section-title {
    font-weight: 500;
    margin: 16px 0 8px 0;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--divider-color);
  }
`;

// ============================================================================
// SCHEMAS
// ============================================================================

const EDITOR_TABS = [
  { id: 'general', label: 'General' },
  { id: 'entities', label: 'Entities' },
  { id: 'actions', label: 'Actions' },
  { id: 'soc', label: 'SOC Colors' },
  { id: 'icons', label: 'Icons' },
  { id: 'filters', label: 'Filters' },
];

const GENERAL_SCHEMA = [
  { name: 'name', label: 'Card Name', selector: { text: {} } },
  { name: 'decimal_places', label: 'Decimal Places', selector: { number: { min: 0, max: 4, mode: 'box' } } },
];

const ENTITIES_SCHEMA = [
  { type: 'section', label: 'Required Sensors' },
  { name: 'soc_entity', label: 'SOC Entity', selector: { entity: { domain: 'sensor' } } },
  { name: 'power_entity', label: 'Power Entity', selector: { entity: { domain: 'sensor' } } },

  { type: 'section', label: 'Status Display (Optional)' },
  { name: 'state_entity', label: 'State Entity (overrides auto-detect)', selector: { entity: {} } },
  { name: 'mode_entity', label: 'Mode Entity (e.g. input_select)', selector: { entity: { domain: ['input_select', 'select', 'sensor'] } } },

  { type: 'section', label: 'Energy (Entity or Fixed Value)' },
  { name: 'soc_energy_entity', label: 'SOC Energy Entity', selector: { entity: { domain: 'sensor' } } },

  { type: 'section', label: 'Capacity (Entity or Fixed Value)' },
  { name: 'capacity_entity', label: 'Capacity Entity', selector: { entity: { domain: 'sensor' } } },
  { name: 'capacity', label: 'OR Fixed Capacity (kWh)', selector: { number: { min: 0, max: 1000, step: 0.1, mode: 'box' } } },

  { type: 'section', label: 'Reserve (Entity or Fixed Value)' },
  { name: 'reserve_entity', label: 'Reserve Entity', selector: { entity: { domain: ['sensor', 'number'] } } },
  { name: 'reserve', label: 'OR Fixed Reserve (%)', selector: { number: { min: 0, max: 100, mode: 'box' } } },

  { type: 'section', label: 'Rates (Entity or Fixed Value)' },
  { name: 'charge_rate_entity', label: 'Max Charge Rate Entity', selector: { entity: { domain: ['sensor', 'number'] } } },
  { name: 'charge_rate', label: 'OR Fixed Max Charge Rate (W)', selector: { number: { min: 0, max: 50000, mode: 'box' } } },
  { name: 'discharge_rate_entity', label: 'Max Discharge Rate Entity', selector: { entity: { domain: ['sensor', 'number'] } } },
  { name: 'discharge_rate', label: 'OR Fixed Max Discharge Rate (W)', selector: { number: { min: 0, max: 50000, mode: 'box' } } },
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
    case 'entities': return ENTITIES_SCHEMA.filter(s => s.type !== 'section');
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
              For static values (capacity, reserve, rates), you can either select an entity OR enter a fixed value. Fixed values take priority.
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
  }

  setConfig(config) {
    if (!config) throw new Error('Invalid configuration');
    this._config = { ...DEFAULT_CONFIG, ...config };
  }

  getCardSize() { return 3; }

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
      socEnergyWh = normalizeToWh(socEnergyValue.value, socEnergyValue.unit);
    }

    // Capacity (entity or fixed, fixed is in kWh)
    const capacityData = getEntityOrFixedValue(this.hass, config, 'capacity_entity', 'capacity', 'kWh');
    let capacityWh = null;
    if (capacityData.available && capacityData.value !== null) {
      capacityWh = capacityData.isFixed ? capacityData.value * 1000 : normalizeToWh(capacityData.value, capacityData.unit);
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
      chargeRateW = chargeRateData.isFixed ? chargeRateData.value : normalizeToWh(chargeRateData.value, chargeRateData.unit);
      if (power > 0 && chargeRateW > 0) {
        chargeRatePercent = Math.min(100, (power / chargeRateW) * 100);
      }
    }

    const dischargeRateData = getEntityOrFixedValue(this.hass, config, 'discharge_rate_entity', 'discharge_rate', 'W');
    let dischargeRateW = null;
    let dischargeRatePercent = null;
    if (dischargeRateData.available && dischargeRateData.value !== null) {
      dischargeRateW = dischargeRateData.isFixed ? dischargeRateData.value : normalizeToWh(dischargeRateData.value, dischargeRateData.unit);
      if (power < 0 && dischargeRateW > 0) {
        dischargeRatePercent = Math.min(100, (Math.abs(power) / dischargeRateW) * 100);
      }
    }

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
      decimals,
    };
  }

  render() {
    if (!this.hass || !this._config) return html``;

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
    const statusIcon = getStatusIcon(stats.status, this._config);
    const batteryIcon = getBatteryIcon(stats.socPercent);

    // Get state text - from entity or auto-detect
    let statusText = stats.status.charAt(0).toUpperCase() + stats.status.slice(1);
    if (this._config.state_entity && this.hass.states[this._config.state_entity]) {
      const stateVal = this.hass.states[this._config.state_entity].state;
      statusText = stateVal.charAt(0).toUpperCase() + stateVal.slice(1).toLowerCase();
    }

    // Get mode text from entity
    let modeText = null;
    if (this._config.mode_entity && this.hass.states[this._config.mode_entity]) {
      modeText = this.hass.states[this._config.mode_entity].state;
    }

    // Format values
    const socEnergyFormatted = stats.socEnergyWh !== null ? formatEnergy(stats.socEnergyWh, stats.decimals) : null;
    const capacityFormatted = stats.capacityWh !== null ? formatEnergy(stats.capacityWh, stats.decimals) : null;
    const reserveFormatted = stats.reserveWh !== null ? formatEnergy(stats.reserveWh, 0) : null;
    const powerFormatted = formatPower(stats.power);

    // Power direction icon
    let powerIcon = '';
    if (stats.status === 'charging') powerIcon = 'mdi:arrow-left';
    else if (stats.status === 'discharging') powerIcon = 'mdi:arrow-right';

    // Build subtitle
    let subtitle = '';
    if (capacityFormatted) {
      subtitle += `Capacity: ${capacityFormatted.value} ${capacityFormatted.unit}`;
    }
    if (reserveFormatted && stats.reservePercent !== null) {
      if (subtitle) subtitle += ' | ';
      subtitle += `Reserve: ${reserveFormatted.value} ${reserveFormatted.unit} (${Math.round(stats.reservePercent)}%)`;
    }
    if (modeText) {
      if (subtitle) subtitle += ' | ';
      subtitle += `Mode: ${modeText}`;
    }

    return html`
      <ha-card
        @mousedown=${this._handleTapStart}
        @mouseup=${this._handleTapEnd}
        @mouseleave=${this._handleTapCancel}
        @touchstart=${this._handleTapStart}
        @touchend=${this._handleTapEnd}
        @touchcancel=${this._handleTapCancel}
      >
        <div class="card-header">
          <div class="header-title">${this._config.name} | ${statusText}</div>
          ${subtitle ? html`<div class="header-subtitle">${subtitle}</div>` : ''}
        </div>

        <div class="battery-layout">
          <!-- Left: Status Icon -->
          <div class="status-icon-section">
            <ha-icon icon="${statusIcon}"></ha-icon>
          </div>

          <!-- Center: Battery -->
          <div class="battery-center">
            <div class="battery-visual">
              <div class="battery-icon-wrapper" style="color: ${socColor}">
                <ha-icon icon="${batteryIcon}"></ha-icon>
              </div>
              <span class="soc-percent" style="color: ${socColor}">${stats.socPercent.toFixed(stats.decimals)}%</span>
            </div>
            ${socEnergyFormatted ? html`
              <div class="soc-energy">${socEnergyFormatted.value} ${socEnergyFormatted.unit}</div>
            ` : ''}
            <div class="power-display">
              ${powerIcon ? html`<ha-icon icon="${powerIcon}"></ha-icon>` : ''}
              <span>${stats.status === 'idle' ? '0 W' : `${powerFormatted.value} ${powerFormatted.unit}`}</span>
            </div>
          </div>

          <!-- Right: Time Estimates -->
          <div class="time-section">
            ${stats.status !== 'idle' && stats.targetPercent !== null ? html`
              <div class="time-item">
                <div class="time-value ${stats.timeToTarget === null ? 'disabled' : ''}">
                  <ha-icon icon="mdi:timer-sand"></ha-icon>
                  ${stats.timeToTarget !== null ? formatDuration(stats.timeToTarget) : '--:--:--'}
                </div>
                <div class="time-label">until ${stats.targetPercent}%</div>
              </div>
              <div class="time-item">
                <div class="time-value ${stats.timeToTarget === null ? 'disabled' : ''}">
                  <ha-icon icon="mdi:clock-outline"></ha-icon>
                  ${stats.timeToTarget !== null ? formatTimeOfArrival(stats.timeToTarget) : '--/-- --:--'}
                </div>
                <div class="time-label">at ${stats.targetPercent}%</div>
              </div>
            ` : html`
              <div class="time-item">
                <div class="time-value disabled">
                  <ha-icon icon="mdi:timer-sand"></ha-icon>
                  --:--:--
                </div>
                <div class="time-label">No load</div>
              </div>
              <div class="time-item">
                <div class="time-value disabled">
                  <ha-icon icon="mdi:clock-outline"></ha-icon>
                  --/-- --:--
                </div>
                <div class="time-label">No Load</div>
              </div>
            `}
          </div>
        </div>
        ${this._renderRates(stats)}
      </ha-card>
    `;
  }

  _renderRates(stats) {
    // Only show if at least one rate is configured
    if (stats.chargeRateW === null && stats.dischargeRateW === null) {
      return '';
    }

    return html`
      <div class="rates-section">
        ${stats.chargeRateW !== null ? html`
          <div class="rate-item">
            <div class="rate-header">
              <span class="rate-label">Charge Rate</span>
              <span class="rate-value">${Math.round(stats.chargeRatePercent ?? 0)}%</span>
            </div>
            <div class="rate-bar">
              <div class="rate-bar-fill charge" style="width: ${stats.chargeRatePercent ?? 0}%"></div>
            </div>
            <div class="rate-value">${formatPower(stats.chargeRateW).value} ${formatPower(stats.chargeRateW).unit} max</div>
          </div>
        ` : ''}
        ${stats.dischargeRateW !== null ? html`
          <div class="rate-item">
            <div class="rate-header">
              <span class="rate-label">Discharge Rate</span>
              <span class="rate-value">${Math.round(stats.dischargeRatePercent ?? 0)}%</span>
            </div>
            <div class="rate-bar">
              <div class="rate-bar-fill discharge" style="width: ${stats.dischargeRatePercent ?? 0}%"></div>
            </div>
            <div class="rate-value">${formatPower(stats.dischargeRateW).value} ${formatPower(stats.dischargeRateW).unit} max</div>
          </div>
        ` : ''}
      </div>
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
  `%c UNIVERSAL-BATTERY-CARD %c v1.4.0 `,
  'color: white; background: #3498db; font-weight: bold;',
  'color: #3498db; background: white; font-weight: bold;'
);
