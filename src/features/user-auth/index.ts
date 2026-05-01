export {
  changePassword,
  getPasswordSupportState,
  getCurrentAuthProfile,
  sendPasswordReset,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  useUserAuth,
  type UserAuthState,
  type UserAuthStatus,
} from './model';
export type { PasswordSupportState } from './model';
export { AuthGoogleButton } from './ui';
export { buildServiceEntryHref } from './lib/service-entry-href';
