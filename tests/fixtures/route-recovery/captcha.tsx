import { forwardRef, useEffect, useImperativeHandle } from 'react';
export interface AuthTurnstileHandle { reset: () => void }
export const AuthTurnstile = forwardRef<AuthTurnstileHandle, { onTokenChange: (token: string) => void }>(function FixtureCaptcha({ onTokenChange }, ref) {
  useEffect(() => { onTokenChange('fixture-captcha-token'); }, [onTokenChange]);
  useImperativeHandle(ref, () => ({ reset: () => onTokenChange('fixture-captcha-token') }), [onTokenChange]);
  return <p>Fixture verification boundary</p>;
});
