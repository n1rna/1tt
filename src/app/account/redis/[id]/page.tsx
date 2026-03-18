import { Metadata } from "next";
import { RedisStudio } from "@/components/account/redis-studio";

export const metadata: Metadata = {
  title: "Redis Studio - 1tt",
  description: "Browse and manage your Upstash Redis database",
};

export default async function RedisStudioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // id is passed to RedisStudio via useParams() inside the client component
  void id;
  return (
    <>
      <style>{`body { overflow: hidden; } footer { display: none; }`}</style>
      <RedisStudio />
    </>
  );
}
