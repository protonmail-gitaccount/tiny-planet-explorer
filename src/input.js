// Keyboard state plus accumulated mouse-drag deltas for the camera.
export class Input {
  constructor(element) {
    this.keys = new Set();
    this.lookDelta = { x: 0, y: 0 };
    this._dragging = false;

    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => this.keys.clear());

    element.addEventListener('pointerdown', (e) => {
      this._dragging = true;
      element.setPointerCapture(e.pointerId);
    });
    element.addEventListener('pointerup', (e) => {
      this._dragging = false;
      element.releasePointerCapture(e.pointerId);
    });
    element.addEventListener('pointermove', (e) => {
      if (!this._dragging) return;
      this.lookDelta.x += e.movementX;
      this.lookDelta.y += e.movementY;
    });
  }

  isDown(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  /** Returns and resets the mouse movement since the last call. */
  consumeLook() {
    const d = { ...this.lookDelta };
    this.lookDelta.x = 0;
    this.lookDelta.y = 0;
    return d;
  }
}
