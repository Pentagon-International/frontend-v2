import { Box, Button, Container, Flex, Text } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { IconArrowLeft } from "@tabler/icons-react";
import { useNavigate } from "react-router-dom";
import AuthImage from "./Components/AuthImage";
import ResetPasswordForm from "./Components/ResetPasswordForm";
import resetPasswordImg from "../../assets/images/reset-password.png";
import resetPasswordImg1 from "../../assets/images/ResetPage-Image-1.jpg";
import resetPasswordImg2 from "../../assets/images/ResetPage-Image-2.jpg";

function ResetPassword() {
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
            {/* 🔙 Back Button */}
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

            <ResetPasswordForm />
          </Box>
        </Box>

        {/* ── Image Section ── */}
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
                  image: resetPasswordImg1,
                  altText: "Reset password image",
                  footerText: {
                    heading: "Set a New Password",
                    text: "Secure your account with a strong password and get back to managing your shipments seamlessly.",
                  },
                },
                {
                  image: resetPasswordImg2,
                  altText: "Reset password image",
                  footerText: {
                    heading: "Set a New Password",
                    text: "Secure your account with a strong password and get back to managing your shipments seamlessly.",
                  },
                },
                {
                  image: resetPasswordImg,
                  altText: "Reset password image",
                  footerText: {
                    heading: "Set a New Password",
                    text: "Secure your account with a strong password and get back to managing your shipments seamlessly.",
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

export default ResetPassword;