import { useCallback, useEffect, useState } from "react";
import type { LoadState } from "../marketplace/ui";
import { foodPartnerService } from "../../services/foodPartner.service";
import type { FoodPartnerProfile } from "../../services/foodPartner.service";

/** The caller's restaurant. `profile` is null once loaded when they have none. */
export const useMyRestaurant = () => {
  const [profile, setProfile] = useState<FoodPartnerProfile | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  const reload = useCallback(async () => {
    try {
      setProfile(await foodPartnerService.myProfile());
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return { profile, state, reload };
};
