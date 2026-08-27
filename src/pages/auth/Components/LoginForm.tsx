import {
  Anchor,
  Box,
  Button,
  Checkbox,
  Divider,
  Group,
  Input,
  Loader,
  PasswordInput,
  Stack,
  Text,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck } from "@tabler/icons-react";
import { AxiosError } from "axios";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ToastNotification from "../../../components/ToastNotification";

import { InteractionStatus } from "@azure/msal-browser";
import { yupResolver } from "mantine-form-yup-resolver";
import * as yup from "yup";
import {
  ensureMsalReady,
  getMsalInteractionStatus,
  isMicrosoftAuthConfigured,
  startMicrosoftLoginRedirect,
  subscribeMsalInteractionStatus,
} from "../../../auth/msal";
import { login, LoginFormData } from "../../../service/auth.services";
import useAuthStore from "../../../store/authStore";
import { normalizeLoginBranches } from "../../../utils/branchOdexCredentials";
import "./../authPage.css";

type SigninFormValues = {
  pulse_id: string;
  full_name: string;
  password: string;
};

type LoginResponse = {
  refresh: string;
  access: string;
  pulse_id: string;
  full_name: string;
  user_identifier: string;
  user_id: number;
  username: string;
  is_staff: boolean;
  is_manager: boolean;
  company: {
    company_id: number;
    company_code: string;
    company_name: string;
  };
  country: {
    country_id: number;
    country_code: string;
    country_name: string;
  };
  branches: Array<{
    id?: number;
    user_branch_id?: number;
    branch_id?: number;
    branch_code: string;
    branch_name: string;
    is_default: boolean;
    main_default?: boolean;
    odex_username?: string | null;
    odex_password?: string | null;
    has_odex_credentials?: boolean;
    logo_url?: string | null;
    branch_title?: string | null;
  }>;
  screen_permissions?: {
    quotation_approval?: boolean;
    include_quotation_body?: boolean;
    customer_approval_screen?: boolean;
    maker_checker?: boolean;
    checker?: boolean;
    finance_dashboard?: boolean;
  };
};

export type ApiError = AxiosError<{
  detail?: string;
  [key: string]: unknown;
}>;

const schema = yup.object().shape({
  pulse_id: yup
    .string()
    .min(3, "Pulse ID should have at least 3 characters")
    .required("Pulse ID is required"),
  full_name: yup.string().required("Full Name is required"),
  password: yup
    .string()
    .min(8, "Minimum 8 characters")
    .required("Password is required"),
});

function MicrosoftLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
      <rect x="1" y="1" width="9" height="9" fill="#F25022" />
      <rect x="11" y="1" width="9" height="9" fill="#7FBA00" />
      <rect x="1" y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

function LoginForm() {
  const pulseIdRef = useRef<HTMLInputElement>(null);
  const microsoftClickLock = useRef(false);
  const [isChecked, setIsChecked] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isMicrosoftLoading, setIsMicrosoftLoading] = useState(false);
  const [msalStatus, setMsalStatus] = useState<InteractionStatus>(
    getMsalInteractionStatus
  );
  const navigate = useNavigate();
  const microsoftEnabled = isMicrosoftAuthConfigured();

  const applyLoginResponse = (response: unknown) => {
    const data =
      (response as { data?: LoginResponse }).data ||
      (response as LoginResponse);

    useAuthStore.getState().login({
      refresh: data.refresh,
      access: data.access,
      pulse_id: data.pulse_id,
      full_name: data.full_name,
      user_identifier: data.user_identifier,
      user_id: data.user_id,
      username: data.username,
      is_staff: data.is_staff,
      is_manager: data.is_manager,
      company: data.company,
      country: data.country,
      branches: normalizeLoginBranches(data.branches),
      screen_permissions: data.screen_permissions,
    });

    ToastNotification({
      type: "success",
      message: "Logged in successfully",
    });

    setTimeout(() => {
      navigate("/");
    }, 100);
  };

  const completeAzureBackendLogin = async (idToken: string) => {
    const response = await login({
      login_type: "azure",
      id_token: idToken,
    });
    applyLoginResponse(response);
  };

  useEffect(() => {
    pulseIdRef.current?.focus();
  }, []);

  // Finish pending MSAL redirect on load, then POST id_token to backend
  useEffect(() => {
    if (!microsoftEnabled) return;

    const unsubscribe = subscribeMsalInteractionStatus(setMsalStatus);
    let cancelled = false;

    (async () => {
      try {
        const hasAuthHash =
          window.location.hash.includes("code=") ||
          window.location.hash.includes("error=");
        if (hasAuthHash) {
          setIsMicrosoftLoading(true);
        }

        const redirectResult = await ensureMsalReady();
        if (cancelled || !redirectResult?.idToken) {
          if (!cancelled) setIsMicrosoftLoading(false);
          return;
        }

        setIsMicrosoftLoading(true);
        await completeAzureBackendLogin(redirectResult.idToken);
      } catch (e: unknown) {
        if (cancelled) return;
        console.error("MSAL redirect handling error:", e);
        ToastNotification({
          type: "error",
          message:
            (e as Error)?.message || "Failed to complete Microsoft login",
        });
        setIsMicrosoftLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only MSAL bootstrap
  }, [microsoftEnabled]);

  const loginForm = useForm({
    mode: "uncontrolled",
    initialValues: {
      pulse_id: "",
      full_name: "",
      password: "",
    },
    validate: yupResolver(schema),
  });

  const handleSignInSubmit = async (event: SigninFormValues) => {
    try {
      const loginData: LoginFormData = {
        pulse_id: event.pulse_id,
        full_name: event.full_name,
        password: event.password,
      };
      setIsLoading(true);

      const response = await login(loginData);
      applyLoginResponse(response);
    } catch (e: unknown) {
      console.error("Login error:", e);
      ToastNotification({
        type: "error",
        message: (e as Error)?.message || "Error occurred",
      });
      loginForm.reset();
    } finally {
      setIsLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    if (!microsoftEnabled) {
      ToastNotification({
        type: "error",
        message:
          "Microsoft login is not configured. Set VITE_AZURE_CLIENT_ID and VITE_AZURE_TENANT_ID.",
      });
      return;
    }

    // Block double-click / overlapping MSAL interactions
    if (
      microsoftClickLock.current ||
      isMicrosoftLoading ||
      getMsalInteractionStatus() !== InteractionStatus.None
    ) {
      return;
    }

    microsoftClickLock.current = true;
    setIsMicrosoftLoading(true);

    try {
      // Same-tab redirect only (no popup) — return handled by ensureMsalReady above
      await startMicrosoftLoginRedirect();
    } catch (e: unknown) {
      console.error("Microsoft login error:", e);
      const errorCode = (e as { errorCode?: string })?.errorCode;
      const message =
        errorCode === "user_cancelled"
          ? "Microsoft login was cancelled"
          : errorCode === "interaction_in_progress"
            ? "Microsoft login already in progress. Clear site data for localhost:5173, then try one click."
            : (e as Error)?.message || "Microsoft login failed";
      ToastNotification({
        type: "error",
        message,
      });
      microsoftClickLock.current = false;
      setIsMicrosoftLoading(false);
    }
  };

  const msalBusy = msalStatus !== InteractionStatus.None;
  const anyLoading = isLoading || isMicrosoftLoading || msalBusy;

  return (
    <>
      <Text
        size="lg"
        style={{
          fontSize: "18px",
          fontWeight: 500,
          color: "#333333",
        }}
      >
        Login with your Credentials
      </Text>
      <form onSubmit={loginForm.onSubmit(handleSignInSubmit)}>
        <div className="mantine-floating-wrapper">
          <Input
            component="input"
            placeholder=" "
            size="md"
            required
            key={loginForm.key("pulse_id")}
            ref={pulseIdRef}
            {...loginForm.getInputProps("pulse_id")}
            classNames={{
              input: "floating-input",
            }}
          />
          <label className="floating-label">
            Pulse ID <span>*</span>
          </label>
        </div>
        <div className="mantine-floating-wrapper">
          <Input
            component="input"
            placeholder=" "
            size="md"
            required
            key={loginForm.key("full_name")}
            {...loginForm.getInputProps("full_name")}
            classNames={{
              input: "floating-input",
            }}
          />
          <label className="floating-label">
            User Name <span>*</span>
          </label>
        </div>
        <div className="mantine-floating-wrapper">
          <PasswordInput
            placeholder=" "
            size="md"
            required
            key={loginForm.key("password")}
            {...loginForm.getInputProps("password")}
            classNames={{
              input: "floating-input",
            }}
          />
          <label className="floating-label">
            Password <span>*</span>
          </label>
        </div>

        <Stack mt="18.55px" gap="xs">
          <Box
            style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <Checkbox
              checked={isChecked}
              color={"#105476"}
              styles={{
                root: { cursor: "pointer" },
                label: { cursor: "pointer" },
                input: { cursor: "pointer" },
              }}
              onChange={() => {
                setIsChecked(!isChecked);
              }}
              label="Remember Me"
            />
          </Box>

          <Group justify="space-between" mt={"sm"}>
            <Anchor
              onClick={() => navigate("/forgot-primeId")}
              size="sm"
              underline="always"
              style={{
                color: "#105476",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Forgot pulse ID?
            </Anchor>
            <Anchor
              onClick={() => navigate("/forgot-password")}
              size="sm"
              underline="always"
              style={{
                color: "#105476",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              Forgot Password?
            </Anchor>
          </Group>
        </Stack>

        <Button
          type="submit"
          radius={"md"}
          fullWidth
          mt="20px"
          color="#105476"
          size="md"
          disabled={anyLoading}
          style={{
            display: "flex",
            alignItems: "base",
            justifyContent: "center",
          }}
        >
          <Text mr="xs">{isLoading ? "Logging in..." : "Login"}</Text>
          {isLoading ? (
            <Loader size={20} color="white" />
          ) : (
            <IconCheck size={16} stroke={3} />
          )}
        </Button>
      </form>

      <Divider my="md" label="OR" labelPosition="center" />

      <Button
        type="button"
        radius="md"
        fullWidth
        size="md"
        variant="default"
        disabled={anyLoading}
        leftSection={
          isMicrosoftLoading ? (
            <Loader size={18} color="#105476" />
          ) : (
            <MicrosoftLogo />
          )
        }
        onClick={handleMicrosoftLogin}
        styles={{
          root: {
            border: "1px solid #d0d5dd",
            backgroundColor: "#fff",
            color: "#333",
            fontWeight: 500,
          },
        }}
      >
        {isMicrosoftLoading ? "Signing in with Microsoft..." : "Sign in with Microsoft"}
      </Button>
    </>
  );
}

export default LoginForm;
