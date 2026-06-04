// Tunables for the co-op pixel platformer. All distances in pixels (world
// space, before camera), all speeds per second.

export const TILE = 32; // size of one tilemap cell on screen

// Physics
export const GRAVITY = 2400; // downward acceleration
export const MOVE_SPEED = 240; // horizontal run speed
export const JUMP_V = 820; // initial jump velocity (upward)
export const MAX_FALL = 1500; // terminal velocity
export const COYOTE = 0.09; // grace window to still jump after leaving ground
export const JUMP_BUFFER = 0.1; // remember a jump press this long before landing

// Networking
export const SEND_HZ = 18; // local state broadcasts per second
export const REMOTE_LERP = 14; // higher = snappier remote interpolation

// Logical canvas size (the world is drawn into this, then scaled to fit)
export const VIEW_W = 800;
export const VIEW_H = 480;

// Character collision box (a touch smaller than a tile so it fits gaps)
export const CHAR_W = 22;
export const CHAR_H = 30;
