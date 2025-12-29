import { Box, Container, Flex, useMantineTheme } from "@mantine/core";
import AuthImage from "./Components/AuthImage";
import resetPasswordImg from "../../assets/images/reset-password.png";
import ResetPasswordForm from "./Components/ResetPasswordForm";

function ResetPassword() {
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
          <AuthImage image={resetPasswordImg} altText="reset password image" />
        </Box>
        <Box
          sx={{
            width: "100%",
            maxWidth: "500px",
            padding: "20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            [`@media (max-width: ${theme.breakpoints.md})`]: {
              padding: "16px",
              maxWidth: "600px",
            },
          }}
        >
          <ResetPasswordForm />
        </Box>
      </Flex>
    </Container>
  );
}

export default ResetPassword;
