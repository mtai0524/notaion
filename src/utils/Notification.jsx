import { notification } from "antd";

export const showNotification = (
  type,
  message,
  description,
  duration = 1,
  pauseOnHover = true,
  showProgress = true
) => {
  notification[type]({
    message,
    description,
    duration,
    pauseOnHover,
    showProgress,
  });
};
