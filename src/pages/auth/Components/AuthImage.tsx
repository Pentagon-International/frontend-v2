import {
  Box,
  Group,
  Image,
  Overlay,
  Stack,
  Text,
  useMantineTheme,
} from "@mantine/core";

type Props = {
  image: string;
  altText: string;
  imageHeaderText?: {
    heading?: string;
    text?: string;
  };
  imageFooterText?: {
    heading?: string;
    text?: string;
  };
};

const AuthImage = ({
  image,
  altText,
  imageHeaderText,
  imageFooterText,
}: Props) => {
  const theme = useMantineTheme();
  return (
    <Box
      sx={(theme) => ({
        maxWidth: "500px",
        width: "100%",
        height: "95vh",
        maxHeight: "550px",
        minWidth: "340px",
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        [`@media (max-width: ${theme.breakpoints.md})`]: {
          maxWidth: "600px",
          maxHeight: "720px",
        },
      })}
    >
      <Overlay
        zIndex={0}
        inset={0}
        gradient={imageFooterText ? "linear-gradient(#0F52764D , #105476 50%)" : "linear-gradient(#0F52764D 50%, #105476)"}
        radius={20}
        opacity={0.85}
      />
      <Image
        fit="cover"
        src={image}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          borderRadius: "20px",
        }}
        alt={altText}
      />
      {imageHeaderText && (
        <Stack
          mt="md"
          style={{
            zIndex: 2,
            position: "absolute",
            top: "3rem",
            padding: "0 30px",
            textAlign: "center",
            color: "white",
          }}
        >
          <Text
            style={{ fontSize: "2rem", fontWeight: 500, lineHeight: "100%" }}
          >
            {imageHeaderText.heading}
          </Text>
          <Text style={{ fontSize: "1.15rem", fontWeight: 400 }}>
            {imageHeaderText.text}
          </Text>
        </Stack>
      )}
      {imageFooterText && (
        <Stack
          mt="md"
          style={{
            zIndex: 2,
            position: "absolute",
            bottom: "4rem",
            padding: "0 30px",
            textAlign: "center",
            color: "white",
          }}
        >
          <Text
            style={{ fontSize: "2rem", fontWeight: 500, lineHeight: "100%" }}
          >
            {imageFooterText.heading}
          </Text>
          <Text style={{ fontSize: "1.15rem", fontWeight: 400 }}>
            {imageFooterText.text}
          </Text>
        </Stack>
      )}
    </Box>
  );
};

export default AuthImage;
