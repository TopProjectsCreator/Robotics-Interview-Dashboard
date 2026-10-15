import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import {
  getPasskeyLoginOptions,
  getPasskeyRegisterOptions,
  loginWithPasskey,
  registerPasskey,
  type AuthSession,
  type PasskeyLoginInput,
  type PasskeyRegistrationInput,
  type PasskeyPublicKeyOptions,
} from "@workspace/api-client-react";

export { browserSupportsPasskeys } from "@simplewebauthn/browser";

type CreationOptions = Parameters<typeof startRegistration>[0]["optionsJSON"];
type AuthenticationOptions = Parameters<typeof startAuthentication>[0]["optionsJSON"];

/**
 * Register a passkey for the signed-in account: fetches WebAuthn options from
 * the API, runs the authenticator ceremony, then stores the credential.
 * Password sign-in keeps working — this is purely an alternative.
 */
export async function registerPasskeyFlow(label?: string): Promise<string> {
  const options = await getPasskeyRegisterOptions();
  const attestation = await startRegistration({
    optionsJSON: options as unknown as CreationOptions,
  });
  const credential = await registerPasskey({
    response: attestation as unknown as PasskeyRegistrationInput["response"],
    ...(label?.trim() ? { label: label.trim() } : {}),
  });
  return credential.label;
}

/**
 * Sign in with a passkey instead of typing the personal password. The event
 * passcode is still required by the caller first, exactly like password login.
 */
export async function loginWithPasskeyFlow(
  eventPassword: string,
  interviewerId: string,
): Promise<AuthSession> {
  const options = await getPasskeyLoginOptions({ eventPassword, interviewerId });
  const assertion = await startAuthentication({
    optionsJSON: options as unknown as AuthenticationOptions,
  });
  return loginWithPasskey({ eventPassword, interviewerId, response: assertion as unknown as PasskeyLoginInput["response"] });
}
