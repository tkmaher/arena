
'use client'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import AuthResponseClient from "@/components/user/authresponseclient";

function SearchComponent() {
  const searchParams = useSearchParams()
  return (
    <AuthResponseClient
        code={searchParams.get('code')}
        error={searchParams.get('error')}
    />
  )
}

export default function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
        <SearchComponent/>
    </Suspense>
  )
}
