"use client";

import * as React from "react";
import { ProductTour } from "@/components/portal/product-tour";
import { ENROLLED_FEATURES_TOUR_STEPS } from "@/lib/portal-tours";

const SHOWN_KEY = "lavelle_unlocked_tour_shown_v1";

/**
 * Fires once, the first time an enrolled candidate reaches the dashboard —
 * points at the four nav items enrolment just unlocked (Programme,
 * Deadlines, Assessment, Notes). A guest-checkout candidate lands straight
 * in EnrolledDashboard already enrolled and never sees the applicant
 * onboarding tour at all, so this is their only orientation to those items.
 */
export function UnlockedFeaturesTour() {
  const [active, setActive] = React.useState(false);

  React.useEffect(() => {
    // localStorage isn't available during SSR/first render, so whether
    // this has already run can't be known until after mount — the same
    // reasoning as the applicant dashboard's own dismissal check.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!window.localStorage.getItem(SHOWN_KEY)) setActive(true);
  }, []);

  function finish() {
    window.localStorage.setItem(SHOWN_KEY, "1");
    setActive(false);
  }

  return <ProductTour steps={ENROLLED_FEATURES_TOUR_STEPS} active={active} onFinish={finish} />;
}
