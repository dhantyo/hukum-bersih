import { QueryClientProvider } from '@tanstack/solid-query';
import { RouterProvider } from '@tanstack/solid-router';
import { createAppRouter } from './router';
import { createQueryClient } from './lib/queries';
import './App.css';

const queryClient = createQueryClient();
const router = createAppRouter(queryClient);

export default function App() {
  return <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>;
}
