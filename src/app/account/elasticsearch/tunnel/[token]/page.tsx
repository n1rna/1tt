import { EsTunnelStudio } from "@/components/account/es-tunnel-studio";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function EsTunnelPage({ params }: Props) {
  const { token } = await params;
  return (
    <>
      <style>{`body { overflow: hidden; } footer { display: none; } main { overflow: hidden !important; }`}</style>
      <EsTunnelStudio token={token} />
    </>
  );
}
