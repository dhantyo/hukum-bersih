import { RouterProvider } from '@tanstack/solid-router';
import { createAppRouter } from './router';
import './App.css';

const router = createAppRouter();

export default function App() {
  return <RouterProvider router={router} />;
}
