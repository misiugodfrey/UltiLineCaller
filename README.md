# Ultimate Line Caller

A lightweight, client-only web app to help mixed-gender ultimate frisbee coaches call balanced lines during games. Uses Man-Matching (MM) and Woman-Matching (WM) terminology.

## Features
- Roster management: add, edit, delete, mark availability
- Role and preferences: gender, position (handler/cutter/both), O/D preference
- Line suggestions: 7 players based on availability, points played, preferences
- Gender ratio control: 4MM-3WM, 3MM-4WM, or Auto alternate
- Editable suggestions: replace, remove, or add players before confirming
- Point tracking: increments points played for confirmed lines, with undo
- History: recent points with context and ratio
- Import/Export: save and load team data as JSON
- Offline-first: data stored locally, no backend required

## Quick start
Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari). No build step or server needed.

## Usage
1. Add players using the form in the Roster panel.
2. Set next point context (Offense/Defense) and desired gender ratio.
3. Click "Suggest line" to generate 7 players. Edit as needed (replace, remove, add).
4. Click "Confirm played" to record the point; players' points played increment.
5. Use Undo in the History panel to revert the last recorded point.
6. Export/Import your team data via the buttons in the Roster panel.

## Data format
Exported JSON includes:
```json
{
  "players": [{"id":"...","name":"...","gender":"M|W" /* shown as MM/WM in UI */,"position":"handler|cutter|both","pref":"O|D|either","available":true,"pointsPlayed":0}],
  "history": [{"timestamp":1700000000,"line":["id1","id2"],"context":"O|D","ratio":"4M-3W|3M-4W|auto"}],
  "nextContext": "O|D",
  "nextRatio": "4M-3W|3M-4W|auto" /* shown as 4MM-3WM or 3MM-4WM in UI */
}
```

## Notes and assumptions
- Suggestion prioritizes availability, fewest points played, and matching O/D preference; position is shown and can filter in picker.
- If the roster cannot satisfy a selected ratio exactly, fewer than 7 may be suggested; fill manually.
- "Auto" alternates between 4M-3W and 3M-4W based on last non-auto ratio in history.

## Accessibility and mobile support
- Responsive grid layout with larger touch targets
- High-contrast dark theme

## License
MIT
