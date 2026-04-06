// hooks/useDateFormat.ts

import { useMemo } from "react";
import useAuthStore from "@/store/useAuthStore";
import { getDateFormat } from "@/utils/dateFormat";

const useDateFormat = () => {
  const countryCode = useAuthStore(
    (state) => state.user?.country?.country_code
  );

  const dateFormat = useMemo(() => {
    return getDateFormat(countryCode);
  }, [countryCode]);

  return dateFormat;
};

export default useDateFormat;