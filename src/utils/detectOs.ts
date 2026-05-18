export type OSType = "windows" | "mac" | "linux" | "unknown";

export function detectOS(): OSType {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes("win"))    return "windows";
  if (ua.includes("mac"))    return "mac";
  if (ua.includes("linux"))  return "linux";
  return "unknown";
}

export const OS_DISPLAY: Record<OSType, { label: string; icon: string; ext: string }> = {
  windows: { label: "Windows",    icon: "🪟", ext: ".zip"    },
  mac:     { label: "macOS",      icon: "🍎", ext: ".zip"    },
  linux:   { label: "Linux",      icon: "🐧", ext: ".tar.gz" },
  unknown: { label: "Your System",icon: "💻", ext: ""        },
};