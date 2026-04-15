"use client";
import { useParams } from 'next/navigation';

export default async function Page() {
    const params = useParams<{ code?: string, error?: string }>();
    console.log("Received auth code:", params.code);

    if (params.error) return (
        <div className="confirm">
            <h1 className="">Authorization denied. Redirecting...</h1>
        </div>
    )
    return (
        <div className="confirm">
            <h1 className="">Authorization confirmed! Redirecting...</h1>
        </div>
    )
}