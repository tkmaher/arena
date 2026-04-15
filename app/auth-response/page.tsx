export default async function Page({ searchParams }: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
    const { code, error } = await searchParams;
    console.log("Received auth code:", code);
    
    if (error) return (
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