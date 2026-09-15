import { toast, ToastOptions } from "react-hot-toast";

interface ToastNotificationProps {
  type: "success" | "error" | "warning" | string;
  message: string;
}

const ToastNotification = ({ type, message }: ToastNotificationProps) => {
  const options: ToastOptions = {
    duration: type === "error" ? 6000 : 4000,
  };

  switch (type) {
    case "success":
      options.icon = "✅";
      break;
    case "error":
      options.icon = "❌";
      break;
    case "warning":
      options.icon = "⚠️";
      break;
    default:
      break;
  }

  const text =
    typeof message === "string"
      ? message.trim()
      : message != null
        ? String(message)
        : "";
  toast(text || "Something went wrong. Please try again.", options);
};

export default ToastNotification;
