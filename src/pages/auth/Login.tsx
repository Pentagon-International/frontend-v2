import { Box, Container, Flex, useMantineTheme } from "@mantine/core";
import AuthImage from "./Components/AuthImage";
import LoginImage from "../../assets/images/login.jpg";
import LoginRightPane from "./Components/LoginRightPane";
import "./authPage.css";

function Login() {
  const theme = useMantineTheme();

  return (
    <Container
      fluid
      className="login-container outfit"
      style={{
        width: "100%",
        minHeight: "100vh",
        padding: 0,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Flex
        justify="space-evenly"
        align="center"
        sx={(theme) => ({
          margin: "0",
          width: "100%",
          height: "100%",
          [`@media (max-width: ${theme.breakpoints.md})`]: {
            flexDirection: "column",
            padding: "28px",
            gap: "40px",
          },
        })}
      >
        <Box
          className="login-image-section"
          style={{
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AuthImage
            image={LoginImage}
            altText="Login-image"
            imageHeaderText={{
              heading: "Welcome to Pulse",
              text: "Your Gateway to Effortless Management",
            }}
            imageFooterText={{
              heading: "Seamless Collaboration",
              text: "Effortlessly work together with your team in real-time.",
            }}
          />
        </Box>
        <Box
          className="login-form-section"
          style={{
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <LoginRightPane />
        </Box>
      </Flex>
    </Container>
  );
}

export default Login;
