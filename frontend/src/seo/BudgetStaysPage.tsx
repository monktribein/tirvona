import React from "react";
import { SeoLandingPage } from "./SeoLandingPage";
import { SEO_LANDING_CONFIGS } from "./seoLandingConfigs";

export const BudgetStaysPage: React.FC = () => {
  return <SeoLandingPage config={SEO_LANDING_CONFIGS.budget} />;
};

export default BudgetStaysPage;
