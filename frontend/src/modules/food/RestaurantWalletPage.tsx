/**
 * Kitchen Wallet: what Tirvona owes this restaurant for delivered orders and what it has paid so far.
 * Route: /restaurant/wallet
 */
import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { RefreshCw, Wallet } from "lucide-react";
import { PanelState } from "../marketplace/ui";
import { Button, PageContainer, PageHeader } from "../pandit/ui";
import { FoodWalletView } from "./FoodWalletView";
import { useMyRestaurant } from "./useMyRestaurant";

export const RestaurantWalletPage: React.FC = () => {
  const { profile, state, reload } = useMyRestaurant();
  const [refreshKey, setRefreshKey] = useState(0);

  if (state !== "ready") return <PanelState state={state} onRetry={reload} />;
  // No restaurant yet: send the owner to sign-up instead of an empty wallet.
  if (!profile) return <Navigate to="/restaurant/profile" replace />;

  return (
    <PageContainer>
      <PageHeader
        eyebrow="Restaurant workspace"
        icon={<Wallet size={20} />}
        title="Kitchen Wallet"
        description="Customers pay Tirvona, so Tirvona pays you. This is what Tirvona owes you for delivered orders, and every payment it has made."
        actions={
          <Button variant="outline" onClick={() => setRefreshKey((k) => k + 1)} aria-label="Refresh wallet">
            <RefreshCw size={16} aria-hidden="true" />
            Refresh
          </Button>
        }
      />
      <FoodWalletView scope="owner" refreshKey={refreshKey} />
    </PageContainer>
  );
};

export default RestaurantWalletPage;
