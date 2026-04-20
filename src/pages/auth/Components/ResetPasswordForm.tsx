import {
  Button,
  Container,
  Flex,
  Image,
  List,
  PasswordInput,
  Stack,
  Text,
  ThemeIcon,
} from "@mantine/core";
import { useForm } from "@mantine/form";
import PentLogo from "../../../assets/images/pentagon-prime.svg";
import { IconCircleCheck } from "@tabler/icons-react";

function ResetPasswordForm() {
  const form = useForm({
    mode: "uncontrolled",
    initialValues: {
      password: "",
      confirmPassword: "",
    },
  });

  return (
    <Container
      sx={{
        width: "100%",
        height: "100%",
        padding: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        margin: "40px 0 0",
      }}
    >
      {/* ── Logo ── */}
      <Flex align="center" justify="flex-start" style={{ width: "100%" }}>
        <Image
          src={PentLogo}
          h={50}
          fit="contain"
          my="xs"
          alt="Pulse Logo"
        />
      </Flex>

      {/* ── Content ── */}
      <Stack style={{ width: "100%" }} gap={0}>
        
        {/* Description */}
        <Text
          mb="sm"
          style={{
            textAlign: "left",
            fontSize: "16px",
            color: "#333333",
          }}
        >
          Create a strong password to secure your account and continue your journey.
        </Text>

        {/* Heading */}
        <Text
          size="lg"
          style={{
            fontSize: "18px",
            fontWeight: 500,
            color: "#333333",
          }}
        >
          Reset Password
        </Text>

        {/* Form */}
        <form onSubmit={form.onSubmit(() => {})}>
          
          {/* Password */}
          <div className="mantine-floating-wrapper" style={{ marginTop: "8px" }}>
            <PasswordInput
              placeholder=" "
              size="md"
              required
              {...form.getInputProps("password")}
              classNames={{ input: "floating-input" }}
            />
            <label className="floating-label">
              New Password <span>*</span>
            </label>
          </div>

          {/* Confirm Password */}
          <div className="mantine-floating-wrapper">
            <PasswordInput
              placeholder=" "
              size="md"
              required
              {...form.getInputProps("confirmPassword")}
              classNames={{ input: "floating-input" }}
            />
            <label className="floating-label">
              Confirm Password <span>*</span>
            </label>
          </div>

          {/* Password Rules */}
          <Text
            mt="md"
            mb="xs"
            style={{
              fontSize: "16px",
              fontWeight: 500,
              color: "#333333",
            }}
          >
            Password must:
          </Text>

          <List
            spacing="xs"
            size="sm"
            icon={
              <ThemeIcon color="#2563EB" size={18} radius="xl">
                <IconCircleCheck size={12} />
              </ThemeIcon>
            }
          >
            <List.Item>Minimum 8 characters</List.Item>
            <List.Item>At least one uppercase letter</List.Item>
            <List.Item>At least one lowercase letter</List.Item>
            <List.Item>One special character</List.Item>
            <List.Item>One number</List.Item>
          </List>

          {/* Submit */}
          <Button
            type="submit"
            radius="md"
            fullWidth
            mt="20px"
            color="#2563EB"
            size="md"
          >
            <Text mr="xs">Update Password</Text>
          </Button>
        </form>
      </Stack>
    </Container>
  );
}

export default ResetPasswordForm;