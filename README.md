# Universal Battery Card

A generic Home Assistant Lovelace card for displaying battery information from **any** home battery system. Unlike vendor-specific cards, this card requires manual configuration of all sensors, making it compatible with any battery integration.

## Features

- **SOC Display**: Battery state of charge percentage with color-coded icon
- **Energy Display**: Current battery energy in Wh/kWh
- **Power Flow**: Real-time charge/discharge power with direction indicator
- **Time Estimates**: Estimated time to target and ETA
- **Color Thresholds**: 5 customizable SOC levels with individual colors
- **Custom Status**: Optional entity for custom state text display
- **Mode Display**: Optional entity to show current battery mode
- **Fixed Values**: Use entities or fixed values for capacity, reserve, and rates
- **Tap Actions**: Configurable tap, hold, and double-tap actions
- **Trickle Charge Filter**: Filter out small power fluctuations
- **Custom Icons**: Configurable icons for charging, discharging, and idle states
- **Visual Editor**: Full point-and-click configuration UI

## Installation

### HACS (Recommended)

1. Open HACS in your Home Assistant instance
2. Click the three dots in the top right corner
3. Select "Custom repositories"
4. Add this repository URL with category "Dashboard"
5. Search for "Universal Battery Card" and install

### Manual Installation

1. Download `universal-battery-card.js` from the latest release
2. Copy to `config/www/universal-battery-card.js`
3. Add resource in Dashboard settings or via YAML:
   ```yaml
   resources:
     - url: /local/universal-battery-card.js
       type: module
   ```

## Configuration

### Required Entities

| Option | Description |
|--------|-------------|
| `soc_entity` | Sensor providing battery state of charge (%) |
| `power_entity` | Sensor providing battery power (W). Positive = charging, negative = discharging |

### Optional Entities

| Option | Description |
|--------|-------------|
| `state_entity` | Custom state text (overrides auto-detected Charging/Discharging/Idle) |
| `mode_entity` | Battery mode display (e.g., from input_select) |
| `soc_energy_entity` | Current battery energy in Wh/kWh |
| `capacity_entity` | Total battery capacity (or use fixed `capacity`) |
| `reserve_entity` | Battery reserve percentage (or use fixed `reserve`) |
| `charge_rate_entity` | Max charge rate (or use fixed `charge_rate`) |
| `discharge_rate_entity` | Max discharge rate (or use fixed `discharge_rate`) |

### Fixed Values

Instead of entities, you can set fixed values:

| Option | Description |
|--------|-------------|
| `capacity` | Fixed capacity in kWh |
| `reserve` | Fixed reserve percentage |
| `charge_rate` | Fixed max charge rate in W |
| `discharge_rate` | Fixed max discharge rate in W |

### Example Configuration

```yaml
type: custom:universal-battery-card
name: Home Battery
soc_entity: sensor.battery_soc
power_entity: sensor.battery_power
soc_energy_entity: sensor.battery_soc_kwh
capacity: 5.2
reserve: 4
state_entity: sensor.battery_state
mode_entity: input_select.battery_mode
```

### Minimal Configuration

```yaml
type: custom:universal-battery-card
name: Battery
soc_entity: sensor.battery_soc
power_entity: sensor.battery_power
```

### SOC Color Thresholds

```yaml
soc_threshold_very_high: 80
soc_threshold_high: 60
soc_threshold_medium: 40
soc_threshold_low: 20

# RGB colors (arrays)
soc_colour_very_high: [0, 128, 0]
soc_colour_high: [0, 128, 0]
soc_colour_medium: [255, 166, 0]
soc_colour_low: [219, 68, 55]
soc_colour_very_low: [139, 0, 0]
```

Note: "Very Low" color applies to any SOC below the "Low" threshold.

### Custom Icons

```yaml
icon_charging: mdi:lightning-bolt
icon_discharging: mdi:home-export-outline
icon_idle: mdi:sleep
```

### Tap Actions

```yaml
tap_action:
  action: more-info
  entity: sensor.battery_soc
hold_action:
  action: navigate
  navigation_path: /lovelace/energy
double_tap_action:
  action: none
```

Supported actions: `more-info`, `navigate`, `url`, `call-service`, `none`

### Trickle Charge Filter

```yaml
enable_trickle_charge_filter: true
trickle_charge_threshold: 25  # Watts
```

## Visual Editor

The card includes a full visual configuration editor. Click "Edit" on any card to access tabs for:

- **General**: Card name, decimal places
- **Entities**: All sensor/entity pickers and fixed values
- **Actions**: Tap, hold, and double-tap actions
- **SOC Colors**: Threshold percentages and colors
- **Icons**: Custom status icons
- **Filters**: Trickle charge settings

## Development

This card is a single vanilla JavaScript file with no build step required. It uses Home Assistant's built-in LitElement library.

To modify, simply edit `universal-battery-card.js` and copy to your Home Assistant installation.

## License

MIT - See [LICENSE](LICENSE) file.

## Credits

This project is based on [givtcp-battery-card](https://github.com/Codegnosis/givtcp-battery-card) by [Codegnosis](https://github.com/Codegnosis). The original card was designed specifically for GivTCP/GivEnergy systems - this fork removes the vendor-specific dependencies to work with any battery system.
