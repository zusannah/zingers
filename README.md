# Zingers

A quick-wit party game for 3 to 8 players. One screen hosts (TV, laptop, or a shared screen on a call), everyone else plays on their phone. No accounts, no installs.

**Play:** https://zusannah.github.io/zingers/

## How it works

1. Open the page on the big screen and press **Host on this screen**.
2. Players scan the QR code (or open the page and type the 4-letter room code).
3. Two rounds of head-to-head prompts (round 2 is double points), then a final where everyone answers the same prompt.

Phones connect straight to the host tab over WebRTC ([PeerJS](https://peerjs.com)), so there is no game server. Keep the host tab open for the whole game.

## Prompts

Edit `prompts.js` to add or change prompts (`clean`, `cheeky`, `finals`). Hosts can also paste their own prompts on the start screen; those get used first.

## Files

- `index.html` the whole game
- `prompts.js` the prompt bank
- PeerJS 1.5.5 and qrcode-generator 2.0.4 (both MIT) load from jsDelivr, version-pinned with integrity hashes

To use your own PeerServer instead of the free public one, set `window.ZINGERS_PEER_OPTIONS = { host, port, path, secure }` before the game script.
