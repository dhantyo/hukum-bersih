import { QueryClientProvider } from "@tanstack/solid-query";
import { RouterProvider } from "@tanstack/solid-router";

import { createQueryClient } from "./lib/queries";
import { createAppRouter } from "./router";

import "./styles/base.css";

const queryClient = createQueryClient();
const router = createAppRouter(queryClient);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <RouterProvider router={router} />
  </QueryClientProvider>
);

export default App;
