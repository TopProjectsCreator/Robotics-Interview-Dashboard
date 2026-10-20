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
  const options = unwrapPasskeyOptions(await getPasskeyRegisterOptions(), "registration");
  const attestation = await startRegistration({
    // unwrapPasskeyOptions already returns the inner publicKey object;
    // reading .publicKey again here handed the authenticator `undefined`.
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
  const options = unwrapPasskeyOptions(
    await getPasskeyLoginOptions({ eventPassword, interviewerId }),
    "sign-in",
  );
  const assertion = await startAuthentication({
    optionsJSON: options as unknown as AuthenticationOptions,
  });
  return loginWithPasskey({ eventPassword, interviewerId, response: assertion as unknown as PasskeyLoginInput["response"] });
}

function unwrapPasskeyOptions(
  envelope: PasskeyPublicKeyOptions,
  ceremony: "registration" | "sign-in",
): Record<string, unknown> {
  const options = envelope?.publicKey;
  if (!options || typeof options !== "object" || Array.isArray(options) || typeof options.challenge !== "string") {
    throw new Error(`Could not start passkey ${ceremony}: the server returned incomplete options. Try again.`);
  }

  if (ceremony === "registration") {
    const user = options.user;
    if (!user || typeof user !== "object" || Array.isArray(user) || typeof (user as Record<string, unknown>).id !== "string") {
      throw new Error("Could not start passkey registration: the server returned incomplete options. Try again.");
    }
  } else {
    const credentials = options.allowCredentials;
    if (
      !Array.isArray(credentials) ||
      credentials.length === 0 ||
      credentials.some((credential) =>
        !credential || typeof credential !== "object" || typeof (credential as Record<string, unknown>).id !== "string",
      )
    ) {
      throw new Error("Could not start passkey sign-in: the server returned incomplete options. Use password sign-in instead.");
    }
  }

  return options;
}
