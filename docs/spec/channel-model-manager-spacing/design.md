# Channel Settings Compact Layout Design

## Model Manager Layout

Keep the existing DOM structure in `ModelManager.vue`:

- `.filter-input-container`
- `.model-list-scrollbar` / `.model-list`
- `.add-model`

Apply spacing through `ModelManager.css` only.

## CSS Changes

- Add a bottom margin to `.model-list-container` so the manual model ID input does not attach visually to the list block.
- Add vertical padding to `.model-list` so list items do not start immediately below the filter border.
- Add a small item gap inside `.model-list` to reduce visual crowding between rows.

## Capability Controls

Use the existing `capability-row` surface but remove the standalone icon column from compact capability rows that need more horizontal space.

For the tool protocol row:

- Move the icon inline with the label.
- Let the selector and hint align closer to the card edge.

For the multimodal row:

- Render the file icon and label on the left.
- Render the checkbox-only control on the right.
- Keep summary text and compatibility link below the header.
- Add an accessible label to the checkbox because the visible text is no longer inside the checkbox label.

## Risk

The change slightly increases vertical height usage in Channel settings. The model list already has a max height, so overflow behavior remains controlled by `CustomScrollbar`.
Static capability tests are string-based and catch structure regressions, not exact rendered pixels.
