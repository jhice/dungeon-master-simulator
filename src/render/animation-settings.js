// Settings of the animated moves (docs/062): control panel, saved in the preferences.
// Apart from the views so that main.js reads them without loading Three.js.

export const DEFAULT_ANIMATION = {
  smoothMoves: true, // moves are animated, otherwise instant
  stepMs: 300, // 100..440: duration of a party's step (DM: at least 2 ticks, 440 ms, docs/061 § 2)
  turnMs: 300, // 80..400: duration of a party's quarter turn
};
