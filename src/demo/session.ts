// Who the demo visitor is "signed in" as. Switching just changes which made-up account the portal
// shows; there are no passwords or real accounts.
import { USERS } from "./seed";

export type DemoRole = keyof typeof USERS;

const KEY = "fch-demo-role";
const listeners = new Set<() => void>();

function read(): DemoRole | null {
  try {
    const r = sessionStorage.getItem(KEY);
    return r === "owner" || r === "client" || r === "staff" ? r : null;
  } catch {
    return null;
  }
}

let role: DemoRole | null = read();

export const getRole = () => role;
export const currentUserId = () => (role ? USERS[role] : null);

export function setRole(next: DemoRole | null) {
  role = next;
  try {
    if (next) sessionStorage.setItem(KEY, next);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
  listeners.forEach((l) => l());
}

export function onRoleChange(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}
