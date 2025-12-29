import {
  Anchor,
  Box,
  Button,
  Group,
  Input,
  Loader,
  PasswordInput,
  Space,
  Stack,
  Text,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import { IconCheck, IconCheckbox } from "@tabler/icons-react";
import { AxiosError } from "axios";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ToastNotification } from "../../../components/index";

import { yupResolver } from "mantine-form-yup-resolver";
import * as yup from "yup";
import { login, LoginFormData } from "../../../service/auth.services";
import useAuthStore from "../../../store/authStore";
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
    branch_id: number;
    branch_code: string;
    branch_name: string;
    is_default: boolean;
  }>;
  screen_permissions?: {
    quotation_approval?: boolean;
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

function LoginForm() {
  const pulseIdRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    pulseIdRef.current?.focus();
  }, []);

  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState();
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
    console.log("Form submitted with:", event);
    try {
      const loginData: LoginFormData = {
        pulse_id: event.pulse_id,
        full_name: event.full_name,
        password: event.password,
      };
      setIsLoading(true);

      const response: unknown = await login(loginData);
      const data =
        (response as { data?: LoginResponse }).data ||
        (response as LoginResponse); // Handle both axios response and direct data
      console.log("Token data----", data);

      // Set authentication state
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
        branches: data.branches,
        screen_permissions: data.screen_permissions,
      });

      // Verify the state was set
      const currentState = useAuthStore.getState();
      console.log("Current auth state after login:", {
        user: currentState.user,
        accessToken: currentState.accessToken,
        refreshToken: currentState.refreshToken,
      });
      setIsLoading(false);
      ToastNotification({
        type: "success",
        message: "Logged in successfully",
      });

      // Add a small delay to ensure state is properly set
      setTimeout(() => {
        navigate("/");
      }, 100);
    } catch (e: any) {
      console.error("Login error:", e);
      setIsLoading(false);
      ToastNotification({
        type: "error",
        message: (e as Error)?.message || "Error occurred",
      });
      loginForm.reset();
    }
  };

  return (
    <>
      <Text
        size="lg"
        style={{
          fontSize: "18px",
          fontWeight: 400,
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

        <Stack mt="16px" gap="xs">
          <Box
            style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <IconCheckbox style={{ color: "#105476" }} />
            <Space w="xs" />
            <Text
              size="sm"
              style={{
                fontSize: "13px",
                fontWeight: 500,
              }}
            >
              Remember me
            </Text>
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
          mt="lg"
          color="#105476"
          size="md"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text mr="xs">Submit</Text>
          {isLoading ? (
            <Loader size={20} color="white" />
          ) : (
            <IconCheck size={20} stroke={2} />
          )}
        </Button>
      </form>
    </>
  );
}

export default LoginForm;
