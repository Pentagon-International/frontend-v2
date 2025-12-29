import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { emotionTransform, MantineEmotionProvider } from "@mantine/emotion";
import requestInterceptor from "./api/requestInterceptor";
import responseInterceptor from "./api/responseInterceptor";
import { apiCallProtected } from "./api/axios";
import { MantineProvider } from "@mantine/core";
import { Toaster } from "react-hot-toast";
import RootRouter from "./Routes/RootRouter";
import { defaultTheme } from "./theme/brandThemeDefault";
import useAuthStore from "./store/authStore";
import { setGlobalQueryClient } from "./utils/queryClient";

function App() {
  requestInterceptor();
  responseInterceptor();
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000, // 5 minutes
        gcTime: 10 * 60 * 1000, // 10 minutes
        refetchOnWindowFocus: false,
        refetchOnMount: false,
        retry: 1,
      },
    },
  });

  // Set the global query client for use in Zustand store
  setGlobalQueryClient(queryClient);

  useEffect(() => {
    useAuthStore.getState().persistAuthFromStorage();
    return () => {
      // Clean up interceptors if needed
      // Note: requestInterceptor and responseInterceptor are functions, not interceptor IDs
      // The cleanup is handled automatically by axios
    };
  }, []);

  return (
    <MantineEmotionProvider>
      <MantineProvider theme={defaultTheme} stylesTransform={emotionTransform}>
        <Toaster position="top-center" reverseOrder={false} />
        <QueryClientProvider client={queryClient}>
          <RootRouter />
        </QueryClientProvider>
      </MantineProvider>
    </MantineEmotionProvider>
  );
}

export default App;
