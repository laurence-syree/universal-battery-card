# Universal Battery Card

> **WIP**: This project is a work in progress. Features may be incomplete or change.

A generic Home Assistant Lovelace card for displaying battery information from **any** home battery system. Unlike vendor-specific cards, this card requires manual configuration of all sensors, making it compatible with any battery integration.

## Features

- **SOC Display**: Battery state of charge percentage with color-coded icon
- **Energy Display**: Current battery energy in Wh/kWh
- **Power Flow**: Real-time charge/discharge power with direction indicator
- **Time Estimates**: Estimated time to full charge or reserve level
- **Daily Statistics**: Today's charge and discharge totals
- **Rate Indicators**: Current charge/discharge rate as percentage of maximum
- **Color Thresholds**: 5 customizable SOC levels with individual colors
- **Trickle Charge Filter**: Filter out small power fluctuations
- **Custom Icons**: Configurable icons for charging, discharging, and idle states
- **Visual Editor**: Full point-and-click configuration UI

## Installation

### HACS (Recommended)

1. Open HACS in your Home Assistant instance
2. Click the three dots in the top right corner
3. Select "Custom repositories"
4. Add this repository URL with category "Lovelace"
5. Search for "Universal Battery Card" and install

### Manual Installation

1. Download `universal-battery-card.js` from the latest release
2. Copy to `config/www/universal-battery-card.js`
3. Add resource in Lovelace:
   ```yaml
   resources:
     - url: /local/universal-battery-card.js
       type: module
   ```

## Configuration

### Required Entities

| Entity | Description |
|--------|-------------|
| `soc_entity` | Sensor providing battery state of charge (%) |
| `power_entity` | Sensor providing battery power (W). Positive = charging, negative = discharging |

### Optional Entities

| Entity | Description |
|--------|-------------|
| `soc_energy_entity` | Current battery energy (Wh/kWh) |
| `capacity_entity` | Total battery capacity |
| `charge_rate_entity` | Maximum charge rate |
| `discharge_rate_entity` | Maximum discharge rate |
| `reserve_entity` | Battery reserve percentage |
| `daily_charge_entity` | Today's charge energy total |
| `daily_discharge_entity` | Today's discharge energy total |

### Example YAML Configuration

```yaml
type: custom:universal-battery-card
name: Home Battery
soc_entity: sensor.battery_soc
power_entity: sensor.battery_power
soc_energy_entity: sensor.battery_soc_kwh
capacity_entity: sensor.battery_capacity
charge_rate_entity: number.battery_max_charge
discharge_rate_entity: number.battery_max_discharge
reserve_entity: number.battery_reserve
daily_charge_entity: sensor.battery_charge_today
daily_discharge_entity: sensor.battery_discharge_today
```

### Minimal Configuration

```yaml
type: custom:universal-battery-card
name: Battery
soc_entity: sensor.battery_soc
power_entity: sensor.battery_power
```

### Display Options

```yaml
display_type: 2           # 0=Wh, 1=kWh, 2=Dynamic
decimal_places: 2
display_abs_power: false  # Show power without +/- sign
show_rates: true          # Show charge/discharge rate bars
show_daily_energy: true   # Show daily energy statistics
```

### SOC Color Thresholds

```yaml
soc_threshold_very_high: 80
soc_threshold_high: 60
soc_threshold_medium: 40
soc_threshold_low: 20

# RGB colors (arrays)
soc_colour_very_high: [0, 69, 23]
soc_colour_high: [67, 160, 71]
soc_colour_medium: [255, 166, 0]
soc_colour_low: [219, 68, 55]
soc_colour_very_low: [94, 0, 0]

# Or use theme variables
soc_colour_input: theme_var
soc_colour_very_high: --success-color
```

### Custom Icons

```yaml
icon_charging: mdi:lightning-bolt
icon_discharging: mdi:home-battery
icon_idle: mdi:sleep
```

### Trickle Charge Filter

```yaml
enable_trickle_charge_filter: true
trickle_charge_threshold: 25  # Watts
```

### Depth of Discharge Settings

```yaml
custom_dod_enabled: true
custom_dod_percent: 90        # 90% usable capacity
calculate_reserve_from_dod: true
display_custom_dod_stats: true
```

## Visual Editor

The card includes a full visual configuration editor accessible through the Home Assistant UI. Click "Edit" on any card to access tabs for:

- **General**: Card name
- **Entities**: All sensor entity pickers
- **SOC Colors**: Threshold percentages and colors
- **Display**: Units, decimal places, visibility toggles
- **Icons**: Custom status icons
- **Filters**: Trickle charge settings

## Development

This card is a single vanilla JavaScript file with no build step required. It uses Home Assistant's built-in LitElement library.

To modify, simply edit `universal-battery-card.js` and copy to your Home Assistant installation.

## License

MIT

## Credits

Inspired by [givtcp-battery-card](https://github.com/Codegnosis/givtcp-battery-card) by Codegnosis.
