import { toast, ToastOptions } from "react-hot-toast";

interface ToastNotificationProps {
  type: "success" | "error" | "warning" | string;
  message: string;
}

const ToastNotification = ({ type, message }: ToastNotificationProps) => {
  const options: ToastOptions = {};

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

  toast(message, options);
};

export default ToastNotification;
