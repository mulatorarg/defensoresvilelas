'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { getPaymentReceipt } from '@/lib/api';
import type { PaymentReceipt } from '@/lib/types';
import { qk } from '@/lib/queries';
import { ErrorState, SkeletonRows } from '@/components/ui/States';
import { ReceiptView } from '@/components/receipt/ReceiptView';

function Receipt() {
  const id = useSearchParams().get('id') ?? '';
  const receipt = useQuery<PaymentReceipt>({
    queryKey: qk.receipt(id),
    queryFn: () => getPaymentReceipt(id),
    enabled: Boolean(id),
  });

  if (!id) return <p className="text-sm text-red-600">Falta el identificador del pago.</p>;
  if (receipt.isPending) return <SkeletonRows count={1} height="h-96" />;
  if (receipt.isError) return <ErrorState error={receipt.error} onRetry={() => receipt.refetch()} />;

  return (
    <ReceiptView
      receipt={receipt.data}
      back={
        <Link href="/admin/cuotas/" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Volver a cuotas
        </Link>
      }
    />
  );
}

export default function ReciboPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <Suspense fallback={<SkeletonRows count={1} height="h-96" />}>
        <Receipt />
      </Suspense>
    </div>
  );
}
