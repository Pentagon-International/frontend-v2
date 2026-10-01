import {
  AuthenticationResult,
  EventMessage,
  EventType,
  InteractionRequiredAuthError,
  InteractionStatus,
  PublicClientApplication,
  RedirectRequest,
  SsoSilentRequest,
} from "@azure/msal-browser";

export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID as string,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    // Dynamic origin so localhost and production both work without hardcoded URIs
    redirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: "localStorage" as const,
    storeAuthStateInCookie: true,
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

const loginScopes = ["openid", "profile", "email"] as const;
const domainHint = "pentagonindia.net";

/** Shared redirect request — no prompt:"login" / prompt:"select_account". */
export const loginRequest: RedirectRequest = {
  scopes: [...loginScopes],
  domainHint,
};

const silentRequest: SsoSilentRequest = {
  scopes: [...loginScopes],
  domainHint,
};

let readyPromise: Promise<AuthenticationResult | null> | null = null;
let inProgress: InteractionStatus = InteractionStatus.Startup;
const statusListeners = new Set<(status: InteractionStatus) => void>();

export function isMicrosoftAuthConfigured(): boolean {
  return Boolean(
    import.meta.env.VITE_AZURE_CLIENT_ID && import.meta.env.VITE_AZURE_TENANT_ID
  );
}

export function getMsalInteractionStatus(): InteractionStatus {
  return inProgress;
}

export function subscribeMsalInteractionStatus(
  listener: (status: InteractionStatus) => void
): () => void {
  statusListeners.add(listener);
  listener(inProgress);
  return () => {
    statusListeners.delete(listener);
  };
}

function setInteractionStatus(status: InteractionStatus) {
  if (inProgress === status) return;
  inProgress = status;
  statusListeners.forEach((listener) => listener(status));
}

function isInteractionRequired(error: unknown): boolean {
  if (error instanceof InteractionRequiredAuthError) return true;
  const code = (error as { errorCode?: string })?.errorCode;
  return (
    code === "interaction_required" ||
    code === "login_required" ||
    code === "consent_required" ||
    code === "monitor_window_timeout"
  );
}

function attachInteractionListeners() {
  msalInstance.addEventCallback((event: EventMessage) => {
    switch (event.eventType) {
      case EventType.HANDLE_REDIRECT_START:
        setInteractionStatus(InteractionStatus.HandleRedirect);
        break;
      case EventType.LOGIN_START:
        setInteractionStatus(InteractionStatus.Login);
        break;
      case EventType.SSO_SILENT_START:
        setInteractionStatus(InteractionStatus.SsoSilent);
        break;
      case EventType.ACQUIRE_TOKEN_START:
        setInteractionStatus(InteractionStatus.AcquireToken);
        break;
      case EventType.LOGOUT_START:
        setInteractionStatus(InteractionStatus.Logout);
        break;
      case EventType.HANDLE_REDIRECT_END:
      case EventType.LOGIN_SUCCESS:
      case EventType.LOGIN_FAILURE:
      case EventType.SSO_SILENT_SUCCESS:
      case EventType.SSO_SILENT_FAILURE:
      case EventType.ACQUIRE_TOKEN_SUCCESS:
      case EventType.ACQUIRE_TOKEN_FAILURE:
      case EventType.LOGOUT_SUCCESS:
      case EventType.LOGOUT_FAILURE:
      case EventType.LOGOUT_END:
        setInteractionStatus(InteractionStatus.None);
        break;
      default:
        break;
    }
  });
}

/**
 * On app / login-page load: initialize MSAL and finish any pending redirect.
 * Safe to call multiple times — runs once.
 *
 * If a prior prompt:"none" redirect failed with interaction required,
 * falls back to an interactive loginRedirect (no forced login/select_account).
 */
export async function ensureMsalReady(): Promise<AuthenticationResult | null> {
  if (!isMicrosoftAuthConfigured()) {
    setInteractionStatus(InteractionStatus.None);
    return null;
  }

  if (!readyPromise) {
    readyPromise = (async () => {
      setInteractionStatus(InteractionStatus.Startup);
      await msalInstance.initialize();
      attachInteractionListeners();

      try {
        const redirectResult = await msalInstance.handleRedirectPromise();
        setInteractionStatus(InteractionStatus.None);
        return redirectResult;
      } catch (error) {
        // prompt:"none" return often surfaces as interaction/login_required
        if (isInteractionRequired(error)) {
          setInteractionStatus(InteractionStatus.Login);
          await msalInstance.loginRedirect(loginRequest);
          return null;
        }
        setInteractionStatus(InteractionStatus.None);
        throw error;
      }
    })().catch((error) => {
      setInteractionStatus(InteractionStatus.None);
      throw error;
    });
  }

  return readyPromise;
}

/**
 * Silent-first Microsoft login.
 * - Returns AuthenticationResult when ssoSilent succeeds (has idToken).
 * - Returns null when a redirect is started (or interaction already in progress).
 */
export async function startMicrosoftLogin(): Promise<AuthenticationResult | null> {
  await ensureMsalReady();

  if (inProgress !== InteractionStatus.None) {
    return null;
  }

  // a) Prefer silent SSO (Entra-joined / existing work session)
  try {
    setInteractionStatus(InteractionStatus.SsoSilent);
    const result = await msalInstance.ssoSilent(silentRequest);
    setInteractionStatus(InteractionStatus.None);
    if (result?.idToken) {
      return result;
    }
  } catch (error) {
    setInteractionStatus(InteractionStatus.None);
    // Fall through to redirect when silent SSO cannot complete
    if (!isInteractionRequired(error)) {
      console.warn("MSAL ssoSilent failed; falling back to redirect:", error);
    }
  }

  // b) Session cookie redirect without UI
  try {
    setInteractionStatus(InteractionStatus.Login);
    await msalInstance.loginRedirect({
      ...loginRequest,
      prompt: "none",
    });
    return null;
  } catch (error) {
    // c) Interactive redirect — do not force prompt:"login" or "select_account"
    if (
      (error as { errorCode?: string })?.errorCode === "interaction_in_progress"
    ) {
      setInteractionStatus(InteractionStatus.None);
      throw error;
    }

    setInteractionStatus(InteractionStatus.Login);
    await msalInstance.loginRedirect(loginRequest);
    return null;
  }
}
