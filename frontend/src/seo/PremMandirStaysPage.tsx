import React from "react";
import { SeoLandingPage } from "./SeoLandingPage";
import { SEO_LANDING_CONFIGS } from "./seoLandingConfigs";

export const PremMandirStaysPage: React.FC = () => {
  return <SeoLandingPage config={SEO_LANDING_CONFIGS["prem-mandir"]} />;
};

export default PremMandirStaysPage;
