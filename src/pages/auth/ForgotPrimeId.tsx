import { Box, Button, Container, Flex, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { useNavigate } from "react-router-dom";
import { IconArrowLeft } from "@tabler/icons-react";
import AuthImage from "./Components/AuthImage";
import ForgotPrimeIdForm from "./Components/ForgotPrimeIdForm";
import forgotPrimeIdImg from "../../assets/images/forgot-page.png";
import ForgotImage1 from "../../assets/images/ForgotPage-Image-1.jpg";
import ForgotImage2 from "../../assets/images/ForgotPage-Image-2.jpg";

function ForgotPrimeId() {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isTablet = useMediaQuery("(max-width: 1024px)");
  const navigate = useNavigate();

  return (
    <Container
      fluid
      className="outfit"
      style={{
        width: "100vw",
        minHeight: "100vh",
        padding: 0,
        overflow: "hidden",
      }}
    >
      <Flex
        style={{
          width: "100%",
          minHeight: "100vh",
        }}
      >
        {/* ── Form Section ── */}
        <Box
          style={{
            flex: isMobile ? "1 1 100%" : "1 1 0",
            minWidth: 0,
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Box
            style={{
              width: "100%",
              padding: "0 32px",
              minHeight: "100vh",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
            }}
          >
            {/* Back to Login button */}
            <Button
              variant="subtle"
              color="#555555"
              onClick={() => navigate("/")}
              style={{
                position: "absolute",
                top: "2rem",
                left: "2.5rem",
              }}
            >
              <IconArrowLeft size={16} />
              <Text ml="sm">Back to Login</Text>
            </Button>

            <ForgotPrimeIdForm />
          </Box>
        </Box>

        {/* ── Image Section — hidden on mobile ── */}
        {!isMobile && (
          <Box
            style={{
              flex: isTablet ? "1 1 0" : "1.5 1 0",
              minWidth: 0,
              minHeight: "100vh",
              position: "sticky",
              top: 0,
            }}
          >
            <AuthImage
              slides={[
                {
                  image: ForgotImage1,
                  altText: "Forgot Prime ID image",
                  footerText: {
                    heading: "Forgot Your Pulse ID?",
                    text: "No worries — recovering your Pulse ID is quick and easy. Get back to managing your freight in seconds.",
                  },
                },
                {
                  image: ForgotImage2,
                  altText: "Forgot Prime ID image",
                  footerText: {
                    heading: "Forgot Your Pulse ID?",
                    text: "No worries — recovering your Pulse ID is quick and easy. Get back to managing your freight in seconds.",
                  },
                },
                {
                  image: forgotPrimeIdImg,
                  altText: "Forgot Prime ID image",
                  footerText: {
                    heading: "Forgot Your Pulse ID?",
                    text: "No worries — recovering your Pulse ID is quick and easy. Get back to managing your freight in seconds.",
                  },
                },
              ]}
              interval={4000}
            />
          </Box>
        )}
      </Flex>
    </Container>
  );
}

export default ForgotPrimeId;