import useAuthStore from "../store/authStore";

/** Staff users (is_staff) can create new master records; others may only view/edit. */
export function useIsAdminUser(): boolean {
  return useAuthStore((state) => state.user?.is_staff ?? false);
}
