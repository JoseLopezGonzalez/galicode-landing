import Image from "next/image"

// viewBox="0 0 679.94 200.88" → aspect ratio ≈ 3.38:1
export function Logo() {
  return (
    <div className="flex items-center justify-center">
      <Image
        src="/logo.svg"
        alt="Galicode Vigo"
        width={200}
        height={59}
        priority
        className="h-auto w-72 sm:w-[420px] md:w-[520px]"
      />
    </div>
  )
}
