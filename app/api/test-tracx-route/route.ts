// /app/api/test-tracx/route.ts

import { TracxLogisClient } from '@/lib/tracx-client';

export async function GET() {
  const client = new TracxLogisClient({
    apiKey: 'QXAPIV1WUuovTlKz9HL51LPtw62ov_g_1_Eiey8wB11',
    apiEndpoint: 'https://api.tracxlogis.com'
  });

//   const result = await client.createInventory({});

//   return Response.json(result);
}