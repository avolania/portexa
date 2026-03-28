"use client";

import PortalContent from "@/components/itsm/PortalContent";

export default function ITSMPortalPage() {
  return (
    <PortalContent
      myTicketsHref="/itsm/my-tickets"
      itsmDashboardHref="/itsm"
    />
  );
}
