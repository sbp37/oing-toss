# Sounds

Short interaction sounds are synthesized with Web Audio in `js/audio.js`.

`oing-original-bgm.mp3` is the original OING loop from
`https://sbp37.github.io/oing/bgm.mp3`. It is loaded only after the player
turns music on, starts at the `GO!` cue, and fades out at game end. The default
slider is 40%, using the original squared gain curve (effective gain 0.16).

No sound is embedded as Base64.
