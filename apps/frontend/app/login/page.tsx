import { Suspense } from 'react';
import LoginForm from './LoginForm';

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-gray-100">
          <div className="text-gray-600">Cargando...</div>
        </main>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
