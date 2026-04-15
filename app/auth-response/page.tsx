"use client";

import AuthResponseClient from "@/components/user/authresponseclient";

export default function Page({
    searchParams,
}: {
    searchParams: {
        code?: string;
        error?: string;
    };
}) {
    console.log(searchParams);
    return (
        <AuthResponseClient
            code={searchParams.code}
            error={searchParams.error}
        />
    );
}

