# Changelog

## Unreleased

- Overhaul gauge sizing so gauges fill available space at any card size or aspect ratio (#6)
- Remove the hard-coded 200 px gauge cap — gauges now grow to fill the tile they're given
- Measure rendered header/footer heights instead of hard-coding them, so layout stays correct when title text wraps, themes change typography, or rows toggle on/off
- Wrap ResizeObserver callbacks in requestAnimationFrame to batch with paint and prevent the "ResizeObserver loop" warning during editor drag-resize
- `getGridOptions` reports `min_columns` / `min_rows` derived from the configured chrome so the resize handles snap to a size the card can actually render; no upper cap so HA's layout decides the maximum

## [v2.3.0](https://github.com/laurence-syree/universal-battery-card/releases/tag/v2.3.0) - 2026-04-09

- Add `power_gauge_scale` option to configure power gauge size relative to main gauge (30-100%, default 78)

## [v2.2.0](https://github.com/laurence-syree/universal-battery-card/releases/tag/v2.2.0) - 2026-04-09

- Add granular display toggles: `show_rate_labels`, `show_power_percent`, `show_power_direction`, `show_gauge_labels`, `show_capacity`, `show_stats` (@ParaDoXke - #4)

## [v2.1.0](https://github.com/laurence-syree/universal-battery-card/releases/tag/v2.1.0) - 2026-04-06

- Add `invert_power` option to reverse power entity value sign (@cbrosius - #3)

## [v2.0.1](https://github.com/laurence-syree/universal-battery-card/releases/tag/v2.0.1) - 2026-01-14

- Update README for HACS default repository

## [v2.0.0](https://github.com/laurence-syree/universal-battery-card/releases/tag/v2.0.0) - 2026-01-13

- Redesign card with circular gauges
- Add responsive sizing with ResizeObserver
- Add entity-specific click handlers for more-info dialogs
- Add display toggle options and header styles (none/title/full)
- Add power gauge directional fill (clockwise charging, counter-clockwise discharging)
- Remove unused Icons tab from editor

## [v1.5.1](https://github.com/laurence-syree/universal-battery-card/releases/tag/v1.5.1) - 2026-01-09

- Add HACS validation GitHub Action
- Fix invalid description field in hacs.json

## [v1.5.0](https://github.com/laurence-syree/universal-battery-card/releases/tag/v1.5.0) - 2026-01-07

- Add loading state
- Add compact mode

## [v1.4.4](https://github.com/laurence-syree/universal-battery-card/releases/tag/v1.4.4) - 2026-01-07

- Code review fixes

## [v1.4.3](https://github.com/laurence-syree/universal-battery-card/releases/tag/v1.4.3) - 2026-01-07

- Add JSDoc documentation and code quality fixes

## [v1.4.1](https://github.com/laurence-syree/universal-battery-card/releases/tag/v1.4.1) - 2026-01-07

- Reduce card vertical spacing for compact layout

## [v1.4.0](https://github.com/laurence-syree/universal-battery-card/releases/tag/v1.4.0) - 2026-01-07

- Add charge/discharge rate display
- Add MIT license

## [v1.3.0](https://github.com/laurence-syree/universal-battery-card/releases/tag/v1.3.0) - 2026-01-07

- Add tap/hold/double-tap action support
- Add hover highlight effect
- Add optional state and mode entity support
- Use title case for status text
