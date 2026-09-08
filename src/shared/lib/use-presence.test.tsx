import { act, fireEvent, render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSwapHeight } from './use-presence';

function Harness({ token }: { token: string }) {
  const { hostRef, capture } = useSwapHeight(token);

  return (
    <>
      <button type="button" onClick={capture}>Capture</button>
      <div ref={hostRef} data-testid="host">
        <span data-testid="child">content</span>
      </div>
    </>
  );
}

function transitionEnd(element: Element, propertyName: string) {
  const event = new Event('transitionend', { bubbles: true });
  Object.defineProperty(event, 'propertyName', { value: propertyName });
  fireEvent(element, event);
}

describe('useSwapHeight', () => {
  it('waits for the host height transition instead of a bubbled child or another host property', () => {
    const originalRect = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'getBoundingClientRect');
    let height = 200;
    Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', {
      configurable: true,
      value() {
        return { height } as DOMRect;
      },
    });

    try {
      const { getByRole, getByTestId, rerender } = render(<Harness token="first" />);
      const host = getByTestId('host');
      const child = getByTestId('child');

      act(() => getByRole('button', { name: 'Capture' }).click());
      height = 120;
      act(() => rerender(<Harness token="second" />));
      expect(host).toHaveStyle({ height: '120px' });

      transitionEnd(child, 'height');
      expect(host).toHaveStyle({ height: '120px' });

      transitionEnd(host, 'opacity');
      expect(host).toHaveStyle({ height: '120px' });

      transitionEnd(host, 'height');
      expect(host.style.height).toBe('');
      expect(host.style.transition).toBe('');
    } finally {
      if (originalRect) Object.defineProperty(HTMLElement.prototype, 'getBoundingClientRect', originalRect);
      else delete (HTMLElement.prototype as unknown as Record<string, unknown>).getBoundingClientRect;
    }
  });
});
