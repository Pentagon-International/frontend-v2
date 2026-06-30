import { Suspense, type ReactNode } from "react";
import { Center, Loader } from "@mantine/core";

export function LazyRoute({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <Center h="50vh">
          <Loader size="lg" />
        </Center>
      }
    >
      {children}
    </Suspense>
  );
}
