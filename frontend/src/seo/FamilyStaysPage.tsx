import React from "react";
import { SeoLandingPage } from "./SeoLandingPage";
import { SEO_LANDING_CONFIGS } from "./seoLandingConfigs";

export const FamilyStaysPage: React.FC = () => {
  return <SeoLandingPage config={SEO_LANDING_CONFIGS.family} />;
};

export default FamilyStaysPage;
