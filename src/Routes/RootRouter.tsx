import { BrowserRouter, Route, Routes } from "react-router-dom";
import useAuthStore from "../store/authStore";
import NavigationRoutes from "./NavigationRoutes";
import {
  ForgotPrimeId,
  Login,
  ForgotPassword,
  ResetPassword,
  QuotationApprovalPublic,
} from "../pages";

const RootRouter = () => {
  // const accessToken = useAuthStore((state) => state.auth?.token);
  // const accessToken = "Auth is set";

  // const accessToken = useAuthStore((state) => state.getAccessToken());
  // console.log("accessToken=", accessToken);
  // const accessToken = "";
  // const accessToken = useAuthStore.getState().accessToken;
  // console.log("getting token---", accessToken);

  const accessToken = useAuthStore((state) => state.accessToken);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes that don't require authentication */}
        <Route
          path="/quotation/approvalrequest/:quotationId"
          element={<QuotationApprovalPublic />}
        />

        {accessToken ? (
          <Route path="/*" element={<NavigationRoutes />} />
        ) : (
          <>
            <Route path="/*" element={<Login />} />
            <Route path="/forgot-primeId" element={<ForgotPrimeId />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  );
};

export default RootRouter;
