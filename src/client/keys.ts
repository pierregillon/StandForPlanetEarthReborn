// État du clavier par position physique des touches (KeyboardEvent.code), voir GD-016 :
// les mêmes touches servent en AZERTY (ZQSD) et en QWERTY (WASD), sans réglage.

const down = new Set<string>();
const pressed = new Set<string>();

window.addEventListener('keydown', (e) => {
  if (!e.repeat) pressed.add(e.code);
  down.add(e.code);
  if (PREVENT_DEFAULT.has(e.code)) e.preventDefault();
});
window.addEventListener('keyup', (e) => {
  down.delete(e.code);
});
window.addEventListener('blur', () => {
  down.clear();
  pressed.clear();
});

const PREVENT_DEFAULT = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);

export const Keys = {
  isDown(...codes: string[]): boolean {
    return codes.some((c) => down.has(c));
  },
  /** Vrai une seule fois par appui : la touche est « consommée » par la lecture. */
  wasPressed(...codes: string[]): boolean {
    let hit = false;
    for (const c of codes) if (pressed.delete(c)) hit = true;
    return hit;
  },
  clearPressed(): void {
    pressed.clear();
  },
};

export const Bind = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  dash: ['Space', 'ShiftLeft', 'ShiftRight'],
  use: ['KeyE', 'Enter', 'NumpadEnter'],
  reload: ['KeyR'],
  // link : la touche marquée A sur un clavier AZERTY (Q sur un QWERTY), libre dans les deux dispositions
  link: ['KeyQ'],
  ulti: ['KeyF'],
  pause: ['Escape'],
  // caméra libre (ADR-017) : V pour « vue », L pour l'éclairage, 1 pour revenir à l'échelle du jeu
  freeCamera: ['KeyV'],
  lights: ['KeyL'],
  zoomReset: ['Digit1', 'Numpad1'],
  fast: ['ShiftLeft', 'ShiftRight'],
  confirm: ['KeyE', 'Enter', 'NumpadEnter', 'Space'],
};
