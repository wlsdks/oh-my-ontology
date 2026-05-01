import { describe, expect, it } from 'vitest';
import { getDataSourceMode } from './data-source-mode';

describe('getDataSourceMode', () => {
  it('vault loaded → local (인증 무관)', () => {
    expect(
      getDataSourceMode({ vaultLoaded: true, isAuthenticated: false }),
    ).toBe('local');
    expect(
      getDataSourceMode({ vaultLoaded: true, isAuthenticated: true }),
    ).toBe('local');
  });

  it('vault 없고 로그인 → cloud', () => {
    expect(
      getDataSourceMode({ vaultLoaded: false, isAuthenticated: true }),
    ).toBe('cloud');
  });

  it('vault 없고 비로그인 → static', () => {
    expect(
      getDataSourceMode({ vaultLoaded: false, isAuthenticated: false }),
    ).toBe('static');
  });

  it('로컬 우선 — 사용자 디스크가 진실원이라는 헌장 준수', () => {
    // 로그인되어 있어도 vault 가 활성이면 local 우선 — 디스크가 진실원.
    expect(
      getDataSourceMode({ vaultLoaded: true, isAuthenticated: true }),
    ).toBe('local');
  });
});
