import { TunnelStudio } from "@/components/account/tunnel-studio";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function TunnelStudioPage({ params }: Props) {
  const { token } = await params;
  return (
    <>
      <style>{`body { overflow: hidden; } footer { display: none; } main { overflow: hidden !important; }`}</style>
      <TunnelStudio token={token} />
    </>
  );
}
