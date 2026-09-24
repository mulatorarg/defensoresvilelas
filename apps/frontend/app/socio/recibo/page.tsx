'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getMemberReceipt } from '@/lib/api';
import type { PaymentReceipt } from '@/lib/types';
import { errorText } from '@/lib/queries';
import { Providers } from '@/components/Providers';
import { ReceiptView } from '@/components/receipt/ReceiptView';

function MemberReceipt() {
  const id = useSearchParams().get('id') ?? '';
  const receipt = useQuery<PaymentReceipt>({
    queryKey: ['member', 'receipt', id],
    queryFn: () => getMemberReceipt(id),
    enabled: Boolean(id),
  });

  const back = (
    <Link href="/socio/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Volver al portal
    </Link>
  );

  if (!id) return <p className="text-sm text-red-600">Falta el identificador del pago.</p>;
  if (receipt.isPending) return <div className="h-96 animate-pulse rounded-2xl bg-gray-200/60" aria-busy="true" />;
  if (receipt.isError)
    return (
      <div className="space-y-4">
        {back}
        <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {errorText(receipt.error, 'No se pudo cargar el recibo')}
        </p>
      </div>
    );
  return <ReceiptView receipt={receipt.data} back={back} />;
}

export default function SocioReciboPage() {
  return (
    <Providers>
      <main className="min-h-screen bg-[#f4f6f5] px-4 py-8 print:bg-white print:p-0">
        <div className="mx-auto max-w-2xl">
          <Suspense fallback={null}>
            <MemberReceipt />
          </Suspense>
        </div>
      </main>
    </Providers>
  );
}
