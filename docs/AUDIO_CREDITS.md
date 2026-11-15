# Audio credits

All sound in Naija Market Rush is **original procedural audio**, generated at run time with the Web Audio API in `web/src/audio.js`. There are no third-party samples, loops, or downloaded sound files in the project.

| Asset | How it is made | Licence |
|---|---|---|
| Serve / cash / tip / wrong / arrive / angry / whoosh / VIP / end / tick SFX | Short synthesized tones (sine, triangle, square, sawtooth) with envelopes | Original work, dedicated to the public domain (CC0 1.0) |
| Haggle lock / yes / no, shop purchase, star fanfare | Same synthesizer | CC0 1.0 |
| Light afrobeat-ish loop | Kick (pitched sine), clap (filtered noise), shekere-like shaker (high-pass noise), highlife-ish bass (triangle), kalimba-like lead (sine). 100 BPM, two-bar pattern | Original work, CC0 1.0 |

The mute button (🔊 / 🔇) silences both the loop and the SFX, and the choice is saved in `localStorage` (`nmr-save-v1`).

If you later replace the loop with a recorded track, add the title, author, source URL and licence here, and keep only works that are CC0, CC BY, or otherwise cleared for the hackathon.
