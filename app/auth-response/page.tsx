import AuthResponseClient from "@/components/user/authresponseclient";

export default function Page({
  searchParams,
}: {
  searchParams: {
    code?: string;
    error?: string;
  };
}) {
  return (
    <AuthResponseClient
      code={searchParams.code}
      error={searchParams.error}
    />
  );
}