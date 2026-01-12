import { create } from "zustand";
import { invalidateBranchRelatedQueries } from "../utils/queryClient";
import { URL } from "../api/serverUrls";
// const useAuthStore = create(
//   persist(
//     (set,get) => {
//       return {
//         auth: {},
//         saveAuth: (authObj) => {
//           set(currentState => ({
//             auth: {
//               ...currentState?.auth,
//               ...authObj
//             }
//           }))
//         },
//          getAccessToken: () => get().auth?.access || null,
//          getEmail: () => get().auth?.email || null,
//          getFullName: () => get().auth?.full_name || null,
//         // getRoleId: () => set((state) => state.auth?.user.Roles[0]?.roleId || null),
//         resetAuth: () => {
//           set({ auth: {} }, true)
//           /** This will replace the current entry in the browser's history, without reloading */
//           window?.location?.replace?.('/');
//         }
//       }
//     },
//     {
//       name: AUTH_STORE,
//       storage: createJSONStorage(() => sessionStorage)
//     }
//   )
// )

interface Company {
  company_id: number;
  company_code: string;
  company_name: string;
}

interface Country {
  country_id: number;
  country_code: string;
  country_name: string;
}

interface Branch {
  user_branch_id: number;
  branch_code: string;
  branch_name: string;
  is_default: boolean;
}

interface ScreenPermissions {
  quotation_approval?: boolean;
}

interface User {
  pulse_id: string;
  password?: string;
  full_name: string;
  user_identifier: string;
  user_id: number;
  username: string;
  email?: string;
  is_staff: boolean;
  is_manager: boolean;
  company: Company;
  country: Country;
  branches: Branch[];
  screen_permissions?: ScreenPermissions;
}

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  login: (data: {
    refresh: string;
    access: string;
    pulse_id: string;
    full_name: string;
    user_identifier: string;
    user_id: number;
    username: string;
    is_staff: boolean;
    is_manager: boolean;
    company: Company;
    country: Country;
    branches: Branch[];
    screen_permissions?: ScreenPermissions;
  }) => void;
  logout: () => void;
  resetAuth: () => void;
  refreshAccessToken: () => Promise<string>;
  setTokens: (access: string, refresh: string) => void;
  persistAuthFromStorage: () => void;
  updateUserBranches: (newDefaultBranchId: number) => void;
  updateUserCompany: (companyData: {
    company: string;
    company_id: number;
    company_code: string;
  }) => void;
  updateUserCountry: (countrydata: {
    country_id: number;
    country_code: string;
    country_name: string;
  }) => void;
  invalidateQueries: () => void;
}

const useAuthStore = create<AuthStore>((set) => ({
  user: JSON.parse(localStorage.getItem("user") || "null"),
  accessToken: localStorage.getItem("accessToken"),
  refreshToken: localStorage.getItem("refreshToken"),

  login: (data) => {
    const user: User = {
      pulse_id: data.pulse_id,
      full_name: data.full_name,
      user_identifier: data.user_identifier,
      user_id: data.user_id,
      username: data.username,
      email: data.user_identifier, // Using user_identifier as email
      is_staff: data.is_staff,
      is_manager: data.is_manager,
      company: data.company,
      country: data.country,
      branches: data.branches,
      screen_permissions: data.screen_permissions,
    };

    // console.log("Login data received:", data);
    // console.log("User object created:", user);

    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("accessToken", data.access);
    localStorage.setItem("refreshToken", data.refresh);

    set({
      user,
      accessToken: data.access,
      refreshToken: data.refresh,
    });
  },

  setTokens: (accessToken, refreshToken) => {
    localStorage.setItem("accessToken", accessToken);
    localStorage.setItem("refreshToken", refreshToken);

    set({ accessToken, refreshToken });
  },

  logout: () => {
    localStorage.clear();
    set({ user: null, accessToken: null, refreshToken: null });
    window.location.href = "/login"; // or use navigate()
  },

  resetAuth: () => {
    localStorage.clear();
    set({ user: null, accessToken: null, refreshToken: null });
    window.location.href = "/login";
  },

  refreshAccessToken: async () => {
    const refresh = localStorage.getItem("refreshToken");
    if (!refresh) {
      // No refresh token available - this should logout
      const error = new Error("No refresh token available") as Error & {
        isRefreshTokenExpired?: boolean;
      };
      error.isRefreshTokenExpired = true;
      throw error;
    }

    const baseURL =
      import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api/";

    try {
      // Construct refresh token URL (baseURL already ends with /)
      const refreshUrl = `${baseURL}${URL.refreshToken}`;
      const res = await fetch(refreshUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      if (!res.ok) {
        // Only logout if refresh token API returns 401 (refresh token expired)
        if (res.status === 401) {
          const error = new Error("Refresh token expired") as Error & {
            isRefreshTokenExpired?: boolean;
          };
          error.isRefreshTokenExpired = true;
          throw error;
        }
        // For other errors (network, 500, etc.), don't logout - just throw error
        throw new Error(`Failed to refresh token: ${res.status}`);
      }

      const data = await res.json();

      if (!data.access) {
        throw new Error("No access token in response");
      }

      // Update tokens in localStorage and state
      localStorage.setItem("accessToken", data.access);
      set({ accessToken: data.access });

      // If the response includes a new refresh token, update it as well
      if (data.refresh) {
        localStorage.setItem("refreshToken", data.refresh);
        set({ refreshToken: data.refresh });
      }

      return data.access;
    } catch (err: any) {
      // Only rethrow - don't logout here
      // The interceptor will handle logout based on isRefreshTokenExpired flag
      console.error("Token refresh failed:", err);
      throw err;
    }
  },
  persistAuthFromStorage: () => {
    const accessToken = localStorage.getItem("accessToken");
    const refreshToken = localStorage.getItem("refreshToken");
    const user = JSON.parse(localStorage.getItem("user") || "null");

    if (accessToken && refreshToken && user) {
      useAuthStore.setState({ accessToken, refreshToken, user });
    }
  },

  updateUserBranches: (newDefaultBranchId: number) => {
    set((state) => {
      if (!state.user || !state.user.branches) return state;

      const updatedBranches = state.user.branches.map((branch) => ({
        ...branch,
        is_default: branch.user_branch_id === newDefaultBranchId,
      }));

      const updatedUser = {
        ...state.user,
        branches: updatedBranches,
      };

      // Update localStorage
      localStorage.setItem("user", JSON.stringify(updatedUser));

      // Invalidate branch-related queries to refetch data
      invalidateBranchRelatedQueries();

      return {
        ...state,
        user: updatedUser,
      };
    });
  },
  updateUserCompany: (companyData: {
    company: string;
    company_id: number;
    company_code: string;
  }) => {
    set((state) => {
      if (!state.user) return state;

      const updatedUser = {
        ...state.user,
        company: {
          ...state.user.company,
          company_name: companyData.company,
          company_id: companyData.company_id,
          company_code: companyData.company_code,
        },
      };

      localStorage.setItem("user", JSON.stringify(updatedUser));
      console.log("updatedUser :", updatedUser);
      invalidateBranchRelatedQueries();

      return {
        ...state,
        user: updatedUser,
      };
    });
  },
  updateUserCountry: (countrydata: {
    country_id: number;
    country_code: string;
    country_name: string;
  }) => {
    set((state) => {
      if (!state.user) return state;

      const updatedUser = {
        ...state.user,
        country: {
          ...state.user.country,
          country_name: countrydata.country_name,
          country_code: countrydata.country_code,
          country_id: countrydata.country_id,
        },
      };

      localStorage.setItem("user", JSON.stringify(updatedUser));
      console.log("updatedUser :", updatedUser);
      invalidateBranchRelatedQueries();

      return {
        ...state,
        user: updatedUser,
      };
    });
  },

  invalidateQueries: () => {
    invalidateBranchRelatedQueries();
  },
}));

export default useAuthStore;
