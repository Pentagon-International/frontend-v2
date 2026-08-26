import {
  AuthenticationResult,
  EventMessage,
  EventType,
  InteractionStatus,
  PublicClientApplication,
  RedirectRequest,
} from "@azure/msal-browser";

export const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_AZURE_CLIENT_ID as string,
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
    redirectUri: "http://localhost:5173",
  },
  cache: {
    cacheLocation: "sessionStorage" as const,
  },
};

export const msalInstance = new PublicClientApplication(msalConfig);

/** Redirect only — do not mix with loginPopup. */
export const loginRequest: RedirectRequest = {
  scopes: ["openid", "profile", "email"],
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

function attachInteractionListeners() {
  msalInstance.addEventCallback((event: EventMessage) => {
    switch (event.eventType) {
      case EventType.HANDLE_REDIRECT_START:
        setInteractionStatus(InteractionStatus.HandleRedirect);
        break;
      case EventType.ACQUIRE_TOKEN_START:
        setInteractionStatus(InteractionStatus.AcquireToken);
        break;
      case EventType.LOGOUT_START:
        setInteractionStatus(InteractionStatus.Logout);
        break;
      case EventType.HANDLE_REDIRECT_END:
      case EventType.LOGIN_SUCCESS:
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

      const redirectResult = await msalInstance.handleRedirectPromise();
      setInteractionStatus(InteractionStatus.None);
      return redirectResult;
    })().catch((error) => {
      setInteractionStatus(InteractionStatus.None);
      throw error;
    });
  }

  return readyPromise;
}

/**
 * Starts Microsoft login via redirect (same tab).
 * Does not return — the browser leaves the page; id_token is handled on return via handleRedirectPromise.
 */
export async function startMicrosoftLoginRedirect(): Promise<void> {
  await ensureMsalReady();

  if (inProgress !== InteractionStatus.None) {
    return;
  }

  setInteractionStatus(InteractionStatus.AcquireToken);
  await msalInstance.loginRedirect(loginRequest);
}
