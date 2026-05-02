'use client';

import type { User as FirebaseUser } from 'firebase/auth';

export type AuthProviderKind = 'firebase';
export type UserAuthStatus = 'loading' | 'unauthenticated' | 'authenticated';

export interface AuthSessionUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  provider: AuthProviderKind;
  roles?: string[];
  permissions?: string[];
}

export interface UserAuthState {
  status: UserAuthStatus;
  user: AuthSessionUser | null;
}

type Listener = () => void;

const subscribers = new Set<Listener>();

let state: UserAuthState = { status: 'loading', user: null };
let initialized = false;
let firebaseResolved = false;
let firebaseUser: AuthSessionUser | null = null;

function emit() {
  subscribers.forEach((listener) => listener());
}

function setState(nextState: UserAuthState) {
  state = nextState;
  emit();
}

function recomputeState() {
  if (!firebaseResolved) {
    setState({ status: 'loading', user: null });
    return;
  }

  setState({
    status: firebaseUser ? 'authenticated' : 'unauthenticated',
    user: firebaseUser,
  });
}

function mapFirebaseUser(user: FirebaseUser): AuthSessionUser {
  return {
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    provider: 'firebase',
  };
}

export function subscribeUserAuth(listener: Listener) {
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
  };
}

export function getUserAuthState() {
  return state;
}

/**
 * Firebase Auth 모듈은 dynamic import 로만 진입한다 — local-first 첫 paint
 * 에서 auth SDK 청크 (~150kb gzipped) 가 다운로드되지 않게.
 *
 * 호출자 (`useUserAuth`) 는 fire-and-forget 으로 호출. 초기화 완료 전엔
 * `state.status === 'loading'` 으로 시작하며, onAuthStateChanged 또는 2.5s
 * 타임아웃이 도달하면 unauthenticated/authenticated 로 전환된다.
 *
 * 2.5s 타이머는 **initializeUserAuthStore 호출 시점부터** 측정 — dynamic
 * import 가 끝나기 전이라도 deadline 이 지나면 unauthenticated 로 fallback
 * 한다. 콜드 캐시에서 firebase 청크 다운로드만으로 5–8s 걸리는 환경 보호.
 */
export async function initializeUserAuthStore() {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  // 타이머 먼저 — dynamic import 가 끝나기 전 deadline 이 지나도 fallback.
  const AUTH_INIT_TIMEOUT_MS = 2500;
  let firebaseInitTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
    if (!firebaseResolved) {
      firebaseResolved = true;
      recomputeState();
    }
    firebaseInitTimer = null;
  }, AUTH_INIT_TIMEOUT_MS);

  let onAuthStateChanged:
    | typeof import('firebase/auth').onAuthStateChanged
    | null = null;
  let getFirebaseAuth: typeof import('@/shared/api').getFirebaseAuth | null = null;
  try {
    const [authMod, sharedApi] = await Promise.all([
      import('firebase/auth'),
      import('@/shared/api'),
    ]);
    onAuthStateChanged = authMod.onAuthStateChanged;
    getFirebaseAuth = sharedApi.getFirebaseAuth;
  } catch (err) {
    // chunk fetch 실패 — fallback timer 가 어차피 unauthenticated 으로
    // 전환하지만, 명시적으로 한 번 더 닫아 race 회피.
    console.warn('[initializeUserAuthStore] firebase chunk load failed', err);
    if (!firebaseResolved) {
      firebaseResolved = true;
      recomputeState();
    }
    if (firebaseInitTimer) {
      clearTimeout(firebaseInitTimer);
      firebaseInitTimer = null;
    }
    return;
  }

  const auth = getFirebaseAuth();
  onAuthStateChanged(auth, (user) => {
    if (firebaseInitTimer) {
      clearTimeout(firebaseInitTimer);
      firebaseInitTimer = null;
    }
    firebaseUser = user ? mapFirebaseUser(user) : null;
    firebaseResolved = true;
    recomputeState();
  });
}

export async function signOutCombined() {
  const [{ signOut: firebaseSignOut }, { getFirebaseAuth }] = await Promise.all([
    import('firebase/auth'),
    import('@/shared/api'),
  ]);
  const auth = getFirebaseAuth();
  await firebaseSignOut(auth);
  firebaseResolved = true;
  firebaseUser = null;
  recomputeState();
}

export async function fetchSessionProfile(): Promise<AuthSessionUser | null> {
  return state.user;
}
