import { fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it } from 'vitest';
import enMessages from '../../../../messages/en.json';
import { HeroMacMenu } from './HeroMacMenu';

/**
 * The gateway's download menu — **its keyboard, which was entirely dead.**
 *
 * ⚠️ The whole menu was unreachable by keyboard and nothing said so. Focus was moved to the
 * first row by a `requestAnimationFrame` scheduled the moment `open` flipped, but `Surface`
 * gates on `usePanelPresence`, which sets `mounted` inside an effect — so on that render the
 * surface returns `null` and the ref the frame callback reads is still null. Measured on the
 * built export 420 ms after the trigger was clicked, `document.activeElement` was still the
 * trigger button (2026-09-10).
 *
 * Everything downstream of that failure was silent. `onMenuKeyDown` lives inside the surface
 * and reads keys bubbling up from a focused row, so with no row focused, Escape, ArrowDown,
 * ArrowUp, Home and End all landed on the trigger — whose own handler answers only ArrowDown.
 * The e2e surface sweep caught the Escape half; the four arrow keys were checked by nothing at
 * all, which is why this file tests the keyboard rather than the one key that failed.
 *
 * The fix is a callback ref, which React runs when it attaches the node, so there is no frame
 * to lose the race in. These tests would pass against a timer too on a fast enough machine —
 * what they actually hold is the *outcome*: focus is inside the menu, and the menu answers.
 */

const renderMenu = () =>
  render(
    <NextIntlClientProvider locale="en" messages={enMessages}>
      <HeroMacMenu variant="primary" testId="hero-cta" />
    </NextIntlClientProvider>,
  );

const openMenu = () => {
  const trigger = screen.getByTestId('hero-cta');
  fireEvent.click(trigger);
  return trigger;
};

const rows = () => screen.queryAllByRole('menuitem');

/**
 * Whether the menu is open, asked of the trigger rather than of the DOM.
 *
 * ⚠️ **A closed surface is still on screen.** `Surface` keeps its node mounted through an exit
 * window so it can animate out, so "are the rows gone" answers *no* for a moment after Escape
 * and would make these tests fail against a correct menu — the same trap the e2e sweep records
 * in its own comments ("at 360ms the exit animation was still on screen"). `aria-expanded` is
 * the state itself, it is what a screen reader is told, and it does not depend on a timer.
 */
const isOpen = () => screen.getByTestId('hero-cta').getAttribute('aria-expanded') === 'true';

describe('HeroMacMenu — the keyboard', () => {
  beforeEach(() => {
    renderMenu();
  });

  it('moves focus into the menu when it opens, not one frame later', () => {
    openMenu();
    const items = rows();
    expect(items.length, 'the menu has rows to focus').toBeGreaterThan(0);
    // The exact defect: focus stayed on the trigger, so no key the menu owns could reach it.
    expect(document.activeElement).toBe(items[0]);
  });

  it('closes on Escape and gives focus back to the trigger', () => {
    const trigger = openMenu();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(isOpen()).toBe(false);
    expect(document.activeElement).toBe(trigger);
  });

  /**
   * Escape is handled on the document, not only inside the surface, so it does not depend on
   * where focus happens to be. A person who opens a menu and immediately presses Escape is
   * asking for it to go away; "it went away only if the focus move had already landed" is the
   * shape of the defect above, and this holds the repair rather than the symptom.
   */
  it('closes on Escape even while focus is still on the trigger', () => {
    const trigger = openMenu();
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(isOpen()).toBe(false);
  });

  it('walks the rows with ArrowDown and ArrowUp, wrapping at both ends', () => {
    openMenu();
    const items = rows();
    expect(items.length, 'wrapping needs at least two rows to be observable').toBeGreaterThan(1);
    const last = items.length - 1;

    fireEvent.keyDown(items[0]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[1]);

    fireEvent.keyDown(items[1]!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[0]);

    // Up from the first lands on the last: a menu with an end you can fall off is a menu that
    // stops answering, which is how the dead keyboard read from the outside.
    fireEvent.keyDown(items[0]!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(items[last]);

    fireEvent.keyDown(items[last]!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(items[0]);
  });

  it('jumps to the ends with Home and End', () => {
    openMenu();
    const items = rows();
    const last = items.length - 1;
    fireEvent.keyDown(items[0]!, { key: 'End' });
    expect(document.activeElement).toBe(items[last]);
    fireEvent.keyDown(items[last]!, { key: 'Home' });
    expect(document.activeElement).toBe(items[0]);
  });

  /** ArrowDown on a closed trigger opens it — the one key the trigger itself answers. */
  it('opens from the trigger with ArrowDown', () => {
    const trigger = screen.getByTestId('hero-cta');
    expect(isOpen()).toBe(false);
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(isOpen()).toBe(true);
    expect(document.activeElement).toBe(rows()[0]);
  });
});
