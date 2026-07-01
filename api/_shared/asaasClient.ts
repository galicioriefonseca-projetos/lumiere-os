export async function asaasRequest(method: string, endpoint: string, body?: any) {
  const apiKey = process.env.ASAAS_API_KEY;
  const baseUrl = process.env.ASAAS_API_URL || "https://sandbox.asaas.com/api/v3";

  if (!apiKey) {
    throw new Error("Chave de API do Asaas (ASAAS_API_KEY) não configurada no servidor.");
  }

  const url = `${baseUrl}${endpoint}`;
  
  const maskedKey = apiKey.substring(0, 12) + "*".repeat(Math.max(0, apiKey.length - 12));
  console.log(`[Vercel Serverless Log] ASAAS_API_URL=${baseUrl}`);
  console.log(`[Vercel Serverless Log] ASAAS_API_KEY=${maskedKey}`);
  console.log(`[Vercel Serverless Log] Calling API: ${method} ${url}`);
  
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "access_token": apiKey,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await response.text();

  console.log(`[Vercel Serverless Log] HTTP status: ${response.status}`);
  if (!response.ok) {
    console.log(`[Vercel Serverless Log] Error body: ${text}`);
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error(`Resposta HTTP do Asaas inválida ou malformada: ${text}`);
  }

  if (!response.ok) {
    const errorMsg = data?.errors?.[0]?.description || data?.message || text;
    throw new Error(`Erro na API do Asaas (${response.status}): ${errorMsg}`);
  }

  return data;
}
