import { Box, Container, Flex } from "@mantine/core";
import AuthImage from "./Components/AuthImage";
import forgotPrimeIdImg from "../../assets/images/forgot-page.png";
import ForgotPrimeIdForm from "./Components/ForgotPrimeIdForm";

function ForgotPrimeId() {
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
          <AuthImage image={forgotPrimeIdImg} altText="Forgot-prime ID image" imageHeaderText={{
              heading: "Welcome to Pulse",
              text: "Your Gateway to Effortless Management",
            }} />
        </Box>
        <Box
          style={{
            padding: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ForgotPrimeIdForm />
        </Box>
      </Flex>
    </Container>
  );
}

export default ForgotPrimeId;
