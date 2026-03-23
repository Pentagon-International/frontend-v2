import { useEffect, useState } from "react";
import { Box, Overlay, Stack, Text } from "@mantine/core";

// ── Types ────────────────────────────────────────────────────────────────────

type SlideContent = {
  image: string;
  altText: string;
  headerText?: {
    heading?: string;
    text?: string;
  };
  footerText?: {
    heading?: string;
    text?: string;
  };
};

type Props = {
  slides: SlideContent[];
  /** Auto-advance interval in ms. Default: 5000 */
  interval?: number;
};

// ── Component ─────────────────────────────────────────────────────────────────

const AuthImage = ({ slides, interval = 5000 }: Props) => {
  const [current, setCurrent] = useState(0);

  // ── Auto-advance (smooth continuous loop) ──
  useEffect(() => {
    const id = setInterval(() => {
      setCurrent((prev) => (prev + 1) % slides.length);
    }, interval);

    return () => clearInterval(id);
  }, [interval, slides.length]);

  // ── Manual navigation ──
  const goTo = (index: number) => {
    if (index === current) return;
    setCurrent(index);
  };

  const activeSlide = slides[current];
  const hasFooter = !!activeSlide.footerText;

  return (
    <Box
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* ── Slide images ── */}
      {slides.map((slide, i) => (
        <Box
          key={slide.image}
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${slide.image})`,
            backgroundSize: "cover",
            backgroundPosition: "center",

            // ✅ Smooth fade transition
            opacity: i === current ? 1 : 0,
            transition: "opacity 1s ease-in-out",
            zIndex: i === current ? 1 : 0,
          }}
          role="img"
          aria-label={slide.altText}
        />
      ))}

      {/* ── Gradient overlay ── */}
      <Overlay
        zIndex={2}
        inset={0}
        gradient={
          hasFooter
            ? "linear-gradient(0deg, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.45) 100%)"
            : "linear-gradient(0deg, rgba(0,0,0,0.45) 50%, rgba(0,0,0,0.45) 100%)"
        }
        opacity={1}
      />

      {/* ── Header text ── */}
      <Stack
        style={{
          zIndex: 3,
          position: "absolute",
          top: "5rem",
          left: 0,
          right: 0,
          padding: "0 30px",
          textAlign: "center",
          color: "white",
          gap: "0.5rem",
        }}
      >
        <Text
          mb={16}
          style={{
            fontSize: "2.25rem",
            fontWeight: 500,
            lineHeight: 1,
          }}
        >
          Welcome Back to Pulse
        </Text>

        <Text
          style={{
            fontSize: "1.15rem",
            fontWeight: 400,
            maxWidth: "85%",
            margin: "0 auto",
            lineHeight: 1.8,
          }}
        >
          The Heartbeat of your freight operations, delivering lightning-fast
          bookings, real-time visibility, and seamless end-to-end logistics
          control in one powerful platform.
        </Text>
      </Stack>

      {/* ── Footer text ── */}
      {activeSlide.footerText && (
        <Stack
          style={{
            zIndex: 3,
            position: "absolute",
            bottom: "4.5rem",
            left: 0,
            right: 0,
            padding: "0 30px",
            textAlign: "center",
            color: "white",
            gap: "0.5rem",
            marginBottom: "1.25rem",
          }}
        >
          {activeSlide.footerText.heading && (
            <Text
              mb={8}
              style={{
                fontSize: "1.75rem",
                fontWeight: 500,
                lineHeight: 1,
              }}
            >
              {activeSlide.footerText.heading}
            </Text>
          )}

          {activeSlide.footerText.text && (
            <Text
              style={{
                fontSize: "1.15rem",
                fontWeight: 400,
                maxWidth: "85%",
                margin: "0 auto",
                lineHeight: 1.8,
              }}
            >
              {activeSlide.footerText.text}
            </Text>
          )}
        </Stack>
      )}

      {/* ── Dot indicators ── */}
      <Box
        style={{
          zIndex: 3,
          position: "absolute",
          bottom: "2rem",
          left: 0,
          right: 0,
          display: "flex",
          justifyContent: "center",
          gap: "8px",
        }}
      >
        {slides.map((_, i) => (
          <Box
            key={i}
            onClick={() => goTo(i)}
            style={{
              width: i === current ? 24 : 8,
              height: 8,
              borderRadius: 99,
              background:
                i === current
                  ? "rgba(255,255,255,0.95)"
                  : "rgba(255,255,255,0.38)",
              cursor: "pointer",
              transition: "width 0.35s ease, background 0.35s ease",
              flexShrink: 0,
            }}
          />
        ))}
      </Box>
    </Box>
  );
};

export default AuthImage;