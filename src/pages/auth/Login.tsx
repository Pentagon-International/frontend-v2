import { Box, Container, Flex } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import AuthImage from "./Components/AuthImage";
import LoginRightPane from "./Components/LoginRightPane";
import containerPort from "@/assets/images/LoginPage-Image-5.jpg";
import nightPort from "@/assets/images/LoginPage-Image-4.jpg";
import cargoShip from "@/assets/images/LoginPage-Image-3.jpg";
import "./authPage.css";

function Login() {
  const isMobile = useMediaQuery("(max-width: 767px)");
  const isTablet = useMediaQuery("(max-width: 1024px)");

  return (
    <Container
      fluid
      className="login-container outfit"
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
        {/* ── Image / Carousel Section — hidden on mobile ── */}
        {!isMobile && (
          <Box
            className="login-image-section"
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
                  image: containerPort,
                  altText: "Container port",
                  footerText: {
                    heading: "Smart Freight Hub",
                    text: "Your gateway to faster, smarter, and more efficient freight management.",
                  }
                },
                {
                  image: nightPort,
                  altText: "Night terminal",
                  footerText: {
                    heading: "Real-Time Synergy",
                    text: "Empower teams to collaborate instantly and keep operations flowing 24/7.",
                  }
                },
                {
                  image: cargoShip,
                  altText: "Cargo ship",
                  footerText: {
                    heading: "Global Without Limits",
                    text: "Seamlessly connect to worldwide markets with one powerful platform.",
                  }
                },
              ]}
              interval={4000}
            />
          </Box>
        )}

        {/* ── Form Section ── */}
        <Box
          className="login-form-section"
          style={{
            // On mobile: take full width. On desktop: share with image panel.
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
            }}
          >
            <LoginRightPane />
          </Box>
        </Box>
      </Flex>
    </Container>
  );
}

export default Login;