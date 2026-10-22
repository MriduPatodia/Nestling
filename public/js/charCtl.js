// Where the character is in the house, and the single Actor that's animating it.
import { state } from './store.js';
import { timer, remaining } from './focusCtl.js';
import { Actor } from './actor.js';
import { DEFAULT_LOOK } from '/shared/avatar.js';
import { ROOM_TYPES } from '/shared/catalog.js';

const ctl = { roomId: null, actor: null, actorRoom: null };

export const look = () => state.profile?.avatar || DEFAULT_LOOK;
export const nickname = () => state.profile?.nickname || state.user?.username || '';

/** 'focus' while a focus session runs (or is paused), 'break' during a running break, otherwise null. */
export function focusMode() {
  const r = remaining();
  if (timer.mode === 'focus' && (r.running || r.paused)) return 'focus';
  if (timer.mode !== 'focus' && r.running) return 'break';
  return null;
}
const rooms = () => state.home?.rooms || [];
export const focusRoomId = () => (rooms().some((r) => r.id === timer.roomId) ? timer.roomId : rooms()[0]?.id);

/** The room the character is in right now. */
export function characterRoomId() {
  if (focusMode() === 'focus') return focusRoomId();
  if (!rooms().some((r) => r.id === ctl.roomId)) ctl.roomId = rooms()[0]?.id ?? null;
  return ctl.roomId;
}
export function moveCharacterTo(roomId) { if (focusMode() !== 'focus') ctl.roomId = roomId; }
export const roomName = (id) => ROOM_TYPES[rooms().find((r) => r.id === id)?.type]?.name || 'room';

/** Scene for a live room canvas, with the character in it if it's in this room. */
export function sceneFor(roomId, now, extraOpts = {}) {
  const room = rooms().find((r) => r.id === roomId);
  if (!room) return null;
  const items = state.home.items.filter((i) => i.roomId === roomId);
  const opts = { ...extraOpts };
  if (characterRoomId() === roomId) {
    const a = actorFor(roomId);
    a.look = look(); a.name = nickname();
    a.update(now, room, items, focusMode());
    opts.actor = a.render(now);
  }
  return { room, items, opts };
}

/** One character at a time: entering a different room makes it walk in from the doorway. */
export function actorFor(roomId) {
  if (ctl.actor && ctl.actorRoom === roomId) return ctl.actor;
  ctl.actor = new Actor({ look: look(), name: nickname() });
  ctl.actorRoom = roomId;
  return ctl.actor;
}
export const currentActor = (roomId) => (ctl.actorRoom === roomId ? ctl.actor : null);
