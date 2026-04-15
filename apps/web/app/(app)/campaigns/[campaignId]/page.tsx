import CampaignDetailPageContent from "./CampaignDetailPageContent";

interface CampaignDetailPageProps {
  params: Promise<{
    campaignId: string;
  }>;
}

export default async function CampaignDetailPage({ params }: CampaignDetailPageProps) {
  const { campaignId } = await params;

  return <CampaignDetailPageContent campaignId={campaignId} />;
}
