/**
 * Firestore `Timestamp` → `Date` 변환을 firebase 의존 없이 수행한다.
 *
 * 기존 mapper 들은 `instanceof Timestamp` 로 분기해 firebase/firestore 를 정적으로
 * 끌어왔다 (~640kb). entity model 은 firebase 의존 없이 빌드되어야 local-first
 * 페이지 (vault, ontology-edit, topology) 의 첫 paint 청크에 firestore SDK 가
 * 들어가지 않는다 — duck-typing 으로 충분.
 *
 * Timestamp 는 `seconds: number` 와 `nanoseconds: number` 그리고 `toDate(): Date`
 * 를 가진다. 하나라도 매칭되면 Date 로 변환. 매칭 안 되면 `new Date(0)`.
 */
export function coerceFirestoreDate(value: unknown): Date {
  if (value instanceof Date) return value;
  if (
    value !== null &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate: unknown }).toDate === 'function'
  ) {
    try {
      const out = (value as { toDate: () => unknown }).toDate();
      if (out instanceof Date) return out;
    } catch {
      /* fall through */
    }
  }
  if (
    value !== null &&
    typeof value === 'object' &&
    'seconds' in value &&
    typeof (value as { seconds: unknown }).seconds === 'number'
  ) {
    const seconds = (value as { seconds: number }).seconds;
    return new Date(seconds * 1000);
  }
  return new Date(0);
}
