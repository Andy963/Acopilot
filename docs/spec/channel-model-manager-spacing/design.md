# Channel Model Manager Spacing Design

## Layout

Keep the existing DOM structure in `ModelManager.vue`:

- `.filter-input-container`
- `.model-list-scrollbar` / `.model-list`
- `.add-model`

Apply spacing through `ModelManager.css` only.

## CSS Changes

- Add a bottom margin to `.model-list-container` so the manual model ID input does not attach visually to the list block.
- Add vertical padding to `.model-list` so list items do not start immediately below the filter border.
- Add a small item gap inside `.model-list` to reduce visual crowding between rows.

## Risk

The change slightly increases vertical height usage in Channel settings. The model list already has a max height, so overflow behavior remains controlled by `CustomScrollbar`.
