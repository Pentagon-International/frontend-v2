import {
  Button,
  Container,
  Image,
  List,
  PasswordInput,
  Space,
  Text,
  ThemeIcon,
  useMantineTheme,
} from "@mantine/core";
import { hasLength, isEmail, useForm } from "@mantine/form";
import PentLogo from "../../../assets/images/pentagon-prime.svg";
import { useState } from "react";
import { IconCheck, IconCircleCheck } from "@tabler/icons-react";

function ResetPasswordForm() {
  const form = useForm({
    mode: "uncontrolled",
    initialValues: { name: "", email: "" },
    validate: {
      name: hasLength({ min: 3 }, "Must be at least 3 characters"),
      email: isEmail("Invalid email"),
    },
  });
  const theme = useMantineTheme();

  const [submittedValues, setSubmittedValues] = useState<
    typeof form.values | null
  >(null);

  return (
    <Container
      sx={(theme) => ({
        width: "100%",
        padding: "20px",
        maxWidth: "500px",
        margin: 0,
        [`@media (max-width: ${theme.breakpoints.md})`]: {
          padding: "16px",
          maxWidth: "600px",
        },
      })}
    >
      <Image
        radius="md"
        src={PentLogo}
        h={50}
        w="auto"
        fit="contain"
        my={"xs"}
        alt="Pulse Logo"
      />
      <Text
        size="md"
        style={{
          textAlign: "left",
          fontSize: "14px",
          color: "#333333",
        }}
      >
        Great! Now you can reset your password.
      </Text>
      <Space h="md" />

      <Text
        size="lg"
        style={{
          fontSize: "18px",
          fontWeight: 400,
          color: "#333333",
        }}
      >
        Reset Your Password.
      </Text>

      <form onSubmit={form.onSubmit(setSubmittedValues)}>
        <div className="mantine-floating-wrapper">
          <PasswordInput
            placeholder=" "
            size="md"
            required
            {...form.getInputProps("new-password")}
            classNames={{
              input: "floating-input",
            }}
          />
          <label className="floating-label">
            Password <span>*</span>
          </label>
        </div>
        <div className="mantine-floating-wrapper">
          <PasswordInput
            placeholder=" "
            size="md"
            required
            {...form.getInputProps("new-password")}
            classNames={{
              input: "floating-input",
            }}
          />
          <label className="floating-label">
            Re-Enter Password <span>*</span>
          </label>
        </div>

        <Space h="xl" />
        <Text
          size="lg"
          style={{
            fontSize: "18px",
            fontWeight: 400,
            color: "#333333",
          }}
        >
          Password Must:
        </Text>
        <Space h="sm" />
        <List
          spacing="sm"
          size="sm"
          center
          icon={
            <ThemeIcon color="#105476" size={20} radius="xl">
              <IconCircleCheck size={12} />
            </ThemeIcon>
          }
        >
          <List.Item>Minimum 8 characters</List.Item>
          <List.Item>Atleast one lower case character</List.Item>
          <List.Item>Atleast one upper case character</List.Item>
          <List.Item>One special character</List.Item>
          <List.Item>One numerical character</List.Item>
        </List>

        <Space h={"lg"}></Space>
        <Button
          radius={"md"}
          fullWidth
          color="#105476"
          rightSection={
            <IconCheck
              size={18}
              //   stroke={2}
              style={{ marginLeft: 2 }}
            />
          }
        >
          Update
          {/* <IconCheck size={18}/> */}
        </Button>
      </form>

      {/* <Space h="lg" />
      <Text>Login with your Credentials</Text>
      <Space h="sm" />
      <Stack
        align="stretch"
        justify="center"
        gap="lg"
        // style={{ width: "80%" }}
      >
        <form onSubmit={form.onSubmit(setSubmittedValues)}>
          <TextInput
            mb={"md"}
            label="Prime ID"
            placeholder="prime001"
            required
            {...form.getInputProps("primeId")}
            variant="default"
          />
          <TextInput
            mb={"md"}
            label="User Name"
            placeholder="username@gmail.com"
            required
            {...form.getInputProps("username")}
          />
          <PasswordInput
            mb={"md"}
            label="Password"
            placeholder="Your password"
            required
            {...form.getInputProps("password")}
          />

          <Stack gap="xs">
            <div style={{ display: "flex", cursor: "pointer" }}>
              <IconCheckbox />
              <Space w="sm" />
              <Text>Remember me</Text>
            </div>

            <Group justify="space-between" mt={"md"}>
              <Anchor
                onClick={() => navigate("/forgot-primeId")}
                size="sm"
                underline="always"
                style={{ color: "#105476" }}
              >
                Forgot Prime ID?
              </Anchor>
              <Anchor
                onClick={() => navigate("/forgot-password")}
                size="sm"
                underline="always"
                style={{ color: "#105476" }}
              >
                Forgot Password?
              </Anchor>
            </Group>
          </Stack>

          <Button type="submit" radius={"md"} fullWidth mt="md" color="#105476">
            Submit
            <IconCheck stroke={2} />
          </Button>
        </form>
      </Stack>  */}
      {/* </Stack> */}
    </Container>
  );
}

export default ResetPasswordForm;
