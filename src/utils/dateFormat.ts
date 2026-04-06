export const getDateFormat = (countryCode?: string): string => {
  switch (countryCode) {
    case "IN":
      return "DD-MM-YYYY";
    case "US":
      return "MM-DD-YYYY";
    default:
      return "YYYY-MM-DD";
  }
};
