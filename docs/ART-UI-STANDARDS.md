# HUNGER PROTOCOL — Art & UI rules

## Design intent
Keep the city as the primary surface. UI is a small set of fixed overlays; management views are opened only when needed. Prefer useful status and controls over decorative labels.

## Visual tokens
- Background: `#0a100d`
- Main glass surface: `rgba(15,23,18,.92)`
- Secondary surface: `#1b291f`
- Border: `rgba(143,170,130,.22)`
- Main text / muted: `#e4ebdc` / `#92a18e`
- Accent: `#c0df91`; success/biomass: `#9cdaa2`; warning: `#efc476`; danger: `#e57c6e`; rare: `#c4b1e5`
- Spacing scale: 4 / 8 / 12 / 16 px
- Radius scale: 7 / 10 / 14 px
- Text scale: 8–9 px metadata, 10–12 px controls, 13–15 px titles. Use tabular numerals for counters.

## Layout contracts
- World canvas fills the viewport. Never put it inside a scrollable page column.
- Top bar is 48 px desktop / 43 px mobile; resource readout sits below it.
- Mission info and battle controls share a single horizontal lane. Camera controls and world counters use the next lane.
- Objective status sits above the bottom action dock. The dock contains unit selection, feeding policy and skills only.
- Management lives in one dismissible drawer. Drawer tabs are the only full set of destinations; top shortcuts are limited to high-frequency views.
- Mobile hides secondary copy before shrinking interactive hit areas. Avoid placing hints across objectives or deployment cards.
- Fixed UI layers must use the existing z-index order: canvas 0, mission/toolbar 10–11, resource/dock 13–14, navigation/camera 15–20, backdrop/drawer 31–32, intro/end overlay 40, toast 60.

## Art asset contracts
- All small entities are authored in a 48×48 logical frame, anchor at center `(0.5, 0.5)`. Their art is cached by stable key; outlines are cached separately from sprite alpha.
- Use `drawAnchoredSprite` for character placement and team outlines. Never hand-offset body and outline independently.
- Keep palette and tile materials in the city palette table. Buildings, vehicles, entrances and evacuation gates use shared drawing helpers rather than local one-off colors.
- A map's static ground/building/decor layer is cached separately from entities, units, health bars and combat effects.
- Team colors are semantic: player horde = green, civilians = amber, armed humans = red. Do not add circular halos around characters.

## Interaction rules
- World clicks deploy the selected unit; camera drag pans and the mouse wheel zooms. Camera limits come from the active map.
- Mission launch has one primary entry point; avoid a second button that appears to start the same battle.
- Every persisted option should be controlled by the corresponding UI setting and stored locally.
- Add an automated smoke test whenever a primary button, overlay, map input or stateful panel changes.

## Maintenance
- CSS values belong in `:root` tokens; do not add new trailing overrides for a component.
- Keep one responsive rule block per breakpoint.
- Keep DOM IDs stable unless the matching JavaScript and smoke tests change in the same commit.
