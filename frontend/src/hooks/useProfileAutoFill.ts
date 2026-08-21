import { useAuth } from "../contexts/AuthContext";

export interface UserAutoFillProfile {
  name: string;
  email: string;
  phone: string;
  city: string;
  state: string;
  address: string;
  pincode: string;
  emergencyContact: string;
  education: string;
  skills: string;
  isLoggedIn: boolean;
}

export const useProfileAutoFill = (): UserAutoFillProfile => {
  const { user } = useAuth();

  if (!user) {
    return {
      name: "",
      email: "",
      phone: "",
      city: "",
      state: "",
      address: "",
      pincode: "",
      emergencyContact: "",
      education: "Graduate",
      skills: "",
      isLoggedIn: false,
    };
  }

  const userObj = user as Record<string, any>;
  const addr = userObj.address;

  let streetAddress = "";
  let cityVal = userObj.city || "";
  let stateVal = userObj.state || "";
  let pincodeVal = userObj.pincode || "";

  if (typeof addr === "string") {
    streetAddress = addr;
  } else if (typeof addr === "object" && addr !== null) {
    streetAddress = addr.street || addr.addressLine1 || "";
    if (!cityVal) cityVal = addr.city || "";
    if (!stateVal) stateVal = addr.state || "";
    if (!pincodeVal) pincodeVal = addr.pincode || addr.zipCode || "";
  }

  return {
    name: userObj.name || "",
    email: userObj.email || "",
    phone: userObj.phone || "",
    city: cityVal,
    state: stateVal,
    address: streetAddress,
    pincode: pincodeVal,
    emergencyContact: userObj.emergencyContact || userObj.alternatePhone || "",
    education: userObj.education || "Graduate",
    skills: Array.isArray(userObj.skills)
      ? userObj.skills.join(", ")
      : userObj.skills || "",
    isLoggedIn: true,
  };
};
