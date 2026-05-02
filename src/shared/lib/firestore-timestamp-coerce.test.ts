import { describe, expect, it } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import { coerceFirestoreDate } from './firestore-timestamp-coerce';

describe('coerceFirestoreDate', () => {
  it('Timestamp 인스턴스를 toDate() 로 변환한다 — production hot path', () => {
    const ts = Timestamp.fromMillis(1_700_000_000_000);
    const d = coerceFirestoreDate(ts);
    expect(d).toBeInstanceOf(Date);
    expect(d.getTime()).toBe(1_700_000_000_000);
  });

  it('Date 인스턴스는 그대로 반환', () => {
    const input = new Date('2026-05-02T00:00:00.000Z');
    const out = coerceFirestoreDate(input);
    expect(out).toBe(input);
  });

  it('null / undefined 는 epoch 0 (Date) — 호출자가 별도 가드해야 한다', () => {
    expect(coerceFirestoreDate(null).getTime()).toBe(0);
    expect(coerceFirestoreDate(undefined).getTime()).toBe(0);
  });

  it('seconds 만 있는 Timestamp-like POJO 도 인식 (직렬화 round-trip 케이스)', () => {
    const fake = { seconds: 1_700_000, nanoseconds: 0 };
    const d = coerceFirestoreDate(fake);
    expect(d.getTime()).toBe(1_700_000 * 1000);
  });

  it('toDate() 가 throw 하면 epoch 0 fallback (silent)', () => {
    const broken = {
      toDate() {
        throw new Error('boom');
      },
    };
    expect(coerceFirestoreDate(broken).getTime()).toBe(0);
  });

  it('toDate() 가 Date 가 아닌 값을 반환하면 epoch 0 fallback', () => {
    const liar = { toDate: () => 'not a date' as unknown as Date };
    expect(coerceFirestoreDate(liar).getTime()).toBe(0);
  });

  it('알 수 없는 타입 (string / number / boolean) 은 epoch 0', () => {
    expect(coerceFirestoreDate('2026-05-02').getTime()).toBe(0);
    expect(coerceFirestoreDate(1_700_000_000_000).getTime()).toBe(0);
    expect(coerceFirestoreDate(true).getTime()).toBe(0);
  });

  it('toDate 가 number 인 객체 (function 이 아님) 는 epoch 0', () => {
    expect(coerceFirestoreDate({ toDate: 42 }).getTime()).toBe(0);
  });
});
