# Changelog

## [v2.9.4](https://github.com/laurence-syree/universal-battery-card/releases/tag/v2.9.4)

- Add `gauge_label_position`, which puts the Reserve and Cutoff labels below the SOC gauge instead of above it, mirroring the Max Charge / Max Discharge labels under the power gauge. Cards are unchanged by default — the option is `above`, where the labels have always been. Below the ring the row has the full width to itself and nothing overhead to collide with, so it doesn't need the readability floors the band above the ring does: it stays on until the gauge is down on its hard minimum, rather than disappearing on a short card that still had room to show it (requested by @viceice - #12)
- Fix the labels vanishing entirely on short cards with a header, after appearing for a moment on reload. The gauge was sized with the label band reserved and then measured against the hide thresholds at that reduced size, so reserving the space is what pushed the gauge under the floor that removed the labels — and hiding them didn't hand the space back, leaving a card with a gauge shrunk to fit labels it wasn't drawing. Hiding now re-sizes the gauge without the band (reported by @viceice - #12)
- Hide the label row with `display` rather than `visibility`, so the `below` row doesn't hold space in the flow while hidden. The sizing pass forces it visible for the frame it measures in, so a hidden row can still be measured and brought back. Cards styled with card_mod should use `--ubc-label-display` in place of `--ubc-label-visibility`

## [v2.9.3](https://github.com/laurence-syree/universal-battery-card/releases/tag/v2.9.3)

- Keep the Reserve and Cutoff labels on screen instead of hiding them when space runs short. v2.9.2 hid the row once it would have escaped the top of the card, which fixed the overflow but took the labels away from the people who wanted to read them. The gauge now yields instead: the sizing pass measures how tall the row actually is at the size it is about to apply, reserves that band above the ring, and sizes the gauge to what's left. The labels stay exactly where they were relative to the ring, the row can no longer reach the card's edge because the space it needs was subtracted before the gauge was drawn, and the cost is a slightly smaller gauge on short cards. The readability floor still applies, so very small gauges drop the labels and get those pixels back (reported by @viceice - #12)

## [v2.9.2](https://github.com/laurence-syree/universal-battery-card/releases/tag/v2.9.2)

- Hide the Reserve and Cutoff labels when they no longer fit above the gauge, instead of letting them escape the card. v2.9.1 stopped the two labels overlapping by wrapping each onto two lines, but a wrapped row is taller than the space above the ring, so on a narrow card it climbed out through the top edge and drew over whatever card sat above it. The labels sit outside the layout flow, so no other measurement could see this happening: the card now measures where the row actually lands, at the size it is about to apply, and hides it if it would cross the card's edge or the header. That answer depends on whether the text wrapped, which depends on the label strings, the font and the theme, so it is measured rather than inferred from the gauge diameter (reported by @viceice - #12)
- Hide the labels with `visibility` rather than `display`, so a hidden row keeps its geometry and the fit check above can't flip-flop by measuring a removed element as zero-sized. Cards styled with card_mod should use `--ubc-label-visibility` in place of `--ubc-label-display`

## [v2.9.1](https://github.com/laurence-syree/universal-battery-card/releases/tag/v2.9.1)

- Fix the Reserve and Cutoff labels printing over each other on narrower cards — "Reserve 10%" and "Cutoff 100%" rendered as `Reserve 10Cutoff 100%`. They were two independently positioned boxes pinned 10% in from each edge with wrapping disabled, so nothing coupled them and nothing stopped them meeting in the middle; showing the runtime/depletion footer shrinks the gauge, which is what pulled the two ends together. They are now a single row across the same span, so they cannot overlap: where they already fit the position is unchanged to the pixel, and where they don't each label wraps onto two lines instead of colliding. The existing auto-hide still removes them on the smallest gauges (reported by @viceice - #12)
- Correct the `show_gauge_labels` description in the README — the labels sit above the SOC gauge, not below it

## [v2.9.0](https://github.com/laurence-syree/universal-battery-card/releases/tag/v2.9.0)

- Add `gauge_track_colour` to set the colour of the unfilled part of both gauge rings, as `[r, g, b]` or a CSS variable name. The track follows the theme's `--divider-color`, which Home Assistant sets to 12% white in dark mode — legible on a desktop panel, but invisible on a wall display, where an idle power gauge is entirely track and so disappears completely. Existing cards are unchanged: the theme value still applies unless the option is set (requested by @Explorer900 - #10)
- Document that every colour option, including the existing `soc_colour_*` values, accepts a CSS variable name as well as an RGB array

## [v2.8.0](https://github.com/laurence-syree/universal-battery-card/releases/tag/v2.8.0)

- Draw the gauge rings as SVG arcs instead of `conic-gradient` backgrounds, fixing cards that rendered as a handful of stray dots on locked-firmware WebViews such as the Shelly Wall Display XL. The v2.7.0 `CSS.supports` fallback couldn't help: those browsers report `conic-gradient` support and then paint nothing, and there's no way to feature-detect the difference. The gradient was never a gradient — both gauges only ever used two hard colour stops, a solid arc on a solid track — so a stroked circle reproduces the design exactly rather than approximating it, and `stroke-linecap: round` replaces the end-cap dots that were sized and positioned to imitate it. Arc endpoints are identical to the old ones at every thickness and percentage (reported by @Explorer900 - #10)

## [v2.7.1](https://github.com/laurence-syree/universal-battery-card/releases/tag/v2.7.1)

- Fix `show_runtime` silently showing nothing when no `soc_energy_entity` is configured. The runtime/depletion estimate was gated on that optional entity with no fallback, so a card with a capacity and an SOC — everything the estimate actually needs — rendered no footer at all on any device. Energy is now derived from SOC % × capacity when the entity isn't set; where it is set, the measured value is still used. The derived figure is deliberately not shown as the gauge's kWh readout, which stays entity-only (reported by @Explorer900 - #10)

## [v2.7.0](https://github.com/laurence-syree/universal-battery-card/releases/tag/v2.7.0)

- Show the discharge runtime footer by default — the time-to-empty estimate now targets 0% when no reserve is configured, instead of being hidden entirely (thanks @Xovos - #11)
- Fix gauges shrinking pass-by-pass on auto-height dashboards (masonry, Sections "auto" row). Card height there is a function of the gauge size, so any error in the space accounting compounded on every measure/resize cycle — and the accounting subtracted the gauge container's padding twice while missing the header's bottom margin, the footer's top margin, the card border, and the rate labels below the power gauge. Chrome is now measured as a single delta from the rendered card instead of summed from constants, so nothing can be left out (reported by @kmb36td - #9)
- Size the gauge from the available width on auto-height dashboards, where the card's height follows its content and so can't tell the gauge anything about available space. Previously this only worked by accident — the accounting bug grew the gauge a few pixels per resize pass until it hit the width limit — so fixing the accounting alone would have left gauges stuck at their starting size. The card now reaches the same result in a single pass, and sizing changes below a few pixels are ignored so nothing can creep (#9)
- Fix the encroach layout collapsing the gauge with no recovery on resize — the header is now overlaid via absolute positioning instead of co-spanning the same grid rows as the gauges, which left row sizing ambiguous across browsers (#9)
- Stop the encroach header shifting 16px down and right as it engages; it was offset by the card padding on top of a grid area that already excluded it
- Derive the card's `min-height` from the configured header/footer instead of a fixed 260px, and report `min_rows` to Home Assistant from that same number — the two could disagree, letting the card overflow the smallest cell its own resize handles allowed. Sections layouts are unaffected: no configuration asks for more rows than before, and cards with a hidden header or footer may now be sized shorter than they could be previously
- Hide the "Max Charge" / "Max Discharge" rate labels automatically on cards too short to fit both them and a readable gauge, the same way the reserve/cutoff labels already hide. Previously the gauge was shrunk to make room for the text instead — on a narrow card with the labels wrapping to two lines that pinned it to the 40px minimum
- Round temp/cycles/health to `decimal_places` in the stats panel; raw sensor floats were overflowing the row and clipping the card title (#9)
- Name the discharge target in the footer when a reserve is set — reaching a 20% reserve isn't depletion — and suppress the arrival time when the duration exceeds the 99-hour display cap
- Fall back to a flat gauge ring (no end caps) where `conic-gradient` isn't supported, instead of painting stray dots on an empty ring (prompted by @Explorer900's report in #10 — that card rendered correctly on the same device before, so the cause there is likely something else and the issue stays open)

## [v2.6.0](https://github.com/laurence-syree/universal-battery-card/releases/tag/v2.6.0)

- Appear in the Home Assistant 2026.6 card picker (Community section) when a battery state-of-charge entity is selected, pre-filling it as `soc_entity` (`getEntitySuggestion`)

## [v2.5.0](https://github.com/laurence-syree/universal-battery-card/releases/tag/v2.5.0)

- Add `date_format` (`auto` / `MM/DD` / `DD/MM`) and `time_format` (`auto` / `24` / `12`) options for the footer ETA. `auto` follows the Home Assistant locale, so dates/times match the user's region without manual patching (thanks @RadzuPL - #8)

## [v2.4.0](https://github.com/laurence-syree/universal-battery-card/releases/tag/v2.4.0) - 2026-05-07

- Overhaul gauge sizing so gauges fill available space at any card size or aspect ratio (#6)
- Remove the hard-coded 200 px gauge cap — gauges now grow to fill the tile they're given
- Measure rendered header/footer heights instead of hard-coding them, so layout stays correct when title text wraps, themes change typography, or rows toggle on/off
- Wrap ResizeObserver callbacks in requestAnimationFrame to batch with paint and prevent the "ResizeObserver loop" warning during editor drag-resize
- `getGridOptions` reports `min_columns` / `min_rows` derived from the configured chrome so the resize handles snap to a size the card can actually render; no upper cap so HA's layout decides the maximum
- Validate config at `setConfig` time with user-readable error messages (out-of-range numbers, inverted SOC thresholds, malformed colour tuples, bad entity IDs); HA surfaces these as red banners in the editor
- Defensively handle missing `ResizeObserver` and other `connectedCallback` failures so older WebViews (e.g. some Amazon Fire HD builds) render the card at CSS defaults instead of a generic "Configuration error" — may help #7

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
