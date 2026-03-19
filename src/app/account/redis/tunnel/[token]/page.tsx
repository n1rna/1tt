import { RedisTunnelStudio } from "@/components/account/redis-tunnel-studio";

interface Props {
  params: Promise<{ token: string }>;
}

export default async function RedisTunnelPage({ params }: Props) {
  const { token } = await params;
  return (
    <>
      <style>{`body { overflow: hidden; } footer { display: none; } main { overflow: hidden !important; }`}</style>
      <RedisTunnelStudio token={token} />
    </>
  );
}
