'use client';

import {
  EmailAuthProvider,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  reauthenticateWithCredential,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/shared/api';
import { env } from '@/shared/config/env';
import {
  fetchSessionProfile,
  signOutCombined,
  type AuthSessionUser,
} from './session-store';

/**
 * 인증 성공 직후 "내 공간" 을 보장한다. 실패해도 로그인 플로우는 계속 진행
 * (fire-and-forget). single-user 모드라 account 자동 생성 안 함.
 */
function bootstrapWorkspace(user: AuthSessionUser): void {
  if (!user.uid) return;
  // single-user 모드: 본인 디스크 / Firestore 단일 namespace 로 작업.
}

export interface PasswordSupportState {
  canChangePassword: boolean;
  canResetPassword: boolean;
  providerLabel: string;
  reason?: string;
}

const provider = new GoogleAuthProvider();

function mapAuthError(error: unknown) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return '이미 가입된 이메일입니다. 로그인 화면에서 다시 시도하세요.';
    case 'auth/invalid-email':
      return '이메일 형식이 올바르지 않습니다.';
    case 'auth/user-not-found':
    case 'auth/invalid-credential':
      return '이메일 또는 비밀번호를 다시 확인해주세요.';
    case 'auth/wrong-password':
      return '비밀번호가 일치하지 않습니다.';
    case 'auth/missing-password':
      return '비밀번호를 입력해주세요.';
    case 'auth/weak-password':
      return '비밀번호는 8자 이상으로 입력해주세요.';
    case 'auth/too-many-requests':
      return '너무 많이 시도했습니다. 잠시 후 다시 시도해주세요.';
    case 'auth/network-request-failed':
      return '네트워크가 불안정합니다. 연결 확인 후 다시 시도해주세요.';
    case 'auth/operation-not-allowed':
      return '이 로그인 방식은 현재 사용할 수 없습니다.';
    case 'auth/account-exists-with-different-credential':
      return '같은 이메일이 다른 로그인 방식으로 이미 가입되어 있습니다. 기존 방식으로 로그인하세요.';
    case 'auth/popup-closed-by-user':
      return '로그인 창이 닫혔습니다. 다시 시도해주세요.';
    case 'auth/popup-blocked':
      return '팝업이 차단됐습니다. 브라우저 설정에서 팝업을 허용해주세요.';
    case 'auth/user-disabled':
      return '이 계정은 비활성화됐습니다.';
    default:
      return error instanceof Error ? error.message : '인증 처리에 실패했습니다.';
  }
}

function mapFirebaseUser(user: Awaited<ReturnType<typeof signInWithPopup>>['user']): AuthSessionUser {
  return {
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    provider: 'firebase',
  };
}

export async function signInWithGoogle(): Promise<AuthSessionUser> {
  const auth = getFirebaseAuth();
  try {
    const result = await signInWithPopup(auth, provider);
    const user = mapFirebaseUser(result.user);
    bootstrapWorkspace(user);
    return user;
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

export async function signInWithEmail(input: {
  email: string;
  password: string;
}): Promise<AuthSessionUser> {
  const auth = getFirebaseAuth();
  try {
    const result = await signInWithEmailAndPassword(
      auth,
      input.email.trim(),
      input.password,
    );
    const user = mapFirebaseUser(result.user);
    bootstrapWorkspace(user);
    return user;
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

export async function signUpWithEmail(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<AuthSessionUser> {
  const auth = getFirebaseAuth();
  try {
    const result = await createUserWithEmailAndPassword(
      auth,
      input.email.trim(),
      input.password,
    );
    if (input.displayName.trim()) {
      await updateProfile(result.user, {
        displayName: input.displayName.trim(),
      });
      await result.user.reload();
    }
    const user = mapFirebaseUser(result.user);
    bootstrapWorkspace(user);
    return user;
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

export async function signOut(): Promise<void> {
  await signOutCombined();
}

export async function getCurrentAuthProfile(): Promise<AuthSessionUser | null> {
  return fetchSessionProfile();
}

export function getPasswordSupportState(): PasswordSupportState {
  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  if (!currentUser) {
    return {
      canChangePassword: false,
      canResetPassword: false,
      providerLabel: '게스트',
      reason: '로그인 후 사용할 수 있습니다.',
    };
  }

  const hasPasswordProvider = currentUser.providerData.some(
    (entry) => entry.providerId === 'password',
  );

  if (!hasPasswordProvider) {
    return {
      canChangePassword: false,
      canResetPassword: false,
      providerLabel: '소셜 로그인',
      reason: '이 계정은 비밀번호 대신 소셜 로그인으로 사용합니다.',
    };
  }

  return {
    canChangePassword: true,
    canResetPassword: true,
    providerLabel: '이메일 로그인',
  };
}

export async function changePassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  if (input.newPassword.trim().length < 8) {
    throw new Error('비밀번호는 8자 이상으로 입력해주세요.');
  }

  const auth = getFirebaseAuth();
  const currentUser = auth.currentUser;

  if (!currentUser || !currentUser.email) {
    throw new Error('로그인된 이메일 계정이 없습니다.');
  }

  const hasPasswordProvider = currentUser.providerData.some(
    (entry) => entry.providerId === 'password',
  );

  if (!hasPasswordProvider) {
    throw new Error('이 계정은 비밀번호 로그인을 사용하지 않습니다.');
  }

  try {
    const credential = EmailAuthProvider.credential(
      currentUser.email,
      input.currentPassword,
    );
    await reauthenticateWithCredential(currentUser, credential);
    await updatePassword(currentUser, input.newPassword);
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}

export async function sendPasswordReset(input: { email: string }): Promise<void> {
  const email = input.email.trim();

  if (!email) {
    throw new Error('이메일을 입력해주세요.');
  }

  try {
    const auth = getFirebaseAuth();
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    throw new Error(mapAuthError(error));
  }
}
