import {
  Button,
  Container,
  Flex,
  Image,
  Input,
  Stack,
  Text,
  useMantineTheme,
} from "@mantine/core";
import PentLogo from "../../../assets/images/pentagon-prime.svg";
import { IconArrowRight } from "@tabler/icons-react";
import "./../authPage.css";

function ForgotPasswordForm() {
  const theme = useMantineTheme();
  return (
    <Container
      sx={(theme) => ({
        width: "100%",
        height:"100%",
        padding: "20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
        margin: 0,
      })}
    >
      <Flex align="center" justify="flex-start" style={{ width: "100%" }}>
        <Image
          radius="md"
          src={PentLogo}
          h={50}
          w="auto"
          fit="contain"
          my={"xs"}
          alt="Pulse Logo"
        />
      </Flex>
      <Stack style={{ width: "100%" }}>
        <Text
          mb="sm"
          style={{
            textAlign: "left",
            fontSize: "16px",
            color: "#333333",
          }}
        >
          Enter your mail id, we will send a verification link to that email,
          that’s allowing you to confirm your identity.
        </Text>

        <form>
          <Text
            size="lg"
            style={{
              fontSize: "18px",
              fontWeight: 500,
              color: "#333333",
            }}
          >
            Forgot Password?
          </Text>

          <div className="mantine-floating-wrapper">
            <Input
              component="input"
              placeholder=" "
              size="md"
              required
              classNames={{
                input: "floating-input",
              }}
            />
            <label className="floating-label">
              Email ID <span>*</span>
            </label>
          </div>

          <Button
            type="submit"
            radius={"md"}
            fullWidth
            mt="20px"
            color="#105476"
            size="md"
            style={{
              display: "flex",
              alignItems: "base",
              justifyContent: "center",
            }}
          >
            <Text mr="xs">{"Get a Link"}</Text>
            {/* {isLoading ? (
              <Loader size={20} color="white" />
            ) : (
              <IconCheck size={16} stroke={3} />
            )} */}
          </Button>
        </form>
      </Stack>


    </Container>
  );
}

export default ForgotPasswordForm;
