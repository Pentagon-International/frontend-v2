import { Box, Container, Flex } from "@mantine/core";
import AuthImage from "./Components/AuthImage";
import ForgotPrimeIdImg from "../../assets/images/forgot-page.png";
import ForgotPasswordForm from "./Components/ForgotPasswordForm";

function ForgotPassword() {
  return (
    <Container
      fluid
      className="outfit"
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
        justify="space-around"
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
          style={{
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AuthImage
            image={ForgotPrimeIdImg}
            altText="Forgot-Password image"
            imageHeaderText={{
              heading: "Welcome to Pulse",
              text: "Your Gateway to Effortless Management",
            }}
          />
        </Box>
        <Box
          style={{
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ForgotPasswordForm />
        </Box>
      </Flex>
    </Container>
  );
}

export default ForgotPassword;
