import PentLogo from "../../../assets/images/pentagon-prime.svg";
import {
  Container,
  Image,
  SegmentedControl,
  Space,
  Text,
  useMantineTheme,
} from "@mantine/core";
import { useState } from "react";
import LoginForm from "./LoginForm";
import SignUpForm from "./SignUpForm";

type SegmentOption = "signin" | "signup";

function LoginRightPane() {
  const [formType, setFormValue] = useState<SegmentOption>("signin");
  const theme = useMantineTheme();
  const handleSegmentChange = (val: string) => {
    setFormValue(val as SegmentOption);
  };

  return (
    <Container
      className="login-form-container"
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
        Lorem, ipsum dolor sit amet consectetur adipisicing elit. Veniam dolorum
        quam vero earum, fugit itaque voluptatum
      </Text>

      <Space h="md" />

      <SegmentedControl
        value={formType}
        onChange={handleSegmentChange}
        fullWidth
        data={[
          { label: "Sign In", value: "signin" },
          { label: "Sign Up", value: "signup" },
        ]}
        radius={"md"}
        size="md"
        color="#FFF"
        styles={{
          root: {
            backgroundColor: "#7098AD",
            color: "#FFF",
          },
          indicator: {
            backgroundColor: "#105476",
            color: "#FFF",
          },
        }}
      />

      <Space h="lg" />

      {formType === "signin" ? <LoginForm /> : <SignUpForm />}
    </Container>
  );
}

export default LoginRightPane;
